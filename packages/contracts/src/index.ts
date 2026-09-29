export const IPC_CHANNELS = {
  appInfo: 'app:info',
  showWindow: 'window:show',
  hideWindow: 'window:hide',
  assistantState: 'assistant:state',
  assistantWake: 'assistant:wake',
  providersList: 'providers:list',
  providersSave: 'providers:save',
  providersTest: 'providers:test',
  providersActivate: 'providers:activate',
  chatSend: 'chat:send',
  knowledgeStatus: 'knowledge:status',
  knowledgeSearch: 'knowledge:search',
  knowledgeReindex: 'knowledge:reindex',
  memoriesList: 'memories:list',
  memoriesSave: 'memories:save',
  noticesList: 'notices:list',
  noticesRefresh: 'notices:refresh',
  noticesDetail: 'notices:detail',
  feasibilityRun: 'feasibility:run',
  feasibilityGet: 'feasibility:get',
  tenderFileStatus: 'tender-file:status',
  tenderFileDownload: 'tender-file:download',
  openExternal: 'app:open-external',
  voiceWake: 'voice:wake',
  voiceStatus: 'voice:status',
  voiceSetListening: 'voice:set-listening',
  approvalsList: 'approvals:list',
  approvalsRequest: 'approvals:request',
  approvalsDecide: 'approvals:decide',
  calendarRead: 'calendar:read',
  proposalExport: 'proposal:export'
} as const

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'task'

export type AppInfo = {
  platform: string
  arch: string
  version: string
}

export type ProviderInput = {
  id?: string
  name: string
  baseUrl: string
  model: string
  apiKey?: string
}

export type ProviderSummary = {
  id: string
  name: string
  baseUrl: string
  model: string
  hasKey: boolean
  keyLast4: string
  active: boolean
  updatedAt: string
}

export type ProviderTestResult = {
  ok: boolean
  message: string
}

export type ChatInput = {
  prompt: string
  speak?: boolean
}

export type ChatResult = {
  content: string
  providerName: string
  model: string
}

export type EvidenceStatus = '已核验证据' | '内部确认' | '待补证明' | '公开信息'

export type KnowledgeStatus = {
  ready: boolean
  root: string
  fileCount: number
  chunkCount: number
  indexedAt: string
  error?: string
}

export type KnowledgeResult = {
  id: string
  title: string
  snippet: string
  source: string
  evidenceStatus: EvidenceStatus
  score: number
}

export type MemoryCategory = 'preference' | 'decision' | 'project' | 'todo'

export type MemoryInput = {
  category: MemoryCategory
  title: string
  content: string
  source?: string
}

export type MemoryItem = MemoryInput & {
  id: string
  createdAt: string
  updatedAt: string
}

export type NoticeSource = 'ccgp' | 'ningxia'

export type NoticeType = '招标公告' | '采购公告' | '采购意向' | '更正公告' | '中标公告' | '其他'

export type ProcurementNotice = {
  id: string
  source: NoticeSource
  sourceName: string
  title: string
  buyer: string
  region: string
  publishedAt: string
  url: string
  projectCode: string
  budget: string
  deadline: string
  noticeType: NoticeType
  relevant: boolean
  matchedKeywords: string[]
}

export type NoticeSourceStatus = {
  source: NoticeSource
  sourceName: string
  ok: boolean
  count: number
  message: string
}

export type NoticeSnapshot = {
  notices: ProcurementNotice[]
  sources: NoticeSourceStatus[]
  refreshedAt: string
}

export type FactStatus = 'verified' | 'pending' | 'missing'

// 每项事实自带来源与核验信息；status 为 missing 时 value 与 sourceUrl 为空字符串
export type SourcedFact = {
  value: string
  sourceUrl: string
  fetchedAt: string
  status: FactStatus
}

export type NoticeDetail = {
  noticeId: string
  projectCode: SourcedFact
  budget: SourcedFact
  buyer: SourcedFact
  constructionSummary: SourcedFact
  qualification: SourcedFact
  registrationDeadline: SourcedFact
  bidDeadline: SourcedFact
}

export type FeasibilityConclusion = '建议参与' | '进一步核实' | '不建议参与'

export type HardGateName =
  | '资格'
  | '案例时限'
  | '厂商授权'
  | '演示环境'
  | '地域交付'
  | '截止时间'
  | '预算结构'

