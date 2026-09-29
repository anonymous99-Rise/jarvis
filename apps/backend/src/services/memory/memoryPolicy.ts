import type { MemoryInput } from '@jarvis/contracts'

const allowedCategories = new Set(['preference', 'decision', 'project', 'todo'])

export function validateMemoryInput(input: MemoryInput): MemoryInput {
  const title = input.title.trim()
  const content = input.content.trim()
  if (!allowedCategories.has(input.category)) throw new Error('不支持的记忆类型')
  if (title.length < 2 || title.length > 100) throw new Error('记忆标题需为2-100个字符')
  if (content.length < 2 || content.length > 4_000) throw new Error('记忆内容需为2-4000个字符')
  return { ...input, title, content, source: input.source?.trim() }
}

export function shouldSuggestLongTermMemory(text: string): boolean {
  const stableSignals = ['以后', '长期', '始终', '固定', '偏好', '决定', '不再参与', '截止时间']
  return stableSignals.some((signal) => text.includes(signal))
}
