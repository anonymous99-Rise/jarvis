import { Menu, Tray, nativeImage } from 'electron'
import { showMainWindow } from './window'

let tray: Tray | null = null
let listeningEnabled = true
let toggleListening: (() => void) | null = null
let quitApp: (() => void) | null = null

function refreshMenu(): void {
  tray?.setToolTip(listeningEnabled ? 'JARVIS is standing by' : 'JARVIS listening is paused')
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示 JARVIS', click: showMainWindow },
      { label: listeningEnabled ? '暂停聆听' : '恢复聆听', click: () => toggleListening?.() },
      { type: 'separator' },
      { label: '彻底退出', click: () => quitApp?.() }
    ])
  )
}

export function updateTrayListening(enabled: boolean): void {
  listeningEnabled = enabled
  refreshMenu()
}

export function createTray(options: { onQuit: () => void; onToggleListening: () => void }): Tray {
  quitApp = options.onQuit
  toggleListening = options.onToggleListening
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('J')
  refreshMenu()
  tray.on('click', showMainWindow)
  return tray
}
