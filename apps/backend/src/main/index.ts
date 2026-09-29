import { app, dialog, globalShortcut, ipcMain, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { IPC_CHANNELS, type AssistantState, type VoiceStatus, type WakeSource } from '@jarvis/contracts'
import type { ApprovalInput, ChatInput, MemoryInput, ProposalInput, ProviderInput } from '@jarvis/contracts'
import { getKnowledgeStatus, rebuildKnowledgeIndex, searchKnowledge } from '../services/knowledge/knowledgeService'
import { listMemories, saveMemory } from '../services/memory/memoryRepository'
import { activateProvider, listProviders, saveProvider, testProvider } from '../services/models/providerRepository'
import { chatWithActiveProvider } from '../services/models/modelGateway'
import { listNotices, refreshNotices } from '../services/crawler/crawlerService'
import { createTray } from './tray'
import { updateTrayListening } from './tray'
import { createMainWindow, getMainWindow, setQuitting, showMainWindow } from './window'
import { VoiceController } from '../services/voice/voiceController'
import { VoiceSidecarManager } from '../services/voice/sidecarManager'
import type { SidecarEvent } from '../services/voice/sidecarProtocol'
import { ApprovalService } from '../services/approvals/approvalService'
import { readUpcomingCalendarEvents } from '../services/calendar/calendarService'
import { createProposalBuffer } from '../services/documents/proposalDocument'

const allowedStates = new Set<AssistantState>([
  'idle',
  'listening',
  'thinking',
  'speaking',
  'task'
])

const voiceController = new VoiceController(undefined, (status: VoiceStatus) => {
  updateTrayListening(status.listeningEnabled)
  getMainWindow()?.webContents.send(IPC_CHANNELS.voiceStatus, status)
})
const voiceSidecar = new VoiceSidecarManager()
const approvalService = new ApprovalService()

function setListeningEnabled(enabled: boolean): VoiceStatus {
  voiceSidecar.command(enabled ? 'resume' : 'pause')
  return voiceController.setListeningEnabled(enabled)
}

voiceSidecar.on('event', (event: SidecarEvent) => {
  if (event.type === 'ready') {
    voiceController.setEngineState('ready', { engineName: event.engine, engineModel: event.model })
  } else if (event.type === 'wake') {
    void wakeAssistant('wakeword')
  } else if (event.type === 'error') {
    voiceController.setEngineState('error', { error: event.message })
  } else if (event.type === 'stopped') {
    voiceController.setEngineState('stopped')
  }
})

async function wakeAssistant(source: WakeSource): Promise<{ triggered: boolean; status: VoiceStatus }> {
  showMainWindow()
  const result = await voiceController.wake(source)
  if (result.triggered) getMainWindow()?.webContents.send(IPC_CHANNELS.assistantWake)
  return result
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.appInfo, () => ({
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion()
  }))

  ipcMain.handle(IPC_CHANNELS.showWindow, () => showMainWindow())
  ipcMain.handle(IPC_CHANNELS.hideWindow, () => getMainWindow()?.hide())
  ipcMain.handle(IPC_CHANNELS.assistantState, (_event, state: AssistantState) => {
    if (!allowedStates.has(state)) throw new Error('Unsupported assistant state')
  })
  ipcMain.handle(IPC_CHANNELS.providersList, () => listProviders())
  ipcMain.handle(IPC_CHANNELS.providersSave, (_event, input: ProviderInput) => saveProvider(input))
  ipcMain.handle(IPC_CHANNELS.providersTest, (_event, id: string) => testProvider(id))
  ipcMain.handle(IPC_CHANNELS.providersActivate, (_event, id: string) => activateProvider(id))
  ipcMain.handle(IPC_CHANNELS.chatSend, async (_event, input: ChatInput) => {
    const result = await chatWithActiveProvider(input)
    if (input.speak !== false) void voiceController.speakReply(result.content)
    return result
  })
  ipcMain.handle(IPC_CHANNELS.knowledgeStatus, () => getKnowledgeStatus())
  ipcMain.handle(IPC_CHANNELS.knowledgeReindex, () => rebuildKnowledgeIndex())
  ipcMain.handle(IPC_CHANNELS.knowledgeSearch, (_event, query: string) => searchKnowledge(query))
  ipcMain.handle(IPC_CHANNELS.memoriesList, (_event, query: string) => listMemories(query))
  ipcMain.handle(IPC_CHANNELS.memoriesSave, (_event, input: MemoryInput) => saveMemory(input))
  ipcMain.handle(IPC_CHANNELS.noticesList, () => listNotices())
  ipcMain.handle(IPC_CHANNELS.noticesRefresh, () => refreshNotices())
  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, url: string) => {
    const parsed = new URL(url)
    const allowedHosts = new Set(['www.ccgp.gov.cn', 'ccgp.gov.cn', 'www.ccgp-ningxia.gov.cn', 'ccgp-ningxia.gov.cn'])
    if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) {
      throw new Error('只允许打开已核验的政府采购官网链接')
    }
    await shell.openExternal(parsed.toString())
  })
  ipcMain.handle(IPC_CHANNELS.voiceWake, (_event, source: WakeSource) => wakeAssistant(source))
  ipcMain.handle(IPC_CHANNELS.voiceStatus, () => voiceController.getStatus())
  ipcMain.handle(IPC_CHANNELS.voiceSetListening, (_event, enabled: boolean) => {
    if (typeof enabled !== 'boolean') throw new Error('聆听状态参数无效')
    return setListeningEnabled(enabled)
  })
  ipcMain.handle(IPC_CHANNELS.approvalsList, () => approvalService.list())
  ipcMain.handle(IPC_CHANNELS.approvalsRequest, (_event, input: ApprovalInput) => approvalService.request(input))
  ipcMain.handle(IPC_CHANNELS.approvalsDecide, (_event, id: string, approved: boolean) =>
    approvalService.decide(id, approved))
  ipcMain.handle(IPC_CHANNELS.calendarRead, async (_event, approvalId: string) => {
    approvalService.consume(approvalId, 'permission')
    return readUpcomingCalendarEvents()
  })
  ipcMain.handle(IPC_CHANNELS.proposalExport, async (_event, input: ProposalInput) => {
    const suggestedName = `${input.projectName.trim() || '政务信息化项目'}-项目建议书.docx`
    const result = await dialog.showSaveDialog({
      title: '导出可编辑项目建议书',
      defaultPath: suggestedName,
      filters: [{ name: 'Word 文档', extensions: ['docx'] }]
    })
    if (result.canceled || !result.filePath) return { saved: false, path: '' }
    await writeFile(result.filePath, await createProposalBuffer(input), { mode: 0o600 })
    return { saved: true, path: result.filePath }
  })
}

app.whenReady().then(() => {
  registerIpc()
  createMainWindow()
  createTray({
    onQuit: () => app.quit(),
    onToggleListening: () => {
      const current = voiceController.getStatus().listeningEnabled
      setListeningEnabled(!current)
    }
  })

  voiceController.setEngineState('starting')
  if (!voiceSidecar.start({ mode: 'whisper', model: 'tiny' })) {
    voiceController.setEngineState('not-installed', { error: '本地语音运行环境尚未安装' })
  }

  globalShortcut.register('CommandOrControl+Shift+J', () => {
    void wakeAssistant('shortcut')
  })

  app.on('activate', showMainWindow)
})

app.on('before-quit', () => {
  setQuitting(true)
  voiceController.shutdown()
  voiceSidecar.stop()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Keep the process alive in the menu bar until the user chooses Quit.
})
