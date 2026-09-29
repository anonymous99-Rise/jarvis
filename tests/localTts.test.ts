import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_VOICE, LocalTts, WAKE_RESPONSE, type SpeechSpawner } from '../apps/backend/src/services/voice/localTts'

describe('本地TTS', () => {
  it('使用无shell参数调用macOS say并保持固定回应', async () => {
    const calls: Array<{ command: string; args: string[] }> = []
    const spawner: SpeechSpawner = (command, args) => {
      calls.push({ command, args })
      const emitter = new EventEmitter()
      const process = emitter as unknown as ReturnType<SpeechSpawner>
      process.kill = vi.fn()
      queueMicrotask(() => emitter.emit('exit', 0))
      return process
    }
    await new LocalTts(spawner).speak(WAKE_RESPONSE)
    expect(calls).toEqual([{
      command: '/usr/bin/say',
      args: ['-v', DEFAULT_VOICE, '-r', '184', "I'm always here, sir."]
    }])
  })
})
