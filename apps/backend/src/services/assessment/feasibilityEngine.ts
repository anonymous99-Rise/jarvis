import type {
  FeasibilityAssessment,
  HardGate,
  HardGateName,
  NoticeDetail,
  ProcurementNotice,
  SourcedFact
} from '@jarvis/contracts'
import {
  getCompanyCapabilitySnapshot,
  type CompanyCapabilitySnapshot
} from './companyCapabilityProvider'

export type FeasibilityOptions = {
  now?: () => Date
  loadCompanyCapabilities?: (notice: ProcurementNotice) => Promise<CompanyCapabilitySnapshot>
}

const GATE_ORDER: HardGateName[] = [
  '资格', '案例时限', '厂商授权', '演示环境', '地域交付', '截止时间', '预算结构'
]

const ACTIONS: Record<HardGateName, string> = {
  资格: '逐条对照招标文件资格条款，补齐营业执照、资质证书等原件证明。',
  案例时限: '核对类似项目的合同、验收材料和业绩年限要求。',
  厂商授权: '向相关厂商确认授权范围、有效期和原件出具时间。',
  演示环境: '确认演示环境、测试数据和现场演示要求，并安排负责人。',
  地域交付: '确认项目所在地的交付团队、驻场周期和服务响应要求。',
  截止时间: '以官网原文复核报名与投标截止时间，并倒排材料准备计划。',
  预算结构: '获取招标文件中的分项预算、报价表和最高限价要求。'
}

const DETAIL_FIELDS: Array<keyof Omit<NoticeDetail, 'noticeId'>> = [
  'projectCode', 'budget', 'buyer', 'constructionSummary', 'qualification',
  'registrationDeadline', 'bidDeadline'
]

function gate(name: HardGateName, result: HardGate['result'], reason: string): HardGate {
  return { name, result, reason }
}

function requirementText(detail: NoticeDetail): string {
  return `${detail.qualification.value} ${detail.constructionSummary.value}`
}

function hasRequirement(detail: NoticeDetail, pattern: RegExp): boolean {
  return pattern.test(requirementText(detail))
}

function explicitNoRequirement(detail: NoticeDetail, pattern: RegExp): boolean {
  const text = requirementText(detail)
  if (!detail.qualification.value || !detail.constructionSummary.value) return false
  return pattern.test(text) && /无需|不要求|无(?:需|特殊)|不设/.test(text)
}

function capabilityReason(
  capabilities: CompanyCapabilitySnapshot,
  name: HardGateName,
  fallback: string
): string {
  const matches = capabilities.evidenceByGate[name]
  return matches.length > 0
    ? `本机公司资料中找到 ${matches.length} 条相关线索，但都须核验原件后才能作为通过依据。`
    : fallback
}

function parseDeadline(value: string): Date | null {
  const match = value.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})(?:\s*[日号])?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (!match) return null
  const [, year, month, day, hour = '23', minute = '59', second = '59'] = match
  const result = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  return Number.isNaN(result.getTime()) ? null : result
}

