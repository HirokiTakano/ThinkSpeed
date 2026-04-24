'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Folder } from '@/hooks/useStore'
import { parseEventsFromFolders, type CalendarEvent } from '@/hooks/parseEvents'

type Props = {
  folders: Folder[]
  onSelectFile: (id: string) => void
  onClose: () => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarOverlay({ folders, onSelectFile, onClose }: Props) {
  const today = localToday()
  const now = new Date()
  const currentYear = now.getFullYear()

  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(today)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Parse all events from note content
  const allEvents = useMemo(
    () => parseEventsFromFolders(folders, currentYear),
    [folders, currentYear],
  )

  // Group events by dateKey
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of allEvents) {
      const list = map.get(ev.dateKey) ?? []
      map.set(ev.dateKey, [...list, ev])
    }
    return map
  }, [allEvents])

  const { daysInMonth, firstDayOffset } = useMemo(() => ({
    firstDayOffset: new Date(viewYear, viewMonth, 1).getDay(),
    daysInMonth: new Date(viewYear, viewMonth + 1, 0).getDate(),
  }), [viewYear, viewMonth])

  const cells: (number | null)[] = useMemo(() => {
    const result: (number | null)[] = [
      ...Array(firstDayOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [firstDayOffset, daysInMonth])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const formatDateKey = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // Sort events for selected date by time (timed events first, then untimed)
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return []
    const evs = eventsByDate.get(selectedDate) ?? []
    return [...evs].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time) return -1
      if (b.time) return 1
      return 0
    })
  }, [selectedDate, eventsByDate])

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ts-bg-main)] overflow-y-auto help-overlay-enter">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 ts-bg-main-alpha backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          戻る
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-indigo-500">✦</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">カレンダー</span>
        </div>
        <div className="w-14" />
      </header>

      <div className="max-w-xl mx-auto px-6 py-8 space-y-6">
        {/* 書き方ヒント */}
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/40 px-4 py-3">
          <p className="text-[11px] text-indigo-600 dark:text-indigo-300 leading-relaxed">
            ノートに <code className="font-mono bg-indigo-100 dark:bg-indigo-900/50 px-1 rounded">10月4日 13時: タスク名</code> と書くと自動でカレンダーに登録されます
          </p>
        </div>

        {/* 月ナビゲーション */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:text-zinc-500 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50 transition-colors"
            aria-label="前の月"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">
            {viewYear}年{viewMonth + 1}月
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:text-zinc-500 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50 transition-colors"
            aria-label="次の月"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* カレンダーグリッド */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-700/50 overflow-hidden bg-white dark:bg-zinc-800/50">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-zinc-700/50">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={`text-center text-[10px] font-medium py-2 ${
                  i === 0 ? 'text-red-400' :
                  i === 6 ? 'text-blue-400' :
                  'text-gray-400 dark:text-zinc-500'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日付セル */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="aspect-square" />
              const dateKey = formatDateKey(day)
              const hasEvents = eventsByDate.has(dateKey)
              const eventCount = eventsByDate.get(dateKey)?.length ?? 0
              const isToday = dateKey === today
              const isSelected = dateKey === selectedDate
              const col = idx % 7

              const textColor =
                isSelected ? 'text-white' :
                isToday ? 'text-indigo-600 dark:text-indigo-300' :
                col === 0 ? 'text-red-400 dark:text-red-400' :
                col === 6 ? 'text-blue-400 dark:text-blue-400' :
                hasEvents ? 'text-gray-700 dark:text-zinc-200' :
                'text-gray-300 dark:text-zinc-600'

              const bgColor =
                isSelected ? 'bg-indigo-500' :
                isToday ? 'bg-indigo-50 dark:bg-indigo-950/40' :
                hasEvents ? 'hover:bg-gray-100 dark:hover:bg-zinc-700/50' :
                'hover:bg-gray-50 dark:hover:bg-zinc-700/30'

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(prev => prev === dateKey ? null : dateKey)}
                  className={`relative aspect-square flex flex-col items-center justify-center text-xs transition-colors ${textColor} ${bgColor}`}
                >
                  <span className={`leading-none ${isToday ? 'font-bold' : 'font-medium'}`}>
                    {day}
                  </span>
                  {hasEvents && (
                    <>
                      <span className={`mt-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white/70' : 'bg-indigo-400'}`} />
                      {eventCount > 1 && (
                        <span className={`absolute top-0.5 right-1 text-[8px] font-medium leading-none ${isSelected ? 'text-white/70' : 'text-indigo-400'}`}>
                          {eventCount}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-4 text-[10px] text-gray-400 dark:text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
            タスクあり
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 inline-block" />
            今日
          </span>
        </div>

        {/* 選択日のタスク一覧 */}
        {selectedDate && (
          <section className="space-y-2 pb-4">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
              {selectedDate.replace(/-/g, '/')} のタスク
            </h3>
            {selectedEvents.length > 0 ? (
              <div className="rounded-lg bg-white dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700/50">
                {selectedEvents.map((ev, i) => (
                  <button
                    key={i}
                    onClick={() => { onSelectFile(ev.fileId); onClose() }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors group text-left"
                  >
                    <span className="shrink-0 text-[10px] font-mono font-medium text-indigo-400 mt-0.5 w-10 text-right leading-tight">
                      {ev.time ?? '終日'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate leading-tight">
                        {ev.task}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5 truncate">
                        {ev.fileName}
                      </p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 dark:text-zinc-600 dark:group-hover:text-indigo-400 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-6">
                この日のタスクはありません
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
