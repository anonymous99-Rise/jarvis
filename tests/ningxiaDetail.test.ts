import { describe, expect, it } from 'vitest'
import {
  extractNingxiaAttachmentUrls,
  fetchNingxiaDetail,
  HandoffError,
  looksLikeHandoff,
  parseNingxiaDetail
} from '../apps/backend/src/services/crawler/ningxiaDetail'

const sampleHtml = `
  <html>
    <body>
      <table>
        <tr><th>项目编号</th><td>NX-2026-MOCK-002</td></tr>
        <tr><th>采购人</th><td>演示采购单位（非真实）</td></tr>
        <tr><th>预算金额</th><td>450 万元（联调示例）</td></tr>
        <tr><th>投标截止时间</th><td>2026-11-05 10:00</td></tr>
      </table>
      <div>投标人资格：</div>
      <p>（1）具有独立承担民事责任能力；（2）近三年承担过类似项目。</p>
      <div>项目建设内容：</div>
      <p>公共数据治理、共享交换与平台基础能力建设。详见招标文件。</p>
    </body>
  </html>
`

describe('宁夏政府采购网公告详情解析', () => {
  it('抽取字段并标注：资格为已核验，其他关键值为待核实（宁夏页面来源稳定性低）', () => {
    const detail = parseNingxiaDetail(sampleHtml, 'https://nx.demo/x', '2026-09-29T10:00:00+08:00', 'nx-1')
    expect(detail.projectCode.value).toBe('NX-2026-MOCK-002')
    expect(detail.budget.value).toContain('450')
    expect(detail.buyer.value).toContain('演示采购单位')
    expect(detail.bidDeadline.status).toBe('pending')
    expect(detail.qualification.status).toBe('verified')
    expect(detail.constructionSummary.value).toContain('公共数据治理')
  })

  it('检测到登录或验证码关键字时抛 HandoffError，绝不伪造字段', () => {
    const html = '<html><body><h1>请登录后查看</h1></body></html>'
    expect(looksLikeHandoff(html)).toBe(true)
    expect(() => parseNingxiaDetail(html, 'https://nx.demo/y', '2026-09-29T10:00:00+08:00', 'nx-2'))
      .toThrow(HandoffError)
  })

  it('空白页面同样返回 missing，不构造默认值', () => {
    const detail = parseNingxiaDetail('<html><body></body></html>', 'https://nx.demo/z', '2026-09-29T10:00:00+08:00', 'nx-3')
    expect(detail.projectCode.status).toBe('missing')
    expect(detail.budget.status).toBe('missing')
    expect(detail.buyer.status).toBe('missing')
    expect(detail.qualification.status).toBe('missing')
  })

  it('只从公告中明确标注的下载链接提取附件地址', () => {
    expect(extractNingxiaAttachmentUrls(
      '<a href="/download?id=1">招标文件下载</a><a href="/home">返回首页</a>',
      'https://www.ccgp-ningxia.gov.cn/notice/1'
    )).toEqual(['https://www.ccgp-ningxia.gov.cn/download?id=1'])
  })

  it('详情请求遇到跨域跳转时停止，不跟随到非采购官网', async () => {
    let calls = 0
    const fetcher: typeof fetch = async () => {
      calls += 1
      return new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/collect' }
      })
    }
    await expect(fetchNingxiaDetail(
      'nx-4',
      'https://www.ccgp-ningxia.gov.cn/notice/4',
      fetcher
    )).rejects.toThrow('已登记的政府采购官网域名')
    expect(calls).toBe(1)
  })
})
