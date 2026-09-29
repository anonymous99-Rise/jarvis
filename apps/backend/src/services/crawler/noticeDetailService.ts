import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { NoticeDetail, NoticeSnapshot } from '@jarvis/contracts'
import { fetchCcgpDetail } from './ccgpDetail'
import { HandoffError, fetchNingxiaDetail } from './ningxiaDetail'
import { listNotices } from './crawlerService'

/**
 * 公告详情服务：按 noticeId 路由到 CCGP / 宁夏解析器，并做磁盘缓存。
 *
 * 演示版约定（作战计划 §4 成员1/成员3/成员4）：
 * - 网络失败时回退到本地缓存，但绝不构造默认值；找不到缓存就抛错或返回 missing 占位详情。
 * - 宁夏页面遇人工接管标记 → 抛 HandoffError 给上层，由 IPC 翻译成 human_action_required。
 *
 * 缓存路径：userData/private/notice-details/<noticeId>.json
 */

const HANDOFF_NOTICE_PREFIX = 'human_action_required'

function detailDir(): string {
  return path.join(app.getPath('userData'), 'private', 'notice-details')
}

function detailPath(noticeId: string): string {
  // 仅用 noticeId 当文件名可能冲突，但演示版保证 CCGP/宁夏 ID 不撞名
  return path.join(detailDir(), `${noticeId}.json`)
}

async function readCache(noticeId: string): Promise<NoticeDetail | null> {
  try {
    const raw = await readFile(detailPath(noticeId), 'utf8')
    return JSON.parse(raw) as NoticeDetail
  } catch {
    return null
  }
}

async function writeCache(detail: NoticeDetail): Promise<void> {
  const dir = detailDir()
  await mkdir(dir, { recursive: true })
  await writeFile(detailPath(detail.noticeId), JSON.stringify(detail, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
}

/** 在快照里按 noticeId 找到原始公告，用于拿到来源 URL 和 source */
async function findNotice(noticeId: string, snapshot?: NoticeSnapshot) {
  const snap = snapshot ?? (await listNotices())
  return snap.notices.find((item) => item.id === noticeId) ?? null
}

/**
 * 占位详情：当既无法联网又无缓存时，至少返回结构完整的 missing 占位，
 * 让前端能正常渲染详情面板而不崩。
 *
 * 注意：所有字段一律 missing，绝不填充伪造值；调用方知道这是降级状态。
 */
function placeholderDetail(noticeId: string): NoticeDetail {
  const empty = { value: '', sourceUrl: '', fetchedAt: '', status: 'missing' as const }
  return {
    noticeId,
    projectCode: { ...empty },
    budget: { ...empty },
    buyer: { ...empty },
    constructionSummary: { ...empty },
    qualification: { ...empty },
    registrationDeadline: { ...empty },
    bidDeadline: { ...empty }
  }
}

export class HumanActionRequiredError extends Error {
  readonly noticeId: string
  constructor(noticeId: string, message: string) {
    super(message)
    this.name = 'HumanActionRequiredError'
    this.noticeId = noticeId
  }
}

export function isHumanActionRequired(error: unknown): error is HumanActionRequiredError {
  return error instanceof HumanActionRequiredError
}

export { HANDOFF_NOTICE_PREFIX }

/**
 * 按 noticeId 获取公告详情：
 * 1. 先读缓存；命中且非空 → 返回（演示版不做 TTL）
 * 2. 否则按 source 在快照里拿到 URL，发起抓取
 * 3. 抓取成功 → 写缓存返回
 * 4. 抓取失败（网络/HTTP）→ 回退缓存，仍无 → 返回 missing 占位
 * 5. 宁夏遇人工接管 → 抛 HumanActionRequiredError
 */
export async function getNoticeDetail(
  noticeId: string,
  snapshot?: NoticeSnapshot
): Promise<NoticeDetail> {
  const cached = await readCache(noticeId)
  if (cached && cached.noticeId === noticeId) return cached

  const notice = await findNotice(noticeId, snapshot)
  if (!notice) {
    // 列表里找不到的 noticeId：返回 missing 占位，绝不伪造字段
    return placeholderDetail(noticeId)
  }

  try {
    if (notice.source === 'ccgp') {
      const detail = await fetchCcgpDetail(notice.id, notice.url)
      await writeCache(detail)
      return detail
    }
    const detail = await fetchNingxiaDetail(notice.id, notice.url)
    await writeCache(detail)
    return detail
  } catch (error) {
    if (error instanceof HandoffError) {
      throw new HumanActionRequiredError(notice.id, error.message)
    }
    // 网络/HTTP 失败：回退缓存，仍无则返回 missing 占位
    if (cached) return cached
    return placeholderDetail(noticeId)
  }
}
