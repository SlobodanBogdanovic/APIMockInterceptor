import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RulesProvider } from './store/rulesStore'
import { LogProvider } from './store/logStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RulesProvider>
      <LogProvider>
        <App />
      </LogProvider>
    </RulesProvider>
  </StrictMode>,
)
