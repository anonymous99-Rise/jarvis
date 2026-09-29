import type { NoticeDetail, SourcedFact } from '@jarvis/contracts'
import { cleanText } from './noticeUtils'
import { validateOfficialProcurementUrl, validateRedirectUrl } from '../download/downloadPolicy'

// 宁夏政府采购网详情页常见入口（演示版只支持公共可访问页面）
export const NINGXIA_DETAIL_BASE = 'https://www.ccgp-ningxia.gov.cn'

// 用于检测页面是否被登录/验证码拦截——出现这些关键字即视作"需要人工接管"
const HANDOFF_MARKERS = ['请登录', '验证码', '图形验证', '人机验证', '账号登录', '扫码登录']

const MISSING_FACT: SourcedFact = {
  value: '',
  sourceUrl: '',
  fetchedAt: '',
  status: 'missing'
}

function verifiedFact(sourceUrl: string, fetchedAt: string, value: string): SourcedFact {
  const cleaned = cleanText(value)
  if (!cleaned) return { ...MISSING_FACT }
  return { value: cleaned, sourceUrl, fetchedAt, status: 'verified' }
}

function pendingFactFrom(sourceUrl: string, fetchedAt: string, value: string): SourcedFact {
  const cleaned = cleanText(value)
  if (!cleaned) return { ...MISSING_FACT }
  return { value: cleaned, sourceUrl, fetchedAt, status: 'pending' }
}

/**
 * 检测页面是否被登录/验证码拦截——返回 true 即上层应给出 human_action_required，
 * 不再尝试解析（作战计划 §4 成员4 明确：遇登录或验证码不识别、不绕过）。
 */
export function looksLikeHandoff(html: string): boolean {
  if (!html) return true
  const sample = html.slice(0, 4000)
  return HANDOFF_MARKERS.some((marker) => sample.includes(marker))
}

// 宁夏详情页字段通常以 <th>标签</th><td>值</td> 或 "项目编号：xxx" 行内形式出现
function cellAfter(block: string, keyword: string): string {
  // 行内"关键字：值"
  const inline = new RegExp(keyword + '[：:][^<\\n]{0,200}([\\s\\S]{1,400}?)(?:<|\\n)', 'i')
  const inlineMatch = inline.exec(block)?.[1]
  if (inlineMatch) return inlineMatch
  // 表格"<th>关键字</th><td>值</td>"
  const tabled = new RegExp(
    '<th[^>]*>[^<]*' + keyword + '[^<]*</th>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)</td>',
    'i'
  )
  return tabled.exec(block)?.[1] ?? ''
}

function paragraphAfter(block: string, keyword: string): string {
  const pattern = new RegExp(keyword + '[\\s\\S]*?<p[^>]*>([\\s\\S]*?)</p>', 'i')
  return pattern.exec(block)?.[1] ?? ''
}

/**
 * 解析宁夏政府采购网公告详情；字段口径与 CCGP 一致。
 *
 * 与 CCGP 的差异：
 * - 宁夏页面经常要求登录或出现验证码，此时不应解析、不应伪造。
 *   调用方应先调用 looksLikeHandoff 判定；这里再次保险检查并抛出 HandoffError。
 * - 其他字段抽不到一律 missing，绝不填默认值。
 */
export function parseNingxiaDetail(
  html: string,
  noticeUrl: string,
  fetchedAt: string,
  noticeId: string
): NoticeDetail {
  if (looksLikeHandoff(html)) {
    throw new HandoffError(`宁夏公告 ${noticeId} 出现登录或验证码，需要人工接管`)
  }

  const tableBlock =
    html.match(/<table[^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? html

  const projectCode = cellAfter(tableBlock, '项目编号')
  const budgetRaw = cellAfter(tableBlock, '预算金额') || cellAfter(tableBlock, '项目预算') || cellAfter(html, '预算')
  const buyer = cellAfter(tableBlock, '采购人') || cellAfter(tableBlock, '采购单位')
  const bidDeadline = cellAfter(tableBlock, '投标截止时间') || cellAfter(tableBlock, '投标截止')
  const registrationDeadline = cellAfter(tableBlock, '报名截止时间') || cellAfter(tableBlock, '报名截止')
  const constructionSummary =
    paragraphAfter(html, '项目建设内容') ||
    paragraphAfter(html, '建设内容') ||
    paragraphAfter(html, '采购需求')
  const qualification =
    paragraphAfter(html, '投标人资格') ||
    paragraphAfter(html, '资格要求') ||
    paragraphAfter(html, '合格投标人')

  return {
    noticeId,
    projectCode: verifiedFact(noticeUrl, fetchedAt, projectCode),
    budget: pendingFactFrom(noticeUrl, fetchedAt, budgetRaw),
    buyer: pendingFactFrom(noticeUrl, fetchedAt, buyer),
    bidDeadline: pendingFactFrom(noticeUrl, fetchedAt, bidDeadline),
    registrationDeadline: pendingFactFrom(noticeUrl, fetchedAt, registrationDeadline),
    constructionSummary: pendingFactFrom(noticeUrl, fetchedAt, constructionSummary),
    qualification: verifiedFact(noticeUrl, fetchedAt, qualification)
  }
}

/**
 * 自定义错误：表示宁夏页面需要人工接管，调用方应返回 human_action_required 而非 missing。
 */
export class HandoffError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HandoffError'
  }
}

/** 只提取公告中显式标注为招标文件或附件的链接，不推测下载地址。 */
export function extractNingxiaAttachmentUrls(html: string, noticeUrl: string): string[] {
  const urls: string[] = []
  for (const match of html.matchAll(/<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const label = cleanText(match[5].replace(/<[^>]*>/g, ' '))
    const href = cleanText(match[3])
    if (!href || !/招标文件|采购文件|磋商文件|谈判文件|下载|附件/.test(`${label} ${href}`)) continue
    try {
      const url = new URL(href, noticeUrl).toString()
      if (!urls.includes(url)) urls.push(url)
    } catch {
      // 忽略格式无效的链接，不猜测或修补地址。
    }
  }
  return urls
}

/**
 * 抓取宁夏公告详情；遇人工接管标记则抛 HandoffError，由调用方转换为 DownloadHandoff。
 */
export async function fetchNingxiaDetail(
  noticeId: string,
  noticeUrl: string,
  fetcher: typeof fetch = fetch
): Promise<NoticeDetail> {
  const fetchedAt = new Date().toISOString()
  let url = noticeUrl
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const decision = validateOfficialProcurementUrl(url)
    if (!decision.allowed) throw new Error(decision.reason)
    const response = await fetcher(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'JARVIS/0.1 local desktop procurement monitor' },
      signal: AbortSignal.timeout(15_000)
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new Error('宁夏官网跳转缺少目标地址。')
      const redirect = validateRedirectUrl(url, location)
      if (!redirect.allowed || !redirect.url) throw new Error(redirect.reason)
      url = redirect.url
      continue
    }
    if (!response.ok) throw new Error(`宁夏公告详情读取失败（HTTP ${response.status}）。`)
    return parseNingxiaDetail(await response.text(), noticeUrl, fetchedAt, noticeId)
  }
  throw new Error('宁夏官网跳转次数过多，已停止读取。')
}
