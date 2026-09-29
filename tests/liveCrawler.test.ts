import { describe, expect, it } from 'vitest'
import { fetchCcgpNotices } from '../apps/backend/src/services/crawler/ccgp'
import { fetchNingxiaNotices } from '../apps/backend/src/services/crawler/ningxia'

describe.skipIf(process.env.RUN_LIVE !== '1')('公开采购网站联网联调', () => {
  it('两个官网均能返回结构化公告', async () => {
    const [ccgp, ningxia] = await Promise.all([fetchCcgpNotices(1), fetchNingxiaNotices(10)])
    expect(ccgp.length).toBeGreaterThan(0)
    expect(ningxia.length).toBeGreaterThan(0)
    expect(ccgp.every((item) => item.url.startsWith('https://www.ccgp.gov.cn/'))).toBe(true)
    expect(ningxia.every((item) => item.url.startsWith('https://www.ccgp-ningxia.gov.cn/'))).toBe(true)
  }, 30_000)
})
