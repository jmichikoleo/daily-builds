// Per device preferences: sound, motion, last profile. Stored locally, never sent anywhere.
import { useSyncExternalStore } from 'react'
import { PLAYER_COLORS } from '../../shared/avatars.ts'
import type { Profile } from '../../shared/protocol.ts'

export interface Prefs {
  volume: number
  muted: boolean
  reducedMotion: 'system' | 'on' | 'off'
}

const KEY = 'wst:prefs'
const PROFILE_KEY = 'wst:profile'
let prefs: Prefs = load()
const listeners = new Set<() => void>()

function load(): Prefs {
  const base: Prefs = { volume: 0.6, muted: false, reducedMotion: 'system' }
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return base
  }
}

export const getPrefs = () => prefs
export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}
export function usePrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
  )
}

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')
    if (p && typeof p.name === 'string') return p
  } catch {
    /* ignore */
  }
  return { name: '', avatar: Math.floor(Math.random() * 12), color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)] }
}
export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}
