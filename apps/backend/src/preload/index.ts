import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type AppInfo,
  type AssistantState,
  type ProviderInput,
  type ProviderSummary,
  type ProviderTestResult,
  type ChatInput,
  type ChatResult,
  type KnowledgeResult,
  type KnowledgeStatus,
  type MemoryInput,
  type MemoryItem,
  type NoticeSnapshot,
  type NoticeDetail,
  type FeasibilityAssessment,
  type TenderFileStatus,
  type VoiceStatus,
  type WakeSource,
  type ApprovalInput,
  type ApprovalRequest,
  type CalendarEvent,
  type ProposalInput,
  type ProposalExportResult,
  type JarvisDesktopApi
} from '@jarvis/contracts'

const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC_CHANNELS.appInfo),
  showWindow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.showWindow),
  hideWindow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.hideWindow),
  setAssistantState: (state: AssistantState): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.assistantState, state),
  listProviders: (): Promise<ProviderSummary[]> => ipcRenderer.invoke(IPC_CHANNELS.providersList),
  saveProvider: (input: ProviderInput): Promise<ProviderSummary> =>
    ipcRenderer.invoke(IPC_CHANNELS.providersSave, input),
  testProvider: (id: string): Promise<ProviderTestResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.providersTest, id),
  activateProvider: (id: string): Promise<ProviderSummary[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.providersActivate, id),
  sendChat: (input: ChatInput): Promise<ChatResult> => ipcRenderer.invoke(IPC_CHANNELS.chatSend, input),
  getKnowledgeStatus: (): Promise<KnowledgeStatus> => ipcRenderer.invoke(IPC_CHANNELS.knowledgeStatus),
  rebuildKnowledgeIndex: (): Promise<KnowledgeStatus> => ipcRenderer.invoke(IPC_CHANNELS.knowledgeReindex),
  searchKnowledge: (query: string): Promise<KnowledgeResult[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.knowledgeSearch, query),
  listMemories: (query = ''): Promise<MemoryItem[]> => ipcRenderer.invoke(IPC_CHANNELS.memoriesList, query),
  saveMemory: (input: MemoryInput): Promise<MemoryItem> => ipcRenderer.invoke(IPC_CHANNELS.memoriesSave, input),
  listNotices: (): Promise<NoticeSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.noticesList),
  refreshNotices: (): Promise<NoticeSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.noticesRefresh),
  getNoticeDetail: (noticeId: string): Promise<NoticeDetail> =>
    ipcRenderer.invoke(IPC_CHANNELS.noticesDetail, noticeId),
  runFeasibility: (noticeId: string): Promise<FeasibilityAssessment> =>
    ipcRenderer.invoke(IPC_CHANNELS.feasibilityRun, noticeId),
  getFeasibility: (noticeId: string): Promise<FeasibilityAssessment | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.feasibilityGet, noticeId),
  getTenderFileStatus: (noticeId: string): Promise<TenderFileStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.tenderFileStatus, noticeId),
  downloadTenderFile: (noticeId: string): Promise<TenderFileStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.tenderFileDownload, noticeId),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.openExternal, url),
  wakeAssistant: (source: WakeSource = 'button'): Promise<{ triggered: boolean; status: VoiceStatus }> =>
    ipcRenderer.invoke(IPC_CHANNELS.voiceWake, source),
  getVoiceStatus: (): Promise<VoiceStatus> => ipcRenderer.invoke(IPC_CHANNELS.voiceStatus),
  setListeningEnabled: (enabled: boolean): Promise<VoiceStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.voiceSetListening, enabled),
  listApprovals: (): Promise<ApprovalRequest[]> => ipcRenderer.invoke(IPC_CHANNELS.approvalsList),
  requestApproval: (input: ApprovalInput): Promise<ApprovalRequest> =>
    ipcRenderer.invoke(IPC_CHANNELS.approvalsRequest, input),
  decideApproval: (id: string, approved: boolean): Promise<ApprovalRequest> =>
    ipcRenderer.invoke(IPC_CHANNELS.approvalsDecide, id, approved),
  readCalendar: (approvalId: string): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.calendarRead, approvalId),
  exportProposal: (input: ProposalInput): Promise<ProposalExportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.proposalExport, input),
  onWake: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(IPC_CHANNELS.assistantWake, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.assistantWake, handler)
    }
  },
  onVoiceStatus: (callback: (status: VoiceStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: VoiceStatus): void => callback(status)
    ipcRenderer.on(IPC_CHANNELS.voiceStatus, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.voiceStatus, handler)
    }
  }
} satisfies JarvisDesktopApi

contextBridge.exposeInMainWorld('jarvis', api)
