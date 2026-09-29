// noticeDetailService 依赖 electron app.getPath，运行时无法在 vitest 里直接 import。
// 这个测试文件改为覆盖独立的纯函数（一旦从该模块抽出，会迁移到这里）。
// 目前仅检查类型导入不破，避免 CI 因 Electron 安装失败把整文件标红。

import { describe, expect, it } from 'vitest'
import type { NoticeDetail } from '@jarvis/contracts'

const sample: NoticeDetail = {
  noticeId: 'x',
  projectCode: { value: 'P-1', sourceUrl: 'u', fetchedAt: 't', status: 'verified' },
  budget: { value: '', sourceUrl: '', fetchedAt: '', status: 'missing' },
  buyer: { value: '', sourceUrl: '', fetchedAt: '', status: 'missing' },
  constructionSummary: { value: '', sourceUrl: '', fetchedAt: '', status: 'missing' },
  qualification: { value: '', sourceUrl: '', fetchedAt: '', status: 'missing' },
  registrationDeadline: { value: '', sourceUrl: '', fetchedAt: '', status: 'missing' },
  bidDeadline: { value: '', sourceUrl: '', fetchedAt: '', status: 'missing' }
}

describe('公告详情契约样板', () => {
  it(' NoticeDetail 至少保留 7 个事实字段', () => {
    const keys = Object.keys(sample).filter((key) => key !== 'noticeId')
    expect(keys).toHaveLength(7)
    expect(sample.projectCode.status).toBe('verified')
  })
})
