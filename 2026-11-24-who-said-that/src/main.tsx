import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bagel-fat-one/latin-400.css'
import '@fontsource/vt323/latin-400.css'
import '@fontsource/space-mono/latin-400.css'
import '@fontsource/space-mono/latin-700.css'
import '@fontsource-variable/dm-sans/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/screens.css'
import './styles/game.css'
import { App } from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
