'use client'

import Editor from '@/components/Editor'
import Sidebar from '@/components/Sidebar'
import { useStore } from '@/hooks/useStore'
import { useState, useEffect } from 'react'

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
    exportData,
    importData,
  } = useStore()

  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // マウント時に保存済みテーマ（またはシステム設定）を読み込む
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY)
    const t: 'light' | 'dark' = saved === 'dark' ? 'dark' : 'light'
    setTheme(t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'light' ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', next === 'dark')
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF8] dark:bg-[#1C1C1E]">
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
        onExport={exportData}
        onImport={importData}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="flex-1 overflow-y-auto">
        <Editor file={activeFile} onChange={updateFileContent} />
      </main>
    </div>
  )
}

