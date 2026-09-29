import { BrowserWindow, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null
let quitting = false

export function setQuitting(value: boolean): void {
  quitting = value
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    title: 'JARVIS',
    backgroundColor: '#0a0d10',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    const capturePath = process.env.JARVIS_CAPTURE_PATH
    if (capturePath && mainWindow) {
      const captureDelay = Number(process.env.JARVIS_CAPTURE_DELAY ?? 900)
      setTimeout(async () => {
        if (!mainWindow) return
        const image = await mainWindow.capturePage()
        await writeFile(capturePath, image.toPNG())
      }, Number.isFinite(captureDelay) ? captureDelay : 900)
    }
  })

  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('Renderer failed to load', { code, description })
  })

  mainWindow.webContents.on('console-message', (details) => {
    if (details.level === 'error') console.error('Renderer error:', details.message)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = new URL(process.env.ELECTRON_RENDERER_URL)
    if (process.env.JARVIS_START_VIEW) rendererUrl.searchParams.set('view', process.env.JARVIS_START_VIEW)
    void mainWindow.loadURL(rendererUrl.toString())
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function showMainWindow(): void {
  if (!mainWindow) createMainWindow()
  mainWindow?.show()
  mainWindow?.focus()
}
