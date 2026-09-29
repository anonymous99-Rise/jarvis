import { useEffect, useState, type JSX } from 'react'
import {
  Mic24Regular,
  PanelRightContract24Regular,
  Play24Regular,
  Stop24Regular
} from '@fluentui/react-icons'
import { JarvisCore } from '../features/assistant/JarvisCore'
import { useAssistantStore } from '../features/assistant/assistantStore'
import { ConversationPanel } from '../features/assistant/ConversationPanel'
import { CommandCenterPreview } from '../features/command-center/CommandCenterPreview'
import { ProjectCommandCenter } from '../features/command-center/ProjectCommandCenter'
import { ModelProviders } from '../features/settings/ModelProviders'
import { KnowledgeWorkbench } from '../features/knowledge/KnowledgeWorkbench'
import { CalendarWorkbench } from '../features/calendar/CalendarWorkbench'
import { DocumentWorkbench } from '../features/documents/DocumentWorkbench'
import { navigationItems, type NavigationKey } from './navigation'
import type { VoiceStatus } from '@jarvis/contracts'

export function App(): JSX.Element {
  const requestedView = new URLSearchParams(window.location.search).get('view')
  const initialView = navigationItems.some((item) => item.key === requestedView)
    ? requestedView as NavigationKey
    : 'assistant'
  const [active, setActive] = useState<NavigationKey>(initialView)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>({
    listeningEnabled: true,
    phase: 'idle',
    lastWakeAt: '',
    engineState: 'not-installed',
    engineName: '',
    engineModel: ''
  })
  const { state, transcript, send, setTranscript } = useAssistantStore()

  useEffect(() => {
    if (!window.jarvis) return undefined
    return window.jarvis.onWake(() => {
      setActive('assistant')
      send('WAKE')
      setTranscript("I'm always here, sir.")
    })
  }, [send, setTranscript])

  useEffect(() => {
    void window.jarvis.getVoiceStatus().then(setVoiceStatus)
    return window.jarvis.onVoiceStatus(setVoiceStatus)
  }, [])

  const wake = (): void => {
    void window.jarvis.wakeAssistant('button')
  }

  const runStateDemo = (): void => {
    send('HEARD')
    setTranscript('正在分析您的任务和可用资料。')
    window.setTimeout(() => {
      send('RESPOND')
      setTranscript('分析完成，sir。当前建议先核验项目资格和截止时间。')
    }, 900)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand-mark" aria-label="JARVIS">J</div>
        <nav>
          {navigationItems.map((item) => (
            <button
              className={active === item.key ? 'nav-button nav-button--active' : 'nav-button'}
              key={item.key}
              onClick={() => {
                setActive(item.key)
                if (item.key !== 'assistant') send('OPEN_TASK')
              }}
              title={item.label}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="nav-button sidebar__collapse" title="收起" type="button">
          <PanelRightContract24Regular />
          <span>收起</span>
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="topbar__context">个人智能助理</span>
            <h1>{active === 'assistant' ? '下午好，sir' : navigationItems.find((item) => item.key === active)?.label}</h1>
          </div>
          <button
            className={voiceStatus.listeningEnabled && voiceStatus.engineState === 'ready'
              ? 'system-state'
              : 'system-state system-state--paused'}
            onClick={() => void window.jarvis.setListeningEnabled(!voiceStatus.listeningEnabled)}
            title={voiceStatus.listeningEnabled ? '点击暂停后台聆听' : '点击恢复后台聆听'}
            type="button"
          >
            <span className="system-state__indicator" aria-hidden="true" />
            {voiceStatus.engineState === 'starting'
              ? '正在加载本地唤醒'
              : voiceStatus.engineState === 'ready' && voiceStatus.listeningEnabled
                ? '本地唤醒已就绪'
                : voiceStatus.listeningEnabled
                  ? '唤醒服务未就绪'
                  : '聆听已暂停'}
          </button>
        </header>

        {active === 'assistant' ? (
          <div className="assistant-layout">
            <section className="assistant-stage">
              <JarvisCore state={state} />
              <div className="transcript">
                <span>JARVIS</span>
                <p>{transcript}</p>
                <ConversationPanel />
              </div>
              <div className="assistant-actions">
                <button className="primary-action" onClick={wake} type="button">
                  <Mic24Regular /> 唤醒
                </button>
                <button className="secondary-action" onClick={runStateDemo} type="button">
                  <Play24Regular /> 状态演示
                </button>
                <button
                  className="secondary-action"
                  onClick={() => {
                    send('TIMEOUT')
                    setTranscript('系统已回到本地待机。')
                  }}
                  type="button"
                >
                  <Stop24Regular /> 待机
                </button>
              </div>
            </section>

            <aside className="briefing-panel">
              <h2>今日简报</h2>
              <div className="briefing-item">
                <span>最重要的事</span>
                <strong>完成JARVIS首版开发与演示链路</strong>
              </div>
              <div className="briefing-item">
                <span>资料状态</span>
                <strong>公司基础资料库已挂接</strong>
              </div>
              <div className="briefing-item">
                <span>下一项动作</span>
                <strong>接入双站公告采集</strong>
              </div>
              <p className="briefing-note">当前显示开发阶段信息，不会向外部发送资料。</p>
            </aside>

            <CommandCenterPreview />
          </div>
        ) : active === 'projects' ? (
          <ProjectCommandCenter />
        ) : active === 'knowledge' ? (
          <KnowledgeWorkbench />
        ) : active === 'settings' ? (
          <ModelProviders />
        ) : active === 'documents' ? (
          <DocumentWorkbench />
        ) : active === 'calendar' ? (
          <CalendarWorkbench />
        ) : (
          <section className="task-placeholder">
            <div className="task-placeholder__core" aria-hidden="true">J</div>
            <h2>{navigationItems.find((item) => item.key === active)?.label}工作台</h2>
            <p>基础界面已经就绪，相关服务将在后续开发任务中接入。</p>
            <button
              className="secondary-action"
              onClick={() => {
                setActive('assistant')
                send('COMPLETE')
              }}
              type="button"
            >
              返回助理
            </button>
          </section>
        )}
      </main>
    </div>
  )
}
