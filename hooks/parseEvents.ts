import type { JSONContent } from '@tiptap/react'
import type { Folder } from '@/hooks/useStore'

export type CalendarEvent = {
  dateKey: string     // 'YYYY-MM-DD'
  time: string | null // '13:00' or null
  task: string
  fileId: string
  fileName: string
}

/** Normalize full-width digits and colons to half-width */
function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
}

/** Extract text lines from Tiptap JSON at paragraph/heading/listItem boundaries */
function extractLines(content: JSONContent | null | undefined): string[] {
  if (!content) return []
  const lines: string[] = []

  function inlineText(node: JSONContent): string {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'hardBreak') return '\n'
    return (node.content ?? []).map(inlineText).join('')
  }

  function visit(node: JSONContent) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const raw = inlineText(node)
      for (const segment of raw.split('\n')) {
        const t = segment.trim()
        if (t) lines.push(t)
      }
    } else {
      for (const child of node.content ?? []) visit(child)
    }
  }

  visit(content)
  return lines
}

/**
 * Parse a time token (e.g. "13時", "13時30分", "13:30") into "HH:MM".
 * Returns null for invalid or out-of-range values.
 */
function parseTime(token: string | undefined): string | null {
  if (!token) return null

  // 時[分] format
  const m1 = /^(\d{1,2})時(?:(\d{1,2})分)?$/.exec(token)
  if (m1) {
    const h = parseInt(m1[1], 10)
    const min = m1[2] ? parseInt(m1[2], 10) : 0
    if (h > 23 || min > 59) return null
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  // H:MM format
  const m2 = /^(\d{1,2}):(\d{2})$/.exec(token)
  if (m2) {
    const h = parseInt(m2[1], 10)
    const min = parseInt(m2[2], 10)
    if (h > 23 || min > 59) return null
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  return null
}

function isValidDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

// [year年] M月D日 [time] : task  — time: H時 | H時M分 | H:MM
const KANJI_EVENT_RE =
  /(?:(\d{4})年[\s　]*)?(\d{1,2})月(\d{1,2})日[\s　]*((?:\d{1,2}時(?:\d{1,2}分)?|\d{1,2}:\d{2}))?[\s　]*:\s*(.+)/

// M/D [time] : task  — anchored at start to avoid matching inside URLs
const SLASH_EVENT_RE =
  /^(\d{1,2})\/(\d{1,2})[\s　]*((?:\d{1,2}時(?:\d{1,2}分)?|\d{1,2}:\d{2}))?[\s　]*:\s*(.+)/

/** Parse a single normalized line into a CalendarEvent, or null if no match. */
function parseEventFromLine(
  line: string,
  currentYear: number,
  fileId: string,
  fileName: string,
): CalendarEvent | null {
  const normalized = normalize(line)

  // Try Japanese M月D日 format
  const m = KANJI_EVENT_RE.exec(normalized)
  if (m) {
    const year = m[1] ? parseInt(m[1], 10) : currentYear
    const month = parseInt(m[2], 10)
    const day = parseInt(m[3], 10)
    const task = m[5]?.trim()
    if (!task || !isValidDate(year, month, day)) return null
    const time = parseTime(m[4])
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { dateKey, time, task, fileId, fileName }
  }

  // Try M/D slash format
  const s = SLASH_EVENT_RE.exec(normalized)
  if (s) {
    const month = parseInt(s[1], 10)
    const day = parseInt(s[2], 10)
    const task = s[4]?.trim()
    if (!task || !isValidDate(currentYear, month, day)) return null
    const time = parseTime(s[3])
    const dateKey = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { dateKey, time, task, fileId, fileName }
  }

  return null
}

/** Scan all folders and return calendar events parsed from note content. */
export function parseEventsFromFolders(
  folders: Folder[],
  currentYear: number,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const folder of folders) {
    for (const file of folder.files) {
      const lines = extractLines(file.content)
      for (const line of lines) {
        const ev = parseEventFromLine(line, currentYear, file.id, file.name)
        if (ev) events.push(ev)
      }
    }
  }
  return events
}
