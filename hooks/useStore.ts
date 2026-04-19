'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { JSONContent } from '@tiptap/react'

export type FileItem = { id: string; name: string; content: JSONContent }
export type Folder = { id: string; name: string; files: FileItem[] }

type Store = { folders: Folder[]; activeFileId: string | null }

const STORE_KEY = 'outliner-store-v2'
const LEGACY_KEY = 'outliner-content'

function newFile(name = '無題のノート'): FileItem {
  return { id: crypto.randomUUID(), name, content: { type: 'doc', content: [] } }
}

function newFolder(name = '新しいフォルダ'): Folder {
  const file = newFile()
  return { id: crypto.randomUUID(), name, files: [file] }
}

function defaultStore(): Store {
  const folder = newFolder('はじめのフォルダ')
  return { folders: [folder], activeFileId: folder.files[0].id }
}

function loadFromStorage(): Store {
  // Try new format
  const saved = localStorage.getItem(STORE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Store
      if (parsed.folders && Array.isArray(parsed.folders)) return parsed
    } catch { /* fall through */ }
  }

  // Migrate from legacy single-doc format
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy) {
    try {
      const content = JSON.parse(legacy) as JSONContent
      const folder = newFolder('はじめのフォルダ')
      folder.files[0] = { ...folder.files[0], content }
      return { folders: [folder], activeFileId: folder.files[0].id }
    } catch { /* fall through */ }
  }

  return defaultStore()
}

export function useStore() {
  const [store, setStore] = useState<Store>(defaultStore)
  const hydrated = useRef(false)

  // Load from localStorage on mount (client only)
  useEffect(() => {
    setStore(loadFromStorage())
    hydrated.current = true
  }, [])

  // Persist whenever store changes (only after hydration)
  useEffect(() => {
    if (!hydrated.current) return
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store))
    } catch { /* noop */ }
  }, [store])

  const activeFile =
    store.folders.flatMap(f => f.files).find(f => f.id === store.activeFileId) ?? null

  const setActiveFile = useCallback((id: string) => {
    setStore(s => ({ ...s, activeFileId: id }))
  }, [])

  const updateFileContent = useCallback((fileId: string, content: JSONContent) => {
    setStore(s => ({
      ...s,
      folders: s.folders.map(folder => ({
        ...folder,
        files: folder.files.map(f => (f.id === fileId ? { ...f, content } : f)),
      })),
    }))
  }, [])

  const addFolder = useCallback(() => {
    const folder = newFolder()
    setStore(s => ({
      folders: [...s.folders, folder],
      activeFileId: folder.files[0].id,
    }))
  }, [])

  const addFile = useCallback((folderId: string) => {
    const file = newFile()
    setStore(s => ({
      ...s,
      folders: s.folders.map(f =>
        f.id === folderId ? { ...f, files: [...f.files, file] } : f
      ),
      activeFileId: file.id,
    }))
  }, [])

  const renameFolder = useCallback((folderId: string, name: string) => {
    setStore(s => ({
      ...s,
      folders: s.folders.map(f => (f.id === folderId ? { ...f, name } : f)),
    }))
  }, [])

  const renameFile = useCallback((fileId: string, name: string) => {
    setStore(s => ({
      ...s,
      folders: s.folders.map(folder => ({
        ...folder,
        files: folder.files.map(f => (f.id === fileId ? { ...f, name } : f)),
      })),
    }))
  }, [])

  const deleteFolder = useCallback((folderId: string) => {
    setStore(s => {
      if (s.folders.length <= 1) return s // 最後の1つは削除不可
      const folders = s.folders.filter(f => f.id !== folderId)
      const allFiles = folders.flatMap(f => f.files)
      const activeFileId =
        allFiles.find(f => f.id === s.activeFileId)?.id ?? allFiles[0]?.id ?? null
      return { folders, activeFileId }
    })
  }, [])

  const deleteFile = useCallback((fileId: string) => {
    setStore(s => {
      // 全ファイル数が1以下なら削除不可
      const totalFiles = s.folders.reduce((n, f) => n + f.files.length, 0)
      if (totalFiles <= 1) return s

      const folders = s.folders.map(f => ({
        ...f,
        files: f.files.filter(file => file.id !== fileId),
      }))
      const allFiles = folders.flatMap(f => f.files)
      const activeFileId =
        s.activeFileId === fileId
          ? (allFiles[0]?.id ?? null)
          : s.activeFileId
      return { folders, activeFileId }
    })
  }, [])

  return {
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
  }
}
