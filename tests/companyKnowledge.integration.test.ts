import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chunksFromText, searchChunks } from '../apps/backend/src/services/knowledge/knowledgeIndex'

const knowledgeRoot = join(
  process.cwd(),
  'tests',
  'fixtures',
  'knowledge'
)

describe('real company knowledge integration', () => {
  it('indexes local knowledge files and retrieves confirmed capabilities', async () => {
    const files = (await readdir(knowledgeRoot)).filter((name) => /\.(md|csv)$/i.test(name))
    const chunks = []
    for (const file of files) {
      chunks.push(...chunksFromText(file, await readFile(join(knowledgeRoot, file), 'utf8')))
    }

    expect(files.length).toBeGreaterThanOrEqual(1)
    expect(searchChunks(chunks, '甲级资质').some((item) => item.evidenceStatus === '内部确认')).toBe(true)
    expect(searchChunks(chunks, '行业案例').length).toBeGreaterThan(0)
  })
})
