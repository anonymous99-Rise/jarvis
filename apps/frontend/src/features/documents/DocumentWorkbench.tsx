import { useState, type JSX } from 'react'
import { DocumentArrowDown24Regular } from '@fluentui/react-icons'
import type { ProposalInput } from '@jarvis/contracts'

const initialForm: ProposalInput = {
  projectName: '',
  constructionUnit: '',
  background: '',
  goals: '',
  constructionContent: '',
  investment: ''
}

export function DocumentWorkbench(): JSX.Element {
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('未填写内容会在文档中标记为【待补充】或【待核实】。')
  const [exporting, setExporting] = useState(false)

  const update = (key: keyof ProposalInput, value: string): void => setForm((current) => ({ ...current, [key]: value }))
  const exportDocument = async (): Promise<void> => {
    setExporting(true)
    try {
      const result = await window.jarvis.exportProposal(form)
      setMessage(result.saved ? `已生成可编辑 Word 文件：${result.path}` : '已取消导出，没有写入文件。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '文档生成失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="task-workbench">
      <header className="project-workbench__header">
        <div>
          <span className="section-heading__label">JARVIS 文档工厂</span>
          <h2>政务信息化项目建议书</h2>
          <p>按八章及附件提纲生成简版、可编辑 DOCX 初稿。</p>
        </div>
        <button className="primary-action" disabled={exporting} onClick={() => void exportDocument()} type="button">
          <DocumentArrowDown24Regular /> {exporting ? '生成中' : '导出 DOCX'}
        </button>
      </header>
      <div className="document-form">
        <label><span>项目名称 *</span><input value={form.projectName} onChange={(event) => update('projectName', event.target.value)} placeholder="例如：政务服务人工智能赋能项目" /></label>
        <label><span>建设单位</span><input value={form.constructionUnit} onChange={(event) => update('constructionUnit', event.target.value)} placeholder="未知可留空" /></label>
        <label className="document-form__wide"><span>建设背景</span><textarea value={form.background} onChange={(event) => update('background', event.target.value)} /></label>
        <label><span>总体目标</span><textarea value={form.goals} onChange={(event) => update('goals', event.target.value)} /></label>
        <label><span>主要建设内容</span><textarea value={form.constructionContent} onChange={(event) => update('constructionContent', event.target.value)} /></label>
        <label className="document-form__wide"><span>投资估算</span><input value={form.investment} onChange={(event) => update('investment', event.target.value)} placeholder="例如：暂估 500 万元；未知可留空" /></label>
      </div>
      <div className="project-message"><DocumentArrowDown24Regular /> {message}</div>
    </section>
  )
}
