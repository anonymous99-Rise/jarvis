import { useState, type JSX } from 'react'
import { CalendarLtr24Regular, Checkmark20Regular, Dismiss20Regular } from '@fluentui/react-icons'
import type { ApprovalRequest, CalendarEvent, ProcurementNotice } from '@jarvis/contracts'

// 与后端 calendarPolicy.CalendarDraft 字段一一对应；成员1把该类型收录进 @jarvis/contracts 后改为统一导入
type CalendarDraft = {
  noticeId: string
  title: string
  deadlineAt: string
  remindAt: string
  remindEndAt: string
  reminderLeadHours: number
  calendarName: string
  sourceNoticeTitle: string
  sourceUrl: string
  action: 'calendar-write'
}

type CalendarWriteResult = {
  eventId: string
  calendar: string
  title: string
  startAt: string
}

const REMINDER_LEAD_HOURS = 48
const REMINDER_DURATION_MS = 60 * 60 * 1000
const TARGET_CALENDAR = 'JARVIS'
const TEST_EVENT_TAG = '【JARVIS 测试日程】'
const DEADLINE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/

// 前端仅做草稿预览;接入 calendar:draft 通道后以后端 calendarPolicy 生成结果为准
function parseDeadline(deadline: string): Date | null {
  const match = DEADLINE_PATTERN.exec(deadline.trim())
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  // 与后端一致：Date 构造器会静默进位越界分量，必须回读比对
  const rounded =
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getHours() !== Number(hour) ||
    parsed.getMinutes() !== Number(minute)
  return Number.isNaN(parsed.getTime()) || rounded ? null : parsed
}

function formatLocal(isoTime: string): string {
  return new Date(isoTime).toLocaleString('zh-CN', { hour12: false })
}

export function CalendarWorkbench(): JSX.Element {
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [message, setMessage] = useState('尚未连接系统日历。读取日程需先确认；写入截止提醒必须逐条确认，确认令牌只能使用一次。')
  const [loading, setLoading] = useState(false)
  const [notices, setNotices] = useState<ProcurementNotice[]>([])
  const [draft, setDraft] = useState<CalendarDraft | null>(null)

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
    setLoading(true)
    try {
      const snapshot = await window.jarvis.listNotices()
      const usable = snapshot.notices.filter((notice) => parseDeadline(notice.deadline))
      setNotices(usable)
      setMessage(`已加载 ${snapshot.notices.length} 个项目，其中 ${usable.length} 个截止时间可核验、可生成提醒`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '项目列表加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 生成草稿并立即发起写入审批：确认卡是发起写入的唯一入口
  const makeDraft = (notice: ProcurementNotice): void => {
    const deadline = parseDeadline(notice.deadline)
    if (!deadline) {
      setMessage(`项目「${notice.title}」的截止时间尚未核验，不能生成提醒草稿。`)
      return
    }
    const remindAt = new Date(deadline.getTime() - REMINDER_LEAD_HOURS * 60 * 60 * 1000)
    const next: CalendarDraft = {
      noticeId: notice.id,
      title: `${TEST_EVENT_TAG}投标截止：${notice.title}`,
      deadlineAt: deadline.toISOString(),
      remindAt: remindAt.toISOString(),
      remindEndAt: new Date(remindAt.getTime() + REMINDER_DURATION_MS).toISOString(),
      reminderLeadHours: REMINDER_LEAD_HOURS,
      calendarName: TARGET_CALENDAR,
      sourceNoticeTitle: notice.title,
      sourceUrl: notice.url,
      action: 'calendar-write'
    }
    // 新草稿作废仍在等待确认的旧审批，避免用旧令牌写新内容
    setApproval(null)
    setDraft(next)
    void confirmWrite(next)
  }

  const confirmWrite = async (pending: CalendarDraft): Promise<void> => {
    try {
      const request = await window.jarvis.requestApproval({
        action: 'calendar-write',
        title: pending.title,
        summary: `提醒时间：${formatLocal(pending.remindAt)}（截止 ${formatLocal(pending.deadlineAt)}，默认提前 ${REMINDER_LEAD_HOURS} 小时）`,
        target: `日历「${pending.calendarName}」新增日程 · 来源项目：${pending.sourceNoticeTitle} · 动作：新增（一次性确认，写入后可在日历删除撤销）`
      })
      setApproval(request)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '写入审批发起失败')
    }
  }

  const decideRead = async (approved: boolean): Promise<void> => {
    if (!approval) return
    try {
      const decided = await window.jarvis.decideApproval(approval.id, approved)
      setApproval(decided)
      if (!approved) {
        setMessage('已取消，本次没有访问系统日历。')
        return
      }
      setLoading(true)
      setMessage('正在读取未来 14 天日程')
      const result = await window.jarvis.readCalendar(decided.id)
      setEvents(result)
      setMessage(result.length ? `已读取 ${result.length} 项日程` : '未来 14 天没有日程')
    } catch (error) {
      setApproval(null)
      setMessage(error instanceof Error ? error.message : '日历读取失败')
    } finally {
      setLoading(false)
    }
  }

  const decideWrite = async (approved: boolean): Promise<void> => {
    if (!approval || !draft) return
    if (approval.title !== draft.title) {
      setMessage('确认卡与当前草稿不一致，已作废；请重新生成提醒草稿。')
      setApproval(null)
      return
    }
    try {
      const decided = await window.jarvis.decideApproval(approval.id, approved)
      setApproval(decided)
      if (!approved) {
        setMessage('已拒绝写入，系统日历未被修改。')
        return
      }
      const api = window.jarvis as unknown as {
        writeCalendar?: (approvalId: string, draft: CalendarDraft) => Promise<CalendarWriteResult>
      }
      if (typeof api.writeCalendar !== 'function') {
        setMessage('确认令牌已批准；calendar:write 通道接入后执行写入（当前为待写入状态）。')
        return
      }
      const result = await api.writeCalendar(decided.id, draft)
      setMessage(`已写入：${result.title} @ ${result.calendar}，${formatLocal(result.startAt)}（可在日历中删除撤销）`)
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
          <p>读取日程需先确认；写入截止提醒必须逐条确认，确认令牌只能使用一次。</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="primary-action" disabled={loading} onClick={() => void requestAccess()} type="button">
            <CalendarLtr24Regular /> {loading ? '读取中' : '连接日历'}
          </button>
          <button className="secondary-action" disabled={loading} onClick={() => void loadNotices()} type="button">
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
          <p>提醒时间：{formatLocal(draft.remindAt)}（截止 {formatLocal(draft.deadlineAt)}）</p>
          <p>目标日历：{draft.calendarName}</p>
          <p>来源项目：{draft.sourceNoticeTitle}</p>
          <code>将执行的动作：在系统日历新增一条日程（本次确认仅可用一次，写入后可在日历中删除撤销）</code>
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
