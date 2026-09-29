import { useState, type FormEvent, type JSX } from 'react'
import { Send20Regular } from '@fluentui/react-icons'
import { useAssistantStore } from './assistantStore'

export function ConversationPanel(): JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const { send, setTranscript } = useAssistantStore()

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const value = prompt.trim()
    if (!value || busy) return
    setBusy(true)
    setPrompt('')
    send('WAKE')
    send('HEARD')
    setTranscript(`正在处理：${value}`)
    try {
      const result = await window.jarvis.sendChat({ prompt: value, speak: true })
      setTranscript(result.content)
      send('RESPOND')
    } catch (error) {
      setTranscript(error instanceof Error ? error.message : '模型调用失败，请检查当前供应商配置。')
      send('TIMEOUT')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="conversation-composer" onSubmit={submit}>
      <input
        aria-label="给贾维斯的文字指令"
        disabled={busy}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="输入任务，先用文字链路验证当前模型"
        value={prompt}
      />
      <button disabled={busy || !prompt.trim()} title="发送给当前模型" type="submit">
        <Send20Regular />
      </button>
    </form>
  )
}
