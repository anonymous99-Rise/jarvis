import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { CalendarEvent } from '@jarvis/contracts'

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
