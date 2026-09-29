import { spawn, type ChildProcess } from 'node:child_process'

export const WAKE_RESPONSE = "I'm always here, sir."
export const DEFAULT_VOICE = 'Daniel'

export type SpeechProcess = Pick<ChildProcess, 'once' | 'kill'>
export type SpeechSpawner = (command: string, args: string[]) => SpeechProcess

const systemSpawner: SpeechSpawner = (command, args) => spawn(command, args, {
  stdio: 'ignore',
  shell: false
})

export class LocalTts {
  private current: SpeechProcess | null = null

  constructor(private readonly spawnSpeech: SpeechSpawner = systemSpawner) {}

  async speak(text: string, voice = DEFAULT_VOICE): Promise<void> {
    const normalized = text.trim()
    if (!normalized) return
    if (normalized.length > 2_000) throw new Error('单次朗读内容不能超过2000个字符')
    this.stop()

    await new Promise<void>((resolve, reject) => {
      const child = this.spawnSpeech('/usr/bin/say', ['-v', voice, '-r', '184', normalized])
      this.current = child
      child.once('error', (error: Error) => {
        if (this.current === child) this.current = null
        reject(new Error(`本地语音播放失败：${error.message}`))
      })
      child.once('exit', (code: number | null) => {
        if (this.current === child) this.current = null
        if (code === 0 || code === null) resolve()
        else reject(new Error(`本地语音播放失败：退出码 ${code}`))
      })
    })
  }

  stop(): void {
    this.current?.kill()
    this.current = null
  }
}
