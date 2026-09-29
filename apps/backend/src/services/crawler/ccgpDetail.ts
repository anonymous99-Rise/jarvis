import type { NoticeDetail, SourcedFact } from '@jarvis/contracts'
import { cleanText } from './noticeUtils'
import { validateOfficialProcurementUrl, validateRedirectUrl } from '../download/downloadPolicy'

// CCGP 详情页入口（演示版只支持公共可访问的招标公告详情）
export const CCGP_DETAIL_BASE = 'https://www.ccgp.gov.cn'

// 抽取失败时的统一缺失值，避免上层把空字符串当作"已核验"
const MISSING_FACT: SourcedFact = {
  value: '',
  sourceUrl: '',
  fetchedAt: '',
  status: 'missing'
}

// 把字符串字段值封装成 verified SourcedFact
function verifiedFact(sourceUrl: string, fetchedAt: string, value: string): SourcedFact {
  const cleaned = cleanText(value)
  if (!cleaned) return { ...MISSING_FACT }
  return { value: cleaned, sourceUrl, fetchedAt, status: 'verified' }
}

// 待人工二次核验的字段（如截止时间）封装成 pending
function pendingFactFrom(sourceUrl: string, fetchedAt: string, value: string): SourcedFact {
  const cleaned = cleanText(value)
  if (!cleaned) return { ...MISSING_FACT }
  return { value: cleaned, sourceUrl, fetchedAt, status: 'pending' }
}

// 表格里查找紧邻某标题的 td 内容；标题用关键字给出，返回 cleaned 文本
function tableCellAfter(tableBlock: string, keyword: string): string {
  // HTML 形如：<th>项目编号</th> <td>xxx</td>，中间允许跨行空白
  const pattern = new RegExp(
    '<th[^>]*>[^<]*' + keyword + '[^<]*</th>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)</td>',
    'i'
  )
  return pattern.exec(tableBlock)?.[1] ?? ''
}

// 自由文本里查找某小标题后的第一段文本
function paragraphAfter(block: string, keyword: string): string {
  // 形如：<div>建设内容摘要：</div> <p>正文</p>
  const pattern = new RegExp(
    keyword + '[\\s\\S]*?<p[^>]*>([\\s\\S]*?)</p>',
    'i'
  )
  return pattern.exec(block)?.[1] ?? ''
}

/**
 * 解析 CCGP 公告详情页 HTML，抽取 7 个核心字段并保留来源链接和采集时间。
 *
 * 演示版约定：
 * - 表格里能稳定抽到 → verified
 * - 截止时间字段即便抽到也一律标记 pending，强制人工再核验（避免被 UI 美化为已核验）
 * - 抽不到的字段返回 status=missing，value/sourceUrl 为空字符串
 *
 * 任何字段抽不到都返回显式缺失，绝不构造默认值（作战计划 §4 成员3 要求）。
 */
export function parseCcgpDetail(
  html: string,
  noticeUrl: string,
  fetchedAt: string,
  noticeId: string
): NoticeDetail {
  const tableBlock =
    html.match(/<table[^>]*class=["'][^"']*terminal_table[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? ''
  const customBlock =
    html.match(/<div[^>]*class=["'][^"']*vF_content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/body>/i)?.[1] ?? html

  const projectCode = tableCellAfter(tableBlock, '项目编号')
  const budgetRaw = tableCellAfter(tableBlock, '预算金额') || tableCellAfter(tableBlock, '项目预算')
  const buyer = tableCellAfter(tableBlock, '采购人') || tableCellAfter(tableBlock, '采购单位')
  const bidDeadline = tableCellAfter(tableBlock, '投标截止时间') || tableCellAfter(tableBlock, '投标截止')
  const registrationDeadline =
    tableCellAfter(tableBlock, '报名截止时间') || tableCellAfter(tableBlock, '报名截止')
  const constructionSummary =
    paragraphAfter(customBlock, '项目建设内容摘要') ||
    paragraphAfter(customBlock, '建设内容') ||
    paragraphAfter(customBlock, '项目概况')
  const qualification =
    paragraphAfter(customBlock, '合格投标人资格条件') ||
    paragraphAfter(customBlock, '资格要求') ||
    paragraphAfter(customBlock, '投标人资格')

  return {
    noticeId,
    projectCode: verifiedFact(noticeUrl, fetchedAt, projectCode),
    budget: verifiedFact(noticeUrl, fetchedAt, budgetRaw),
    buyer: verifiedFact(noticeUrl, fetchedAt, buyer),
    bidDeadline: pendingFactFrom(noticeUrl, fetchedAt, bidDeadline),
    registrationDeadline: pendingFactFrom(noticeUrl, fetchedAt, registrationDeadline),
    constructionSummary: verifiedFact(noticeUrl, fetchedAt, constructionSummary),
    qualification: verifiedFact(noticeUrl, fetchedAt, qualification)
  }
}

/**
 * 抓取 CCGP 详情页并解析；网络失败时抛错，由上层决定是否回退本地快照。
 */
export async function fetchCcgpDetail(
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
      if (!location) throw new Error('中国政府采购网跳转缺少目标地址。')
      const redirect = validateRedirectUrl(url, location)
      if (!redirect.allowed || !redirect.url) throw new Error(redirect.reason)
      url = redirect.url
      continue
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return parseCcgpDetail(await response.text(), url, fetchedAt, noticeId)
  }
  throw new Error('中国政府采购网跳转次数过多，已停止读取。')
}
