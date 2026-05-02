'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Folder } from '@/hooks/useStore'
import {
  calendarEventKey,
  parseEventsFromFolders,
  type CalendarEvent,
} from '@/hooks/parseEvents'

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const MAPPINGS_KEY = 'thinkspeed-google-calendar-mappings-v1'
const DEFAULT_CALENDAR_ID = 'primary'

type SyncStatus = 'disabled' | 'ready' | 'connecting' | 'connected' | 'syncing' | 'error'

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}

type TokenClient = {
  requestAccessToken: (options?: { prompt?: '' | 'consent' | 'select_account' }) => void
  callback?: (response: GoogleTokenResponse) => void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
          }) => TokenClient
        }
      }
    }
  }
}

type Mapping = {
  key: string
  eventId: string
  calendarId: string
  event: CalendarEvent
  syncedAt: number
}

type GoogleEvent = {
  id: string
  status?: string
}

function loadMappings(): Mapping[] {
  try {
    const raw = localStorage.getItem(MAPPINGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveMappings(mappings: Mapping[]) {
  localStorage.setItem(MAPPINGS_KEY, JSON.stringify(mappings))
}

function eventBody(ev: CalendarEvent) {
  const summary = ev.task
  const description = [
    'Synced from ThinkSpeed.',
    `File: ${ev.fileName}`,
    `Source: ${ev.sourceLine}`,
  ].join('\n')

  if (ev.time) {
    const start = `${ev.dateKey}T${ev.time}:00`
    return {
      summary,
      description,
      start: { dateTime: start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: addMinutesDateTime(ev.dateKey, ev.time, 30), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      extendedProperties: { private: { thinkspeedKey: calendarEventKey(ev) } },
    }
  }

  return {
    summary,
    description,
    start: { date: ev.dateKey },
    end: { date: nextDateKey(ev.dateKey) },
    extendedProperties: { private: { thinkspeedKey: calendarEventKey(ev) } },
  }
}

function addMinutesDateTime(dateKey: string, time: string, minutes: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const d = new Date(year, month - 1, day, hour, minute + minutes)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
}

function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const d = new Date(year, month - 1, day + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isGone(status: number) {
  return status === 404 || status === 410
}

export function useGoogleCalendarSync({
  folders,
  onGoogleDeletedEvent,
}: {
  folders: Folder[]
  onGoogleDeletedEvent: (event: CalendarEvent) => void
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const enabled = !!clientId
  const [status, setStatus] = useState<SyncStatus>(enabled ? 'ready' : 'disabled')
  const [message, setMessage] = useState(enabled ? 'Google カレンダーと接続できます' : 'NEXT_PUBLIC_GOOGLE_CLIENT_ID が未設定です')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const tokenClientRef = useRef<TokenClient | null>(null)
  const syncingRef = useRef(false)
  const deleteFromGoogleRef = useRef<Set<string>>(new Set())
  const currentYear = new Date().getFullYear()
  const calendarId = DEFAULT_CALENDAR_ID

  const appEvents = useMemo(
    () => parseEventsFromFolders(folders, currentYear),
    [folders, currentYear],
  )

  useEffect(() => {
    if (!enabled || tokenClientRef.current) return
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (!window.google?.accounts?.oauth2 || !clientId) return
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) => {
          if (response.error || !response.access_token) {
            setStatus('error')
            setMessage('Google への接続に失敗しました')
            return
          }
          setAccessToken(response.access_token)
          setStatus('connected')
          setMessage('Google カレンダーと接続中')
        },
      })
    }
    if (!existing) document.head.appendChild(script)
  }, [clientId, enabled])

  const connect = useCallback(() => {
    if (!enabled) return
    setStatus('connecting')
    setMessage('Google に接続しています')
    tokenClientRef.current?.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
  }, [accessToken, enabled])

  const disconnect = useCallback(() => {
    setAccessToken(null)
    setStatus(enabled ? 'ready' : 'disabled')
    setMessage(enabled ? 'Google カレンダーとの接続を解除しました' : 'NEXT_PUBLIC_GOOGLE_CLIENT_ID が未設定です')
  }, [enabled])

  const googleFetch = useCallback(async (path: string, init?: RequestInit) => {
    if (!accessToken) throw new Error('Google is not connected')
    return fetch(`${CALENDAR_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  }, [accessToken])

  const sync = useCallback(async () => {
    if (!accessToken || syncingRef.current) return
    syncingRef.current = true
    setStatus('syncing')
    setMessage('Google カレンダーと同期しています')

    try {
      const eventsByKey = new Map(appEvents.map(ev => [calendarEventKey(ev), ev]))
      let mappings = loadMappings().filter(m => m.calendarId === calendarId)
      const mappedKeys = new Set(mappings.map(m => m.key))

      for (const mapping of mappings) {
        if (eventsByKey.has(mapping.key)) continue
        deleteFromGoogleRef.current.add(mapping.key)
        const res = await googleFetch(`/calendars/${encodeURIComponent(mapping.calendarId)}/events/${encodeURIComponent(mapping.eventId)}`, {
          method: 'DELETE',
        })
        deleteFromGoogleRef.current.delete(mapping.key)
        if (!res.ok && !isGone(res.status)) throw new Error(`Google event delete failed: ${res.status}`)
      }
      mappings = mappings.filter(m => eventsByKey.has(m.key))

      for (const ev of appEvents) {
        const key = calendarEventKey(ev)
        if (mappedKeys.has(key)) continue
        const res = await googleFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
          method: 'POST',
          body: JSON.stringify(eventBody(ev)),
        })
        if (!res.ok) throw new Error(`Google event create failed: ${res.status}`)
        const created = await res.json() as GoogleEvent
        mappings.push({ key, eventId: created.id, calendarId, event: ev, syncedAt: Date.now() })
      }

      saveMappings([...loadMappings().filter(m => m.calendarId !== calendarId), ...mappings])
      setStatus('connected')
      setMessage(`同期済み: ${mappings.length} 件`)
    } catch {
      setStatus('error')
      setMessage('同期に失敗しました。Google への接続を確認してください')
    } finally {
      syncingRef.current = false
    }
  }, [accessToken, appEvents, calendarId, googleFetch])

  const pullGoogleDeletions = useCallback(async () => {
    if (!accessToken || syncingRef.current) return
    const mappings = loadMappings().filter(m => m.calendarId === calendarId)
    let changed = false
    const kept: Mapping[] = []

    for (const mapping of mappings) {
      const res = await googleFetch(`/calendars/${encodeURIComponent(mapping.calendarId)}/events/${encodeURIComponent(mapping.eventId)}`)
      if (deleteFromGoogleRef.current.has(mapping.key)) {
        kept.push(mapping)
        continue
      }
      if (isGone(res.status)) {
        onGoogleDeletedEvent(mapping.event)
        changed = true
        continue
      }
      if (!res.ok) {
        kept.push(mapping)
        continue
      }
      const event = await res.json() as GoogleEvent
      if (event.status === 'cancelled') {
        onGoogleDeletedEvent(mapping.event)
        changed = true
        continue
      }
      kept.push(mapping)
    }

    if (changed) {
      saveMappings([...loadMappings().filter(m => m.calendarId !== calendarId), ...kept])
      setMessage('Google 側の削除を反映しました')
    }
  }, [accessToken, calendarId, googleFetch, onGoogleDeletedEvent])

  useEffect(() => {
    if (!accessToken) return
    const id = window.setTimeout(() => { void sync() }, 700)
    return () => window.clearTimeout(id)
  }, [accessToken, sync])

  useEffect(() => {
    if (!accessToken) return
    void pullGoogleDeletions()
    const id = window.setInterval(() => { void pullGoogleDeletions() }, 60_000)
    return () => window.clearInterval(id)
  }, [accessToken, pullGoogleDeletions])

  return {
    enabled,
    connected: !!accessToken,
    status,
    message,
    connect,
    disconnect,
    sync,
  }
}
