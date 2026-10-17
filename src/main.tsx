import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { capturarErrosGlobais } from './lib/erros'
import { aplicarTema, temaSalvo } from './lib/tema'

capturarErrosGlobais()
aplicarTema(temaSalvo())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
