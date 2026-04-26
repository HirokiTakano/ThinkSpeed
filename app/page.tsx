'use client'

import Editor, { type EditorHandle } from '@/components/Editor'
import Sidebar from '@/components/Sidebar'
import SearchPanel from '@/components/SearchPanel'
import { useStore } from '@/hooks/useStore'
import {
  LIGHT_COLORS_KEY, DARK_COLORS_KEY,
  EMPHASIS_COLORS_KEY, DEFAULT_EMPHASIS_COLORS,
  DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS,
  applyColorsToDOM, loadColorsFromStorage, loadEmphasisColorsFromStorage,
  type ColorConfig,
} from '@/hooks/themes'
import {
  DEFAULT_SHORTCUTS, SHORTCUTS_KEY, loadShortcutsFromStorage,
  type ShortcutConfig, type ShortcutDef,
} from '@/hooks/shortcuts'
import { useState, useEffect, useRef, useCallback } from 'react'

const THEME_KEY = 'thinkspeed-theme'

export default function Home() {
  const {
    store,
    activeFile,
    setActiveFile,
    updateFileContent,
    addFolder,
    addFile,
    renameFolder,
    renameFile,
    deleteFolder,
    deleteFile,
    restoreFromTrash,
    permanentlyDelete,
    emptyTrash,
    exportData,
    exportFolder,
    exportFile,
    applyImport,
  } = useStore()

  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [searchOpen, setSearchOpen] = useState(false)
  const editorRef = useRef<EditorHandle>(null)
  const pendingFindRef = useRef<{ query: string; occurrenceIndex: number } | null>(null)

  const handleFileReady = useCallback(() => {
    if (pendingFindRef.current) {
      editorRef.current?.findAndSelect(pendingFindRef.current.query, pendingFindRef.current.occurrenceIndex)
      pendingFindRef.current = null
    }
  }, [])
  const [lightColors, setLightColors] = useState<ColorConfig>(DEFAULT_LIGHT_COLORS)
  const [darkColors, setDarkColors] = useState<ColorConfig>(DEFAULT_DARK_COLORS)
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(DEFAULT_SHORTCUTS)
  const [emphasisColors, setEmphasisColors] = useState<[string, string, string]>(DEFAULT_EMPHASIS_COLORS)

  // マウント時に保存済みテーマ・カラー・ショートカットを読み込んで適用
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY)
    const t: 'light' | 'dark' = saved === 'dark' ? 'dark' : 'light'
    const { light, dark } = loadColorsFromStorage()

    setTheme(t)
    setLightColors(light)
    setDarkColors(dark)
    setShortcuts(loadShortcutsFromStorage())
    setEmphasisColors(loadEmphasisColorsFromStorage())

    document.documentElement.classList.toggle('dark', t === 'dark')
    applyColorsToDOM(light, dark)
  }, [])

  // Ctrl+F / Cmd+F でカスタム検索パネルを開く（ブラウザのネイティブ検索を抑制）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'f' && !e.repeat) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const toggleTheme = () => {
    const next: 'light' | 'dark' = theme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem(THEME_KEY, next)
    setTheme(next)
    applyColorsToDOM(lightColors, darkColors)
  }

  const changeColor = (mode: 'light' | 'dark', key: keyof ColorConfig, value: string) => {
    if (mode === 'light') {
      setLightColors(prev => {
        const next: ColorConfig = { ...DEFAULT_LIGHT_COLORS, ...prev, [key]: value }
        localStorage.setItem(LIGHT_COLORS_KEY, JSON.stringify(next))
        applyColorsToDOM(next, darkColors)
        return next
      })
    } else {
      setDarkColors(prev => {
        const next: ColorConfig = { ...DEFAULT_DARK_COLORS, ...prev, [key]: value }
        localStorage.setItem(DARK_COLORS_KEY, JSON.stringify(next))
        applyColorsToDOM(lightColors, next)
        return next
      })
    }
  }

  const changeShortcut = (action: keyof ShortcutConfig, def: ShortcutDef) => {
    setShortcuts(prev => {
      const next: ShortcutConfig = { ...prev, [action]: def }
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(next))
      return next
    })
  }

  const changeEmphasisColor = (index: number, color: string) => {
    setEmphasisColors(prev => {
      const next: [string, string, string] = [...prev] as [string, string, string]
      next[index] = color
      localStorage.setItem(EMPHASIS_COLORS_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--ts-bg-main)]">
      <Sidebar
        folders={store.folders}
        activeFileId={store.activeFileId}
        onSelectFile={setActiveFile}
        onAddFolder={addFolder}
        onAddFile={addFile}
        onRenameFolder={renameFolder}
        onRenameFile={renameFile}
        onDeleteFolder={deleteFolder}
        onDeleteFile={deleteFile}
        trash={store.trash}
        onRestoreFromTrash={restoreFromTrash}
        onPermanentlyDelete={permanentlyDelete}
        onEmptyTrash={emptyTrash}
        onExport={exportData}
        onExportFolder={exportFolder}
        onExportFile={exportFile}
        onApplyImport={applyImport}
        theme={theme}
        onToggleTheme={toggleTheme}
        lightColors={lightColors}
        darkColors={darkColors}
        onChangeColor={changeColor}
        shortcuts={shortcuts}
        onChangeShortcut={changeShortcut}
        emphasisColors={emphasisColors}
        onChangeEmphasisColor={changeEmphasisColor}
      />
      <main className="flex-1 overflow-y-auto">
        <Editor
          ref={editorRef}
          file={activeFile}
          onChange={updateFileContent}
          shortcuts={shortcuts}
          emphasisColors={emphasisColors}
          onOpenSearch={() => setSearchOpen(true)}
          onFileReady={handleFileReady}
        />
      </main>
      {searchOpen && (
        <SearchPanel
          folders={store.folders}
          activeFileId={store.activeFileId}
          onSelectFile={setActiveFile}
          onFindInCurrentFile={(q, idx) => editorRef.current?.findAndSelect(q, idx)}
          onSelectFileAndFind={(fileId, q, idx) => {
            pendingFindRef.current = { query: q, occurrenceIndex: idx }
            setActiveFile(fileId)
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}

