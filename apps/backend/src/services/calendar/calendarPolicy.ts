import type { ProcurementNotice } from '@jarvis/contracts'

// CalendarDraft 契约由成员1统一收录到 @jarvis/contracts 后,此处改为 re-export,
// 字段结构已与其余契约保持一致,成员1可直接复制。
export type CalendarDraft = {
  noticeId: string
  title: string
  /** 截止时间(即日程开始的锚点) */
  deadlineAt: string
  /** 提醒日程开始时间,默认为截止时间前 48 小时 */
  remindAt: string
  /** 提醒日程结束时间,固定 1 小时时长,便于在日历中占位 */
  remindEndAt: string
  /** 默认提前提醒的小时数 */
  reminderLeadHours: number
  calendarName: string
  sourceNoticeTitle: string
  sourceUrl: string
  action: 'calendar-write'
}

export const DEFAULT_REMINDER_LEAD_HOURS = 48
const REMINDER_DURATION_MS = 60 * 60 * 1000
const TEST_EVENT_TAG = '【JARVIS 测试日程】'

// 演示数据使用 "YYYY-MM-DD HH:mm" 本地时间;不依赖引擎对非标准格式的宽容解析
const DEADLINE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/

export function parseDeadline(deadline: string): Date {
  const match = DEADLINE_PATTERN.exec(deadline.trim())
  if (!match) throw new Error(`截止时间无法解析或尚未核验（值：“${deadline}”），不生成提醒草稿`)
  const [, year, month, day, hour, minute] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  // Date 构造器会静默进位越界分量（如 13 月 40 日），必须回读比对防止伪造合法时间
  const rounded =
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getHours() !== Number(hour) ||
    parsed.getMinutes() !== Number(minute)
  if (Number.isNaN(parsed.getTime()) || rounded) {
    throw new Error(`截止时间数值非法（值：“${deadline}”），不生成提醒草稿`)
  }
  return parsed
}

export function buildCalendarDraft(
  notice: Pick<ProcurementNotice, 'id' | 'title' | 'url' | 'deadline'>,
  options?: { leadHours?: number; calendarName?: string }
): CalendarDraft {
  const leadHours = options?.leadHours ?? DEFAULT_REMINDER_LEAD_HOURS
  if (!Number.isFinite(leadHours) || leadHours <= 0) throw new Error('提前提醒小时数必须为正数')

  const deadline = parseDeadline(notice.deadline)
  const remindAt = new Date(deadline.getTime() - leadHours * 60 * 60 * 1000)

  return {
    noticeId: notice.id,
    title: `${TEST_EVENT_TAG}投标截止：${notice.title}`,
    deadlineAt: deadline.toISOString(),
    remindAt: remindAt.toISOString(),
    remindEndAt: new Date(remindAt.getTime() + REMINDER_DURATION_MS).toISOString(),
    reminderLeadHours: leadHours,
    calendarName: options?.calendarName ?? 'JARVIS',
    sourceNoticeTitle: notice.title,
    sourceUrl: notice.url,
    action: 'calendar-write'
  }
}

// 确认卡必须完整展示：标题、时间、日历、来源项目和将执行的动作
export function describeDraft(draft: CalendarDraft): string[] {
  return [
    `标题：${draft.title}`,
    `提醒时间：${formatLocal(draft.remindAt)}（截止 ${formatLocal(draft.deadlineAt)}）`,
    `目标日历：${draft.calendarName}`,
    `来源项目：${draft.sourceNoticeTitle}`,
    '将执行的动作：在系统日历新增一条日程（本次确认仅可用一次，写入后可在日历中删除撤销）'
  ]
}

export function formatLocal(isoTime: string): string {
  return new Date(isoTime).toLocaleString('zh-CN', { hour12: false })
}

// 生成 osascript 新增日程脚本;仅构造文本便于测试,真正执行在 calendarService 中
export function buildWriteScript(draft: CalendarDraft): string {
  // 换行会破坏 JXA 字符串字面量，一并压平
  const escape = (value: string): string =>
    value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')
  return [
    `const calendarName = "${escape(draft.calendarName)}"`,
    `const summary = "${escape(draft.title)}"`,
    `const startAt = new Date("${escape(draft.remindAt)}")`,
    `const endAt = new Date("${escape(draft.remindEndAt)}")`,
    'const calendarApp = Application("Calendar")',
    'const calendars = calendarApp.calendars.whose({name: calendarName})()',
    'if (calendars.length === 0) throw new Error("未找到目标日历：" + calendarName)',
    'const event = calendarApp.Event({summary: summary, startDate: startAt, endDate: endAt})',
    'calendarApp.calendars.byId(calendars[0].id()).events.push(event)',
    'JSON.stringify({eventId: String(event.uid()), calendar: calendarName, title: summary, startAt: startAt.toISOString()})'
  ].join('\n')
}
