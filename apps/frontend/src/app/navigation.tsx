import type { JSX } from 'react'
import {
  Bot24Regular,
  Briefcase24Regular,
  CalendarLtr24Regular,
  DocumentText24Regular,
  Library24Regular,
  Settings24Regular
} from '@fluentui/react-icons'

export type NavigationKey = 'assistant' | 'projects' | 'knowledge' | 'documents' | 'calendar' | 'settings'

export type NavigationItem = {
  key: NavigationKey
  label: string
  icon: JSX.Element
}

export const navigationItems: NavigationItem[] = [
  { key: 'assistant', label: '助理', icon: <Bot24Regular /> },
  { key: 'projects', label: '项目', icon: <Briefcase24Regular /> },
  { key: 'knowledge', label: '资料', icon: <Library24Regular /> },
  { key: 'documents', label: '文档', icon: <DocumentText24Regular /> },
  { key: 'calendar', label: '日历', icon: <CalendarLtr24Regular /> },
  { key: 'settings', label: '设置', icon: <Settings24Regular /> }
]
