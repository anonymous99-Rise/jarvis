import { describe, expect, it } from 'vitest'
import { JsonLineDecoder, parseSidecarEvent } from '../apps/backend/src/services/voice/sidecarProtocol'

describe('语音sidecar协议', () => {
  it('解析ready和wake事件', () => {
    expect(parseSidecarEvent('{"type":"ready","engine":"mock","model":"tiny"}'))
      .toEqual({ type: 'ready', engine: 'mock', model: 'tiny' })
    expect(parseSidecarEvent('{"type":"wake","text":"贾维斯","confidence":0.98}'))
      .toEqual({ type: 'wake', text: '贾维斯', confidence: 0.98 })
  })

  it('支持被分段到达的JSON Lines', () => {
    const decoder = new JsonLineDecoder()
    expect(decoder.push('{"type":"trans')).toEqual([])
    expect(decoder.push('cript","text":"你好","final":true}\n'))
      .toEqual([{ type: 'transcript', text: '你好', final: true }])
  })

  it('拒绝未知或字段不完整的事件', () => {
    expect(() => parseSidecarEvent('{"type":"ready"}')).toThrow('字段无效')
  })
})
