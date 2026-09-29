import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '@jarvis/contracts'

describe('IPC allowlist', () => {
  it('contains only explicit JARVIS channels', () => {
    expect(Object.keys(IPC_CHANNELS).sort()).toEqual([
      'appInfo',
      'approvalsDecide',
      'approvalsList',
      'approvalsRequest',
      'assistantState',
      'assistantWake',
      'calendarRead',
      'chatSend',
      'feasibilityGet',
      'feasibilityRun',
      'hideWindow',
      'knowledgeReindex',
      'knowledgeSearch',
      'knowledgeStatus',
      'memoriesList',
      'memoriesSave',
      'noticesDetail',
      'noticesList',
      'noticesRefresh',
      'openExternal',
      'proposalExport',
      'providersActivate',
      'providersList',
      'providersSave',
      'providersTest',
      'showWindow',
      'tenderFileStatus',
      'voiceSetListening',
      'voiceStatus',
      'voiceWake'
    ])
  })
})
