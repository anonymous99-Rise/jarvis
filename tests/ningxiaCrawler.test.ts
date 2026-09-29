import { describe, expect, it } from 'vitest'
import { parseNingxiaNotices } from '../apps/backend/src/services/crawler/ningxia'

describe('宁夏政府采购网列表解析', () => {
  it('构造新版详情页并保留区本级来源', () => {
    const [notice] = parseNingxiaNotices({
      result: '1',
      dataList: [{
        ID: 'notice-001',
        CAPTION: '政务数据治理平台项目招标公告',
        PUBLISH_TIME: '2026-09-29'
      }]
    }, 'QBJ')
    expect(notice).toMatchObject({
      source: 'ningxia',
      region: '宁夏·区本级',
      relevant: true,
      noticeType: '招标公告'
    })
    expect(notice.url).toContain('NoticeFullProcess.do')
    expect(notice.url).toContain('noticeId=notice-001')
  })

  it('拒绝异常接口响应，避免把空数据当作成功', () => {
    expect(() => parseNingxiaNotices({ result: '0', message: 'temporary error' }, 'SX'))
      .toThrow('temporary error')
  })
})
