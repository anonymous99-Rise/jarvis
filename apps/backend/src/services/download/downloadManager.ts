import { open, mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { ProcurementNotice, TenderFileStatus } from '@jarvis/contracts'
import {
  extractNingxiaAttachmentUrls,
  HandoffError,
  parseNingxiaDetail
} from '../crawler/ningxiaDetail'
import {
  isHumanHandoffResponse,
  isSupportedTenderFile,
  sanitizeTenderFilename,
  validateOfficialProcurementUrl,
  validateRedirectUrl
} from './downloadPolicy'

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024
const MAX_REDIRECTS = 5

export type DownloadManagerOptions = {
  directory: string
  fetcher?: typeof fetch
  now?: () => string
  maxBytes?: number
}

export type DownloadManager = {
  getStatus: (noticeId: string) => TenderFileStatus
  download: (notice: ProcurementNotice) => Promise<TenderFileStatus>
}

function filenameFromResponse(response: Response, url: string, title: string): string {
  const disposition = response.headers.get('content-disposition') ?? ''
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  const basic = disposition.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1]
  let candidate = encoded ? decodeURIComponent(encoded) : basic
  if (!candidate) {
    try {
      candidate = path.posix.basename(new URL(url).pathname)
    } catch {
      candidate = ''
    }
  }
  if (!candidate || !path.extname(candidate)) {
    const contentType = response.headers.get('content-type') ?? ''
    const extension = /pdf/i.test(contentType) ? '.pdf'
      : /zip/i.test(contentType) ? '.zip'
        : /wordprocessingml/i.test(contentType) ? '.docx'
          : /msword/i.test(contentType) ? '.doc'
            : '.bin'
    candidate = `${title || '招标文件'}${extension}`
  }
  return sanitizeTenderFilename(candidate)
}

async function readLimited(response: Response, maximum: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (declaredLength > maximum) throw new Error('招标文件超过 50 MB 演示版下载上限。')
  if (!response.body) throw new Error('官网没有返回可保存的文件内容。')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maximum) {
        await reader.cancel()
        throw new Error('招标文件超过 50 MB 演示版下载上限。')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

async function fetchWithoutUntrustedRedirects(
  initialUrl: string,
  fetcher: typeof fetch
): Promise<{ response: Response; url: string }> {
  let url = initialUrl
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const decision = validateOfficialProcurementUrl(url)
    if (!decision.allowed) throw new Error(decision.reason)
    const response = await fetcher(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'JARVIS/0.1 local desktop procurement monitor' },
      signal: AbortSignal.timeout(30_000)
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url }
    const location = response.headers.get('location')
    if (!location) throw new Error('官网跳转缺少目标地址。')
    const redirect = validateRedirectUrl(url, location)
    if (!redirect.allowed || !redirect.url) throw new Error(redirect.reason)
    url = redirect.url
  }
  throw new Error('官网跳转次数过多，已停止下载。')
}

