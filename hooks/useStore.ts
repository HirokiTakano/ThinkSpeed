'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { JSONContent } from '@tiptap/react'

export type FileItem = { id: string; name: string; content: JSONContent; createdOn?: string }
export type Folder = { id: string; name: string; files: FileItem[] }
export type ImportMode = 'overwrite' | 'rename'

type Store = { folders: Folder[]; activeFileId: string | null }

const STORE_KEY = 'outliner-store-v2'
const LEGACY_KEY = 'outliner-content'

const EMPTY_BULLET_CONTENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }],
}

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function newFile(name = '無題のノート'): FileItem {
  return { id: crypto.randomUUID(), name, content: EMPTY_BULLET_CONTENT, createdOn: localDateString() }
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
  const [store, setStore] = useState<Store>({ folders: [], activeFileId: null })
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

  const exportData = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      folders: store.folders,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ThinkSpeed_全データ_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [store.folders])

  const exportFolder = useCallback((folderId: string) => {
    const folder = store.folders.find(f => f.id === folderId)
    if (!folder) return
    const payload = { version: 1, exportedAt: new Date().toISOString(), folders: [folder] }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = folder.name.replace(/[^\w\u3040-\u9fff]/g, '_')
    a.download = `ThinkSpeed_フォルダ_${safeName}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [store.folders])

  const exportFile = useCallback((fileId: string) => {
    for (const folder of store.folders) {
      const file = folder.files.find(f => f.id === fileId)
      if (file) {
        const payload = { version: 1, exportedAt: new Date().toISOString(), folders: [{ ...folder, files: [file] }] }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const safeName = file.name.replace(/[^\w\u3040-\u9fff]/g, '_')
        a.download = `ThinkSpeed_ファイル_${safeName}_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        return
      }
    }
  }, [store.folders])

  const importData = useCallback((file: File, onResult?: (ok: boolean) => void) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        // version 1 ラッパーと生の folders 配列の両方に対応
        const folders: Folder[] = Array.isArray(json) ? json : json.folders
        if (!Array.isArray(folders) || folders.length === 0) throw new Error('Invalid')
        // 最低限のバリデーション
        for (const f of folders) {
          if (typeof f.id !== 'string' || !Array.isArray(f.files)) throw new Error('Invalid')
          for (const fi of f.files) {
            if (typeof fi.id !== 'string' || typeof fi.name !== 'string') throw new Error('Invalid')
          }
        }
        const allFiles = folders.flatMap(f => f.files)
        const activeFileId = allFiles[0]?.id ?? null
        setStore({ folders, activeFileId })
        onResult?.(true)
      } catch {
        onResult?.(false)
      }
    }
    reader.readAsText(file)
  }, [])

  const applyImport = useCallback((importedFolders: Folder[], mode: ImportMode) => {
    setStore(prev => {
      if (mode === 'overwrite') {
        const updatedFolders = [...prev.folders]
        let newActiveFileId = prev.activeFileId
        for (const importedFolder of importedFolders) {
          const existingIdx = updatedFolders.findIndex(f => f.name === importedFolder.name)
          if (existingIdx === -1) {
            updatedFolders.push({
              ...importedFolder,
              id: crypto.randomUUID(),
              files: importedFolder.files.map(fi => ({ ...fi, id: crypto.randomUUID() })),
            })
          } else {
            const updatedFiles = [...updatedFolders[existingIdx].files]
            for (const importedFile of importedFolder.files) {
              const fileIdx = updatedFiles.findIndex(f => f.name === importedFile.name)
              if (fileIdx === -1) {
                updatedFiles.push({ ...importedFile, id: crypto.randomUUID() })
              } else {
                // 新しいIDを生成してエディタに変更を通知する
                const newId = crypto.randomUUID()
                if (updatedFiles[fileIdx].id === prev.activeFileId) newActiveFileId = newId
                updatedFiles[fileIdx] = { ...importedFile, id: newId }
              }
            }
            updatedFolders[existingIdx] = { ...updatedFolders[existingIdx], files: updatedFiles }
          }
        }
        return { folders: updatedFolders, activeFileId: newActiveFileId }
      }

      if (mode === 'rename') {
        // フォルダ名が衝突する場合は「フォルダ名 (2)」のように別名で追加
        const updatedFolders = [...prev.folders]
        const existingFolderNames = new Set(updatedFolders.map(f => f.name))
        for (const importedFolder of importedFolders) {
          let newFolderName = importedFolder.name
          if (existingFolderNames.has(newFolderName)) {
            let counter = 2
            while (existingFolderNames.has(`${importedFolder.name} (${counter})`)) counter++
            newFolderName = `${importedFolder.name} (${counter})`
          }
          existingFolderNames.add(newFolderName)
          updatedFolders.push({
            ...importedFolder,
            id: crypto.randomUUID(),
            name: newFolderName,
            files: importedFolder.files.map(fi => ({ ...fi, id: crypto.randomUUID() })),
          })
        }
        return { ...prev, folders: updatedFolders }
      }

      return prev
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
    exportData,
    exportFolder,
    exportFile,
    importData,
    applyImport,
  }
}
