'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { Folder, ImportMode, TrashEntry } from '@/hooks/useStore'
import CalendarOverlay from '@/components/CalendarOverlay'
import {
  BG_LIGHT_SWATCHES, BG_DARK_SWATCHES,
  TEXT_LIGHT_SWATCHES, TEXT_DARK_SWATCHES,
  ACCENT_SWATCHES, MARKER_SWATCHES,
  type ColorConfig,
} from '@/hooks/themes'
import {
  DEFAULT_SHORTCUTS, defsConflict, formatShortcutDef,
  type ShortcutConfig, type ShortcutDef, type Modifier,
} from '@/hooks/shortcuts'

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
  trash: TrashEntry[]
  onRestoreFromTrash: (trashId: string) => void
  onPermanentlyDelete: (trashId: string) => void
  onEmptyTrash: () => void
  onExport: () => void
  onExportFolder: (folderId: string) => void
  onExportFile: (fileId: string) => void
  onApplyImport: (folders: Folder[], mode: ImportMode) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  lightColors: ColorConfig
  darkColors: ColorConfig
  onChangeColor: (mode: 'light' | 'dark', key: keyof ColorConfig, value: string) => void
  shortcuts: ShortcutConfig
  onChangeShortcut: (action: keyof ShortcutConfig, def: ShortcutDef) => void
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


type RecordingTarget = keyof ShortcutConfig | null