export function createDownloadManager(options: DownloadManagerOptions): DownloadManager {
  const fetcher = options.fetcher ?? fetch
  const now = options.now ?? (() => new Date().toISOString())
  const maxBytes = options.maxBytes ?? MAX_DOWNLOAD_BYTES
  const statuses = new Map<string, TenderFileStatus>()

  const statusFor = (noticeId: string): TenderFileStatus => statuses.get(noticeId) ?? {
    noticeId,
    state: 'not-downloaded',
    message: '尚未下载招标文件。',
    updatedAt: now()
  }

  const saveStatus = (status: TenderFileStatus): TenderFileStatus => {
    statuses.set(status.noticeId, status)
    return status
  }

  const handoff = (notice: ProcurementNotice, message: string): TenderFileStatus => saveStatus({
    noticeId: notice.id,
    state: 'human_action_required',
    sourceUrl: notice.url,
    message,
    updatedAt: now()
  })

  return {
    getStatus: statusFor,
    async download(notice) {
      saveStatus({ noticeId: notice.id, state: 'downloading', message: '正在检查官网附件。', updatedAt: now() })
      try {
        const pageDecision = validateOfficialProcurementUrl(notice.url)
        if (!pageDecision.allowed) {
          return saveStatus({
            noticeId: notice.id,
            state: 'blocked',
            sourceUrl: notice.url,
            message: pageDecision.reason,
            updatedAt: now()
          })
        }

        const page = await fetchWithoutUntrustedRedirects(notice.url, fetcher)
        if (page.response.status === 401 || page.response.status === 403 || page.response.status === 429) {
          return handoff(notice, '官网要求登录、验证码或限制自动访问，请在官网人工完成操作。')
        }
        if (!page.response.ok) return handoff(notice, `官网暂时无法读取（HTTP ${page.response.status}），请在官网人工下载。`)
        const pageType = page.response.headers.get('content-type') ?? ''
        if (!/text\/html|application\/xhtml/i.test(pageType)) {
          return handoff(notice, '公告详情响应不是可识别的网页，请在官网人工查找招标文件。')
        }

        const html = await page.response.text()
        if (isHumanHandoffResponse(pageType, html)) {
          return handoff(notice, '官网要求登录或通过验证码，请在官网人工完成操作。')
        }
        try {
          parseNingxiaDetail(html, page.url, now(), notice.id)
        } catch (error) {
          if (error instanceof HandoffError) return handoff(notice, error.message)
          throw error
        }
        const attachmentUrls = extractNingxiaAttachmentUrls(html, page.url)
        if (attachmentUrls.length === 0) {
          return handoff(notice, '已读取公告页面；未发现公开附件链接，请在官网人工查找招标文件。')
        }

        let lastReason = '没有可安全下载的公开附件。'
        for (const attachmentUrl of attachmentUrls) {
          const initialDecision = validateOfficialProcurementUrl(attachmentUrl)
          if (!initialDecision.allowed) {
            lastReason = initialDecision.reason
            continue
          }
          const { response, url } = await fetchWithoutUntrustedRedirects(attachmentUrl, fetcher)
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            return handoff(notice, '下载需要登录或验证码，请在官网人工完成操作。')
          }
          if (!response.ok) {
            lastReason = `附件读取失败（HTTP ${response.status}）。`
            continue
          }
          const contentType = response.headers.get('content-type') ?? ''
          const filename = filenameFromResponse(response, url, notice.title)
          const fileDecision = isSupportedTenderFile(contentType, filename)
          if (!fileDecision.allowed) {
            if (/text\/html|application\/xhtml/i.test(contentType)) {
              const body = await response.text()
              if (isHumanHandoffResponse(contentType, body)) {
                return handoff(notice, '附件需要登录或验证码，请在官网人工完成操作。')
              }
            }
            lastReason = fileDecision.reason
            continue
          }

          const bytes = await readLimited(response, maxBytes)
          await mkdir(options.directory, { recursive: true, mode: 0o700 })
          const filePath = path.join(options.directory, filename)
          let created = false
          try {
            const file = await open(filePath, 'wx', 0o600)
            created = true
            try {
              await file.writeFile(bytes)
            } finally {
              await file.close()
            }
          } catch (error) {
            if (created) await unlink(filePath).catch(() => undefined)
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
              return handoff(notice, `本机已存在同名文件“${filename}”，为避免覆盖请先人工处理。`)
            }
            throw error
          }
          return saveStatus({
            noticeId: notice.id,
            state: 'downloaded',
            filePath,
            sourceUrl: url,
            message: '招标文件已安全保存到本机。',
            updatedAt: now()
          })
        }
        if (/必须使用 HTTPS|只允许来自|不能包含账号|格式无效/.test(lastReason)) {
          return saveStatus({
            noticeId: notice.id,
            state: 'blocked',
            sourceUrl: notice.url,
            message: lastReason,
            updatedAt: now()
          })
        }
        return handoff(notice, lastReason)
      } catch (error) {
        const message = error instanceof Error ? error.message : '下载策略执行失败。'
        const state = /必须使用 HTTPS|只允许来自|不能包含账号|无效/.test(message) ? 'blocked' : 'human_action_required'
        return saveStatus({
          noticeId: notice.id,
          state,
          sourceUrl: notice.url,
          message,
          updatedAt: now()
        })
      }
    }
  }
}
