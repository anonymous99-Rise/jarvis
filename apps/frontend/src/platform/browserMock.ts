import type {
  ApprovalRequest,
  JarvisDesktopApi,
  MemoryItem,
  ProviderSummary,
  VoiceStatus
} from '@jarvis/contracts'

const now = (): string => new Date().toISOString()

export function createBrowserMock(): JarvisDesktopApi {
  const memories: MemoryItem[] = []
  const approvals: ApprovalRequest[] = []
  const wakeListeners = new Set<() => void>()
  const voiceListeners = new Set<(status: VoiceStatus) => void>()
  const providers: ProviderSummary[] = [{
    id: 'frontend-mock',
    name: '前端联调模型（Mock）',
    baseUrl: 'browser-mock://local',
    model: 'jarvis-ui-mock',
    hasKey: false,
    keyLast4: '',
    active: true,
    updatedAt: now()
  }]
  let voiceStatus: VoiceStatus = {
    listeningEnabled: true,
    phase: 'idle',
    lastWakeAt: '',
    engineState: 'ready',
    engineName: '浏览器联调 Mock',
    engineModel: 'no-audio'
  }

  return {
    getAppInfo: async () => ({ platform: 'browser-mock', arch: 'mock', version: 'frontend-dev' }),
    showWindow: async () => undefined,
    hideWindow: async () => undefined,
    setAssistantState: async () => undefined,
    listProviders: async () => providers,
    saveProvider: async (input) => ({
      id: input.id ?? 'frontend-mock',
      name: input.name,
      baseUrl: input.baseUrl,
      model: input.model,
      hasKey: Boolean(input.apiKey),
      keyLast4: input.apiKey?.slice(-4) ?? '',
      active: true,
      updatedAt: now()
    }),
    testProvider: async () => ({ ok: true, message: '前端联调模式未连接真实模型。' }),
    activateProvider: async () => providers,
    sendChat: async (input) => ({
      content: `已收到前端联调指令：“${input.prompt}”。当前未调用真实模型，sir。`,
      providerName: '前端联调模型（Mock）',
      model: 'jarvis-ui-mock'
    }),
    getKnowledgeStatus: async () => ({
      ready: true,
      root: 'browser-mock://knowledge',
      fileCount: 7,
      chunkCount: 84,
      indexedAt: now()
    }),
    rebuildKnowledgeIndex: async () => ({
      ready: true,
      root: 'browser-mock://knowledge',
      fileCount: 7,
      chunkCount: 84,
      indexedAt: now()
    }),
    searchKnowledge: async (query) => [{
      id: `mock-${query}`,
      title: '前端联调示例（非真实资料）',
      snippet: `用于检查“${query}”检索结果的排版，不代表公司事实。`,
      source: 'browser-mock://knowledge/example',
      evidenceStatus: '待补证明',
      score: 1
    }],
    listMemories: async (query = '') => memories.filter((item) =>
      !query || `${item.title} ${item.content}`.includes(query)),
    saveMemory: async (input) => {
      const item: MemoryItem = { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }
      memories.unshift(item)
      return item
    },
    listNotices: async () => ({ notices: [], sources: [], refreshedAt: now() }),
    refreshNotices: async () => ({
      notices: [],
      sources: [
        { source: 'ccgp', sourceName: '中国政府采购网', ok: true, count: 0, message: '前端联调模式' },
        { source: 'ningxia', sourceName: '宁夏政府采购网', ok: true, count: 0, message: '前端联调模式' }
      ],
      refreshedAt: now()
    }),
    openExternal: async () => undefined,
    wakeAssistant: async () => {
      voiceStatus = { ...voiceStatus, phase: 'speaking', lastWakeAt: now() }
      wakeListeners.forEach((listener) => listener())
      voiceListeners.forEach((listener) => listener(voiceStatus))
      return { triggered: true, status: voiceStatus }
    },
    getVoiceStatus: async () => voiceStatus,
    setListeningEnabled: async (enabled) => {
      voiceStatus = { ...voiceStatus, listeningEnabled: enabled, phase: enabled ? 'idle' : 'paused' }
      voiceListeners.forEach((listener) => listener(voiceStatus))
      return voiceStatus
    },
    listApprovals: async () => approvals,
    requestApproval: async (input) => {
      const request: ApprovalRequest = {
        ...input,
        id: crypto.randomUUID(),
        status: 'pending',
        createdAt: now(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
      approvals.unshift(request)
      return request
    },
    decideApproval: async (id, approved) => {
      const request = approvals.find((item) => item.id === id)
      if (!request) throw new Error('前端联调审批请求不存在')
      request.status = approved ? 'approved' : 'rejected'
      request.decidedAt = now()
      return request
    },
    readCalendar: async () => [],
    exportProposal: async () => ({ saved: false, path: '' }),
    onWake: (callback) => {
      wakeListeners.add(callback)
      return () => wakeListeners.delete(callback)
    },
    onVoiceStatus: (callback) => {
      voiceListeners.add(callback)
      return () => voiceListeners.delete(callback)
    }
  }
}

export function installBrowserMock(): void {
  if (import.meta.env.DEV && !window.jarvis) window.jarvis = createBrowserMock()
}
