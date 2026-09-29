import type { ProcurementNotice } from '@jarvis/contracts'
import { cleanText, inferNoticeType, relevanceFor, stableId } from './noticeUtils'

export const CCGP_LIST_URL = 'https://www.ccgp.gov.cn/cggg/dfgg/gkzb/'

function attribute(block: string, name: string): string {
  return block.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'))?.[1] ?? ''
}

export function parseCcgpList(html: string, baseUrl = CCGP_LIST_URL): ProcurementNotice[] {
  const list = html.match(/<ul[^>]*class=["'][^"']*c_list_bid[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? ''
  const blocks = list.match(/<li[\s\S]*?<\/li>/gi) ?? []

  return blocks.flatMap((block) => {
    const anchor = block.match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0]
    const href = anchor ? attribute(anchor, 'href') : ''
    const title = cleanText(anchor ? attribute(anchor, 'title') : '')
    const meta = [...block.matchAll(/<em[^>]*>([\s\S]*?)<\/em>/gi)].map((match) => cleanText(match[1]))
    if (!href || !title || meta.length < 3) return []

    const url = new URL(href, baseUrl).toString()
    const pathId = url.match(/t\d+_(\d+)\.htm/i)?.[1]
    return [{
      id: pathId ?? stableId(url),
      source: 'ccgp' as const,
      sourceName: '中国政府采购网',
      title,
      publishedAt: meta[0],
      region: meta[1],
      buyer: meta[2],
      url,
      projectCode: '详情页待核验',
      budget: '详情页待核验',
      deadline: '详情页待核验',
      noticeType: inferNoticeType(title),
      ...relevanceFor(title)
    }]
  })
}

function pageUrl(page: number): string {
  if (page === 0) return CCGP_LIST_URL
  return new URL(`index_${page}.htm`, CCGP_LIST_URL).toString()
}

export async function fetchCcgpNotices(pageCount = 3): Promise<ProcurementNotice[]> {
  const pages = await Promise.all(
    Array.from({ length: pageCount }, async (_, page) => {
      const url = pageUrl(page)
      const response = await fetch(url, {
        headers: { 'user-agent': 'JARVIS/0.1 local desktop procurement monitor' },
        signal: AbortSignal.timeout(15_000)
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return parseCcgpList(await response.text(), url)
    })
  )
  return pages.flat()
}
