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
      'hideWindow',
      'knowledgeReindex',
      'knowledgeSearch',
      'knowledgeStatus',
      'memoriesList',
      'memoriesSave',
      'noticesList',
      'noticesRefresh',
      'openExternal',
      'proposalExport',
      'providersActivate',
      'providersList',
      'providersSave',
      'providersTest',
      'showWindow',
      'voiceSetListening',
      'voiceStatus',
      'voiceWake'
    ])
  })
})
