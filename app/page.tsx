'use client'

import Editor from '@/components/Editor'
import Sidebar from '@/components/Sidebar'
import { useStore } from '@/hooks/useStore'
import {
  LIGHT_COLORS_KEY, DARK_COLORS_KEY,
  DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS,
  applyColorsToDOM, loadColorsFromStorage,
  type ColorConfig,
} from '@/hooks/themes'
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
  const [lightColors, setLightColors] = useState<ColorConfig>(DEFAULT_LIGHT_COLORS)
  const [darkColors, setDarkColors] = useState<ColorConfig>(DEFAULT_DARK_COLORS)

  // マウント時に保存済みテーマ・カラーを読み込んで適用
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY)
    const t: 'light' | 'dark' = saved === 'dark' ? 'dark' : 'light'
    const { light, dark } = loadColorsFromStorage()

    setTheme(t)
    setLightColors(light)
    setDarkColors(dark)

    document.documentElement.classList.toggle('dark', t === 'dark')
    applyColorsToDOM(light, dark)
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
        onExport={exportData}
        onImport={importData}
        theme={theme}
        onToggleTheme={toggleTheme}
        lightColors={lightColors}
        darkColors={darkColors}
        onChangeColor={changeColor}
      />
      <main className="flex-1 overflow-y-auto">
        <Editor file={activeFile} onChange={updateFileContent} />
      </main>
    </div>
  )
}

