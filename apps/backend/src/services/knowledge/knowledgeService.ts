import { app } from 'electron'
import { access, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { KnowledgeResult, KnowledgeStatus } from '@jarvis/contracts'
import { chunksFromText, searchChunks, type KnowledgeChunk } from './knowledgeIndex'

const COMPANY_PATH = join(
  '贾维斯资料中心',
  '02_公司资料库',
  '宁夏希望信息产业股份有限公司'
)
const PROJECT_COMPANY_PATH = join('knowledge', 'company', '宁夏希望信息产业股份有限公司')

let chunks: KnowledgeChunk[] = []
let status: KnowledgeStatus = {
  ready: false,
  root: '',
  fileCount: 0,
  chunkCount: 0,
  indexedAt: ''
}

async function firstExisting(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Continue to the next local candidate.
    }
  }
  throw new Error('未找到宁夏希望信息产业股份有限公司资料库')
}

async function resolveRoot(): Promise<string> {
  const override = process.env.JARVIS_KNOWLEDGE_ROOT
  const candidates = [
    ...(override ? [override] : []),
    join(process.cwd(), PROJECT_COMPANY_PATH),
    join(app.getAppPath(), PROJECT_COMPANY_PATH),
    join(process.cwd(), '..', COMPANY_PATH),
    join(app.getAppPath(), '..', COMPANY_PATH),
    join(app.getPath('documents'), 'Codex', '2026-08-26', 'sha', COMPANY_PATH)
  ]
  return firstExisting(candidates)
}

export async function rebuildKnowledgeIndex(): Promise<KnowledgeStatus> {
  try {
    const root = await resolveRoot()
    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.(md|txt|csv)$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

    const nextChunks: KnowledgeChunk[] = []
    for (const entry of entries) {
      const path = join(root, entry.name)
      const text = await readFile(path, 'utf8')
      nextChunks.push(...chunksFromText(relative(root, path), text))
    }

    chunks = nextChunks
    status = {
      ready: true,
      root,
      fileCount: entries.length,
      chunkCount: chunks.length,
      indexedAt: new Date().toISOString()
    }
  } catch (error) {
    status = {
      ready: false,
      root: '',
      fileCount: 0,
      chunkCount: 0,
      indexedAt: '',
      error: error instanceof Error ? error.message : '资料库索引失败'
    }
  }
  return status
}

export async function getKnowledgeStatus(): Promise<KnowledgeStatus> {
  if (!status.indexedAt && !status.error) await rebuildKnowledgeIndex()
  return status
}

export async function searchKnowledge(query: string): Promise<KnowledgeResult[]> {
  if (!status.ready) await rebuildKnowledgeIndex()
  return searchChunks(chunks, query)
}
