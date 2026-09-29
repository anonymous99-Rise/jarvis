export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'task'

export type AssistantEvent =
  | 'WAKE'
  | 'HEARD'
  | 'RESPOND'
  | 'OPEN_TASK'
  | 'COMPLETE'
  | 'TIMEOUT'

const transitions: Record<AssistantState, Partial<Record<AssistantEvent, AssistantState>>> = {
  idle: { WAKE: 'listening', OPEN_TASK: 'task' },
  listening: { HEARD: 'thinking', TIMEOUT: 'idle', OPEN_TASK: 'task' },
  thinking: { RESPOND: 'speaking', TIMEOUT: 'idle', OPEN_TASK: 'task' },
  speaking: { WAKE: 'listening', COMPLETE: 'idle', OPEN_TASK: 'task' },
  task: { WAKE: 'listening', COMPLETE: 'idle', TIMEOUT: 'idle' }
}

export function transition(state: AssistantState, event: AssistantEvent): AssistantState {
  return transitions[state][event] ?? state
}

export const assistantLabels: Record<AssistantState, string> = {
  idle: '随时待命',
  listening: '正在聆听',
  thinking: '正在分析',
  speaking: '正在回复',
  task: '任务执行中'
}
