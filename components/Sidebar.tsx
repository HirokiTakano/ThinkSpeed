'use client'

import { useState, useRef, useEffect } from 'react'
import type { Folder } from '@/hooks/useStore'

type Props = {
  folders: Folder[]
  activeFileId: string | null
  onSelectFile: (id: string) => void
  onAddFolder: () => void
  onAddFile: (folderId: string) => void
  onRenameFolder: (id: string, name: string) => void
  onRenameFile: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onDeleteFile: (id: string) => void
}

function InlineEdit({
  value,
  onCommit,
}: {
  value: string
  onCommit: (v: string) => void
}) {
  const [val, setVal] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const commit = () => onCommit(val.trim() || value)
  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onCommit(value)
        e.stopPropagation()
      }}
      onClick={e => e.stopPropagation()}
      className="flex-1 bg-white/80 outline-none border-b border-indigo-300 text-xs min-w-0 px-0.5"
    />
  )
}

export default function Sidebar({
  folders,
  activeFileId,
  onSelectFile,
  onAddFolder,
  onAddFile,
  onRenameFolder,
  onRenameFile,
  onDeleteFolder,
  onDeleteFile,
}: Props) {
  // フォルダの開閉状態（新しいフォルダはデフォルト open）
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{
    id: string
    type: 'folder' | 'file'
  } | null>(null)

  const totalFiles = folders.reduce((n, f) => n + f.files.length, 0)

  const toggleFolder = (id: string) => {
    setClosedFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen bg-[#F5F4F1] border-r border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200/80">
        <span className="flex items-center gap-1.5 font-semibold text-gray-700 text-sm select-none">
          <span className="text-indigo-500 text-base">✦</span>
          ThinkSpeed
        </span>
        <button
          onClick={onAddFolder}
          title="新しいフォルダを追加"
          className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
        >
          {/* folder + icon */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
      </div>

      {/* フォルダ・ファイルツリー */}
      <div className="flex-1 overflow-y-auto py-2">
        {folders.map(folder => {
          const isOpen = !closedFolders.has(folder.id)
          return (
            <div key={folder.id}>
              {/* フォルダ行 */}
              <div className="group flex items-center gap-1 px-3 py-1.5 hover:bg-gray-200/60 select-none">
                {/* 折りたたみシェブロン */}
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <svg
                    className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                {/* フォルダアイコン */}
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-indigo-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                </svg>
                {/* フォルダ名 */}
                {editing?.id === folder.id && editing.type === 'folder' ? (
                  <InlineEdit
                    value={folder.name}
                    onCommit={name => {
                      onRenameFolder(folder.id, name)
                      setEditing(null)
                    }}
                  />
                ) : (
                  <span
                    className="flex-1 truncate text-xs font-medium text-gray-600 cursor-pointer"
                    onClick={() => toggleFolder(folder.id)}
                    onDoubleClick={() => setEditing({ id: folder.id, type: 'folder' })}
                  >
                    {folder.name}
                  </span>
                )}
                {/* ホバーアクション */}
                {!editing && (
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); onAddFile(folder.id) }}
                      title="ファイルを追加"
                      className="p-0.5 rounded text-gray-400 hover:text-indigo-500"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    {folders.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteFolder(folder.id) }}
                        title="フォルダを削除"
                        className="p-0.5 rounded text-gray-400 hover:text-red-400"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ファイル一覧 */}
              {isOpen && (
                <div>
                  {folder.files.map(file => {
                    const isActive = file.id === activeFileId
                    return (
                      <div
                        key={file.id}
                        onClick={() => onSelectFile(file.id)}
                        className={`group flex items-center gap-1.5 pl-8 pr-3 py-1.5 cursor-pointer select-none transition-colors
                          ${isActive
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-500 hover:bg-gray-200/60'
                          }`}
                      >
                        <svg
                          className={`w-3 h-3 shrink-0 ${isActive ? 'text-indigo-400' : 'text-gray-400'}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        {editing?.id === file.id && editing.type === 'file' ? (
                          <InlineEdit
                            value={file.name}
                            onCommit={name => {
                              onRenameFile(file.id, name)
                              setEditing(null)
                            }}
                          />
                        ) : (
                          <span
                            className="flex-1 truncate text-xs"
                            onDoubleClick={() => setEditing({ id: file.id, type: 'file' })}
                          >
                            {file.name}
                          </span>
                        )}
                        {!editing && totalFiles > 1 && (
                          <button
                            onClick={e => { e.stopPropagation(); onDeleteFile(file.id) }}
                            title="ファイルを削除"
                            className="hidden group-hover:block p-0.5 rounded text-gray-300 hover:text-red-400 shrink-0"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ショートカットヒント */}
      <div className="px-4 py-3 border-t border-gray-200/80 space-y-1.5">
        {([['Ctrl+.', 'リスト切替'], ['Tab', 'インデント'], ['Shift+Tab', 'アウトデント']] as const).map(
          ([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <kbd className="px-1 py-0.5 rounded border border-gray-200 bg-white font-mono text-[9px] leading-none">
                {key}
              </kbd>
              <span>{label}</span>
            </div>
          )
        )}
      </div>
    </aside>
  )
}