export type HardGateResult = 'pass' | 'fail' | 'unknown'

export type HardGate = {
  name: HardGateName
  result: HardGateResult
  reason: string
}

export type FeasibilityAssessment = {
  noticeId: string
  conclusion: FeasibilityConclusion
  confidence: number // 0~1
  hardGates: HardGate[]
  risks: string[]
  evidence: SourcedFact[]
  recommendedActions: string[]
  assessedAt: string
}

export type TenderFileState =
  | 'not-downloaded'
  | 'downloading'
  | 'downloaded'
  | 'submitted'
  | 'human_action_required'
  | 'blocked'

export type TenderFileStatus = {
  noticeId: string
  state: TenderFileState
  filePath?: string
  sourceUrl?: string
  message?: string
  updatedAt: string
}

export type WakeSource = 'shortcut' | 'button' | 'wakeword'

export type VoicePhase = 'idle' | 'speaking' | 'listening' | 'paused'
export type VoiceEngineState = 'not-installed' | 'starting' | 'ready' | 'error' | 'stopped'

export type VoiceStatus = {
  listeningEnabled: boolean
  phase: VoicePhase
  lastWakeAt: string
  engineState: VoiceEngineState
  engineName: string
  engineModel: string
  error?: string
}

export type ApprovalAction =
  | 'modify'
  | 'delete'
  | 'upload'
  | 'send'
  | 'permission'
  | 'calendar-write'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'consumed' | 'expired'

export type ApprovalInput = {
  action: ApprovalAction
  title: string
  summary: string
  target: string
}

export type ApprovalRequest = ApprovalInput & {
  id: string
  status: ApprovalStatus
  createdAt: string
  expiresAt: string
  decidedAt?: string
}

export type CalendarEvent = {
  id: string
  calendar: string
  title: string
  startAt: string
  endAt: string
  location: string
}

export type ProposalInput = {
  projectName: string
  constructionUnit?: string
  background?: string
  goals?: string
  constructionContent?: string
  investment?: string
}

export type ProposalExportResult = {
  saved: boolean
  path: string
}

export interface JarvisDesktopApi {
  getAppInfo(): Promise<AppInfo>
  showWindow(): Promise<void>
  hideWindow(): Promise<void>
  setAssistantState(state: AssistantState): Promise<void>
  listProviders(): Promise<ProviderSummary[]>
  saveProvider(input: ProviderInput): Promise<ProviderSummary>
  testProvider(id: string): Promise<ProviderTestResult>
  activateProvider(id: string): Promise<ProviderSummary[]>
  sendChat(input: ChatInput): Promise<ChatResult>
  getKnowledgeStatus(): Promise<KnowledgeStatus>
  rebuildKnowledgeIndex(): Promise<KnowledgeStatus>
  searchKnowledge(query: string): Promise<KnowledgeResult[]>
  listMemories(query?: string): Promise<MemoryItem[]>
  saveMemory(input: MemoryInput): Promise<MemoryItem>
  listNotices(): Promise<NoticeSnapshot>
  refreshNotices(): Promise<NoticeSnapshot>
  getNoticeDetail(noticeId: string): Promise<NoticeDetail>
  runFeasibility(noticeId: string): Promise<FeasibilityAssessment>
  getFeasibility(noticeId: string): Promise<FeasibilityAssessment | null>
  getTenderFileStatus(noticeId: string): Promise<TenderFileStatus>
  downloadTenderFile(noticeId: string): Promise<TenderFileStatus>
  openExternal(url: string): Promise<void>
  wakeAssistant(source?: WakeSource): Promise<{ triggered: boolean; status: VoiceStatus }>
  getVoiceStatus(): Promise<VoiceStatus>
  setListeningEnabled(enabled: boolean): Promise<VoiceStatus>
  listApprovals(): Promise<ApprovalRequest[]>
  requestApproval(input: ApprovalInput): Promise<ApprovalRequest>
  decideApproval(id: string, approved: boolean): Promise<ApprovalRequest>
  readCalendar(approvalId: string): Promise<CalendarEvent[]>
  exportProposal(input: ProposalInput): Promise<ProposalExportResult>
  onWake(callback: () => void): () => void
  onVoiceStatus(callback: (status: VoiceStatus) => void): () => void
}
