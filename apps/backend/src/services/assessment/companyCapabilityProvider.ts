import type { HardGateName, KnowledgeResult, ProcurementNotice, SourcedFact } from '@jarvis/contracts'

export type CompanyCapabilityEvidence = Record<HardGateName, SourcedFact[]>

export type CompanyCapabilitySnapshot = {
  evidence: SourcedFact[]
  evidenceByGate: CompanyCapabilityEvidence
  abandoned: boolean
  abandonmentReason: string
}

export type KnowledgeSearch = (query: string) => Promise<KnowledgeResult[]>

const ABANDONMENT_MARKER = /禁投|决定放弃|已放弃|放弃投标|不参与该项目|不再参与/
const CAPABILITY_TOPICS: Array<[HardGateName, RegExp]> = [
  ['资格', /资质|资格|证书|认证/],
  ['案例时限', /案例|业绩|合同|验收/],
  ['厂商授权', /厂商|原厂|授权/],
  ['演示环境', /演示|测试环境|样机/],
  ['地域交付', /地域|本地|驻场|交付团队|服务响应/],
  ['预算结构', /报价|成本|预算|财务/],
  ['截止时间', /响应周期|交付周期|实施周期/]
]

function normalizeProjectText(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}

function isSpecificProjectMatch(result: KnowledgeResult, notice: ProcurementNotice): boolean {
  const text = normalizeProjectText(`${result.title} ${result.snippet}`)
  const code = normalizeProjectText(notice.projectCode)
  const title = normalizeProjectText(notice.title)
  if (code && code !== '详情页待核验' && text.includes(code)) return true
  return title.length >= 8 && text.includes(title)
}

function toPendingEvidence(result: KnowledgeResult): SourcedFact {
  const sourceName = result.source.split(/[\\/]/).pop() || '本机公司资料库'
  return {
    value: `内部确认，待原件核验（资料：${sourceName}）：${result.title}。${result.snippet}`,
    sourceUrl: '',
    fetchedAt: new Date().toISOString(),
    status: 'pending'
  }
}

function emptyEvidenceByGate(): CompanyCapabilityEvidence {
  return {
    资格: [],
    案例时限: [],
    厂商授权: [],
    演示环境: [],
    地域交付: [],
    截止时间: [],
    预算结构: []
  }
}

/**
 * 从本机公司资料索引读取匹配线索；所有内部资料都保持 pending，等待原件核验。
 * 禁投判断必须同时命中明确放弃标记和完整项目名称或项目编号，避免误伤同类项目。
 */
export async function getCompanyCapabilitySnapshot(
  notice: ProcurementNotice,
  search?: KnowledgeSearch
): Promise<CompanyCapabilitySnapshot> {
  try {
    const searchLocalKnowledge = search ?? (await import('../knowledge/knowledgeService')).searchKnowledge
    const query = `${notice.projectCode} ${notice.title} 资质 案例 授权 演示环境 地域交付 禁投 放弃`
      .replace(/详情页待核验/g, '')
      .trim()
    const results = await searchLocalKnowledge(query)
    const companyResults = results.filter((result) => result.evidenceStatus !== '公开信息')
    const evidence = companyResults.slice(0, 8).map(toPendingEvidence)
    const evidenceByGate = emptyEvidenceByGate()
    companyResults.slice(0, 8).forEach((result, index) => {
      const searchText = `${result.title} ${result.snippet}`
      CAPABILITY_TOPICS.forEach(([name, pattern]) => {
        if (pattern.test(searchText)) evidenceByGate[name].push(evidence[index])
      })
    })
    const abandonedResult = companyResults.find((result) =>
      ABANDONMENT_MARKER.test(`${result.title} ${result.snippet}`)
      && isSpecificProjectMatch(result, notice)
    )

    return {
      evidence,
      evidenceByGate,
      abandoned: Boolean(abandonedResult),
      abandonmentReason: abandonedResult
        ? `公司本机记录标注“${abandonedResult.title}”已放弃；内部记录仍需负责人确认。`
        : ''
    }
  } catch {
    // 资料库离线不能阻断诊断，但必须作为证据缺口反映给上层。
    return {
      evidence: [],
      evidenceByGate: emptyEvidenceByGate(),
      abandoned: false,
      abandonmentReason: ''
    }
  }
}
