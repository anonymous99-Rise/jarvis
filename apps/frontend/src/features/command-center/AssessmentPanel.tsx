import {
  CheckmarkCircle20Regular,
  Clock20Regular,
  Dismiss20Regular,
  ErrorCircle20Regular,
  Flag20Regular,
  Hourglass20Regular,
  Lightbulb20Regular
} from '@fluentui/react-icons'
import type { JSX } from 'react'
import type {
  FeasibilityAssessment,
  FeasibilityConclusion,
  HardGate,
  SourcedFact
} from '@jarvis/contracts'

type Props = {
  assessment: FeasibilityAssessment | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onClose: () => void
}

const CONCLUSION_LABEL: Record<FeasibilityConclusion, string> = {
  建议参与: '建议参与',
  进一步核实: '进一步核实',
  不建议参与: '不建议参与'
}

export function AssessmentPanel({ assessment, loading, error, onRetry, onClose }: Props): JSX.Element {
  if (loading) {
    return (
      <aside className="assessment-panel assessment-panel--loading" aria-label="可投性诊断">
        <header className="assessment-panel__header">
          <span className="section-heading__label">系统分析 · 规则引擎</span>
          <h3>正在运行可投性诊断</h3>
        </header>
        <div className="assessment-panel__loading">
          <Hourglass20Regular /> 读取硬门槛、风险与建议中（联调模式走本地快照）
        </div>
      </aside>
    )
  }

  if (error) {
    return (
      <aside className="assessment-panel assessment-panel--error" aria-label="可投性诊断">
        <header className="assessment-panel__header">
          <div>
            <span className="section-heading__label">系统分析 · 规则引擎</span>
            <h3>诊断未能完成</h3>
          </div>
          <button className="icon-action" onClick={onClose} type="button" title="关闭诊断">
            <Dismiss20Regular />
          </button>
        </header>
        <p className="assessment-panel__error" role="alert">{error}</p>
        <button className="secondary-action" onClick={onRetry} type="button">重新运行诊断</button>
      </aside>
    )
  }

  if (!assessment) {
    return (
      <aside className="assessment-panel assessment-panel--idle" aria-label="可投性诊断">
        <header className="assessment-panel__header">
          <span className="section-heading__label">系统分析 · 规则引擎</span>
          <h3>等待诊断指令</h3>
        </header>
        <p className="assessment-panel__hint">
          在公告详情中选择“开始可投性诊断”。诊断结论仅基于公告事实和公司内部证据，不替换 sir 的业务判断。
        </p>
      </aside>
    )
  }

  const tone = conclusionTone(assessment.conclusion)

  return (
    <aside className={`assessment-panel assessment-panel--${tone}`} aria-label="可投性诊断">
      <header className="assessment-panel__header">
        <div>
          <span className="section-heading__label">系统分析 · 规则引擎</span>
          <h3>
            <Flag20Regular /> {CONCLUSION_LABEL[assessment.conclusion]}
          </h3>
          <p>置信度 {Math.round(assessment.confidence * 100)}% · 评估时间 {formatTime(assessment.assessedAt)}</p>
        </div>
        <button className="icon-action" onClick={onClose} type="button" title="关闭诊断">
          <Dismiss20Regular />
        </button>
      </header>

      <section className="assessment-block">
        <h4>硬门槛</h4>
        <ul className="gate-list">
          {assessment.hardGates.map((gate) => (
            <GateRow key={gate.name} gate={gate} />
          ))}
        </ul>
      </section>

      <section className="assessment-block">
        <h4>风险提示</h4>
        {assessment.risks.length === 0 ? (
          <p className="assessment-block__empty">未识别到需 sir 立即处理的风险。</p>
        ) : (
          <ul className="risk-list">
            {assessment.risks.map((risk, index) => (
              <li key={index}>
                <ErrorCircle20Regular /> {risk}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="assessment-block">
        <h4>支撑证据</h4>
        <ul className="evidence-list">
          {assessment.evidence.map((fact, index) => (
            <EvidenceRow key={index} fact={fact} />
          ))}
        </ul>
      </section>

      <section className="assessment-block assessment-block--actions">
        <h4>行动建议</h4>
        {assessment.recommendedActions.length === 0 ? (
          <p className="assessment-block__empty">暂无可执行的下一步建议。</p>
        ) : (
          <ol className="action-list">
            {assessment.recommendedActions.map((action, index) => (
              <li key={index}>
                <Lightbulb20Regular /> {action}
              </li>
            ))}
          </ol>
        )}
        <p className="assessment-panel__note">
          系统分析与公告事实分栏呈现；最终是否参与由 sir 决定，不会自动写入外部系统。
        </p>
      </section>
    </aside>
  )
}

function GateRow({ gate }: { gate: HardGate }): JSX.Element {
  const passed = gate.result === 'pass'
  return (
    <li className={`gate-row gate-row--${gate.result}`}>
      {passed ? <CheckmarkCircle20Regular /> : <ErrorCircle20Regular />}
      <div>
        <strong>{gate.name}</strong>
        <span>{passed ? '通过' : '未通过'}</span>
        <p>{gate.reason}</p>
      </div>
    </li>
  )
}

function EvidenceRow({ fact }: { fact: SourcedFact }): JSX.Element {
  return (
    <li className={`evidence-row evidence-row--${fact.status}`}>
      <Clock20Regular />
      <div>
        <span className="evidence-row__value">{fact.value}</span>
        <span className="evidence-row__meta">
          {labelFor(fact.status)} · {fact.sourceUrl || '无原始链接'}
        </span>
      </div>
    </li>
  )
}

function labelFor(status: SourcedFact['status']): string {
  if (status === 'verified') return '已核验证据'
  if (status === 'pending') return '内部确认 · 待原件核验'
  return '公开信息'
}

function conclusionTone(conclusion: FeasibilityConclusion): 'positive' | 'warn' | 'negative' {
  if (conclusion === '建议参与') return 'positive'
  if (conclusion === '不建议参与') return 'negative'
  return 'warn'
}

function formatTime(iso: string): string {
  if (!iso) return '未知时间'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
