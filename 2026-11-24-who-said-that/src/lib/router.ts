// A tiny history router. Paths: /  /new  /r/CODE  /decks  /studio  /how
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
if (typeof window !== 'undefined') window.addEventListener('popstate', emit)

export function navigate(path: string, replace = false) {
  if (path === location.pathname) return
  if (replace) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  window.scrollTo({ top: 0 })
  emit()
}

export function usePath() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => location.pathname,
  )
}

export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'room'; code: string }
  | { name: 'decks' }
  | { name: 'studio' }
  | { name: 'how' }

export function parse(path: string): Route {
  const m = path.match(/^\/r\/([A-Za-z0-9]{6})\/?$/)
  if (m) return { name: 'room', code: m[1].toUpperCase() }
  if (path.startsWith('/new')) return { name: 'new' }
  if (path.startsWith('/decks')) return { name: 'decks' }
  if (path.startsWith('/studio')) return { name: 'studio' }
  if (path.startsWith('/how')) return { name: 'how' }
  return { name: 'home' }
}
