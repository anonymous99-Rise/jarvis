import { useEffect, useState, type FormEvent, type JSX } from 'react'
import { CheckmarkCircle20Regular, PlugConnected20Regular, Save20Regular } from '@fluentui/react-icons'
import type { ProviderSummary } from '@jarvis/contracts'

const emptyForm = { name: '', baseUrl: '', model: '', apiKey: '' }

export function ModelProviders(): JSX.Element {
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('API Key仅加密保存在本机。')
  const [busy, setBusy] = useState(false)

  const refresh = async (): Promise<void> => {
    if (!window.jarvis) return
    setProviders(await window.jarvis.listProviders())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!window.jarvis) return
    setBusy(true)
    try {
      await window.jarvis.saveProvider(form)
      setForm(emptyForm)
      setMessage('供应商配置已安全保存。')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请检查配置。')
    } finally {
      setBusy(false)
    }
  }

  const test = async (id: string): Promise<void> => {
    if (!window.jarvis) return
    setBusy(true)
    const result = await window.jarvis.testProvider(id)
    setMessage(result.message)
    setBusy(false)
  }

  const activate = async (id: string): Promise<void> => {
    if (!window.jarvis) return
    setBusy(true)
    try {
      setProviders(await window.jarvis.activateProvider(id))
      setMessage('当前模型已切换，无需重启JARVIS。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '模型切换失败。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-workbench">
      <header>
        <h2>模型供应商</h2>
        <p>配置OpenAI兼容接口。测试连接时会向所填服务地址发送密钥。</p>
      </header>

      <div className="settings-grid">
        <form className="provider-form" onSubmit={submit}>
          <label>
            <span>供应商名称</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            <span>Base URL</span>
            <input
              placeholder="https://api.example.com/v1"
              value={form.baseUrl}
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
            />
          </label>
          <label>
            <span>模型名称</span>
            <input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
          </label>
          <label>
            <span>API Key</span>
            <input
              autoComplete="off"
              type="password"
              value={form.apiKey}
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            />
          </label>
          <button className="primary-action" disabled={busy} type="submit">
            <Save20Regular /> 保存配置
          </button>
        </form>

        <div className="provider-list">
          {providers.length === 0 ? (
            <div className="empty-state">
              <PlugConnected20Regular />
              <strong>尚未配置模型</strong>
              <span>填写左侧信息后即可添加。</span>
            </div>
          ) : (
            providers.map((provider) => (
              <article className="provider-item" key={provider.id}>
                <div>
                  <strong>{provider.name} {provider.active && <span className="provider-active">当前</span>}</strong>
                  <span>{provider.model}</span>
                  <small>{provider.baseUrl}</small>
                </div>
                <div className="provider-item__actions">
                  <span>Key ••••{provider.keyLast4}</span>
                  <button className="secondary-action" disabled={busy} onClick={() => void test(provider.id)} type="button">
                    测试连接
                  </button>
                  {!provider.active && (
                    <button className="secondary-action" disabled={busy} onClick={() => void activate(provider.id)} type="button">
                      设为当前
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="settings-message" role="status">
        <CheckmarkCircle20Regular /> {message}
      </div>
    </section>
  )
}
