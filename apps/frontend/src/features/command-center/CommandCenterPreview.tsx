import type { JSX } from 'react'
import {
  ArrowRight20Regular,
  CalendarClock20Regular,
  ShieldCheckmark20Regular
} from '@fluentui/react-icons'

const demoProjects = [
  {
    title: '政务服务人工智能辅助项目',
    buyer: '演示采购单位',
    amount: '预算待核实',
    deadline: '截止时间待核实',
    status: '需要资料核验'
  },
  {
    title: '公共数据治理与共享平台',
    buyer: '演示采购单位',
    amount: '预算待核实',
    deadline: '截止时间待核实',
    status: '等待公告采集'
  }
]

export function CommandCenterPreview(): JSX.Element {
  return (
    <section className="command-preview" aria-label="项目作战指挥台演示">
      <header className="section-heading">
        <div>
          <span className="section-heading__label">项目作战指挥台</span>
          <h2>先看是否值得投入</h2>
        </div>
        <button className="text-action" type="button">
          查看全部 <ArrowRight20Regular />
        </button>
      </header>

      <div className="project-list">
        {demoProjects.map((project) => (
          <article className="project-row" key={project.title}>
            <div className="project-row__title">
              <strong>{project.title}</strong>
              <span>{project.buyer}</span>
            </div>
            <div className="project-row__meta">
              <span>{project.amount}</span>
              <span><CalendarClock20Regular /> {project.deadline}</span>
            </div>
            <div className="project-row__status">
              <ShieldCheckmark20Regular />
              <span>{project.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
