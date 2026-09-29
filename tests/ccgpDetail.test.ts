import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fetchCcgpDetail, parseCcgpDetail } from '../apps/backend/src/services/crawler/ccgpDetail'

const fixturePath = path.join(__dirname, 'fixtures', 'notices', 'ccgp-detail.html')
const fixtureUrl = 'https://www.ccgp.gov.cn/202609/t20260929_27415495.htm'
const fixtureTime = '2026-09-29T10:12:00+08:00'

function loadFixture(): string {
  return readFileSync(fixturePath, 'utf8')
}

describe('中国政府采购网公告详情解析', () => {
  it('抽取表格中的项目编号、采购人和预算，并标记为已核验', () => {
    const detail = parseCcgpDetail(loadFixture(), fixtureUrl, fixtureTime, '27415495')
    expect(detail.noticeId).toBe('27415495')
    expect(detail.projectCode).toMatchObject({
      value: 'CCGP-2026-MOCK-001',
      status: 'verified',
      sourceUrl: fixtureUrl,
      fetchedAt: fixtureTime
    })
    expect(detail.buyer.value).toBe('演示采购单位（非真实单位）')
    expect(detail.budget.value).toContain('300 万元')
  })

  it('截止时间字段一律标记为 pending，强制人工再核验', () => {
    const detail = parseCcgpDetail(loadFixture(), fixtureUrl, fixtureTime, '27415495')
    expect(detail.bidDeadline.status).toBe('pending')
    expect(detail.bidDeadline.value).toContain('2026-10-30 09:00')
    expect(detail.registrationDeadline.status).toBe('pending')
  })

  it('自由文本里的资格要求和建设内容摘要被正确抽取', () => {
    const detail = parseCcgpDetail(loadFixture(), fixtureUrl, fixtureTime, '27415495')
    expect(detail.qualification.status).toBe('verified')
    expect(detail.qualification.value).toContain('近三年承担过类似政务信息化项目')
    expect(detail.constructionSummary.status).toBe('verified')
    expect(detail.constructionSummary.value).toContain('模型推理')
  })

  it('字段抽取不到时返回显式 missing，不构造默认值', () => {
    const detail = parseCcgpDetail('<html><body>页面已被删改</body></html>', fixtureUrl, fixtureTime, 'x')
    expect(detail.projectCode).toMatchObject({ value: '', status: 'missing', sourceUrl: '' })
    expect(detail.budget.status).toBe('missing')
    expect(detail.buyer.status).toBe('missing')
    expect(detail.constructionSummary.status).toBe('missing')
    expect(detail.qualification.status).toBe('missing')
  })

  it('拒绝非政府采购官网详情地址并阻止跨域重定向', async () => {
    let calls = 0
    const fetcher: typeof fetch = async () => {
      calls += 1
      return new Response(null, { status: 302, headers: { location: 'https://example.com/collect' } })
    }
    await expect(fetchCcgpDetail('x', 'https://www.ccgp.gov.cn/a', fetcher))
      .rejects.toThrow('已登记的政府采购官网域名')
    expect(calls).toBe(1)
    await expect(fetchCcgpDetail('x', 'https://example.com/a', fetcher))
      .rejects.toThrow('已登记的政府采购官网域名')
    expect(calls).toBe(1)
  })
})
