import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Importé avant tout rendu : l'écouteur d'installation doit exister au plus tôt.
import './core/install'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
