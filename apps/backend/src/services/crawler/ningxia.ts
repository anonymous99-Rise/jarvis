import type { ProcurementNotice } from '@jarvis/contracts'
import { cleanText, inferNoticeType, relevanceFor } from './noticeUtils'

const BASE_URL = 'https://www.ccgp-ningxia.gov.cn/NXGPPSP_CMS/'
const NOTICE_ENDPOINT = new URL('nxgpp/NewsQuery_findNoticeWithCount.do', BASE_URL).toString()

type NingxiaRawNotice = {
  ID?: string
  CAPTION?: string
  PUBLISH_TIME?: string
}

type NingxiaResponse = {
  result?: string
  message?: string
  dataList?: NingxiaRawNotice[]
}

export function parseNingxiaNotices(payload: NingxiaResponse, tab: 'QBJ' | 'SX'): ProcurementNotice[] {
  if (payload.result !== '1' || !Array.isArray(payload.dataList)) {
    throw new Error(payload.message || '宁夏公告接口返回异常')
  }

  return payload.dataList.flatMap((raw) => {
    const id = cleanText(raw.ID ?? '')
    const title = cleanText(raw.CAPTION ?? '')
    const publishedAt = cleanText(raw.PUBLISH_TIME ?? '')
    if (!id || !title || !publishedAt) return []
    const url = new URL(
      `nxgpp/NoticeFullProcess.do?noticeType=zbgg&noticeId=${encodeURIComponent(id)}&tab=${tab}`,
      BASE_URL
    ).toString()

    return [{
      id,
      source: 'ningxia' as const,
      sourceName: '宁夏政府采购网',
      title,
      publishedAt,
      region: tab === 'QBJ' ? '宁夏·区本级' : '宁夏·市县',
      buyer: '详情页待核验',
      url,
      projectCode: '详情页待核验',
      budget: '详情页待核验',
      deadline: '详情页待核验',
      noticeType: inferNoticeType(title),
      ...relevanceFor(title)
    }]
  })
}

async function fetchTab(tab: 'QBJ' | 'SX', count: number): Promise<ProcurementNotice[]> {
  const body = Buffer.from(JSON.stringify({
    columnId: 'ZBGG',
    count,
    columnCode: 'ZBGG',
    parentColumnCode: tab
  })).toString('base64')
  const response = await fetch(NOTICE_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'JARVIS/0.1 local desktop procurement monitor'
    },
    body,
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseNingxiaNotices(await response.json() as NingxiaResponse, tab)
}

export async function fetchNingxiaNotices(count = 30): Promise<ProcurementNotice[]> {
  const [district, local] = await Promise.all([fetchTab('QBJ', count), fetchTab('SX', count)])
  return [...district, ...local]
}
