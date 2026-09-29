import type { JSX } from 'react'
import { assistantLabels, type AssistantState } from './assistantMachine'

type JarvisCoreProps = {
  state: AssistantState
}

export function JarvisCore({ state }: JarvisCoreProps): JSX.Element {
  return (
    <section className={`jarvis-core jarvis-core--${state}`} aria-live="polite">
      <div className="jarvis-core__halo" aria-hidden="true" />
      <div className="jarvis-core__orbit jarvis-core__orbit--outer" aria-hidden="true" />
      <div className="jarvis-core__orbit jarvis-core__orbit--inner" aria-hidden="true" />
      <div className="jarvis-core__center" aria-hidden="true">
        <span>J</span>
      </div>
      <div className="jarvis-core__caption">
        <strong>{assistantLabels[state]}</strong>
        <span>{state === 'idle' ? '⌘⇧J 唤醒' : '语音通道已激活'}</span>
      </div>
    </section>
  )
}
