export type SidecarEvent =
  | { type: 'ready'; engine: string; model: string }
  | { type: 'wake'; text: string; confidence?: number }
  | { type: 'transcript'; text: string; final: boolean }
  | { type: 'metric'; name: string; value: number; unit: string }
  | { type: 'error'; message: string }
  | { type: 'stopped' }

export function parseSidecarEvent(line: string): SidecarEvent {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    throw new Error('语音服务返回了无效JSON')
  }
  if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') {
    throw new Error('语音服务事件缺少type')
  }
  const event = value as Record<string, unknown>
  switch (event.type) {
    case 'ready':
      if (typeof event.engine !== 'string' || typeof event.model !== 'string') break
      return { type: 'ready', engine: event.engine, model: event.model }
    case 'wake':
      if (typeof event.text !== 'string') break
      return { type: 'wake', text: event.text, ...(typeof event.confidence === 'number' ? { confidence: event.confidence } : {}) }
    case 'transcript':
      if (typeof event.text !== 'string' || typeof event.final !== 'boolean') break
      return { type: 'transcript', text: event.text, final: event.final }
    case 'metric':
      if (typeof event.name !== 'string' || typeof event.value !== 'number' || typeof event.unit !== 'string') break
      return { type: 'metric', name: event.name, value: event.value, unit: event.unit }
    case 'error':
      if (typeof event.message !== 'string') break
      return { type: 'error', message: event.message }
    case 'stopped':
      return { type: 'stopped' }
  }
  throw new Error(`语音服务事件字段无效：${String(event.type)}`)
}

export class JsonLineDecoder {
  private buffer = ''

  push(chunk: string): SidecarEvent[] {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() ?? ''
    return lines.filter((line) => line.trim()).map(parseSidecarEvent)
  }
}
