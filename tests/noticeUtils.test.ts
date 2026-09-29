import { describe, expect, it } from 'vitest'
import type {
  FeasibilityAssessment,
  HardGateName,
  NoticeDetail,
  ProcurementNotice,
  SourcedFact
} from '@jarvis/contracts'
import { sortAndDedupe } from '../apps/backend/src/services/crawler/noticeUtils'

const notice = (id: string, publishedAt: string): ProcurementNotice => ({
  id,
  source: 'ccgp',
  sourceName: '中国政府采购网',
  title: id,
  buyer: '采购人',
  region: '全国',
  publishedAt,
  url: `https://www.ccgp.gov.cn/${id}`,
  projectCode: '待核验',
  budget: '待核验',
  deadline: '待核验',
  noticeType: '招标公告',
  relevant: false,
  matchedKeywords: []
})

describe('公告去重', () => {
  it('按来源和ID去重并按发布时间倒序', () => {
    const result = sortAndDedupe([
      notice('old', '2026-09-28 10:00'),
      notice('new', '2026-09-29 10:00'),
      notice('old', '2026-09-28 10:00')
    ])
    expect(result.map((item) => item.id)).toEqual(['new', 'old'])
  })
})

const fact = (value: string, status: SourcedFact['status']): SourcedFact => ({
  value,
  sourceUrl: value ? 'https://www.ccgp.gov.cn/detail-1' : '',
  fetchedAt: '2026-09-29 10:00:00',
  status
})

const detail: NoticeDetail = {
  noticeId: 'detail-1',
  projectCode: fact('NXZC-2026-001', 'verified'),
  budget: fact('500 万元', 'verified'),
  buyer: fact('示例采购人', 'verified'),
  constructionSummary: fact('示例系统建设内容摘要', 'verified'),
  qualification: fact('', 'missing'),
  registrationDeadline: fact('2026-10-15 17:30', 'pending'),
  bidDeadline: fact('2026-10-30 09:00', 'pending')
}

const assessment: FeasibilityAssessment = {
  noticeId: 'detail-1',
  conclusion: '进一步核实',
  confidence: 0.62,
  hardGates: [
    { name: '资格', result: 'pass', reason: '满足公告资格条件' },
    { name: '案例时限', result: 'fail', reason: '近三年类似案例不足' }
  ],
  risks: ['报名截止临近，材料准备时间紧'],
  evidence: [fact('公告要求具备相应资质', 'verified'), fact('预算 500 万元', 'verified')],
  recommendedActions: ['补充类似案例证明材料'],
  assessedAt: '2026-09-29 10:05:00'
}

describe('项目详情契约', () => {
  it('NoticeDetail 固定包含七项事实字段', () => {
    expect(Object.keys(detail).sort()).toEqual([
      'bidDeadline',
      'budget',
      'buyer',
      'constructionSummary',
      'noticeId',
      'projectCode',
      'qualification',
      'registrationDeadline'
    ])
  })

  it('每项事实都携带来源、抓取时间和核验状态', () => {
    const facts = [
      detail.projectCode,
      detail.budget,
      detail.buyer,
      detail.constructionSummary,
      detail.qualification,
      detail.registrationDeadline,
      detail.bidDeadline
    ]
    expect(facts).toHaveLength(7)
    for (const item of facts) {
      expect(['verified', 'pending', 'missing']).toContain(item.status)
      expect(item.fetchedAt).toBeTruthy()
      if (item.status === 'missing') {
        expect(item.value).toBe('')
      } else {
        expect(item.sourceUrl).toBeTruthy()
        expect(item.value).not.toBe('')
      }
    }
  })

  it('FeasibilityAssessment 固定包含结论、置信度、硬门槛、风险、证据和建议动作', () => {
    expect(Object.keys(assessment).sort()).toEqual([
      'assessedAt',
      'conclusion',
      'confidence',
      'evidence',
      'hardGates',
      'noticeId',
      'recommendedActions',
      'risks'
    ])
    expect(['建议参与', '进一步核实', '不建议参与']).toContain(assessment.conclusion)
    expect(assessment.confidence).toBeGreaterThanOrEqual(0)
    expect(assessment.confidence).toBeLessThanOrEqual(1)
    expect(assessment.evidence.length).toBeGreaterThan(0)
    expect(assessment.recommendedActions.length).toBeGreaterThan(0)
  })

  it('硬门槛只使用约定名单和通过结果', () => {
    const allowedNames: HardGateName[] = [
      '案例时限',
      '厂商授权',
      '地域交付',
      '演示环境',
      '截止时间',
      '资格',
      '预算结构'
    ]
    expect(assessment.hardGates.length).toBeGreaterThan(0)
    for (const gate of assessment.hardGates) {
      expect(allowedNames).toContain(gate.name)
      expect(['pass', 'fail']).toContain(gate.result)
      expect(gate.reason).not.toBe('')
    }
  })
})
