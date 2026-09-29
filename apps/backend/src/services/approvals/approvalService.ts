import { randomUUID } from 'node:crypto'
import type { ApprovalAction, ApprovalInput, ApprovalRequest } from '@jarvis/contracts'

const DEFAULT_TTL_MS = 10 * 60 * 1000

export class ApprovalService {
  private readonly requests = new Map<string, ApprovalRequest>()

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = DEFAULT_TTL_MS
  ) {}

  list(): ApprovalRequest[] {
    this.expireOldRequests()
    return [...this.requests.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  request(input: ApprovalInput): ApprovalRequest {
    if (!input.title.trim() || !input.summary.trim() || !input.target.trim()) {
      throw new Error('审批卡片信息不完整')
    }
    const createdAt = new Date(this.now()).toISOString()
    const request: ApprovalRequest = {
      ...input,
      id: randomUUID(),
      status: 'pending',
      createdAt,
      expiresAt: new Date(this.now() + this.ttlMs).toISOString()
    }
    this.requests.set(request.id, request)
    return request
  }

  decide(id: string, approved: boolean): ApprovalRequest {
    this.expireOldRequests()
    const request = this.requests.get(id)
    if (!request) throw new Error('审批请求不存在')
    if (request.status !== 'pending') throw new Error('审批请求已处理或已过期')
    request.status = approved ? 'approved' : 'rejected'
    request.decidedAt = new Date(this.now()).toISOString()
    return { ...request }
  }

  consume(id: string, expectedAction: ApprovalAction): ApprovalRequest {
    this.expireOldRequests()
    const request = this.requests.get(id)
    if (!request) throw new Error('审批请求不存在')
    if (request.action !== expectedAction) throw new Error('审批范围与当前操作不一致')
    if (request.status !== 'approved') throw new Error('当前操作尚未获得明确确认')
    request.status = 'consumed'
    return { ...request }
  }

  private expireOldRequests(): void {
    const now = this.now()
    for (const request of this.requests.values()) {
      if ((request.status === 'pending' || request.status === 'approved') && Date.parse(request.expiresAt) <= now) {
        request.status = 'expired'
      }
    }
  }
}
