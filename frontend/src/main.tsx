import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConfigErrorScreen } from './ConfigErrorScreen.tsx'
import { isSupabaseConfigured } from './lib/supabaseClient.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? <App /> : <ConfigErrorScreen />}
  </StrictMode>,
)
