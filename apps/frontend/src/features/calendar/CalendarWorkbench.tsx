import { useState, type JSX } from 'react'
import { CalendarLtr24Regular, Checkmark20Regular, Dismiss20Regular } from '@fluentui/react-icons'
import type { ApprovalRequest, CalendarEvent } from '@jarvis/contracts'

export function CalendarWorkbench(): JSX.Element {
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [message, setMessage] = useState('尚未连接系统日历。首次读取可能触发 macOS 权限提示。')
  const [loading, setLoading] = useState(false)

  const requestAccess = async (): Promise<void> => {
    const request = await window.jarvis.requestApproval({
      action: 'permission',
      title: '允许读取系统日历？',
      summary: '读取未来 14 天的日程，用于截止提醒；不会新增、修改或删除事件。',
      target: 'macOS 系统日历（只读）'
    })
    setApproval(request)
  }

  const decide = async (approved: boolean): Promise<void> => {
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

  return (
    <section className="task-workbench">
      <header className="project-workbench__header">
        <div>
          <span className="section-heading__label">日程与截止提醒</span>
          <h2>系统日历</h2>
          <p>当前仅提供只读连接；任何写入、更新或删除都必须再次确认。</p>
        </div>
        <button className="primary-action" disabled={loading} onClick={requestAccess} type="button">
          <CalendarLtr24Regular /> {loading ? '读取中' : '连接日历'}
        </button>
      </header>

      {approval?.status === 'pending' && (
        <article className="approval-card">
          <span className="approval-card__eyebrow">需要 sir 确认</span>
          <h3>{approval.title}</h3>
          <p>{approval.summary}</p>
          <code>{approval.target}</code>
          <div className="approval-card__actions">
            <button className="primary-action" onClick={() => void decide(true)} type="button"><Checkmark20Regular /> 允许本次读取</button>
            <button className="secondary-action" onClick={() => void decide(false)} type="button"><Dismiss20Regular /> 取消</button>
          </div>
        </article>
      )}

      <div className="project-message"><CalendarLtr24Regular /> {message}</div>
      <div className="calendar-list">
        {events.map((event) => (
          <article className="calendar-event" key={`${event.calendar}:${event.id}`}>
            <time>{new Date(event.startAt).toLocaleString('zh-CN', { hour12: false })}</time>
            <div><strong>{event.title}</strong><span>{event.calendar}{event.location ? ` · ${event.location}` : ''}</span></div>
          </article>
        ))}
      </div>
    </section>
  )
}
