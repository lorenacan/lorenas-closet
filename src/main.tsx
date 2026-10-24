import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/montserrat/300.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import './styles.css'
import { App } from './App'
import { initSync } from './sync/store'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// Pide almacenamiento persistente para que el navegador no borre las fotos y las prendas
void navigator.storage?.persist?.()

void initSync()
