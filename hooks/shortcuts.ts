export type Modifier = 'Mod' | 'Shift' | 'Alt'

export type ShortcutDef = {
  modifiers: Modifier[]
  key: string  // lowercase for single chars (as returned by e.key, normalized)
}

export type ShortcutConfig = {
  bulletList: ShortcutDef
  taskList: ShortcutDef
  link: ShortcutDef
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  bulletList: { modifiers: ['Mod'], key: '.' },
  taskList:   { modifiers: ['Mod'], key: '/' },
  link:       { modifiers: ['Mod'], key: 'k' },
}

export const SHORTCUTS_KEY = 'thinkspeed-shortcuts'

export function loadShortcutsFromStorage(): ShortcutConfig {
  try {
    const raw = localStorage.getItem(SHORTCUTS_KEY)
    if (!raw) return { ...DEFAULT_SHORTCUTS }
    const p = JSON.parse(raw) as Record<string, unknown>
    return {
      ...DEFAULT_SHORTCUTS,
      ...(isValidDef(p.bulletList) && { bulletList: p.bulletList }),
      ...(isValidDef(p.taskList)   && { taskList:   p.taskList }),
      ...(isValidDef(p.link)       && { link:        p.link }),
    }
  } catch {
    return { ...DEFAULT_SHORTCUTS }
  }
}

function isValidDef(d: unknown): d is ShortcutDef {
  if (!d || typeof d !== 'object') return false
  const o = d as Record<string, unknown>
  return Array.isArray(o.modifiers) && typeof o.key === 'string' && o.key.length > 0
}

/** KeyboardEvent がショートカット定義に一致するか判定 */
export function matchesEvent(e: KeyboardEvent, def: ShortcutDef | undefined): boolean {
  if (!def || e.isComposing || e.repeat) return false
  const wantMod   = def.modifiers.includes('Mod')
  const wantShift = def.modifiers.includes('Shift')
  const wantAlt   = def.modifiers.includes('Alt')
  const normalKey = e.key.length === 1 ? e.key.toLowerCase() : e.key
  return (e.ctrlKey || e.metaKey) === wantMod &&
         e.shiftKey               === wantShift &&
         e.altKey                 === wantAlt &&
         normalKey                === def.key
}

/** 2 つの ShortcutDef が同じキー組み合わせか判定 */
export function defsConflict(a: ShortcutDef | undefined, b: ShortcutDef | undefined): boolean {
  if (!a || !b) return false
  return a.key === b.key &&
    a.modifiers.includes('Mod')   === b.modifiers.includes('Mod') &&
    a.modifiers.includes('Shift') === b.modifiers.includes('Shift') &&
    a.modifiers.includes('Alt')   === b.modifiers.includes('Alt')
}

/** 表示用文字列 (例: "Ctrl + K", Mac では "Cmd + K") */
export function formatShortcutDef(def: ShortcutDef | undefined): string {
  if (!def) return '—'
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const parts: string[] = []
  if (def.modifiers.includes('Mod'))   parts.push(isMac ? 'Cmd' : 'Ctrl')
  if (def.modifiers.includes('Shift')) parts.push('Shift')
  if (def.modifiers.includes('Alt'))   parts.push(isMac ? 'Option' : 'Alt')
  const display = def.key.length === 1 ? def.key.toUpperCase() : def.key
  parts.push(display)
  return parts.join(' + ')
}