function collectEvidence(detail: NoticeDetail, internalEvidence: SourcedFact[]): SourcedFact[] {
  const seen = new Set<string>()
  return [
    ...DETAIL_FIELDS.map((field) => detail[field]).filter((fact) => fact.value),
    ...internalEvidence
  ].filter((fact) => {
    const key = `${fact.value}\n${fact.sourceUrl}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * 按七类硬门槛生成保守诊断。结论由缺口和明确失败规则决定，不计算投标成功分数。
 * confidence 表示已有硬门槛证据覆盖比例，不代表中标概率。
 */
export async function runFeasibilityAssessment(
  notice: ProcurementNotice,
  detail: NoticeDetail,
  options: FeasibilityOptions = {}
): Promise<FeasibilityAssessment> {
  const now = options.now?.() ?? new Date()
  const capabilities = await (options.loadCompanyCapabilities ?? getCompanyCapabilitySnapshot)(notice)
  const requirements = requirementText(detail)
  const dateText = detail.bidDeadline.value || notice.deadline
  const parsedDeadline = parseDeadline(dateText)

  const hardGates: HardGate[] = [
    gate('资格', explicitNoRequirement(detail, /资格|资质/)
      ? 'pass' : 'unknown',
    detail.qualification.value
      ? capabilityReason(capabilities, '资格', '公告列出资格条件，但本机资料中未找到可用资质证明。')
      : '公告详情未提供资格条件，暂不能判断。'),

    gate('案例时限', explicitNoRequirement(detail, /案例|业绩/)
      ? 'pass'
      : hasRequirement(detail, /近\s*\d+\s*年|类似项目|同类业绩|案例|业绩/)
        ? 'unknown' : detail.qualification.value && detail.constructionSummary.value ? 'pass' : 'unknown',
    /近\s*\d+\s*年|类似项目|同类业绩|案例|业绩/.test(requirements)
      ? capabilityReason(capabilities, '案例时限', '公告要求类似项目业绩，但本机资料中未找到匹配案例证明。')
      : '尚未从完整公告详情确认业绩时限要求。'),

    gate('厂商授权', explicitNoRequirement(detail, /厂商授权|原厂授权/)
      ? 'pass'
      : hasRequirement(detail, /厂商授权|原厂授权|授权函/)
        ? 'unknown' : detail.qualification.value && detail.constructionSummary.value ? 'pass' : 'unknown',
    /厂商授权|原厂授权|授权函/.test(requirements)
      ? capabilityReason(capabilities, '厂商授权', '公告涉及厂商授权，本机资料中未找到可用授权证明。')
      : '尚未从完整公告详情确认是否要求厂商授权。'),

    gate('演示环境', explicitNoRequirement(detail, /演示环境|现场演示|样机演示/)
      ? 'pass'
      : hasRequirement(detail, /演示环境|现场演示|样机演示/)
        ? 'unknown' : detail.qualification.value && detail.constructionSummary.value ? 'pass' : 'unknown',
    /演示环境|现场演示|样机演示/.test(requirements)
      ? capabilityReason(capabilities, '演示环境', '公告包含演示要求，本机资料中未找到环境或演示证明。')
      : '尚未从完整公告详情确认演示环境要求。'),

    gate('地域交付', explicitNoRequirement(detail, /本地化服务|驻场|本地团队/)
      ? 'pass'
      : hasRequirement(detail, /本地化服务|驻场|本地团队|现场服务/)
        ? 'unknown' : detail.qualification.value && detail.constructionSummary.value ? 'pass' : 'unknown',
    /本地化服务|驻场|本地团队|现场服务/.test(requirements)
      ? capabilityReason(capabilities, '地域交付', '公告涉及地域交付要求，本机资料中未找到当地服务证明。')
      : '尚未从完整公告详情确认地域交付要求。'),

    !parsedDeadline
      ? gate('截止时间', 'unknown', '未取得可解析的投标截止时间，需以官网原文核验。')
      : parsedDeadline.getTime() <= now.getTime()
        ? gate('截止时间', 'fail', `投标截止时间 ${dateText} 已经过期。`)
        : gate('截止时间', 'pass', `公告截止时间为 ${dateText}，当前尚未过期；仍需在官网复核。`),

    gate('预算结构', detail.budget.status === 'verified'
      && /(?:分项预算|分项报价).*(?:已核验|已明确)|(?:无需|不要求).*(?:分项预算|分项报价)/.test(
        `${detail.budget.value} ${requirements}`
      ) ? 'pass' : 'unknown',
    detail.budget.value
      ? '公告已给出预算金额；分项预算与报价约束仍需从招标文件核实。'
      : capabilityReason(capabilities, '预算结构', '公告详情未提供预算金额和分项结构，本机资料中也未找到可用预算依据。'))
  ]

  const risks = hardGates
    .filter((item) => item.result === 'unknown')
    .map((item) => `${item.name}：${item.reason}`)
  if (capabilities.abandoned) risks.unshift(capabilities.abandonmentReason)
  if (hardGates.some((item) => item.result === 'unknown')) {
    risks.push('证据覆盖率仅表示硬门槛证据完整程度，不代表投标成功概率。')
  }

  const hasFailure = hardGates.some((item) => item.result === 'fail')
  const hasUnknown = hardGates.some((item) => item.result === 'unknown')
  const conclusion = capabilities.abandoned || hasFailure
    ? '不建议参与'
    : hasUnknown
      ? '进一步核实'
      : '建议参与'
  const knownGates = hardGates.filter((item) => item.result !== 'unknown').length

  return {
    noticeId: notice.id,
    conclusion,
    confidence: Math.round((knownGates / GATE_ORDER.length) * 100) / 100,
    hardGates: GATE_ORDER.map((name) => hardGates.find((item) => item.name === name)!),
    risks,
    evidence: collectEvidence(detail, capabilities.evidence),
    recommendedActions: capabilities.abandoned
      ? ['保持禁投状态；如需重新评估，由业务负责人先确认是否撤销放弃记录。']
      : hardGates
        .filter((item) => item.result === 'unknown' || item.result === 'fail')
        .map((item) => ACTIONS[item.name]),
    assessedAt: now.toISOString()
  }
}
