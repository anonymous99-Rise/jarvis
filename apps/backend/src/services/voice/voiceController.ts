import type { VoiceStatus, WakeSource } from '@jarvis/contracts'
import { LocalTts, WAKE_RESPONSE } from './localTts'

export type VoiceStatusListener = (status: VoiceStatus) => void
export type TtsEngine = Pick<LocalTts, 'speak' | 'stop'>

export class VoiceController {
  private status: VoiceStatus = {
    listeningEnabled: true,
    phase: 'idle',
    lastWakeAt: '',
    engineState: 'not-installed',
    engineName: '',
    engineModel: ''
  }

  constructor(
    private readonly tts: TtsEngine = new LocalTts(),
    private readonly onStatus: VoiceStatusListener = () => undefined
  ) {}

  getStatus(): VoiceStatus {
    return { ...this.status }
  }

  setListeningEnabled(enabled: boolean): VoiceStatus {
    if (!enabled) this.tts.stop()
    this.update({ listeningEnabled: enabled, phase: enabled ? 'idle' : 'paused' })
    return this.getStatus()
  }

  setEngineState(
    engineState: VoiceStatus['engineState'],
    details: { engineName?: string; engineModel?: string; error?: string } = {}
  ): VoiceStatus {
    this.update({
      engineState,
      engineName: details.engineName ?? this.status.engineName,
      engineModel: details.engineModel ?? this.status.engineModel,
      ...(details.error ? { error: details.error } : {})
    })
    return this.getStatus()
  }

  async wake(_source: WakeSource): Promise<{ triggered: boolean; status: VoiceStatus }> {
    if (!this.status.listeningEnabled) return { triggered: false, status: this.getStatus() }
    this.update({ phase: 'speaking', lastWakeAt: new Date().toISOString() })
    try {
      await this.tts.speak(WAKE_RESPONSE)
      this.update({ phase: 'listening' })
      return { triggered: true, status: this.getStatus() }
    } catch (error) {
      this.update({
        phase: 'listening',
        error: error instanceof Error ? error.message : '本地语音播放失败'
      })
      return { triggered: true, status: this.getStatus() }
    }
  }

  async speakReply(text: string): Promise<VoiceStatus> {
    if (!this.status.listeningEnabled) return this.getStatus()
    this.update({ phase: 'speaking' })
    try {
      await this.tts.speak(text)
    } finally {
      this.update({ phase: 'listening' })
    }
    return this.getStatus()
  }

  shutdown(): void {
    this.tts.stop()
    this.update({ listeningEnabled: false, phase: 'paused' })
  }

  private update(change: Partial<VoiceStatus>): void {
    this.status = { ...this.status, ...change }
    if (!change.error) delete this.status.error
    this.onStatus(this.getStatus())
  }
}