function HelpOverlay({
  shortcuts,
  onChangeShortcut,
  onClose,
}: {
  shortcuts: ShortcutConfig
  onChangeShortcut: (action: keyof ShortcutConfig, def: ShortcutDef) => void
  onClose: () => void
}) {
  const [recording, setRecording] = useState<RecordingTarget>(null)
  const [error, setError] = useState<string | null>(null)

  // Esc でオーバーレイを閉じる（録音中は中断のみ）— capture で録音ハンドラより先に処理
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (recording) {
          e.stopImmediatePropagation()
          setRecording(null)
          setError(null)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [onClose, recording])

  // キー録音ハンドラ（capture フェーズ: エディタより先に受け取る）
  useEffect(() => {
    if (!recording) return
    const handler = (e: KeyboardEvent) => {
      // Esc は上の Esc ハンドラに任せる
      if (e.key === 'Escape') return

      e.preventDefault()
      e.stopPropagation()

      // 修飾キー単体は無視
      if (['Control', 'Meta', 'Shift', 'Alt', 'CapsLock'].includes(e.key)) return
      // IME 変換中は無視
      if (e.isComposing) return

      const normalKey = e.key.length === 1 ? e.key.toLowerCase() : e.key

      // Tab / Shift+Tab は予約済み
      if (normalKey === 'Tab') {
        setError('Tab / Shift+Tab はシステムで予約されています')
        return
      }

      // 修飾キーが1つも押されていない場合は拒否
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setError('Ctrl（Mac: Cmd）などの修飾キーを組み合わせてください')
        return
      }

      const modifiers: Modifier[] = []
      if (e.ctrlKey || e.metaKey) modifiers.push('Mod')
      if (e.shiftKey) modifiers.push('Shift')
      if (e.altKey)  modifiers.push('Alt')

      const newDef: ShortcutDef = { modifiers, key: normalKey }

      // 他のショートカットと競合していないか確認
      const otherActions = (Object.keys(shortcuts) as Array<keyof ShortcutConfig>).filter(k => k !== recording)
      const conflict = otherActions.find(k => defsConflict(shortcuts[k], newDef))
      if (conflict) {
        const labels: Record<keyof ShortcutConfig, string> = { bulletList: '箇条書きトグル', taskList: 'チェックリストトグル', link: 'リンク設定' }
        setError(`「${labels[conflict]}」と競合しています`)
        return
      }

      onChangeShortcut(recording, newDef)
      setRecording(null)
      setError(null)
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [recording, shortcuts, onChangeShortcut])

  const SHORTCUT_ROWS: { action: keyof ShortcutConfig; label: string; fixed?: boolean }[] = [
    { action: 'bulletList', label: '箇条書きのオン / オフ' },
    { action: 'taskList',   label: 'チェックリストのオン / オフ' },
    { action: 'link',       label: 'リンクの設定 / 解除' },
  ]
  const FIXED_ROWS = [
    { key: 'Tab',       label: '一段深くインデント' },
    { key: 'Shift+Tab', label: '一段浅くアウトデント' },
  ]

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
              ["Markdown でコピー", "右下の丸ボタンで内容を Markdown 形式でクリップボードにコピー"],
            ] as const).map(([title, desc]) => (
              <div key={title} className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-700 dark:text-zinc-200">{title}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* カレンダー */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">カレンダー</h3>
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 border border-indigo-100 dark:border-indigo-900/40 p-4 space-y-3">
            <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
              ノートの本文に日付とタスクを書くと、自動的にカレンダーへ登録されます。
            </p>
            <div className="space-y-1.5">
              {([
                ['4/23 13時: タスク名', 'スラッシュ形式'],
                ['10月4日 13時: タスク名', '日本語形式'],
                ['10月4日 13時30分: タスク名', '時刻 + 分'],
                ['10月4日: タスク名', '日付のみ（終日）'],
                ['2026年10月4日 13時: タスク名', '年も指定できます'],
              ] as const).map(([example, label]) => (
                <div key={example} className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-[11px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">{example}</code>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">
              💡 日付をクリックするとその日のタスクが表示されます
            </p>
          </div>
        </section>

        {/* キーボードショートカット */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">キーボードショートカット</h3>
            <button
              onClick={() => {
                onChangeShortcut('bulletList', DEFAULT_SHORTCUTS.bulletList)
                onChangeShortcut('taskList',   DEFAULT_SHORTCUTS.taskList)
                onChangeShortcut('link',       DEFAULT_SHORTCUTS.link)
              }}
              className="text-[10px] text-gray-400 hover:text-indigo-500 dark:text-zinc-600 dark:hover:text-indigo-400 transition-colors"
            >
              デフォルトに戻す
            </button>
          </div>

          {recording && (
            <div className="px-4 py-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-600 dark:text-indigo-300 text-center animate-pulse">
              キーを押してください… (Esc でキャンセル)
            </div>
          )}
          {error && !recording && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 text-center">
              {error}
            </div>
          )}

          <div className="rounded-lg bg-white dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700/50">
            {/* カスタマイズ可能なショートカット */}
            {SHORTCUT_ROWS.map(({ action, label }) => {
              const isRec = recording === action
              return (
                <div key={action} className="flex items-center gap-3 px-4 py-3">
                  <kbd className={`px-2 py-1 rounded border font-mono text-[10px] shrink-0 min-w-[100px] text-center leading-none transition-colors ${
                    isRec
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 animate-pulse'
                      : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-zinc-300'
                  }`}>
                    {isRec ? '…' : formatShortcutDef(shortcuts[action])}
                  </kbd>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 flex-1">{label}</span>
                  <button
                    onClick={() => {
                      setError(null)
                      setRecording(isRec ? null : action)
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      isRec
                        ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40'
                        : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-400'
                    }`}
                  >
                    {isRec ? 'キャンセル' : '変更'}
                  </button>
                </div>
              )
            })}
            {/* 固定ショートカット */}
            {FIXED_ROWS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3 px-4 py-3 opacity-60">
                <kbd className="px-2 py-1 rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 font-mono text-[10px] text-gray-600 dark:text-zinc-300 shrink-0 min-w-[100px] text-center leading-none">
                  {key}
                </kbd>
                <span className="text-xs text-gray-500 dark:text-zinc-400 flex-1">{label}</span>
                <span className="text-[10px] text-gray-300 dark:text-zinc-700">固定</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-zinc-600 text-center">
            Mac の場合、Ctrl は Cmd として表示されます
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

function PatchNotesOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const RELEASES = [
    {
      version: 'v0.3',
      date: '2025年4月',
      label: '画像サポート',
      color: 'emerald',
      items: [
        { icon: '🖼️', text: 'エディタに画像をそのまま貼り付けられるようになりました（Ctrl/Cmd + V）' },
        { icon: '📋', text: 'スクリーンショットやクリップボードの画像に対応' },
        { icon: '💾', text: '画像はノートと一緒に localStorage に保存されます' },
      ],
    },
    {
      version: 'v0.2',
      date: '2025年4月',
      label: 'カレンダー刷新',
      color: 'indigo',
      items: [
        { icon: '📅', text: 'カレンダーがノートの内容を自動解析してタスクを登録するように変わりました' },
        { icon: '✍️', text: '「10月4日 13時: タスク名」と書くだけで自動登録' },
        { icon: '📝', text: '「4/23 15時30分: タスク」形式（スラッシュ表記）にも対応' },
        { icon: '🗓️', text: '全角数字・「終日」タスク・年付き表記にも対応' },
        { icon: '🔗', text: 'カレンダーからタスクをクリックして該当ノートに即ジャンプ' },
      ],
    },
    {
      version: 'v0.1',
      date: '2025年初期',
      label: '初回リリース',
      color: 'violet',
      items: [
        { icon: '✦', text: '箇条書きベースのアウトライナーエディタ' },
        { icon: '📁', text: 'フォルダ・ファイルによる階層管理' },
        { icon: '⌨️', text: 'Tab / Shift+Tab による深いインデント対応' },
        { icon: '🔗', text: 'URL の自動リンク化・YouTube 動画の埋め込み' },
        { icon: '🌙', text: 'ダークモード / ライトモード切替' },
        { icon: '🎨', text: '背景色・文字色・アクセントカラーのカスタマイズ' },
        { icon: '⚡', text: 'キーボードショートカットのカスタマイズ' },
        { icon: '📤', text: 'JSON でのエクスポート / インポート' },
        { icon: '📋', text: 'Markdown コピー機能' },
      ],
    },
  ] as const

  const colorMap = {
    emerald: {
      badge: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-400',
      line: 'border-emerald-200 dark:border-emerald-800/60',
    },
    indigo: {
      badge: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      dot: 'bg-indigo-400',
      line: 'border-indigo-200 dark:border-indigo-800/60',
    },
    violet: {
      badge: 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
      dot: 'bg-violet-400',
      line: 'border-violet-200 dark:border-violet-800/60',
    },
  }

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
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">パッチノート</span>
        </div>
        <div className="w-14" />
      </header>

      <div className="max-w-xl mx-auto px-6 py-8">
        <div className="relative pl-6">
          {/* 縦線 */}
          <div className="absolute left-2 top-3 bottom-3 w-px bg-gray-100 dark:bg-zinc-800" />

          <div className="space-y-10">
            {RELEASES.map((release) => {
              const c = colorMap[release.color]
              return (
                <div key={release.version} className="relative">
                  {/* タイムラインドット */}
                  <div className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${c.dot}`} />

                  <div className="space-y-3">
                    {/* バージョンヘッダー */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.badge}`}>
                        {release.version}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">
                        {release.label}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                        {release.date}
                      </span>
                    </div>

                    {/* 変更内容 */}
                    <div className={`rounded-xl border ${c.line} bg-white dark:bg-zinc-800/40 overflow-hidden divide-y divide-gray-50 dark:divide-zinc-800/60`}>
                      {release.items.map((item) => (
                        <div key={item.text} className="flex items-start gap-3 px-4 py-2.5">
                          <span className="text-base leading-tight shrink-0">{item.icon}</span>
                          <span className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed">
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrashOverlay({
  trash,
  onRestore,
  onDelete,
  onEmpty,
  onClose,
}: {
  trash: TrashEntry[]
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onEmpty: () => void
  onClose: () => void
}) {
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const daysLeft = (deletedAt: number) => {
    const elapsed = Date.now() - deletedAt
    const remaining = Math.ceil((30 * 24 * 60 * 60 * 1000 - elapsed) / (24 * 60 * 60 * 1000))
    return Math.max(0, remaining)
  }

  const sorted = [...trash].sort((a, b) => b.deletedAt - a.deletedAt)

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
          <svg className="w-4 h-4 text-gray-500 dark:text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">ゴミ箱</span>
          {trash.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-zinc-500">({trash.length}件)</span>
          )}
        </div>
        <div className="w-14" />
      </header>

      <div className="max-w-xl mx-auto px-6 py-6">
        {trash.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400 dark:text-zinc-600 select-none">
            <svg className="w-10 h-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <p className="text-sm">ゴミ箱は空です</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* ゴミ箱を空にするボタン */}
            {confirmEmpty ? (
              <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 mb-4">
                <p className="text-xs text-red-700 dark:text-red-300 mb-3">すべてのアイテムを完全に削除します。この操作は取り消せません。</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onEmpty(); setConfirmEmpty(false) }}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors"
                  >完全に削除する</button>
                  <button
                    onClick={() => setConfirmEmpty(false)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 text-xs font-medium transition-colors"
                  >キャンセル</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEmpty(true)}
                className="w-full mb-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                ゴミ箱を空にする
              </button>
            )}

            {/* アイテム一覧 */}
            {sorted.map(entry => {
              const isFolder = entry.type === 'folder'
              const name = isFolder
                ? (entry.payload as { name: string }).name
                : (entry.payload as { name: string }).name
              const left = daysLeft(entry.deletedAt)
              return (
                <div key={entry.id} className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800">
                  <div className="flex-shrink-0 mt-0.5">
                    {isFolder ? (
                      <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-zinc-200 truncate">{name}</p>
                    {!isFolder && entry.parentFolderName && (
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 truncate">フォルダ: {entry.parentFolderName}</p>
                    )}
                    <p className={`text-[10px] mt-0.5 ${left <= 3 ? 'text-red-400' : 'text-gray-400 dark:text-zinc-600'}`}>
                      {left}日後に完全削除
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onRestore(entry.id)}
                      title="元に戻す"
                      className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(entry.id)}
                      title="完全に削除"
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}

            <p className="text-[10px] text-gray-400 dark:text-zinc-600 text-center pt-4">
              削除されたアイテムは30日後に自動で完全削除されます
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function AppearanceOverlay({
  theme,
  lightColors,
  darkColors,
  onChangeColor,
  onClose,
}: {
  theme: 'light' | 'dark'
  lightColors: ColorConfig
  darkColors: ColorConfig
  onChangeColor: (mode: 'light' | 'dark', key: keyof ColorConfig, value: string) => void
  onClose: () => void
}) {
  // 現在のライト/ダークモードに応じて編集対象モードを固定
  const mode = theme
  const activeColors = mode === 'light' ? lightColors : darkColors

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const sections: { key: keyof ColorConfig; label: string; swatches: string[] }[] = [
    { key: 'bg',     label: '背景色',           swatches: mode === 'light' ? BG_LIGHT_SWATCHES : BG_DARK_SWATCHES },
    { key: 'text',   label: '文字色',           swatches: mode === 'light' ? TEXT_LIGHT_SWATCHES : TEXT_DARK_SWATCHES },
    { key: 'marker', label: '箇条書きマーカー色', swatches: MARKER_SWATCHES },
    { key: 'accent', label: 'アクセントカラー',   swatches: ACCENT_SWATCHES },
  ]

  const modeLabel = mode === 'light' ? '☀️ ライトモード' : '🌙 ダークモード'

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ts-bg-main)] flex flex-col help-overlay-enter">

      {/* ヘッダー */}
      <header className="flex-none flex items-center justify-between px-6 py-4 ts-bg-main-alpha backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
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
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">外観 — {modeLabel}</span>
        </div>
        <div className="w-20" />
      </header>

      {/* プレビューカード（固定表示） */}
      <div className="flex-none border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-xl mx-auto">
          <div
            className="rounded-xl border border-black/10 dark:border-white/10 p-5 space-y-3 transition-colors"
            style={{ backgroundColor: activeColors.bg }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
               style={{ color: activeColors.accent }}>
              プレビュー
            </p>
            <p className="text-sm font-semibold mb-2" style={{ color: activeColors.text }}>
              思考を素早く整理する
            </p>
            <ul className="space-y-1.5 pl-1">
              {[
                'アイデアをすぐにメモできる',
                'タスクを箇条書きで管理する',
                'ノートを構造化して整理する',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span style={{ color: i === 0 ? activeColors.marker : `${activeColors.marker}99` }}>●</span>
                  <span style={{ color: activeColors.text }}>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs mt-2 underline underline-offset-2" style={{ color: activeColors.accent }}>
              リンクのアクセントカラー
            </p>
          </div>
        </div>
      </div>

      {/* 各カラーセクション（スクロール可能） */}
      <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-8 space-y-8">

        {/* 各カラーセクション */}
        {sections.map(({ key, label, swatches }) => {
          const currentValue = activeColors[key] ?? ''
          return (
          <section key={key} className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
              {label}
            </h3>
            <div className="grid grid-cols-5 gap-2.5">
              {swatches.map(color => {
                const isSelected = currentValue.toLowerCase() === color.toLowerCase()
                return (
                  <button
                    key={color}
                    title={color}
                    onClick={() => onChangeColor(mode, key, color)}
                    style={{ backgroundColor: color }}
                    className={`relative w-full aspect-square rounded-lg transition-all hover:scale-105 ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-indigo-400 scale-105'
                        : 'ring-1 ring-black/10 dark:ring-white/10'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-4 h-4 drop-shadow" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {/* カスタムカラーピッカー */}
            {currentValue && (
            <div className="flex items-center gap-2.5 pt-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-gray-400 dark:text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
                <input
                  type="color"
                  value={currentValue}
                  onChange={e => onChangeColor(mode, key, e.target.value)}
                  className="w-5 h-5 cursor-pointer rounded border border-gray-300 dark:border-zinc-600 p-0"
                />
                その他の色
              </label>
              <span className="text-[10px] font-mono text-gray-300 dark:text-zinc-600">
                {currentValue}
              </span>
            </div>
            )}
          </section>
          )
        })}

      </div>
      </div>
    </div>
  )
}

function DataManagementOverlay({
  folders,
  onExportAll,
  onExportFolder,
  onExportFile,
  onApplyImport,
  onClose,
}: {
  folders: Folder[]
  onExportAll: () => void
  onExportFolder: (id: string) => void
  onExportFile: (id: string) => void
  onApplyImport: (folders: Folder[], mode: ImportMode) => void
  onClose: () => void
}) {
  type ImportStep = 'idle' | 'select-mode' | 'confirm-overwrite'
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [exportedIds, setExportedIds] = useState<Set<string>>(new Set())
  const [importStep, setImportStep] = useState<ImportStep>('idle')
  const [pendingFolders, setPendingFolders] = useState<Folder[] | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>('rename')
  const [importFeedback, setImportFeedback] = useState<'idle' | 'ok' | 'err'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [onClose])

  const flashExport = (id: string) => {
    setExportedIds(prev => new Set(prev).add(id))
    setTimeout(() => setExportedIds(prev => { const next = new Set(prev); next.delete(id); return next }), 1500)
  }

  const handleExportAll = () => { onExportAll(); flashExport('__all__') }
  const handleExportFolder = (id: string) => { onExportFolder(id); flashExport(id) }
  const handleExportFile = (id: string) => { onExportFile(id); flashExport(id) }

  const toggleExpand = (id: string) => {
    setExpandedFolders(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        const parsed: Folder[] = Array.isArray(json) ? json : json.folders
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error()
        for (const f of parsed) {
          if (typeof f.id !== 'string' || !Array.isArray(f.files)) throw new Error()
          for (const fi of f.files) {
            if (typeof fi.id !== 'string' || typeof fi.name !== 'string') throw new Error()
          }
        }
        setPendingFolders(parsed)
        setImportStep('select-mode')
      } catch {
        setImportFeedback('err')
        setTimeout(() => setImportFeedback('idle'), 2500)
      }
    }
    reader.readAsText(file)
  }

  const executeImport = () => {
    if (!pendingFolders) return
    onApplyImport(pendingFolders, importMode)
    setPendingFolders(null)
    setImportStep('idle')
    setImportFeedback('ok')
    setTimeout(() => setImportFeedback('idle'), 2500)
  }

  const cancelImport = () => {
    setPendingFolders(null)
    setImportStep('idle')
  }

  const MODE_INFO: { mode: ImportMode; label: string; desc: string }[] = [
    {
      mode: 'rename',
      label: '新規追加',
      desc: 'バックアップの内容を新しく追加します。同じ名前のフォルダ・ファイルがある場合は、自動で「フォルダ名 (2)」のように別名を付けます。既存のデータは変わりません。',
    },
    {
      mode: 'overwrite',
      label: '同名を上書き',
      desc: '同じ名前のフォルダ・ファイルがある場合、その内容をバックアップで置き換えます。名前が一致しないものはそのまま残ります。',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ts-bg-main)] flex flex-col help-overlay-enter">
      <header className="flex-none flex items-center justify-between px-6 py-4 ts-bg-main-alpha backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
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
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">データ管理</span>
        </div>
        <div className="w-14" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 py-8 space-y-10">

          {/* ── バックアップ ── */}
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-700 dark:text-zinc-200 mb-1">💾 バックアップ</h2>
              <p className="text-sm text-gray-400 dark:text-zinc-500">ノートをパソコンにファイルとして保存します。定期的なバックアップをおすすめします。</p>
            </div>

            {/* 全データ */}
            <button
              onClick={handleExportAll}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                exportedIds.has('__all__')
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-950/50'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exportedIds.has('__all__') ? '✓ 保存しました！' : 'すべてのデータをまとめて保存'}
            </button>

            {/* フォルダ / ファイル別 */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 dark:text-zinc-600">フォルダ・ファイルごとに保存</p>
              <div className="rounded-xl border border-gray-100 dark:border-zinc-700/50 overflow-hidden bg-white dark:bg-zinc-800/50">
                {folders.map((folder, fi) => {
                  const expanded = expandedFolders.has(folder.id)
                  return (
                    <div key={folder.id} className={fi > 0 ? 'border-t border-gray-100 dark:border-zinc-700/50' : ''}>
                      <div className="flex items-center gap-2 px-4 py-2.5">
                        <button
                          onClick={() => toggleExpand(folder.id)}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                        >
                          <svg className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                          <span className="text-sm">📁</span>
                          <span className="text-xs text-gray-600 dark:text-zinc-300 truncate">{folder.name}</span>
                          <span className="text-[10px] text-gray-300 dark:text-zinc-700 shrink-0">{folder.files.length}件</span>
                        </button>
                        <button
                          onClick={() => handleExportFolder(folder.id)}
                          className={`shrink-0 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            exportedIds.has(folder.id)
                              ? 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40'
                              : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:border-indigo-700 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/30'
                          }`}
                        >
                          {exportedIds.has(folder.id) ? '✓' : '保存'}
                        </button>
                      </div>
                      {expanded && folder.files.map(file => (
                        <div key={file.id} className="flex items-center gap-2 pl-10 pr-4 py-2 bg-gray-50/70 dark:bg-zinc-900/40 border-t border-gray-100 dark:border-zinc-700/50">
                          <span className="text-sm shrink-0">📄</span>
                          <span className="flex-1 text-xs text-gray-500 dark:text-zinc-400 truncate">{file.name}</span>
                          <button
                            onClick={() => handleExportFile(file.id)}
                            className={`shrink-0 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                              exportedIds.has(file.id)
                                ? 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40'
                                : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:border-indigo-700 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/30'
                            }`}
                          >
                            {exportedIds.has(file.id) ? '✓' : '保存'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── 取り込み ── */}
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-700 dark:text-zinc-200 mb-1">📥 取り込み</h2>
              <p className="text-sm text-gray-400 dark:text-zinc-500">以前に保存したバックアップファイルからノートを取り込みます。</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Step 1: ファイル選択 */}
            {importStep === 'idle' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  importFeedback === 'ok'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : importFeedback === 'err'
                    ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
                    : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:border-indigo-700 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/30'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 5 17 10" />
                  <line x1="12" y1="5" x2="12" y2="15" />
                </svg>
                {importFeedback === 'ok' ? '✓ 取り込みました！' : importFeedback === 'err' ? '❌ 読み込みに失敗しました' : 'バックアップファイルを選ぶ'}
              </button>
            )}

            {/* Step 2: 取り込み方法の選択 */}
            {importStep === 'select-mode' && pendingFolders && (
              <div className="space-y-4">
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 px-4 py-3">
                  <p className="text-sm text-indigo-600 dark:text-indigo-400">
                    📦 {pendingFolders.length}個のフォルダ、{pendingFolders.reduce((sum, f) => sum + f.files.length, 0)}個のファイルが見つかりました
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">取り込み方法を選んでください</p>
                  {MODE_INFO.map(({ mode, label, desc }) => (
                    <button
                      key={mode}
                      onClick={() => setImportMode(mode)}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors ${
                        importMode === mode
                          ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/30'
                          : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none flex items-center justify-center ${
                        importMode === mode ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 dark:border-zinc-600'
                      }`}>
                        {importMode === mode && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">{label}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={cancelImport}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => importMode === 'overwrite' ? setImportStep('confirm-overwrite') : executeImport()}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
                  >
                    取り込む →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 上書き確認 */}
            {importStep === 'confirm-overwrite' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-4 py-4 space-y-2">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">⚠️ 上書きの確認</p>
                  <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed">
                    同じ名前のフォルダ・ファイルが見つかった場合、既存のデータが<strong>完全に失われ</strong>、バックアップの内容で置き換えられます。
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">この操作は元に戻せません。続けますか？</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportStep('select-mode')}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    ← 戻る
                  </button>
                  <button
                    onClick={executeImport}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                  >
                    上書きして取り込む
                  </button>
                </div>
              </div>
            )}
          </section>

        </div>
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
  trash,
  onRestoreFromTrash,
  onPermanentlyDelete,
  onEmptyTrash,
  onExport,
  onExportFolder,
  onExportFile,
  onApplyImport,
  theme,
  onToggleTheme,
  lightColors,
  darkColors,
  onChangeColor,
  shortcuts,
  onChangeShortcut,
}: Props) {
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{
    id: string
    type: 'folder' | 'file'
  } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showAppearance, setShowAppearance] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showPatchNotes, setShowPatchNotes] = useState(false)
  const [showDataMgmt, setShowDataMgmt] = useState(false)
  const [showTrash, setShowTrash] = useState(false)

  // カレンダーからファイルを選ぶとき、親フォルダを自動展開する
  const selectAndRevealFile = useCallback((fileId: string) => {
    const folder = folders.find(f => f.files.some(file => file.id === fileId))
    if (folder) {
      setClosedFolders(prev => {
        const next = new Set(prev)
        next.delete(folder.id)
        return next
      })
    }
    onSelectFile(fileId)
  }, [folders, onSelectFile])

  const totalFiles = folders.reduce((n, f) => n + f.files.length, 0)

  const toggleFolder = (id: string) => {
    setClosedFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      <aside className="w-60 shrink-0 flex flex-col h-screen bg-[var(--ts-bg-sidebar)] border-r border-gray-200 dark:border-zinc-800 overflow-hidden">
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
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: 'var(--ts-marker)' }}
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

      {/* データ管理 */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800/80">
        <button
          onClick={() => setShowDataMgmt(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wide hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            データ管理
          </span>
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* カレンダー */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800/80">
        <button
          onClick={() => setShowCalendar(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wide hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            カレンダー
          </span>
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 外観 */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800/80">
        <button
          onClick={() => setShowAppearance(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wide hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2 0-.52-.2-1-.52-1.36-.28-.34-.44-.78-.44-1.22 0-1.1.9-2 2-2h2.32c2.98 0 5.43-2.46 5.43-5.43C22.8 6.01 17.89 2 12 2z" />
            </svg>
            外観
          </span>
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
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

      {/* パッチノート */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800/80">
        <button
          onClick={() => setShowPatchNotes(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wide hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            パッチノート
          </span>
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* ゴミ箱 */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800/80">
        <button
          onClick={() => setShowTrash(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wide hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            ゴミ箱
            {trash.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 text-[9px] font-bold">
                {trash.length}
              </span>
            )}
          </span>
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </aside>
    {showCalendar && (
      <CalendarOverlay
        folders={folders}
        onSelectFile={selectAndRevealFile}
        onClose={() => setShowCalendar(false)}
        onOpenHelp={() => { setShowCalendar(false); setShowHelp(true) }}
      />
    )}
    {showHelp && (
      <HelpOverlay
        shortcuts={shortcuts}
        onChangeShortcut={onChangeShortcut}
        onClose={() => setShowHelp(false)}
      />
    )}
    {showAppearance && (
      <AppearanceOverlay
        theme={theme}
        lightColors={lightColors}
        darkColors={darkColors}
        onChangeColor={onChangeColor}
        onClose={() => setShowAppearance(false)}
      />
    )}
    {showPatchNotes && (
      <PatchNotesOverlay onClose={() => setShowPatchNotes(false)} />
    )}
    {showTrash && (
      <TrashOverlay
        trash={trash}
        onRestore={onRestoreFromTrash}
        onDelete={onPermanentlyDelete}
        onEmpty={onEmptyTrash}
        onClose={() => setShowTrash(false)}
      />
    )}
    {showDataMgmt && (
      <DataManagementOverlay
        folders={folders}
        onExportAll={onExport}
        onExportFolder={onExportFolder}
        onExportFile={onExportFile}
        onApplyImport={onApplyImport}
        onClose={() => setShowDataMgmt(false)}
      />
    )}
    </>
  )
}
