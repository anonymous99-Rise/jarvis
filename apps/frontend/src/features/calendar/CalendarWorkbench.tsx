import { useState, type JSX } from 'react'
import { CalendarLtr24Regular, Checkmark20Regular, Dismiss20Regular } from '@fluentui/react-icons'
import type { ApprovalRequest, CalendarEvent, ProcurementNotice } from '@jarvis/contracts'

type CalendarWriteResult = {
  eventId: string
  calendar: string
  title: string
  startAt: string
}

type Draft = {
  notice: ProcurementNotice
  title: string
  deadlineAt: string
  remindAt: string
  calendarName: string
}

const REMINDER_LEAD_HOURS = 48
const TARGET_CALENDAR = 'JARVIS'
const DEADLINE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/

// 前端仅做草稿预览;接入 calendar:draft 通道后以后端 calendarPolicy 生成结果为准
function parseDeadline(deadline: string): Date | null {
  const match = DEADLINE_PATTERN.exec(deadline.trim())
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatLocal(isoTime: string): string {
  return new Date(isoTime).toLocaleString('zh-CN', { hour12: false })
}

export function CalendarWorkbench(): JSX.Element {
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [message, setMessage] = useState('尚未连接系统日历。首次读取可能触发 macOS 权限提示。')
  const [loading, setLoading] = useState(false)
  const [notices, setNotices] = useState<ProcurementNotice[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [writeResult, setWriteResult] = useState<CalendarWriteResult | null>(null)

  const requestAccess = async (): Promise<void> => {
    const request = await window.jarvis.requestApproval({
      action: 'permission',
      title: '允许读取系统日历？',
      summary: '读取未来 14 天的日程，用于截止提醒；不会新增、修改或删除事件。',
      target: 'macOS 系统日历（只读）'
    })
    setApproval(request)
  }

  const loadNotices = async (): Promise<void> => {
    const snapshot = await window.jarvis.listNotices()
    setNotices(snapshot.notices.filter((notice) => parseDeadline(notice.deadline)))
    setMessage(`已加载 ${snapshot.notices.length} 个项目，其中 ${snapshot.notices.length ? '可解析截止时间的项目可生成提醒' : '暂无可提醒项目'}`)
  }

  const makeDraft = (notice: ProcurementNotice): void => {
    const deadline = parseDeadline(notice.deadline)
    if (!deadline) {
      setMessage(`项目「${notice.title}」的截止时间尚未核验，不能生成提醒草稿。`)
      return
    }
    setWriteResult(null)
    setDraft({
      notice,
      title: `【JARVIS 测试日程】投标截止：${notice.title}`,
      deadlineAt: deadline.toISOString(),
      remindAt: new Date(deadline.getTime() - REMINDER_LEAD_HOURS * 60 * 60 * 1000).toISOString(),
      calendarName: TARGET_CALENDAR
    })
  }

  const confirmWrite = async (): Promise<void> => {
    if (!draft) return
    const request = await window.jarvis.requestApproval({
      action: 'calendar-write',
      title: draft.title,
      summary: `提醒时间：${formatLocal(draft.remindAt)}（截止 ${formatLocal(draft.deadlineAt)}，默认提前 ${REMINDER_LEAD_HOURS} 小时）`,
      target: `日历「${draft.calendarName}」新增日程 · 来源项目：${draft.notice.title} · 动作：新增（一次性确认，写入后可在日历删除撤销）`
    })
    setApproval(request)
  }

  const decideRead = async (approved: boolean): Promise<void> => {
    if (!approval) return
    const decided = await window.jarvis.decideApproval(approval.id, approved)
    setApproval(decided)
    if (!approved) {
      setMessage('已取消，本次没有访问系统日历。')
      return
    }
    setLoading(true)
    setMessage('正在读取未来 14 天日程')
    try {
      const result = await window.jarvis.readCalendar(decided.id)
      setEvents(result)
      setMessage(result.length ? `已读取 ${result.length} 项日程` : '未来 14 天没有日程')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '日历读取失败')
    } finally {
      setLoading(false)
    }
  }

  const decideWrite = async (approved: boolean): Promise<void> => {
    if (!approval || !draft) return
    const decided = await window.jarvis.decideApproval(approval.id, approved)
    setApproval(decided)
    if (!approved) {
      setMessage('已拒绝写入，系统日历未被修改。')
      return
    }
    const api = window.jarvis as unknown as {
      writeCalendar?: (approvalId: string, draft: Draft) => Promise<CalendarWriteResult>
    }
    if (typeof api.writeCalendar !== 'function') {
      setMessage('确认令牌已批准；calendar:write 通道接入后执行写入（当前为待写入状态）。')
      return
    }
    try {
      const result = await api.writeCalendar(decided.id, draft)
      setWriteResult(result)
      setMessage(`已写入日程「${result.title}」，可在系统日历中删除以撤销。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '日历写入失败，确认令牌仍可重试')
    }
  }

  return (
    <section className="task-workbench">
      <header className="project-workbench__header">
        <div>
          <span className="section-heading__label">日程与截止提醒</span>
          <h2>系统日历</h2>
          <p>只读连接即刻可用；写入截止提醒必须逐条确认，确认令牌只能使用一次。</p>
        </div>
        <div>
          <button className="primary-action" disabled={loading} onClick={requestAccess} type="button">
            <CalendarLtr24Regular /> {loading ? '读取中' : '连接日历'}
          </button>
          <button className="secondary-action" onClick={() => void loadNotices()} type="button">
            加载项目截止时间
          </button>
        </div>
      </header>

      {approval?.status === 'pending' && approval.action === 'permission' && (
        <article className="approval-card">
          <span className="approval-card__eyebrow">需要 sir 确认</span>
          <h3>{approval.title}</h3>
          <p>{approval.summary}</p>
          <code>{approval.target}</code>
          <div className="approval-card__actions">
            <button className="primary-action" onClick={() => void decideRead(true)} type="button"><Checkmark20Regular /> 允许本次读取</button>
            <button className="secondary-action" onClick={() => void decideRead(false)} type="button"><Dismiss20Regular /> 取消</button>
          </div>
        </article>
      )}

      {approval?.status === 'pending' && approval.action === 'calendar-write' && draft && (
        <article className="approval-card">
          <span className="approval-card__eyebrow">需要 sir 确认写入</span>
          <h3>确认卡 · 创建日历提醒</h3>
          <p>标题：{draft.title}</p>
          <p>时间：{formatLocal(draft.remindAt)}（项目截止 {formatLocal(draft.deadlineAt)}，默认提前 {REMINDER_LEAD_HOURS} 小时）</p>
          <p>日历：{draft.calendarName}</p>
          <p>来源项目：{draft.notice.title}</p>
          <code>将执行的动作：在系统日历新增一条日程；本确认令牌只能消费一次，写入成功后失效。</code>
          <div className="approval-card__actions">
            <button className="primary-action" onClick={() => void decideWrite(true)} type="button"><Checkmark20Regular /> 确认写入</button>
            <button className="secondary-action" onClick={() => void decideWrite(false)} type="button"><Dismiss20Regular /> 拒绝</button>
          </div>
        </article>
      )}

      <div className="project-message"><CalendarLtr24Regular /> {message}</div>

      {notices.length > 0 && (
        <div className="calendar-list">
          {notices.map((notice) => (
            <article className="calendar-event" key={notice.id}>
              <time>{notice.deadline}</time>
              <div>
                <strong>{notice.title}</strong>
                <span>{notice.sourceName} · 截止 {notice.deadline}</span>
              </div>
              <button className="secondary-action" onClick={() => makeDraft(notice)} type="button">
                生成提醒草稿
              </button>
            </article>
          ))}
        </div>
      )}

      {writeResult && (
        <div className="project-message">
          已写入：{writeResult.title} @ {writeResult.calendar}，{formatLocal(writeResult.startAt)}（可在日历中删除撤销）
        </div>
      )}

      <div className="calendar-list">
        {events.map((event) => (
          <article className="calendar-event" key={`${event.calendar}:${event.id}`}>
            <time>{formatLocal(event.startAt)}</time>
            <div><strong>{event.title}</strong><span>{event.calendar}{event.location ? ` · ${event.location}` : ''}</span></div>
          </article>
        ))}
      </div>
    </section>
  )
}
