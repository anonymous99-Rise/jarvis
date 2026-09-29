import { describe, expect, it } from 'vitest'
import { transition } from '../apps/frontend/src/features/assistant/assistantMachine'

describe('assistant state machine', () => {
  it('runs the core conversation cycle', () => {
    expect(transition('idle', 'WAKE')).toBe('listening')
    expect(transition('listening', 'HEARD')).toBe('thinking')
    expect(transition('thinking', 'RESPOND')).toBe('speaking')
    expect(transition('speaking', 'COMPLETE')).toBe('idle')
  })

  it('opens and closes task mode', () => {
    expect(transition('idle', 'OPEN_TASK')).toBe('task')
    expect(transition('task', 'COMPLETE')).toBe('idle')
  })

  it('ignores unsupported transitions', () => {
    expect(transition('idle', 'HEARD')).toBe('idle')
  })
})
