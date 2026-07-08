import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { desktopBridge } from './desktop/bridge'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('main.tsx: #root element not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// No-op in a plain browser (available: false). Inside the desktop shell, this is the SPA's first
// real IPC roundtrip -- the desktop CI job's cold-start budget measures from process spawn to the
// host printing its own "ready" marker in response to this call (design.md's footprint method).
if (desktopBridge.available) {
  void desktopBridge.invoke('ping').catch(() => {})
}
