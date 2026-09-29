import { useEffect, useState, type FormEvent, type JSX } from 'react'
import {
  Add20Regular,
  ArrowSync20Regular,
  BookDatabase20Regular,
  Search20Regular
} from '@fluentui/react-icons'
import type {
  KnowledgeResult,
  KnowledgeStatus,
  MemoryCategory,
  MemoryItem
} from '@jarvis/contracts'

type View = 'knowledge' | 'memory'

const categoryLabels: Record<MemoryCategory, string> = {
  preference: '长期偏好',
  decision: '重要决定',
  project: '项目状态',
  todo: '待办事项'
}

export function KnowledgeWorkbench(): JSX.Element {
  const [view, setView] = useState<View>('knowledge')
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KnowledgeResult[]>([])
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [memoryForm, setMemoryForm] = useState({
    category: 'decision' as MemoryCategory,
    title: '',
    content: ''
  })
  const [message, setMessage] = useState('所有索引和记忆仅保存在本机。')

  useEffect(() => {
    if (!window.jarvis) return
    void window.jarvis.getKnowledgeStatus().then(setStatus)
    void window.jarvis.listMemories().then(setMemories)
  }, [])

  const search = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    if (!window.jarvis || !query.trim()) return
    if (view === 'knowledge') setResults(await window.jarvis.searchKnowledge(query))
    else setMemories(await window.jarvis.listMemories(query))
  }

  const reindex = async (): Promise<void> => {
    if (!window.jarvis) return
    setMessage('正在重建本地索引。')
    const next = await window.jarvis.rebuildKnowledgeIndex()
    setStatus(next)
    setMessage(next.ready ? '本地资料索引已更新。' : next.error ?? '索引失败。')
  }

  const saveMemory = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!window.jarvis) return
    try {
      await window.jarvis.saveMemory(memoryForm)
      setMemoryForm({ category: 'decision', title: '', content: '' })
      setMemories(await window.jarvis.listMemories())
      setMessage('长期记忆已保存到本机。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '记忆保存失败。')
    }
  }

  return (
    <section className="knowledge-workbench">
      <header className="knowledge-header">
        <div>
          <h2>本地知识与记忆</h2>
          <p>检索结果保留来源和证据状态，模型不会自动获得全部资料。</p>
        </div>
        <div className="segmented-control" aria-label="资料视图">
          <button className={view === 'knowledge' ? 'active' : ''} onClick={() => setView('knowledge')} type="button">公司资料</button>
          <button className={view === 'memory' ? 'active' : ''} onClick={() => setView('memory')} type="button">长期记忆</button>
        </div>
      </header>

      <form className="knowledge-search" onSubmit={(event) => void search(event)}>
        <Search20Regular />
        <input
          aria-label="搜索本地资料"
          placeholder={view === 'knowledge' ? '搜索资质、案例或行业能力' : '搜索偏好、决定或项目状态'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="primary-action" type="submit">搜索</button>
      </form>

      {view === 'knowledge' ? (
        <>
          <div className="knowledge-status">
            <BookDatabase20Regular />
            <span>{status?.ready ? `${status.fileCount}个文件，${status.chunkCount}个证据片段` : status?.error ?? '正在读取本地资料库'}</span>
            <button className="text-action" onClick={() => void reindex()} type="button"><ArrowSync20Regular /> 更新索引</button>
          </div>
          <div className="quick-queries">
            {['CCRC一级', '医保案例', '人社业绩'].map((item) => (
              <button key={item} onClick={() => setQuery(item)} type="button">{item}</button>
            ))}
          </div>
          <div className="knowledge-results">
            {results.length === 0 ? (
              <div className="knowledge-empty">输入关键词后，JARVIS会显示证据片段及其本地来源。</div>
            ) : results.map((result) => (
              <article className="knowledge-result" key={result.id}>
                <div className="knowledge-result__heading">
                  <strong>{result.title}</strong>
                  <span data-status={result.evidenceStatus}>{result.evidenceStatus}</span>
                </div>
                <p>{result.snippet}</p>
                <small>{result.source}</small>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="memory-layout">
          <form className="memory-form" onSubmit={(event) => void saveMemory(event)}>
            <h3>保存一条长期记忆</h3>
            <label>
              <span>类型</span>
              <select
                value={memoryForm.category}
                onChange={(event) => setMemoryForm({ ...memoryForm, category: event.target.value as MemoryCategory })}
              >
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>标题</span>
              <input value={memoryForm.title} onChange={(event) => setMemoryForm({ ...memoryForm, title: event.target.value })} />
            </label>
            <label>
              <span>内容</span>
              <textarea rows={5} value={memoryForm.content} onChange={(event) => setMemoryForm({ ...memoryForm, content: event.target.value })} />
            </label>
            <button className="primary-action" type="submit"><Add20Regular /> 保存记忆</button>
          </form>
          <div className="memory-list">
            {memories.length === 0 ? <div className="knowledge-empty">还没有应用内长期记忆。</div> : memories.map((memory) => (
              <article className="memory-item" key={memory.id}>
                <span>{categoryLabels[memory.category]}</span>
                <strong>{memory.title}</strong>
                <p>{memory.content}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      <footer className="knowledge-footer">{message}</footer>
    </section>
  )
}
