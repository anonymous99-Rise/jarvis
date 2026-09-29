import type {
  ApprovalRequest,
  JarvisDesktopApi,
  MemoryItem,
  ProcurementNotice,
  ProviderSummary,
  SourcedFact,
  TenderFileStatus,
  VoiceStatus
} from '@jarvis/contracts'

const now = (): string => new Date().toISOString()
const SAMPLE_CAPTURED_AT = '2026-09-29T10:12:00+08:00'

export function createBrowserMock(): JarvisDesktopApi {
  const mockFact = (
    noticeId: string,
    value: string,
    status: SourcedFact['status'],
    sourceUrl = `browser-mock://notices/${noticeId}`
  ): SourcedFact => ({
    value,
    sourceUrl: status === 'missing' ? '' : sourceUrl,
    fetchedAt: SAMPLE_CAPTURED_AT,
    status
  })

  const sampleNotices: ProcurementNotice[] = [
    {
      id: 'ccgp-demo-2026-001',
      source: 'ccgp',
      sourceName: '中国政府采购网',
      title: '联调示例：政务服务人工智能辅助决策平台采购',
      buyer: '联调示例采购单位（非真实单位）',
      region: '全国',
      publishedAt: '2026-09-25',
      url: 'https://browser-mock.ccgp.gov.cn/demo-001',
      projectCode: 'CCGP-MOCK-2026-001',
      budget: '300 万元（联调示例）',
      deadline: '2026-10-30 09:00',
      noticeType: '招标公告',
      relevant: true,
      matchedKeywords: ['人工智能', '政务信息化', '辅助决策']
    },
    {
      id: 'ningxia-demo-2026-002',
      source: 'ningxia',
      sourceName: '宁夏政府采购网',
      title: '联调示例：公共数据治理与共享交换平台建设',
      buyer: '联调示例采购单位（非真实单位）',
      region: '宁夏',
      publishedAt: '2026-09-24',
      url: 'https://browser-mock.nxggzy.org.cn/demo-002',
      projectCode: 'NX-MOCK-2026-002',
      budget: '450 万元（联调示例）',
      deadline: '2026-11-05 10:00',
      noticeType: '采购公告',
      relevant: true,
      matchedKeywords: ['数据治理', '信息共享', '政务平台']
    }
  ]

  const memories: MemoryItem[] = []
  const approvals: ApprovalRequest[] = []
  const tenderFileStatuses = new Map<string, TenderFileStatus>()
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
    listNotices: async () => ({
      notices: sampleNotices,
      sources: [
        { source: 'ccgp', sourceName: '中国政府采购网', ok: true, count: 1, message: '前端联调示例' },
        { source: 'ningxia', sourceName: '宁夏政府采购网', ok: true, count: 1, message: '前端联调示例' }
      ],
      refreshedAt: SAMPLE_CAPTURED_AT
    }),
    refreshNotices: async () => ({
      notices: sampleNotices,
      sources: [
        { source: 'ccgp', sourceName: '中国政府采购网', ok: true, count: 1, message: '前端联调示例' },
        { source: 'ningxia', sourceName: '宁夏政府采购网', ok: true, count: 1, message: '前端联调示例' }
      ],
      refreshedAt: now()
    }),
    getNoticeDetail: async (noticeId) => {
      if (noticeId === 'ccgp-demo-2026-001') {
        return {
          noticeId,
          projectCode: mockFact(noticeId, 'CCGP-MOCK-2026-001', 'verified',
            'https://browser-mock.ccgp.gov.cn/demo-001'),
          budget: mockFact(noticeId, '300 万元（联调示例，非真实预算）', 'verified',
            'https://browser-mock.ccgp.gov.cn/demo-001'),
          buyer: mockFact(noticeId, '联调示例采购单位（非真实单位）', 'verified',
            'https://browser-mock.ccgp.gov.cn/demo-001'),
          constructionSummary: mockFact(noticeId,
            '联调示例建设内容：建设政务人工智能辅助决策平台，包含数据接入、模型推理、可视化决策与运营辅助模块。仅供排版检查，不代表公司事实。',
            'verified', 'https://browser-mock.ccgp.gov.cn/demo-001'),
          qualification: mockFact(noticeId, '', 'missing'),
          registrationDeadline: mockFact(noticeId, '2026-10-15 17:30（联调示例）', 'pending',
            'https://browser-mock.ccgp.gov.cn/demo-001'),
          bidDeadline: mockFact(noticeId, '2026-10-30 09:00（联调示例）', 'verified',
            'https://browser-mock.ccgp.gov.cn/demo-001')
        }
      }
      return {
        noticeId,
        projectCode: mockFact(noticeId, 'NX-MOCK-2026-002', 'verified',
          'https://browser-mock.nxggzy.org.cn/demo-002'),
        budget: mockFact(noticeId, '450 万元（联调示例，非真实预算）', 'verified',
          'https://browser-mock.nxggzy.org.cn/demo-002'),
        buyer: mockFact(noticeId, '联调示例采购单位（非真实单位）', 'pending',
          'https://browser-mock.nxggzy.org.cn/demo-002'),
        constructionSummary: mockFact(noticeId,
          '联调示例建设内容：公共数据治理、共享交换与平台基础能力建设。详见招标文件。',
          'pending', 'https://browser-mock.nxggzy.org.cn/demo-002'),
        qualification: mockFact(noticeId, '', 'missing'),
        registrationDeadline: mockFact(noticeId, '2026-10-20 17:00（联调示例）', 'pending',
          'https://browser-mock.nxggzy.org.cn/demo-002'),
        bidDeadline: mockFact(noticeId, '2026-11-05 10:00（联调示例）', 'verified',
          'https://browser-mock.nxggzy.org.cn/demo-002')
      }
    },
    runFeasibility: async (noticeId) => {
      if (noticeId === 'ccgp-demo-2026-001') {
        return {
          noticeId,
          conclusion: '建议参与',
          confidence: 0.78,
          hardGates: [
            { name: '资格', result: 'pass', reason: '联调示例：注册资本、营业执照及行业资质满足公告要求。' },
            { name: '案例时限', result: 'pass', reason: '联调示例：近三年具备类似规模政务平台案例。' },
            { name: '厂商授权', result: 'fail', reason: '联调示例：尚未取得拟采用模型厂商的有效授权。' },
            { name: '演示环境', result: 'pass', reason: '联调示例：本地联调环境可承担演示。' },
            { name: '地域交付', result: 'pass', reason: '联调示例：承诺本地化交付团队。' },
            { name: '截止时间', result: 'pass', reason: '联调示例：距投标截止仍有充足准备时间。' },
            { name: '预算结构', result: 'pass', reason: '联调示例：预算分项与建设内容匹配。' }
          ],
          risks: [
            '联调示例风险：厂商授权未落实，需尽快与原厂对接。'
          ],
          evidence: [
            mockFact(noticeId, '公告预算 300 万元（联调示例）。', 'verified',
              'https://browser-mock.ccgp.gov.cn/demo-001'),
            mockFact(noticeId, '近三年类似案例清单（内部确认）。', 'verified',
              'browser-mock://company/cases'),
            mockFact(noticeId, '厂商授权函待原件核验。', 'pending',
              'browser-mock://company/vendor')
          ],
          recommendedActions: [
            '联调示例：48 小时内联系厂商启动授权函流转。',
            '联调示例：与采购人沟通答疑，确认评分项权重。'
          ],
          assessedAt: now()
        }
      }
      return {
        noticeId,
        conclusion: '进一步核实',
        confidence: 0.55,
        hardGates: [
          { name: '资格', result: 'pass', reason: '联调示例：基础资质满足。' },
          { name: '案例时限', result: 'fail', reason: '联调示例：近三年宁夏本地类似案例不足。' },
          { name: '厂商授权', result: 'fail', reason: '联调示例：未确认是否需要原厂授权。' },
          { name: '演示环境', result: 'pass', reason: '联调示例：可远程演示。' },
          { name: '地域交付', result: 'fail', reason: '联调示例：尚未确认本地常驻交付能力。' },
          { name: '截止时间', result: 'pass', reason: '联调示例：时间充裕。' },
          { name: '预算结构', result: 'pass', reason: '联调示例：预算结构与建设内容基本对应。' }
        ],
        risks: [
          '联调示例风险：宁夏本地案例与交付能力均需补充证明。'
        ],
        evidence: [
          mockFact(noticeId, '公告预算 450 万元（联调示例）。', 'verified',
            'https://browser-mock.nxggzy.org.cn/demo-002'),
          mockFact(noticeId, '本地交付团队证明待补。', 'pending',
            'browser-mock://company/local-team')
        ],
        recommendedActions: [
          '联调示例：联系宁夏本地合作伙伴确认联合体与案例归属。',
          '联调示例：向采购人书面答疑，澄清授权与案例要求。'
        ],
        assessedAt: now()
      }
    },
    getFeasibility: async () => null,
    getTenderFileStatus: async (noticeId) => tenderFileStatuses.get(noticeId) ?? ({
      noticeId,
      state: 'not-downloaded',
      message: '前端联调模式：未接入真实招标文件下载。',
      updatedAt: now()
    }),
    downloadTenderFile: async (noticeId) => {
      const notice = sampleNotices.find((item) => item.id === noticeId)
      const status: TenderFileStatus = {
        noticeId,
        state: 'human_action_required',
        sourceUrl: notice?.url,
        message: '前端联调模式不会访问真实官网或保存文件，请在官网人工核验。',
        updatedAt: now()
      }
      tenderFileStatuses.set(noticeId, status)
      return status
    },
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
