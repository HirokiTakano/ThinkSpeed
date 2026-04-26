'use client'

import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react'
import type { JSONContent } from '@tiptap/react'
import type { Folder, FileItem } from '@/hooks/useStore'

type SearchScope = 'file' | 'folder' | 'all'

type FileMatches = {
  fileId: string
  fileName: string
  folderName: string
  matches: Array<{ snippet: string }>
  totalCount: number
}

// Traverse JSONContent text nodes (same traversal order as Editor's findAndSelect)
// to collect matches per text node — avoids cross-mark false positives.
function findTextNodeMatches(
  content: JSONContent,
  query: string,
  maxShown: number,
): { matches: Array<{ snippet: string }>; totalCount: number } {
  const q = query.toLowerCase()
  const matches: Array<{ snippet: string }> = []
  let totalCount = 0

  function traverse(node: JSONContent) {
    if (node.type === 'text') {
      const text = node.text ?? ''
      let searchFrom = 0
      while (true) {
        const idx = text.toLowerCase().indexOf(q, searchFrom)
        if (idx === -1) break
        totalCount++
        if (matches.length < maxShown) {
          const start = Math.max(0, idx - 40)
          const end = Math.min(text.length, idx + q.length + 40)
          const snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
          matches.push({ snippet })
        }
        searchFrom = idx + q.length
      }
      return
    }
    if (!node.content) return
    for (const child of node.content) traverse(child)
  }

  traverse(content)
  return { matches, totalCount }
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <span>{text}</span>
  const parts: ReactNode[] = []
  const q = query.toLowerCase()
  let remaining = text
  let key = 0
  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(q)
    if (idx === -1) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }
    if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>)
    parts.push(
      <mark
        key={key++}
        className="bg-yellow-200 dark:bg-yellow-800/60 text-inherit not-italic rounded-sm px-0.5"
      >
        {remaining.slice(idx, idx + q.length)}
      </mark>
    )
    remaining = remaining.slice(idx + q.length)
  }
  return <>{parts}</>
}

type Props = {
  folders: Folder[]
  activeFileId: string | null
  onSelectFile: (id: string) => void
  onFindInCurrentFile?: (query: string, occurrenceIndex: number) => void
  onSelectFileAndFind?: (fileId: string, query: string, occurrenceIndex: number) => void
  onClose: () => void
}

const TABS: { key: SearchScope; label: string }[] = [
  { key: 'file', label: 'このファイル' },
  { key: 'folder', label: 'このフォルダ' },
  { key: 'all', label: 'すべて' },
]

export default function SearchPanel({ folders, activeFileId, onSelectFile, onFindInCurrentFile, onSelectFileAndFind, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('file')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Escape key closes the panel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(t)
  }, [query])

  const activeFolder = useMemo(
    () => folders.find(f => f.files.some(fi => fi.id === activeFileId)),
    [folders, activeFileId]
  )

  const results = useMemo<FileMatches[]>(() => {
    const q = debouncedQuery.trim()
    if (!q || !activeFileId) return []

    // 'file' scope shows more snippets; folder/all show fewer per file
    const maxShown = scope === 'file' ? 50 : 5

    let filesToSearch: Array<{ file: FileItem; folderName: string }> = []
    if (scope === 'file') {
      for (const folder of folders) {
        const file = folder.files.find(fi => fi.id === activeFileId)
        if (file) { filesToSearch = [{ file, folderName: folder.name }]; break }
      }
    } else if (scope === 'folder') {
      if (activeFolder) {
        filesToSearch = activeFolder.files.map(f => ({ file: f, folderName: activeFolder.name }))
      }
    } else {
      filesToSearch = folders.flatMap(f => f.files.map(fi => ({ file: fi, folderName: f.name })))
    }

    return filesToSearch
      .slice(0, 100)
      .map(({ file, folderName }) => {
        const { matches, totalCount } = findTextNodeMatches(file.content, q, maxShown)
        if (totalCount === 0) return null
        return { fileId: file.id, fileName: file.name, folderName, matches, totalCount }
      })
      .filter((r): r is FileMatches => r !== null)
      .slice(0, 30)
  }, [debouncedQuery, scope, folders, activeFileId, activeFolder])

  const handleMatchClick = useCallback((fileId: string, occIdx: number) => {
    if (fileId === activeFileId) {
      onFindInCurrentFile?.(debouncedQuery, occIdx)
    } else {
      onSelectFileAndFind?.(fileId, debouncedQuery, occIdx)
    }
    onClose()
  }, [activeFileId, debouncedQuery, onFindInCurrentFile, onSelectFileAndFind, onClose])

  const hasQuery = query.trim().length > 0
  const isFileScope = scope === 'file'

  return (
    <div
      className="fixed top-12 right-4 z-[60] w-80 flex flex-col overflow-hidden rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 bg-[var(--ts-bg-main)]"
      style={{ maxHeight: 'calc(100vh - 4rem)' }}
    >
      {/* Scope tabs + close */}
      <div className="flex items-stretch border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setScope(key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
              scope === key
                ? 'text-[var(--ts-accent)] border-b-2 border-[var(--ts-accent)]'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="px-3 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors cursor-pointer flex-shrink-0 flex items-center"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <div className="p-3 flex-shrink-0">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="検索..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none focus:border-[var(--ts-accent)] text-[var(--ts-text-color)] placeholder-gray-400 dark:placeholder-zinc-500"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {!hasQuery && (
          <p className="py-4 text-center text-xs text-gray-400 dark:text-zinc-500">
            検索ワードを入力してください
          </p>
        )}
        {hasQuery && debouncedQuery && results.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400 dark:text-zinc-500">
            見つかりませんでした
          </p>
        )}

        {results.map(fileResult => (
          <div key={fileResult.fileId} className="mb-3">
            {/* File header (folder / all scope) */}
            {!isFileScope && (
              <div className="mb-0.5 flex items-center gap-1.5 px-1">
                <span className="truncate text-xs font-semibold text-[var(--ts-text-color)]">
                  {fileResult.fileName}
                </span>
                <span className="flex-shrink-0 text-[10px] text-[var(--ts-accent)]">
                  {fileResult.totalCount}件
                </span>
              </div>
            )}
            {!isFileScope && scope === 'all' && (
              <p className="mb-1 px-1 text-[10px] text-gray-400 dark:text-zinc-500">
                {fileResult.folderName}
              </p>
            )}
            {isFileScope && (
              <p className="mb-1 px-1 text-[10px] text-gray-400 dark:text-zinc-500">
                {fileResult.totalCount}件ヒット
              </p>
            )}

            {/* Individual match buttons */}
            {fileResult.matches.map((match, occIdx) => (
              <button
                key={occIdx}
                onClick={() => handleMatchClick(fileResult.fileId, occIdx)}
                className="mb-0.5 w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <p className="line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">
                  <HighlightedText text={match.snippet} query={debouncedQuery} />
                </p>
              </button>
            ))}

            {/* Overflow indicator */}
            {fileResult.totalCount > fileResult.matches.length && (
              <p className="px-2.5 py-0.5 text-[10px] text-gray-400 dark:text-zinc-500">
                他{fileResult.totalCount - fileResult.matches.length}件…
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
