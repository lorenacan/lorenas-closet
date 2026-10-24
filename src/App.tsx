import { useEffect, useState } from 'react'
import { NavProvider, useNav, type Route } from './lib/router'
import { ensureSeed } from './db/db'
import { Closet } from './screens/Closet'
import { GarmentForm } from './screens/GarmentForm'
import { GarmentDetail } from './screens/GarmentDetail'
import { Generate } from './screens/Generate'
import { Results } from './screens/Results'
import { LookDetail } from './screens/LookDetail'
import { Looks } from './screens/Looks'
import { Settings } from './screens/Settings'
import { Categories } from './screens/Categories'
import { ToastHost } from './ui/components'
import { IconGear, IconHanger, IconHeartNav, IconSpark } from './ui/icons'

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'closet': return <Closet />
    case 'generate': return <Generate />
    case 'looks': return <Looks />
    case 'settings': return <Settings />
    case 'garment': return <GarmentDetail id={route.id} />
    case 'edit': return <GarmentForm key={route.id ?? 'new'} id={route.id} categoryId={route.categoryId} />
    case 'results': return <Results />
    case 'look': return <LookDetail key={route.signature} signature={route.signature} from={route.from} />
    case 'categories': return <Categories />
  }
}

const TABS: { name: 'closet' | 'generate' | 'looks' | 'settings'; label: string; icon: React.ReactNode }[] = [
  { name: 'closet', label: 'Armario', icon: <IconHanger /> },
  { name: 'generate', label: 'Crear', icon: <IconSpark /> },
  { name: 'looks', label: 'Looks', icon: <IconHeartNav /> },
  { name: 'settings', label: 'Ajustes', icon: <IconGear /> },
]

function Shell() {
  const nav = useNav()
  // La pestaña activa es la raíz de la pila; las pantallas apiladas no la cambian
  const [tab, setTab] = useState<'closet' | 'generate' | 'looks' | 'settings'>('closet')
  useEffect(() => {
    if (nav.depth === 1 && TABS.some((t) => t.name === nav.route.name)) setTab(nav.route.name as typeof tab)
  }, [nav.route, nav.depth])
  return (
    <div className="app">
      <Screen route={nav.route} />
      <nav className="tabs">
        <div className="in">
          {TABS.map((t) => (
            <button key={t.name} className={`${tab === t.name ? 'on' : ''} ${t.name === 'generate' ? 'gen' : ''}`} onClick={() => nav.tab({ name: t.name })}>
              {t.name === 'generate' ? <span className="dot">{t.icon}</span> : t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <ToastHost />
    </div>
  )
}

export function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => { void ensureSeed().then(() => setReady(true)) }, [])
  if (!ready) return null
  return <NavProvider><Shell /></NavProvider>
}
