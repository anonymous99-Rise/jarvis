/// <reference types="vite/client" />

import type { JarvisDesktopApi } from '@jarvis/contracts'

declare global {
  interface Window {
    jarvis: JarvisDesktopApi
  }
}

export {}
