import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProcurementNotice } from '@jarvis/contracts'
import { createDownloadManager } from '../apps/backend/src/services/download/downloadManager'

const notice: ProcurementNotice = {
  id: 'nx-download-001',
  source: 'ningxia',
  sourceName: '宁夏政府采购网',
  title: '政务数据平台招标公告',
  buyer: '采购人待核验',
  region: '宁夏',
  publishedAt: '2026-09-29',
  url: 'https://www.ccgp-ningxia.gov.cn/notice/001',
  projectCode: '待核验',
  budget: '待核验',
  deadline: '待核验',
  noticeType: '招标公告',
  relevant: true,
  matchedKeywords: ['数据平台']
}

const htmlWithAttachment = (url = '/files/tender.pdf'): string =>
  `<html><body><a href="${url}">招标文件下载</a></body></html>`

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'jarvis-tender-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('招标文件受控下载', () => {
  it('下载官方 HTTPS 文件并以独占方式保存到本机', async () => {
    const directory = await tempDirectory()
    const manager = createDownloadManager({
      directory,
      now: () => '2026-09-29T02:00:00.000Z',
      fetcher: async (input) => String(input).includes('/notice/')
        ? new Response(htmlWithAttachment(), { headers: { 'content-type': 'text/html' } })
        : new Response(new Uint8Array([1, 2, 3]), {
            headers: {
              'content-type': 'application/pdf',
              'content-disposition': 'attachment; filename="tender.pdf"'
            }
          })
    })

    const status = await manager.download(notice)
    expect(status).toMatchObject({
      state: 'downloaded',
      sourceUrl: 'https://www.ccgp-ningxia.gov.cn/files/tender.pdf',
      message: '招标文件已安全保存到本机。'
    })
    expect(await readFile(status.filePath!)).toEqual(Buffer.from([1, 2, 3]))
    expect(manager.getStatus(notice.id)).toEqual(status)
  })

  it('登录和验证码转入人工接管，非官方附件直接阻止', async () => {
    const directory = await tempDirectory()
    const protectedManager = createDownloadManager({
      directory,
      fetcher: async () => new Response('<html>请先登录后下载</html>', {
        headers: { 'content-type': 'text/html' }
      })
    })
    expect((await protectedManager.download(notice)).state).toBe('human_action_required')

    let requestCount = 0
    const externalManager = createDownloadManager({
      directory,
      fetcher: async () => {
        requestCount += 1
        return new Response(htmlWithAttachment('https://files.example.net/tender.pdf'), {
          headers: { 'content-type': 'text/html' }
        })
      }
    })
    const status = await externalManager.download(notice)
    expect(status.state).toBe('blocked')
    expect(status.message).toContain('已登记的政府采购官网域名')
    expect(requestCount).toBe(1)
  })

  it('同名文件已存在时保留原文件，不执行覆盖', async () => {
    const directory = await tempDirectory()
    let downloadCount = 0
    const manager = createDownloadManager({
      directory,
      fetcher: async (input) => String(input).includes('/notice/')
        ? new Response(htmlWithAttachment(), { headers: { 'content-type': 'text/html' } })
        : new Response(new Uint8Array([++downloadCount === 1 ? 1 : 9]), {
            headers: {
              'content-type': 'application/pdf',
              'content-disposition': 'attachment; filename="tender.pdf"'
            }
          })
    })
    await manager.download(notice)
    const status = await manager.download(notice)
    expect(status.state).toBe('human_action_required')
    expect(status.message).toContain('避免覆盖')
    expect(await readFile(join(directory, 'tender.pdf'))).toEqual(Buffer.from([1]))
  })
})
