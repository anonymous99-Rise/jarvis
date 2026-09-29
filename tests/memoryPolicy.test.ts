import { describe, expect, it } from 'vitest'
import { shouldSuggestLongTermMemory, validateMemoryInput } from '../apps/backend/src/services/memory/memoryPolicy'

describe('long-term memory policy', () => {
  it('accepts stable decisions', () => {
    expect(validateMemoryInput({
      category: 'decision',
      title: '项目决定',
      content: '保税区项目不再参与。'
    }).title).toBe('项目决定')
  })

  it('does not suggest ordinary small talk as long-term memory', () => {
    expect(shouldSuggestLongTermMemory('今天天气不错')).toBe(false)
    expect(shouldSuggestLongTermMemory('以后都称呼我为sir')).toBe(true)
  })
})
