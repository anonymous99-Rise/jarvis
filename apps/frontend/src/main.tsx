import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider, webDarkTheme } from '@fluentui/react-components'
import { App } from './app/App'
import { installBrowserMock } from './platform/browserMock'
import './styles/app.css'

installBrowserMock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={webDarkTheme} className="fluent-root">
      <App />
    </FluentProvider>
  </StrictMode>
)
