import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Route =
  | { name: 'closet' }
  | { name: 'generate' }
  | { name: 'looks' }
  | { name: 'settings' }
  | { name: 'garment'; id: string }
  | { name: 'edit'; id?: string; categoryId?: string; fromReview?: boolean }
  | { name: 'review' }
  | { name: 'results' }
  | { name: 'look'; signature: string; from: 'results' | 'saved' }
  | { name: 'categories' }

interface Nav {
  route: Route
  depth: number
  push: (r: Route) => void
  back: () => void
  tab: (r: Route) => void
}

const Ctx = createContext<Nav | null>(null)
export const useNav = () => useContext(Ctx)!

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: 'closet' }])

  useEffect(() => {
    history.replaceState({ d: 1 }, '')
    const onPop = (e: PopStateEvent) => {
      const d = (e.state?.d as number | undefined) ?? 1
      setStack((s) => s.slice(0, Math.max(1, d)))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const nav = useMemo<Nav>(() => ({
    route: stack[stack.length - 1],
    depth: stack.length,
    push: (r) => {
      history.pushState({ d: stack.length + 1 }, '')
      setStack([...stack, r])
    },
    back: () => { if (stack.length > 1) history.back() },
    tab: (r) => {
      history.replaceState({ d: 1 }, '')
      setStack([r])
      window.scrollTo(0, 0)
    },
  }), [stack])

  return <Ctx.Provider value={nav}>{children}</Ctx.Provider>
}
