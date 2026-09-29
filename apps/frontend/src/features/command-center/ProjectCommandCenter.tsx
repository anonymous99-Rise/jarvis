import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  ArrowClockwise20Regular,
  ArrowUpRight20Regular,
  CalendarClock20Regular,
  DatabaseSearch20Regular,
  Search20Regular
} from '@fluentui/react-icons'
import type {
  FeasibilityAssessment,
  NoticeDetail,
  NoticeSnapshot,
  ProcurementNotice
} from '@jarvis/contracts'
import { AssessmentPanel } from './AssessmentPanel'
import { ProjectDetailPanel } from './ProjectDetailPanel'

const emptySnapshot: NoticeSnapshot = { notices: [], sources: [], refreshedAt: '' }

export function ProjectCommandCenter(): JSX.Element {
  const [snapshot, setSnapshot] = useState<NoticeSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [relevantOnly, setRelevantOnly] = useState(true)
  const [message, setMessage] = useState('正在读取本地公告库')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<NoticeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [assessment, setAssessment] = useState<FeasibilityAssessment | null>(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const detailRequest = useRef(0)
  const assessmentRequest = useRef(0)

  useEffect(() => {
    window.jarvis.listNotices()
      .then(async (data) => {
        if (data.refreshedAt) {
          setSnapshot(data)
          setMessage(`已读取本地公告快照，共 ${data.notices.length} 条`)
          return
        }
        setMessage('首次进入，正在低频读取两个政府采购官网')
        const fresh = await window.jarvis.refreshNotices()
        setSnapshot(fresh)
        setMessage(`首次采集完成，共读取 ${fresh.notices.length} 条公开公告`)
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '读取失败'))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => snapshot.notices.filter((notice) => {
    if (relevantOnly && !notice.relevant) return false
    const term = query.trim().toLowerCase()
    if (!term) return true
    return `${notice.title} ${notice.buyer} ${notice.region} ${notice.matchedKeywords.join(' ')}`
      .toLowerCase().includes(term)
  }), [query, relevantOnly, snapshot.notices])

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setMessage('正在低频读取两个政府采购官网')
    try {
      const data = await window.jarvis.refreshNotices()
      setSnapshot(data)
      const failures = data.sources.filter((source) => !source.ok)
      setMessage(failures.length === 0
        ? `采集完成，共读取 ${data.notices.length} 条公开公告`
        : `已保留可用结果；${failures.map((item) => item.sourceName).join('、')}读取异常`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '公告采集失败')
    } finally {
      setLoading(false)
    }
  }

  const openDetail = async (notice: ProcurementNotice): Promise<void> => {
    const requestId = ++detailRequest.current
    assessmentRequest.current += 1
    setSelectedId(notice.id)
    setDetail(null)
    setDetailError(null)
    setAssessment(null)
    setAssessmentError(null)
    setAssessmentLoading(false)
    setDetailLoading(true)
    try {
      const result = await window.jarvis.getNoticeDetail(notice.id)
      if (requestId !== detailRequest.current) return
      setDetail(result)
    } catch (error) {
      if (requestId !== detailRequest.current) return
      const errorMessage = error instanceof Error ? error.message : '读取详情失败'
      setDetailError(errorMessage)
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false)
    }
  }

  const closeDetail = (): void => {
    detailRequest.current += 1
    assessmentRequest.current += 1
    setSelectedId(null)
    setDetail(null)
    setDetailError(null)
    setAssessment(null)
    setAssessmentError(null)
    setDetailLoading(false)
    setAssessmentLoading(false)
  }

  const runAssessment = async (): Promise<void> => {
    if (!selectedId) return
    const requestId = ++assessmentRequest.current
    const noticeId = selectedId
    setAssessmentLoading(true)
    setAssessment(null)
    setAssessmentError(null)
    try {
      const result = await window.jarvis.runFeasibility(noticeId)
      if (requestId !== assessmentRequest.current) return
      setAssessment(result)
    } catch (error) {
      if (requestId !== assessmentRequest.current) return
      setAssessmentError(error instanceof Error ? error.message : '可投性诊断失败')
    } finally {
      if (requestId === assessmentRequest.current) setAssessmentLoading(false)
    }
  }

  const closeAssessment = (): void => {
    assessmentRequest.current += 1
    setAssessment(null)
    setAssessmentError(null)
    setAssessmentLoading(false)
  }

  const displayedNotices = visible.slice(0, 40)

  const refreshedAt = snapshot.refreshedAt
    ? new Date(snapshot.refreshedAt).toLocaleString('zh-CN', { hour12: false })
    : '尚未刷新'

  return (
    <section className="project-workbench project-workbench--with-detail">
      <header className="project-workbench__header">
        <div>
          <span className="section-heading__label">JARVIS 前线</span>
          <h2>全国信息化项目作战指挥台</h2>
          <p>当前演示源：中国政府采购网、宁夏政府采购网。资料只保存在本机。</p>
        </div>
        <button className="primary-action" disabled={loading} onClick={refresh} type="button">
          <ArrowClockwise20Regular /> {loading ? '执行中' : '刷新公告'}
        </button>
      </header>

      <div className="project-source-strip">
        {snapshot.sources.length === 0 ? (
          <span className="source-chip source-chip--idle">等待首次采集</span>
        ) : snapshot.sources.map((source) => (
          <span className={source.ok ? 'source-chip source-chip--ok' : 'source-chip source-chip--error'} key={source.source}>
            {source.sourceName} · {source.ok ? `${source.count}条` : '异常'}
          </span>
        ))}
        <span className="project-source-strip__time">最近刷新：{refreshedAt}</span>
      </div>

      <div className="project-workbench__body">
        <div className="project-workbench__list-column">
          <div className="project-toolbar">
            <label className="project-search">
              <Search20Regular />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、采购人或关键词" />
            </label>
            <label className="filter-toggle">
              <input checked={relevantOnly} onChange={(event) => setRelevantOnly(event.target.checked)} type="checkbox" />
              仅看信息化机会
            </label>
            <span className="project-toolbar__count">显示 {displayedNotices.length} / {snapshot.notices.length} 条</span>
          </div>

          <div className="project-message"><DatabaseSearch20Regular /> {message}</div>

          {visible.length === 0 ? (
            <div className="empty-state project-empty">
              <DatabaseSearch20Regular />
              <strong>{snapshot.notices.length === 0 ? '本地还没有公告数据' : '当前条件没有匹配项目'}</strong>
              <span>{snapshot.notices.length === 0 ? '点击“刷新公告”开始读取公开信息' : '可关闭信息化筛选或更换关键词'}</span>
            </div>
          ) : (
            <div className="notice-list">
              {displayedNotices.map((notice) => {
                const active = notice.id === selectedId
                return (
                  <article
                    className={active ? 'notice-card notice-card--active' : 'notice-card'}
                    key={`${notice.source}:${notice.id}`}
                  >
                    <div
                      className="notice-card__main"
                      onClick={() => void openDetail(notice)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          void openDetail(notice)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`查看项目详情：${notice.title}`}
                    >
                      <div className="notice-card__badges">
                        <span>{notice.sourceName}</span>
                        <span>{notice.region}</span>
                        <span>{notice.noticeType}</span>
                      </div>
                      <h3>{notice.title}</h3>
                      <p>{notice.buyer}</p>
                      {notice.matchedKeywords.length > 0 && (
                        <div className="notice-card__keywords">
                          {notice.matchedKeywords.slice(0, 5).map((keyword) => <span key={keyword}>{keyword}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="notice-card__facts">
                      <span><CalendarClock20Regular /> 发布于 {notice.publishedAt}</span>
                      <span>预算：{notice.budget}</span>
                      <span>截止：{notice.deadline}</span>
                    </div>
                    <div className="notice-card__actions">
                      <button
                        className="link-action"
                        onClick={() => void openDetail(notice)}
                        type="button"
                      >
                        查看详情
                      </button>
                      <button
                        className="secondary-action"
                        onClick={() => window.jarvis.openExternal(notice.url)}
                        type="button"
                      >
                        官网核验 <ArrowUpRight20Regular />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <ProjectDetailPanel
          noticeId={selectedId}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          snapshot={snapshot}
          assessing={assessmentLoading}
          onRunAssessment={runAssessment}
          onRetry={() => {
            const notice = snapshot.notices.find((item) => item.id === selectedId)
            if (notice) void openDetail(notice)
          }}
          onClose={closeDetail}
        />

        <AssessmentPanel
          assessment={assessment}
          loading={assessmentLoading}
          error={assessmentError}
          onRetry={() => void runAssessment()}
          onClose={closeAssessment}
        />
      </div>
    </section>
  )
}
