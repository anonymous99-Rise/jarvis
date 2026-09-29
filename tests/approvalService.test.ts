import { describe, expect, it } from 'vitest'
import { ApprovalService } from '../apps/backend/src/services/approvals/approvalService'

const input = {
  action: 'permission' as const,
  title: '读取系统日历',
  summary: 'macOS 可能显示日历访问授权提示',
  target: '系统日历（只读）'
}

describe('统一审批服务', () => {
  it('只有明确批准且动作匹配的令牌可消费一次', () => {
    const service = new ApprovalService(() => Date.parse('2026-09-29T09:00:00.000Z'))
    const request = service.request(input)
    expect(() => service.consume(request.id, 'permission')).toThrow('尚未获得')
    service.decide(request.id, true)
    expect(service.consume(request.id, 'permission').status).toBe('consumed')
    expect(() => service.consume(request.id, 'permission')).toThrow('尚未获得')
  })

  it('拒绝跨动作复用并让过期请求失效', () => {
    let now = Date.parse('2026-09-29T09:00:00.000Z')
    const service = new ApprovalService(() => now, 1000)
    const request = service.request(input)
    service.decide(request.id, true)
    expect(() => service.consume(request.id, 'delete')).toThrow('审批范围')
    now += 1001
    expect(service.list()[0].status).toBe('expired')
  })
})
