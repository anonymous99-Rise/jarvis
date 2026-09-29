import { describe, expect, it } from 'vitest'
import type { KnowledgeResult, NoticeDetail, ProcurementNotice, SourcedFact } from '@jarvis/contracts'
import { runFeasibilityAssessment } from '../apps/backend/src/services/assessment/feasibilityEngine'
import { getCompanyCapabilitySnapshot } from '../apps/backend/src/services/assessment/companyCapabilityProvider'

const notice: ProcurementNotice = {
  id: 'nx-2026-001',
  source: 'ningxia',
  sourceName: '宁夏政府采购网',
  title: '政务数据治理平台升级项目招标公告',
  buyer: '详情页待核验',
  region: '宁夏',
  publishedAt: '2026-09-29',
  url: 'https://www.ccgp-ningxia.gov.cn/notice/1',
  projectCode: 'NX-2026-001',
  budget: '详情页待核验',
  deadline: '2026-11-05 10:00',
  noticeType: '招标公告',
  relevant: true,
  matchedKeywords: ['数据治理']
}

const fact = (value: string, status: SourcedFact['status'] = 'verified'): SourcedFact => ({
  value,
  sourceUrl: value ? notice.url : '',
  fetchedAt: value ? '2026-09-29T02:00:00.000Z' : '',
  status: value ? status : 'missing'
})

const detail: NoticeDetail = {
  noticeId: notice.id,
  projectCode: fact(notice.projectCode),
  budget: fact('500 万元', 'pending'),
  buyer: fact('采购单位示例', 'pending'),
  constructionSummary: fact('建设政务数据治理平台，包含数据交换和治理服务。', 'pending'),
  qualification: fact('具备相关信息系统建设资质；近三年有同类项目案例。', 'pending'),
  registrationDeadline: fact('2026-10-20 17:00', 'pending'),
  bidDeadline: fact(notice.deadline, 'pending')
}

const fixedNow = (): Date => new Date('2026-09-29T10:00:00+08:00')

const emptyCapabilities = () => ({
  evidence: [],
  evidenceByGate: {
    资格: [], 案例时限: [], 厂商授权: [], 演示环境: [], 地域交付: [], 截止时间: [], 预算结构: []
  },
  abandoned: false,
  abandonmentReason: ''
})

function knowledgeResult(
  title: string,
  snippet: string,
  evidenceStatus: KnowledgeResult['evidenceStatus'] = '内部确认'
): KnowledgeResult {
  return { id: title, title, snippet, source: '06_internal-confirmed.md', evidenceStatus, score: 5 }
}

describe('可投性规则诊断', () => {
  it('按固定顺序检查七类硬门槛，关键证据缺失时结论为进一步核实', async () => {
    const assessment = await runFeasibilityAssessment(notice, detail, {
      now: fixedNow,
      loadCompanyCapabilities: async () => emptyCapabilities()
    })

    expect(assessment.conclusion).toBe('进一步核实')
    expect(assessment.hardGates.map((item) => item.name)).toEqual([
      '资格', '案例时限', '厂商授权', '演示环境', '地域交付', '截止时间', '预算结构'
    ])
    expect(assessment.hardGates.some((item) => item.result === 'unknown')).toBe(true)
    expect(assessment.confidence).toBeLessThan(1)
    expect(assessment.risks.some((risk) => risk.includes('不代表投标成功概率'))).toBe(true)
  })

  it('截止时间已过时明确判为不建议参与', async () => {
    const expired = { ...detail, bidDeadline: fact('2026-09-01 09:00', 'verified') }
    const assessment = await runFeasibilityAssessment(notice, expired, {
      now: fixedNow,
      loadCompanyCapabilities: async () => emptyCapabilities()
    })
    expect(assessment.conclusion).toBe('不建议参与')
    expect(assessment.hardGates.find((item) => item.name === '截止时间')?.result).toBe('fail')
  })

  it('只有资格要求明确免除且七类证据齐备时才给出建议参与', async () => {
    const complete: NoticeDetail = {
      ...detail,
      budget: fact('分项预算已核验：无需分项报价', 'verified'),
      qualification: fact('本项目无特殊资格要求，无需类似案例，无需原厂授权，无需现场演示，无需驻场。'),
      constructionSummary: fact('建设内容明确；无需原厂授权、无需现场演示、无需驻场。'),
      bidDeadline: fact('2026-11-05 10:00')
    }
    const assessment = await runFeasibilityAssessment(notice, complete, {
      now: fixedNow,
      loadCompanyCapabilities: async () => emptyCapabilities()
    })
    expect(assessment.conclusion).toBe('建议参与')
    expect(assessment.confidence).toBe(1)
    expect(assessment.hardGates.every((item) => item.result === 'pass')).toBe(true)
  })

  it('匹配到明确放弃记录时保持禁投，不推荐重新参与', async () => {
    const abandoned = knowledgeResult('项目放弃记录', `${notice.title}，业务负责人决定放弃投标。`)
    const capabilities = await getCompanyCapabilitySnapshot(notice, async () => [abandoned])
    expect(capabilities.abandoned).toBe(true)
    expect(capabilities.evidence[0].status).toBe('pending')
    expect(capabilities.evidence[0].value).toContain('内部确认，待原件核验')

    const assessment = await runFeasibilityAssessment(notice, detail, {
      now: fixedNow,
      loadCompanyCapabilities: async () => capabilities
    })
    expect(assessment.conclusion).toBe('不建议参与')
    expect(assessment.risks[0]).toContain('已放弃')
    expect(assessment.recommendedActions).toEqual([
      '保持禁投状态；如需重新评估，由业务负责人先确认是否撤销放弃记录。'
    ])
  })

  it('把本机业绩线索匹配到业绩门槛，但保留待原件核验状态', async () => {
    const caseRecord = knowledgeResult('近三年案例材料', `${notice.title}：近三年类似项目验收合同。`)
    const capabilities = await getCompanyCapabilitySnapshot(notice, async () => [caseRecord])
    const assessment = await runFeasibilityAssessment(notice, detail, {
      now: fixedNow,
      loadCompanyCapabilities: async () => capabilities
    })
    const caseGate = assessment.hardGates.find((item) => item.name === '案例时限')
    expect(caseGate?.result).toBe('unknown')
    expect(caseGate?.reason).toContain('找到 1 条相关线索')
    const internalEvidence = assessment.evidence.find((item) => item.value.includes('内部确认'))
    expect(internalEvidence?.status).toBe('pending')
    expect(internalEvidence?.value).toContain('内部确认，待原件核验')
  })

  it('相似项目名称或公开信息中的放弃文字不能误触发禁投', async () => {
    const unrelated = knowledgeResult('项目放弃记录', '另一项目决定放弃投标。', '公开信息')
    const capabilities = await getCompanyCapabilitySnapshot(notice, async () => [unrelated])
    expect(capabilities.abandoned).toBe(false)
  })
})
