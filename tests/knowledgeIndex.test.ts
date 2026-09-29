import { describe, expect, it } from 'vitest'
import { chunksFromText, evidenceStatusFor, searchChunks } from '../apps/backend/src/services/knowledge/knowledgeIndex'

describe('local knowledge index', () => {
  it('assigns evidence status from the controlled company files', () => {
    expect(evidenceStatusFor('06_内部确认能力与证据挂接.md')).toBe('内部确认')
    expect(evidenceStatusFor('05_待公司补充清单.md')).toBe('待补证明')
    expect(evidenceStatusFor('04_证据索引.md')).toBe('已核验证据')
  })

  it('searches Chinese evidence and preserves its source', () => {
    const chunks = chunksFromText('06_内部确认能力与证据挂接.md', '# 资质\n公司具备全量CCRC一级资质。\n\n# 业绩\n具有人社和医保项目业绩。')
    const results = searchChunks(chunks, 'CCRC一级')
    expect(results[0]).toMatchObject({
      source: '06_内部确认能力与证据挂接.md',
      evidenceStatus: '内部确认'
    })
  })
})
