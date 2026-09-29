import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import type { EvidenceStatus, KnowledgeResult } from '@jarvis/contracts'

export type KnowledgeChunk = {
  id: string
  title: string
  content: string
  source: string
  evidenceStatus: EvidenceStatus
}

export function evidenceStatusFor(source: string): EvidenceStatus {
  const name = basename(source)
  if (name.startsWith('06_')) return '内部确认'
  if (name.startsWith('05_')) return '待补证明'
  if (name.startsWith('04_')) return '已核验证据'
  return '公开信息'
}

export function chunksFromText(source: string, text: string): KnowledgeChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const isCsv = source.toLowerCase().endsWith('.csv')
  const blocks = isCsv
    ? normalized.split('\n').filter(Boolean)
    : normalized.split(/\n(?=#{1,4}\s)|\n{2,}/).map((part) => part.trim()).filter(Boolean)

  let currentHeading = basename(source)
  return blocks
    .map((block, index) => {
      const heading = block.match(/^#{1,4}\s+(.+)$/m)?.[1]?.trim()
      if (heading) currentHeading = heading
      const content = block.replace(/^#{1,4}\s+.+\n?/, '').trim() || block.trim()
      return {
        id: createHash('sha1').update(`${source}:${index}:${content}`).digest('hex'),
        title: currentHeading,
        content,
        source,
        evidenceStatus: evidenceStatusFor(source)
      }
    })
    .filter((chunk) => chunk.content.length > 1)
}

function queryTerms(query: string): string[] {
  const compact = query.trim().toLowerCase()
  if (!compact) return []
  const terms = compact.split(/[\s,，、;；]+/).filter((term) => term.length > 0)
  return [...new Set([compact, ...terms])]
}

export function searchChunks(chunks: KnowledgeChunk[], query: string, limit = 12): KnowledgeResult[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []

  return chunks
    .map((chunk) => {
      const title = chunk.title.toLowerCase()
      const content = chunk.content.toLowerCase()
      const source = chunk.source.toLowerCase()
      let score = 0
      for (const term of terms) {
        if (title.includes(term)) score += 8
        if (content.includes(term)) score += 4
        if (source.includes(term)) score += 2
        score += Math.min(content.split(term).length - 1, 4)
      }
      return { chunk, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({
      id: chunk.id,
      title: chunk.title,
      snippet: chunk.content.length > 260 ? `${chunk.content.slice(0, 260)}...` : chunk.content,
      source: chunk.source,
      evidenceStatus: chunk.evidenceStatus,
      score
    }))
}
