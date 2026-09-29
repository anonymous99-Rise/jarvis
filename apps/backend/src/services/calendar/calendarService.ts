import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { CalendarEvent } from '@jarvis/contracts'
import type { ApprovalService } from '../approvals/approvalService'
import { buildWriteScript, type CalendarDraft } from './calendarPolicy'

const execFileAsync = promisify(execFile)

const CALENDAR_SCRIPT = `
const calendarApp = Application('Calendar');
const now = new Date();
const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
const output = [];
for (const calendar of calendarApp.calendars()) {
  for (const event of calendar.events()) {
    const start = event.startDate();
    if (start < now || start > until) continue;
    output.push({
      id: String(event.uid()),
      calendar: String(calendar.name()),
      title: String(event.summary()),
      startAt: start.toISOString(),
      endAt: event.endDate().toISOString(),
      location: String(event.location() || '')
    });
  }
}
JSON.stringify(output.sort((a, b) => a.startAt.localeCompare(b.startAt)));
`

export async function readUpcomingCalendarEvents(): Promise<CalendarEvent[]> {
  if (process.platform !== 'darwin') throw new Error('当前演示版仅支持读取 macOS 系统日历')
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', CALENDAR_SCRIPT], {
    timeout: 20_000,
    maxBuffer: 2 * 1024 * 1024
  })
  const parsed: unknown = JSON.parse(stdout.trim() || '[]')
  if (!Array.isArray(parsed)) throw new Error('系统日历返回格式异常')
  return parsed as CalendarEvent[]
}

export type CalendarWriteResult = {
  eventId: string
  calendar: string
  title: string
  startAt: string
}

// 未获得 calendar-write 确认令牌前不触碰系统日历；写入成功后才消费令牌，保证只能写入一次
export async function writeConfirmedEvent(
  approvalService: ApprovalService,
  approvalId: string,
  draft: CalendarDraft
): Promise<CalendarWriteResult> {
  approvalService.getApproved(approvalId, 'calendar-write')
  if (process.platform !== 'darwin') throw new Error('当前演示版仅支持写入 macOS 系统日历')
  if (draft.action !== 'calendar-write') throw new Error('草稿动作与审批范围不一致')

  const { stdout } = await execFileAsync(
    '/usr/bin/osascript',
    ['-l', 'JavaScript', '-e', buildWriteScript(draft)],
    { timeout: 20_000, maxBuffer: 1024 * 1024 }
  )
  const result: unknown = JSON.parse(stdout.trim())
  if (!result || typeof result !== 'object' || !('eventId' in result)) {
    throw new Error('日历写入返回格式异常')
  }
  approvalService.consume(approvalId, 'calendar-write')
  return result as CalendarWriteResult
}
