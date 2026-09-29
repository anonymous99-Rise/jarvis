import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from 'docx'
import type { ProposalInput } from '@jarvis/contracts'

const MISSING = '【待补充】'

function value(value?: string): string {
  return value?.trim() || MISSING
}

function heading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 180, after: 100 } })
}

function body(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 24 })],
    spacing: { line: 360, after: 100 },
    indent: { firstLine: 480 }
  })
}

export function buildProposalDocument(input: ProposalInput): Document {
  if (!input.projectName.trim()) throw new Error('请先填写项目名称')
  const sections = [
    ['一、项目简介', [
      ['（一）项目名称', input.projectName],
      ['（二）项目建设单位概况和负责人、项目责任人', value(input.constructionUnit)],
      ['（三）项目建议书编制依据', '【待核实】国家及地方政务信息化、数据安全、网络安全相关政策与标准。'],
      ['（四）项目概况', value(input.constructionContent)],
      ['（五）主要结论和建议', '建议在完成业务调研、数据摸底和投资评审后分期实施。']
    ]],
    ['二、项目建设的必要性', [
      ['（一）项目提出的背景和依据', value(input.background)],
      ['（二）现有信息系统装备和信息化应用状况及存在问题和差距', MISSING],
      ['（三）项目建设的意义和必要性', '围绕业务协同、数据共享、服务提效和安全治理形成一体化能力。']
    ]],
    ['三、需求分析', [
      ['（一）社会问题和政务目标分析', MISSING],
      ['（二）业务功能、业务流程、业务量分析', MISSING],
      ['（三）信息量分析与预测', MISSING],
      ['（四）运行环境需求分析', MISSING],
      ['（五）功能和性能需求分析', value(input.goals)],
      ['（六）政务信息共享开放需求分析', '【待核实】需结合数据目录、共享责任清单和开放要求进一步明确。']
    ]],
    ['四、总体建设方案', [
      ['（一）总体目标与分期目标', value(input.goals)],
      ['（二）总体建设任务与分期建设内容', value(input.constructionContent)],
      ['（三）总体设计方案', '建议采用分层解耦、数据驱动、统一支撑、安全可控的总体架构。']
    ]],
    ['五、本期项目建设方案', [
      ['（一）建设目标与主要建设内容', value(input.constructionContent)],
      ['（二）信息资源规划和数据库建设', MISSING],
      ['（三）应用支撑平台和应用系统建设', MISSING],
      ['（四）数据处理和存储系统建设', MISSING],
      ['（五）安全系统建设', '按照网络安全、数据安全和密码应用相关要求同步规划、同步建设。'],
      ['（六）主要软硬件选型原则和配置清单', MISSING],
      ['（七）配套工程建设', MISSING]
    ]],
    ['六、项目组织机构和人员', [
      ['（一）项目领导、实施和运维机构及组织管理', MISSING],
      ['（二）人员配置', MISSING],
      ['（三）人员培训需求和计划', MISSING]
    ]],
    ['七、投资估算和资金筹措', [
      ['（一）总投资估算和构成', value(input.investment)],
      ['（二）资金来源、落实情况和主要用途', MISSING]
    ]],
    ['八、效益与风险分析', [
      ['（一）经济效益和社会效益分析', '预期提升业务协同效率、数据利用能力和公共服务体验；量化指标【待补充】。'],
      ['（二）风险分析和控制措施', '重点关注需求变更、数据质量、系统集成、网络数据安全和进度风险，并建立分阶段评审机制。']
    ]],
    ['附件', [['编制依据及与项目有关的政策、技术、经济资料', '【待核实】待补充正式文件名称、文号及有效性。']]]
  ] as const

  const children: Paragraph[] = [
    new Paragraph({
      alignment: 'center',
      spacing: { after: 280 },
      children: [new TextRun({ text: input.projectName, bold: true, size: 40 })]
    }),
    new Paragraph({
      alignment: 'center',
      spacing: { after: 480 },
      children: [new TextRun({ text: '项目建议书（JARVIS 简版初稿）', bold: true, size: 32 })]
    })
  ]

  for (const [chapter, items] of sections) {
    children.push(heading(chapter, HeadingLevel.HEADING_1))
    for (const [title, content] of items) {
      children.push(heading(title, HeadingLevel.HEADING_2), body(content))
    }
  }

  return new Document({ sections: [{ properties: {}, children }] })
}

export async function createProposalBuffer(input: ProposalInput): Promise<Buffer> {
  return Packer.toBuffer(buildProposalDocument(input))
}
