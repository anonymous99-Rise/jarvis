import { create } from 'zustand'
import {
  transition,
  type AssistantEvent,
  type AssistantState
} from './assistantMachine'

type AssistantStore = {
  state: AssistantState
  transcript: string
  send: (event: AssistantEvent) => void
  setTranscript: (transcript: string) => void
}

export const useAssistantStore = create<AssistantStore>((set) => ({
  state: 'idle',
  transcript: 'Good afternoon, sir. 系统已经就绪。',
  send: (event) =>
    set((current) => {
      const next = transition(current.state, event)
      void window.jarvis?.setAssistantState(next)
      return { state: next }
    }),
  setTranscript: (transcript) => set({ transcript })
}))
