import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Off-season: VITE_SEASON_PAUSED=true shows only the splash page. The app (and
// its Supabase client) is never loaded, so a paused database causes no errors.
const paused = import.meta.env.VITE_SEASON_PAUSED === 'true'
const Root = paused
  ? (await import('./Splash.jsx')).default
  : (await import('./App.jsx')).default

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
