'use client'

import { useRef, useState, useEffect } from 'react'
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
  onExport: () => void
  onImport: (file: File) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
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
      className="flex-1 bg-white/80 dark:bg-zinc-800/80 outline-none border-b border-indigo-300 dark:border-indigo-600 text-xs dark:text-zinc-200 min-w-0 px-0.5"
    />
  )
}


function HelpOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-[#FAFAF8] dark:bg-[#1C1C1E] overflow-y-auto help-overlay-enter">

      {/* ヘッダー */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#FAFAF8]/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
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
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">使い方ガイド</span>
        </div>
        <div className="w-14" />
      </header>

      {/* コンテンツ */}
      <div className="max-w-xl mx-auto px-6 py-8 space-y-7">

        {/* ThinkSpeed とは */}
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 border border-indigo-100 dark:border-indigo-900/40 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-indigo-500 text-lg">✦</span>
            <h2 className="font-bold text-gray-800 dark:text-zinc-100 text-sm">ThinkSpeed とは？</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
            思考をすばやく整理するための、シンプルなアウトライナーです。余計な機能を排除し、
            <strong className="text-gray-800 dark:text-zinc-200">箇条書きベース</strong>
            でアイデアをまとめることに集中できます。
          </p>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-3 font-medium">
            📌 データはすべてブラウザ内に保存されます（サーバー送信なし）
          </p>
        </div>

        {/* 基本操作 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">基本操作</h3>
          <div className="space-y-2">
            {([
              ["📁", "フォルダを追加", "サイドバー右上の 📁+ ボタンをクリック"],
              ["📄", "ファイルを追加", "フォルダにカーソルを当てると + ボタンが現れます"],
              ["✏️", "名前を変更", "フォルダ名・ファイル名をダブルクリック"],
              ["🗑️", "削除", "ゴミ箱アイコン（2 つ以上ある場合のみ表示）"],
              ["▶", "フォルダの開閉", "フォルダ名をクリックして展開・折りたたみ"],
            ] as const).map(([icon, title, desc]) => (
              <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50">
                <span className="text-base mt-0.5 shrink-0">{icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-zinc-200">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* エディタで書く */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">エディタで書く</h3>
          <div className="rounded-lg bg-white dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700/50">
            {([
              ["箇条書きがデフォルト", "ファイルを開いたらすぐ箇条書きで書き始められます"],
              ["YouTube 動画の埋め込み", "YouTube の URL をそのままペーストすると動画が挿入されます"],
              ["リンクの設定", "テキストを選択して Ctrl+K（Mac: Cmd+K）でリンクを設定・解除"],
              ["Markdown でコピー", "右下の丸ボタンで内容を Markdown 形式でクリップボードにコピー"],
            ] as const).map(([title, desc]) => (
              <div key={title} className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-700 dark:text-zinc-200">{title}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ショートカット */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">キーボードショートカット</h3>
          <div className="rounded-lg bg-white dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700/50">
            {([
              ["Ctrl + .", "箇条書きのオン / オフ"],
              ["Tab", "一段深くインデント"],
              ["Shift + Tab", "一段浅くアウトデント"],
              ["Ctrl + K", "リンクの設定 / 解除"],
            ] as const).map(([key, desc]) => (
              <div key={key} className="flex items-center gap-3 px-4 py-3">
                <kbd className="px-2 py-1 rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 font-mono text-[10px] text-gray-600 dark:text-zinc-300 shrink-0 min-w-[90px] text-center leading-none">
                  {key}
                </kbd>
                <span className="text-xs text-gray-500 dark:text-zinc-400">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-zinc-600 text-center">
            Mac の場合は Ctrl → Cmd に読み替えてください
          </p>
        </section>

        {/* データについて */}
        <section className="space-y-3 pb-4">
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">データについて</h3>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-4 space-y-2">
            {([
              ["✅", "データはブラウザの localStorage に保存されます"],
              ["✅", "サーバーには何も送信されません（完全プライベート）"],
              ["⚠️", "ブラウザのキャッシュをクリアするとデータが消えます"],
              ["💡", "定期的に「JSON でエクスポート」してバックアップを取りましょう"],
            ] as const).map(([icon, text]) => (
              <p key={text} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <span className="shrink-0">{icon}</span>
                <span>{text}</span>
              </p>
            ))}
          </div>
        </section>

      </div>
    </div>
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
  onExport,
  onImport,
  theme,
  onToggleTheme,
}: Props) {
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{
    id: string
    type: 'folder' | 'file'
  } | null>(null)
  const [importFeedback, setImportFeedback] = useState<'idle' | 'ok' | 'err'>('idle')
  const [showHelp, setShowHelp] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalFiles = folders.reduce((n, f) => n + f.files.length, 0)

  const toggleFolder = (id: string) => {
    setClosedFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // reset input so same file can be re-selected
    e.target.value = ''
    try {
      onImport(file)
      setImportFeedback('ok')
    } catch {
      setImportFeedback('err')
    }
    setTimeout(() => setImportFeedback('idle'), 2000)
  }

  return (
    <>
      <aside className="w-60 shrink-0 flex flex-col h-screen bg-[#F5F4F1] dark:bg-[#111113] border-r border-gray-200 dark:border-zinc-800 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200/80 dark:border-zinc-800/80">
        <span className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-zinc-200 text-sm select-none">
          <span className="text-indigo-500 text-base">✦</span>
          ThinkSpeed
        </span>
        <div className="flex items-center gap-0.5">
          {/* テーマ切替ボタン */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
            className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:text-zinc-500 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50 transition-colors"
          >
            {theme === 'dark' ? (
              // 太陽アイコン（ライトモードに戻す）
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              // 月アイコン（ダークモードにする）
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          {/* フォルダ追加ボタン */}
          <button
            onClick={onAddFolder}
            title="新しいフォルダを追加"
            className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:text-zinc-500 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50 transition-colors"
          >
            {/* folder + icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      {/* フォルダ・ファイルツリー */}
      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {folders.map(folder => {
          const isOpen = !closedFolders.has(folder.id)
          return (
            <div key={folder.id}>
              {/* フォルダ行 */}
              <div className="group flex items-center gap-1 px-3 py-1.5 hover:bg-gray-200/60 dark:hover:bg-zinc-700/40 select-none">
                {/* 折りたたみシェブロン */}
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="shrink-0 text-gray-400 hover:text-gray-600 dark:text-zinc-600 dark:hover:text-zinc-400 p-0.5"
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
                    className="flex-1 truncate text-xs font-medium text-gray-600 dark:text-zinc-300 cursor-pointer"
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
                      className="p-0.5 rounded text-gray-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400"
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
                        className="p-0.5 rounded text-gray-400 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400"
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
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'text-gray-500 hover:bg-gray-200/60 dark:text-zinc-400 dark:hover:bg-zinc-700/40'
                          }`}
                      >
                        <svg
                          className={`w-3 h-3 shrink-0 ${isActive ? 'text-indigo-400' : 'text-gray-400 dark:text-zinc-500'}`}
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
                            className="hidden group-hover:block p-0.5 rounded text-gray-300 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400 shrink-0"
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

      {/* エクスポート / インポート */}
      <div className="px-4 py-3 border-t border-gray-200/80 dark:border-zinc-800/80 space-y-1.5">
        {/* hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wide mb-1.5">データ管理</p>
        <button
          onClick={onExport}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-zinc-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          JSONでエクスポート
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-colors
            ${importFeedback === 'ok'
              ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40'
              : importFeedback === 'err'
              ? 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950/40'
              : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-zinc-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/50'
            }`}
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 5 17 10" />
            <line x1="12" y1="5" x2="12" y2="15" />
          </svg>
          {importFeedback === 'ok' ? 'インポート完了!' : importFeedback === 'err' ? '読み込み失敗' : 'JSONをインポート'}
        </button>
      </div>

      {/* 使い方 */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800/80">
        <button
          onClick={() => setShowHelp(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wide hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            使い方
          </span>
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </aside>
    {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </>
  )
}
