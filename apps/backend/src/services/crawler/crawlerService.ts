import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { NoticeSnapshot, NoticeSource, NoticeSourceStatus, ProcurementNotice } from '@jarvis/contracts'
import { fetchCcgpNotices } from './ccgp'
import { fetchNingxiaNotices } from './ningxia'
import { sortAndDedupe } from './noticeUtils'

const EMPTY_SNAPSHOT: NoticeSnapshot = { notices: [], sources: [], refreshedAt: '' }

function storagePath(): string {
  return path.join(app.getPath('userData'), 'private', 'procurement-notices.json')
}

async function readSnapshot(): Promise<NoticeSnapshot> {
  try {
    return JSON.parse(await readFile(storagePath(), 'utf8')) as NoticeSnapshot
  } catch {
    return EMPTY_SNAPSHOT
  }
}

async function persist(snapshot: NoticeSnapshot): Promise<void> {
  const target = storagePath()
  const temporary = `${target}.tmp`
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(temporary, JSON.stringify(snapshot, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, target)
}

function sourceStatus(
  source: NoticeSource,
  sourceName: string,
  result: PromiseSettledResult<ProcurementNotice[]>
): NoticeSourceStatus {
  if (result.status === 'fulfilled') {
    return { source, sourceName, ok: true, count: result.value.length, message: '公开公告读取正常' }
  }
  const message = result.reason instanceof Error ? result.reason.message : '读取失败'
  return { source, sourceName, ok: false, count: 0, message }
}

export async function listNotices(): Promise<NoticeSnapshot> {
  return readSnapshot()
}

export async function refreshNotices(): Promise<NoticeSnapshot> {
  const previous = await readSnapshot()
  const [ccgp, ningxia] = await Promise.allSettled([fetchCcgpNotices(), fetchNingxiaNotices()])
  const previousBySource = (source: NoticeSource): ProcurementNotice[] =>
    previous.notices.filter((notice) => notice.source === source)

  const ccgpNotices = ccgp.status === 'fulfilled' ? ccgp.value : previousBySource('ccgp')
  const ningxiaNotices = ningxia.status === 'fulfilled' ? ningxia.value : previousBySource('ningxia')
  const snapshot: NoticeSnapshot = {
    notices: sortAndDedupe([...ccgpNotices, ...ningxiaNotices]),
    sources: [
      sourceStatus('ccgp', '中国政府采购网', ccgp),
      sourceStatus('ningxia', '宁夏政府采购网', ningxia)
    ],
    refreshedAt: new Date().toISOString()
  }
  await persist(snapshot)
  return snapshot
}
