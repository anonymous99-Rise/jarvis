import { createHash } from 'node:crypto'
import type { NoticeType, ProcurementNotice } from '@jarvis/contracts'

export const INFORMATION_KEYWORDS = [
  '人工智能', '大模型', '智能体', '政务服务', '数字政府', '数据治理', '数据中台',
  '政务云', '算力', '数据中心', '软件开发', '系统集成', '信创', '网络安全',
  '应急指挥', '运维', '信息化', '数字化', '智慧', '平台', '系统', '数据库'
] as const

export function cleanText(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inferNoticeType(title: string): NoticeType {
  if (/采购意向/.test(title)) return '采购意向'
  if (/更正|变更|延期/.test(title)) return '更正公告'
  if (/中标|成交|结果/.test(title)) return '中标公告'
  if (/招标/.test(title)) return '招标公告'
  if (/采购|磋商|谈判|询价/.test(title)) return '采购公告'
  return '其他'
}

export function relevanceFor(title: string): Pick<ProcurementNotice, 'relevant' | 'matchedKeywords'> {
  const matchedKeywords = INFORMATION_KEYWORDS.filter((keyword) => title.includes(keyword))
  return { relevant: matchedKeywords.length > 0, matchedKeywords: [...matchedKeywords] }
}

export function stableId(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20)
}

export function sortAndDedupe(notices: ProcurementNotice[]): ProcurementNotice[] {
  const unique = new Map<string, ProcurementNotice>()
  for (const notice of notices) {
    const key = `${notice.source}:${notice.id}`
    if (!unique.has(key)) unique.set(key, notice)
  }
  return [...unique.values()].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
}
