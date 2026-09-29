import {
  ArrowUpRight20Regular,
  Dismiss20Regular,
  Hourglass20Regular,
  Link20Regular,
  ShieldQuestion20Regular
} from '@fluentui/react-icons'
import type { JSX } from 'react'
import type { NoticeDetail, NoticeSnapshot, SourcedFact } from '@jarvis/contracts'

type Field = {
  key: keyof Omit<NoticeDetail, 'noticeId'>
  label: string
  fact: SourcedFact
}

const STATUS_LABEL: Record<SourcedFact['status'], string> = {
  verified: '已核验',
  pending: '待核实',
  missing: '缺失'
}

const STATUS_HINT: Record<SourcedFact['status'], string> = {
  verified: '来自公告原文，已与官网信息一致。',
  pending: '来源尚不一致，需要人工二次核实。',
  missing: '公告未公开该字段，演示版不补默认值。'
}

type Props = {
  noticeId: string | null
  detail: NoticeDetail | null
  loading: boolean
  error: string | null
  snapshot: NoticeSnapshot
  assessing: boolean
  onRunAssessment: () => void
  onRetry: () => void
  onClose: () => void
}

export function ProjectDetailPanel({
  noticeId,
  detail,
  loading,
  error,
  snapshot,
  assessing,
  onRunAssessment,
  onRetry,
  onClose
}: Props): JSX.Element {
  if (!noticeId) {
    return (
      <aside className="detail-panel detail-panel--idle" aria-label="项目详情">
        <div className="detail-panel__empty">
          <ShieldQuestion20Regular />
          <strong>选择左侧公告查看详情</strong>
          <span>指挥台只会展示来自公告原文的事实，缺失字段会显式标注。</span>
        </div>
      </aside>
    )
  }

  const notice = snapshot.notices.find((item) => item.id === noticeId) ?? null

  return (
    <aside className="detail-panel" aria-label={`公告详情 ${noticeId}`}>
      <header className="detail-panel__header">
        <div className="detail-panel__heading">
          <span className="section-heading__label">公告事实 · 来自原文</span>
          <h3>{notice ? notice.title : '加载详情中'}</h3>
          {notice && (
            <p>
              {notice.sourceName} · {notice.region} · {notice.noticeType}
            </p>
          )}
        </div>
        <button className="icon-action" onClick={onClose} type="button" title="收起详情">
          <Dismiss20Regular />
        </button>
      </header>

      {error ? (
        <div className="detail-panel__error" role="alert">
          <strong>详情读取失败</strong>
          <span>{error}</span>
          <button className="secondary-action" onClick={onRetry} type="button">重试</button>
        </div>
      ) : loading || !detail ? (
        <div className="detail-panel__loading">
          <Hourglass20Regular /> 正在读取公告详情（联调模式走本地快照）
        </div>
      ) : (
        <>
          <ul className="fact-list">
            {buildFields(noticeId, detail).map((field) => (
              <li key={field.key} className={`fact-item fact-item--${field.fact.status}`}>
                <div className="fact-item__label">
                  <span>{field.label}</span>
                  <span className={`fact-status fact-status--${field.fact.status}`}>
                    {STATUS_LABEL[field.fact.status]}
                  </span>
                </div>
                <div className="fact-item__value">
                  {field.fact.value || '【待补充】'}
                </div>
                <div className="fact-item__source">
                  {field.fact.sourceUrl ? (
                    <a href={field.fact.sourceUrl} target="_blank" rel="noreferrer">
                      <Link20Regular /> {field.fact.sourceUrl}
                    </a>
                  ) : (
                    <span className="fact-item__source fact-item__source--missing">
                      公告未提供原始链接
                    </span>
                  )}
                  <span className="fact-item__captured">
                    采集于 {formatTime(field.fact.fetchedAt)} · {STATUS_HINT[field.fact.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="detail-panel__actions">
            <button
              className="primary-action"
              disabled={assessing}
              onClick={onRunAssessment}
              type="button"
            >
              {assessing ? '诊断中' : '开始可投性诊断'}
            </button>
            {notice && (
              <button
                className="secondary-action"
                onClick={() => window.jarvis.openExternal(notice.url)}
                type="button"
              >
                官网核验 <ArrowUpRight20Regular />
              </button>
            )}
            <span className="detail-panel__note">
              详情区只包含公告原文事实；系统分析与行动建议将在右侧诊断面板单独展示。
            </span>
          </div>
        </>
      )}
    </aside>
  )
}

function buildFields(noticeId: string, detail: NoticeDetail): Field[] {
  if (detail.noticeId !== noticeId) return []
  return [
    { key: 'projectCode', label: '项目编号', fact: detail.projectCode },
    { key: 'buyer', label: '采购人', fact: detail.buyer },
    { key: 'budget', label: '预算金额', fact: detail.budget },
    { key: 'constructionSummary', label: '建设内容摘要', fact: detail.constructionSummary },
    { key: 'qualification', label: '资格要求', fact: detail.qualification },
    { key: 'registrationDeadline', label: '报名截止', fact: detail.registrationDeadline },
    { key: 'bidDeadline', label: '投标截止', fact: detail.bidDeadline }
  ]
}

function formatTime(iso: string): string {
  if (!iso) return '未知时间'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
