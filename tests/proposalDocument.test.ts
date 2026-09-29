import { describe, expect, it } from 'vitest'
import { createProposalBuffer } from '../apps/backend/src/services/documents/proposalDocument'

describe('项目建议书生成', () => {
  it('生成可编辑的 DOCX 文件并保留待补充标记', async () => {
    const buffer = await createProposalBuffer({
      projectName: '政务服务人工智能赋能项目',
      goals: '建设统一智能服务能力'
    })
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    expect(buffer.byteLength).toBeGreaterThan(5_000)
  })

  it('拒绝生成没有项目名称的文件', async () => {
    await expect(createProposalBuffer({ projectName: ' ' })).rejects.toThrow('项目名称')
  })
})
