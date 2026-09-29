import { describe, expect, it } from 'vitest'
import { parseCcgpList } from '../apps/backend/src/services/crawler/ccgp'

describe('中国政府采购网列表解析', () => {
  it('读取标题、采购人、地域和时间，并识别信息化关键词', () => {
    const html = `
      <ul class="c_list_bid">
        <li><a href="./202609/t20260929_27415495.htm" title="智慧治理平台公开招标公告">智慧治理平台...</a>
        发布时间：<em>2026-09-29 14:40</em> 地域：<em>江西</em> 采购人：<em>某公安局</em></li>
      </ul>`
    const [notice] = parseCcgpList(html)
    expect(notice).toMatchObject({
      id: '27415495',
      title: '智慧治理平台公开招标公告',
      buyer: '某公安局',
      region: '江西',
      noticeType: '招标公告',
      relevant: true
    })
    expect(notice.url).toBe('https://www.ccgp.gov.cn/cggg/dfgg/gkzb/202609/t20260929_27415495.htm')
    expect(notice.matchedKeywords).toContain('智慧')
  })
})
