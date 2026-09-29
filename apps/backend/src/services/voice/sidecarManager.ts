import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { JsonLineDecoder, type SidecarEvent } from './sidecarProtocol'

export class VoiceSidecarManager extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null

  start(options: { mode?: 'mock' | 'whisper'; model?: string } = {}): boolean {
    if (this.child) return true
    const appRoot = process.env.JARVIS_APP_ROOT ?? process.cwd()
    const python = process.env.JARVIS_VOICE_PYTHON ?? path.join(appRoot, '.voice-venv', 'bin', 'python')
    const script = path.join(appRoot, 'sidecar', 'jarvis_voice_service.py')
    if (!existsSync(python) || !existsSync(script)) return false

    const child = spawn(python, [script, '--mode', options.mode ?? 'whisper', '--model', options.model ?? 'tiny'], {
      cwd: appRoot,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child = child
    const decoder = new JsonLineDecoder()
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      try {
        for (const event of decoder.push(chunk)) this.emit('event', event)
      } catch (error) {
        this.emit('event', { type: 'error', message: error instanceof Error ? error.message : '语音协议解析失败' } satisfies SidecarEvent)
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      const message = chunk.trim()
      if (message) this.emit('event', { type: 'error', message } satisfies SidecarEvent)
    })
    child.once('exit', () => {
      if (this.child === child) this.child = null
      this.emit('event', { type: 'stopped' } satisfies SidecarEvent)
    })
    return true
  }

  command(type: 'pause' | 'resume' | 'simulate_wake' | 'shutdown', payload: Record<string, unknown> = {}): void {
    this.child?.stdin.write(`${JSON.stringify({ type, ...payload })}\n`)
  }

  stop(): void {
    if (!this.child) return
    this.command('shutdown')
    const child = this.child
    setTimeout(() => child.kill(), 1_500).unref()
  }
}
