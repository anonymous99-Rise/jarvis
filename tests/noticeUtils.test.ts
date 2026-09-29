import { describe, expect, it } from 'vitest'
import type { ProcurementNotice } from '@jarvis/contracts'
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
