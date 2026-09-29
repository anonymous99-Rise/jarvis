import { describe, expect, it } from 'vitest'
import { ApprovalService } from '../apps/backend/src/services/approvals/approvalService'
import {
  DEFAULT_REMINDER_LEAD_HOURS,
  buildCalendarDraft,
  buildWriteScript,
  describeDraft,
  parseDeadline
} from '../apps/backend/src/services/calendar/calendarPolicy'
import { writeConfirmedEvent } from '../apps/backend/src/services/calendar/calendarService'

const notice = {
  id: 'demo-ccgp-1',
  title: '某单位信息系统建设项目招标公告',
  url: 'https://www.ccgp.gov.cn/notice/demo-1',
  deadline: '2026-10-30 09:00'
}

// 本地时间对照，避免测试受运行机器时区影响
const localTime = (year: number, month: number, day: number, hour: number, minute = 0): number =>
  new Date(year, month - 1, day, hour, minute).getTime()

describe('日历草稿生成', () => {
  it('默认从项目截止时间提前 48 小时生成提醒', () => {
    const draft = buildCalendarDraft(notice)
    expect(draft.reminderLeadHours).toBe(DEFAULT_REMINDER_LEAD_HOURS)
    expect(draft.reminderLeadHours).toBe(48)
    expect(Date.parse(draft.deadlineAt)).toBe(localTime(2026, 10, 30, 9))
    expect(Date.parse(draft.remindAt)).toBe(localTime(2026, 10, 28, 9))
    expect(Date.parse(draft.remindEndAt)).toBe(localTime(2026, 10, 28, 10))
    expect(draft.noticeId).toBe(notice.id)
    expect(draft.action).toBe('calendar-write')
  })

  it('日程标题带测试标记，便于在日历中识别和撤销', () => {
    const draft = buildCalendarDraft(notice)
    expect(draft.title.startsWith('【JARVIS 测试日程】')).toBe(true)
    expect(draft.title).toContain(notice.title)
  })

  it('截止时间缺失或未核验时显式报错，不构造默认草稿', () => {
    expect(() => buildCalendarDraft({ ...notice, deadline: '详情页待核验' })).toThrow('截止时间')
    expect(() => buildCalendarDraft({ ...notice, deadline: '' })).toThrow('截止时间')
    expect(() => buildCalendarDraft({ ...notice, deadline: '2026-13-40 09:00' })).toThrow('非法')
    expect(parseDeadline('2026-10-30T09:00')).toEqual(new Date(2026, 9, 30, 9, 0))
  })

  it('确认卡完整展示标题、时间、日历、来源项目和动作', () => {
    const draft = buildCalendarDraft(notice, { calendarName: '投标' })
    const lines = describeDraft(draft).join('\n')
    expect(lines).toContain('标题：')
    expect(lines).toContain('提醒时间：')
    expect(lines).toContain('目标日历：投标')
    expect(lines).toContain('来源项目：')
    expect(lines).toContain('将执行的动作：')
  })
})

describe('calendar-write 一次性令牌', () => {
  const draft = buildCalendarDraft(notice)

  it('未确认时不进入写入流程', async () => {
    const approvals = new ApprovalService(() => Date.parse('2026-09-29T09:00:00.000Z'))
    const request = approvals.request({
      action: 'calendar-write',
      title: draft.title,
      summary: '确认写入',
      target: '日历「JARVIS」'
    })
    // pending 状态：尚未获得确认，先于平台检查抛出，系统日历未被调用
    await expect(writeConfirmedEvent(approvals, request.id, draft)).rejects.toThrow('尚未获得')
    approvals.decide(request.id, false)
    await expect(writeConfirmedEvent(approvals, request.id, draft)).rejects.toThrow('尚未获得')
  })

  it('批准后令牌只能消费一次，写入成功即失效', async () => {
    const approvals = new ApprovalService(() => Date.parse('2026-09-29T09:00:00.000Z'))
    const request = approvals.request({
      action: 'calendar-write',
      title: draft.title,
      summary: '确认写入',
      target: '日历「JARVIS」'
    })
    approvals.decide(request.id, true)
    // getApproved 只校验不消费，供写入前置校验
    expect(approvals.getApproved(request.id, 'calendar-write').status).toBe('approved')
    expect(approvals.getApproved(request.id, 'calendar-write').status).toBe('approved')
    expect(approvals.consume(request.id, 'calendar-write').status).toBe('consumed')
    // 消费后再次尝试写入必须被拒绝
    await expect(writeConfirmedEvent(approvals, request.id, draft)).rejects.toThrow('尚未获得')
  })

  it('拒绝跨动作复用写入令牌', () => {
    const approvals = new ApprovalService(() => Date.parse('2026-09-29T09:00:00.000Z'))
    const request = approvals.request({
      action: 'calendar-write',
      title: draft.title,
      summary: '确认写入',
      target: '日历「JARVIS」'
    })
    approvals.decide(request.id, true)
    expect(() => approvals.consume(request.id, 'delete')).toThrow('审批范围')
  })

  it.skipIf(process.platform === 'darwin')('确认通过但平台不支持时显式失败，不消费令牌以便迁移后重试', async () => {
    const approvals = new ApprovalService(() => Date.parse('2026-09-29T09:00:00.000Z'))
    const request = approvals.request({
      action: 'calendar-write',
      title: draft.title,
      summary: '确认写入',
      target: '日历「JARVIS」'
    })
    approvals.decide(request.id, true)
    await expect(writeConfirmedEvent(approvals, request.id, draft)).rejects.toThrow('macOS')
    expect(approvals.getApproved(request.id, 'calendar-write').status).toBe('approved')
  })
})

describe('写入脚本构造', () => {
  it('转义标题中的特殊字符并定位目标日历', () => {
    const draft = buildCalendarDraft(
      { ...notice, title: '项目"X"\\一期 招标公告' },
      { calendarName: 'JARVIS' }
    )
    const script = buildWriteScript(draft)
    expect(script).toContain('\\"X\\"')
    expect(script).toContain('\\\\一期')
    expect(script).toContain('Application("Calendar")')
    expect(script).toContain('未找到目标日历')
  })
})
