import { describe, expect, it, vi } from 'vitest'
import { VoiceController } from '../apps/backend/src/services/voice/voiceController'

describe('语音控制器', () => {
  it('暂停聆听时拒绝唤醒', async () => {
    const tts = { speak: vi.fn(), stop: vi.fn() }
    const controller = new VoiceController(tts)
    controller.setListeningEnabled(false)
    const result = await controller.wake('shortcut')
    expect(result.triggered).toBe(false)
    expect(tts.speak).not.toHaveBeenCalled()
  })

  it('唤醒后播放固定回应并进入聆听', async () => {
    const tts = { speak: vi.fn().mockResolvedValue(undefined), stop: vi.fn() }
    const controller = new VoiceController(tts)
    const result = await controller.wake('button')
    expect(tts.speak).toHaveBeenCalledWith("I'm always here, sir.")
    expect(result).toMatchObject({ triggered: true, status: { phase: 'listening' } })
  })

  it('记录本地引擎就绪状态', () => {
    const controller = new VoiceController({ speak: vi.fn(), stop: vi.fn() })
    expect(controller.setEngineState('ready', { engineName: 'faster-whisper', engineModel: 'tiny' }))
      .toMatchObject({ engineState: 'ready', engineName: 'faster-whisper', engineModel: 'tiny' })
  })
})
