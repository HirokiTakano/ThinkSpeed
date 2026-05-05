'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { JSONContent } from '@tiptap/react'
import { MAX_IMPORT_BYTES, parseFoldersFromImport, sanitizeContent, sanitizeFolders } from '@/hooks/sanitizeStore'

export type FileItem = { id: string; name: string; content: JSONContent; createdOn?: string }
export type Folder = { id: string; name: string; files: FileItem[] }
export type ImportMode = 'overwrite' | 'rename'
export type DropPosition = 'before' | 'after'

export type TrashEntry = {
  id: string
  type: 'folder' | 'file'
  payload: Folder | FileItem
  parentFolderId?: string
  parentFolderName?: string
  deletedAt: number
}

type Store = { folders: Folder[]; activeFileId: string | null; trash: TrashEntry[] }

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
  return { folders: [folder], activeFileId: folder.files[0].id, trash: [] }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function loadFromStorage(): Store {
  // Try new format
  const saved = localStorage.getItem(STORE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.folders && Array.isArray(parsed.folders)) {
        const folders = sanitizeFolders(parsed.folders)
        const allFiles = folders.flatMap(f => f.files)
        const activeFileId =
          typeof parsed.activeFileId === 'string' && allFiles.some(f => f.id === parsed.activeFileId)
            ? parsed.activeFileId
            : allFiles[0]?.id ?? null
        const trash: TrashEntry[] = Array.isArray(parsed.trash)
          ? (parsed.trash as TrashEntry[]).flatMap((t): TrashEntry[] => {
              if (!t || typeof t.deletedAt !== 'number' || Date.now() - t.deletedAt >= THIRTY_DAYS_MS) return []
              try {
                if (t.type === 'folder') {
                  const [payload] = sanitizeFolders([t.payload])
                  return [{ ...t, payload }]
                }
                if (t.type === 'file') {
                  const payload = t.payload as FileItem
                  if (!payload || typeof payload !== 'object') return []
                  const entry: TrashEntry = {
                    ...t,
                    payload: {
                      ...payload,
                      id: typeof payload.id === 'string' ? payload.id : crypto.randomUUID(),
                      name: typeof payload.name === 'string' ? payload.name : '復元したファイル',
                      content: sanitizeContent(payload.content),
                    },
                  }
                  return [entry]
                }
                return []
              } catch {
                return []
              }
            })
          : []
        return { folders, activeFileId, trash }
      }
    } catch { /* fall through */ }
  }

  // Migrate from legacy single-doc format
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy) {
    try {
      const content = sanitizeContent(JSON.parse(legacy))
      const folder = newFolder('はじめのフォルダ')
      folder.files[0] = { ...folder.files[0], content }
      return { folders: [folder], activeFileId: folder.files[0].id, trash: [] }
    } catch { /* fall through */ }
  }

  return defaultStore()
}

export function useStore() {
  const [store, setStore] = useState<Store>({ folders: [], activeFileId: null, trash: [] })
  const hydrated = useRef(false)

  // Load from localStorage on mount (client only)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only; initial render must stay deterministic for hydration.
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
      ...s,
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

  const moveFolder = useCallback((folderId: string, targetFolderId: string, position: DropPosition) => {
    setStore(s => {
      if (folderId === targetFolderId) return s
      const fromIndex = s.folders.findIndex(folder => folder.id === folderId)
      const targetIndex = s.folders.findIndex(folder => folder.id === targetFolderId)
      if (fromIndex === -1 || targetIndex === -1) return s

      const folders = [...s.folders]
      const [folder] = folders.splice(fromIndex, 1)
      const targetIndexAfterRemoval = folders.findIndex(f => f.id === targetFolderId)
      const insertIndex = position === 'before' ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1
      folders.splice(insertIndex, 0, folder)
      return { ...s, folders }
    })
  }, [])

  const moveFile = useCallback((
    fileId: string,
    targetFolderId: string,
    targetFileId?: string,
    position: DropPosition = 'after'
  ) => {
    setStore(s => {
      let movedFile: FileItem | undefined
      let sourceFolderId: string | undefined
      const foldersWithoutFile = s.folders.map(folder => {
        const file = folder.files.find(f => f.id === fileId)
        if (!file) return folder
        movedFile = file
        sourceFolderId = folder.id
        return { ...folder, files: folder.files.filter(f => f.id !== fileId) }
      })
      if (!movedFile || !sourceFolderId) return s

      const targetFolder = foldersWithoutFile.find(folder => folder.id === targetFolderId)
      if (!targetFolder) return s
      if (targetFileId === fileId) return s

      const targetFiles = [...targetFolder.files]
      let insertIndex = targetFiles.length
      if (targetFileId) {
        const targetIndex = targetFiles.findIndex(f => f.id === targetFileId)
        if (targetIndex === -1) return s
        insertIndex = position === 'before' ? targetIndex : targetIndex + 1
      }

      if (sourceFolderId === targetFolderId) {
        const originalFolder = s.folders.find(folder => folder.id === sourceFolderId)
        const originalSourceIndex = originalFolder?.files.findIndex(f => f.id === fileId) ?? -1
        const originalTargetIndex = originalFolder?.files.findIndex(f => f.id === targetFileId) ?? -1
        if (
          targetFileId &&
          originalSourceIndex !== -1 &&
          originalTargetIndex !== -1 &&
          (originalSourceIndex === originalTargetIndex ||
            (position === 'after' && originalSourceIndex === originalTargetIndex + 1) ||
            (position === 'before' && originalSourceIndex === originalTargetIndex - 1))
        ) {
          return s
        }
      }

      targetFiles.splice(insertIndex, 0, movedFile)
      return {
        ...s,
        folders: foldersWithoutFile.map(folder =>
          folder.id === targetFolderId ? { ...folder, files: targetFiles } : folder
        ),
      }
    })
  }, [])

  const deleteFolder = useCallback((folderId: string) => {
    setStore(s => {
      if (s.folders.length <= 1) return s // 最後の1つは削除不可
      const folder = s.folders.find(f => f.id === folderId)
      if (!folder) return s
      const folders = s.folders.filter(f => f.id !== folderId)
      const allFiles = folders.flatMap(f => f.files)
      const activeFileId =
        allFiles.find(f => f.id === s.activeFileId)?.id ?? allFiles[0]?.id ?? null
      const entry: TrashEntry = {
        id: crypto.randomUUID(),
        type: 'folder',
        payload: folder,
        deletedAt: Date.now(),
      }
      return { ...s, folders, activeFileId, trash: [...s.trash, entry] }
    })
  }, [])

  const deleteFile = useCallback((fileId: string) => {
    setStore(s => {
      // 全ファイル数が1以下なら削除不可
      const totalFiles = s.folders.reduce((n, f) => n + f.files.length, 0)
      if (totalFiles <= 1) return s

      let parentFolder: Folder | undefined
      let fileItem: FileItem | undefined
      for (const f of s.folders) {
        const fi = f.files.find(fi => fi.id === fileId)
        if (fi) { parentFolder = f; fileItem = fi; break }
      }
      if (!fileItem || !parentFolder) return s

      const folders = s.folders.map(f => ({
        ...f,
        files: f.files.filter(file => file.id !== fileId),
      }))
      const allFiles = folders.flatMap(f => f.files)
      const activeFileId =
        s.activeFileId === fileId
          ? (allFiles[0]?.id ?? null)
          : s.activeFileId
      const entry: TrashEntry = {
        id: crypto.randomUUID(),
        type: 'file',
        payload: fileItem,
        parentFolderId: parentFolder.id,
        parentFolderName: parentFolder.name,
        deletedAt: Date.now(),
      }
      return { ...s, folders, activeFileId, trash: [...s.trash, entry] }
    })
  }, [])

  const restoreFromTrash = useCallback((trashId: string) => {
    setStore(s => {
      const entry = s.trash.find(t => t.id === trashId)
      if (!entry) return s
      let folders = s.folders
      let activeFileId = s.activeFileId
      if (entry.type === 'folder') {
        const folder = entry.payload as Folder
        folders = [...s.folders, folder]
        if (!activeFileId) activeFileId = folder.files[0]?.id ?? null
      } else {
        const file = entry.payload as FileItem
        const targetFolder = s.folders.find(f => f.id === entry.parentFolderId)
        if (targetFolder) {
          folders = s.folders.map(f =>
            f.id === entry.parentFolderId ? { ...f, files: [...f.files, file] } : f
          )
        } else {
          // 元のフォルダが存在しない場合は同名の新フォルダを作成して復元
          const restoredFolder: Folder = {
            id: crypto.randomUUID(),
            name: entry.parentFolderName ?? '復元したファイル',
            files: [file],
          }
          folders = [...s.folders, restoredFolder]
        }
      }
      return { ...s, folders, activeFileId, trash: s.trash.filter(t => t.id !== trashId) }
    })
  }, [])

  const permanentlyDelete = useCallback((trashId: string) => {
    setStore(s => ({ ...s, trash: s.trash.filter(t => t.id !== trashId) }))
  }, [])

  const emptyTrash = useCallback(() => {
    setStore(s => ({ ...s, trash: [] }))
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
    if (file.size > MAX_IMPORT_BYTES) {
      onResult?.(false)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        const folders = parseFoldersFromImport(json)
        const allFiles = folders.flatMap(f => f.files)
        const activeFileId = allFiles[0]?.id ?? null
        setStore(s => ({ ...s, folders, activeFileId }))
        onResult?.(true)
      } catch {
        onResult?.(false)
      }
    }
    reader.readAsText(file)
  }, [])

  const applyImport = useCallback((importedFolders: Folder[], mode: ImportMode) => {
    const safeImportedFolders = sanitizeFolders(importedFolders)
    setStore(prev => {
      if (mode === 'overwrite') {
        const updatedFolders = [...prev.folders]
        let newActiveFileId = prev.activeFileId
        for (const importedFolder of safeImportedFolders) {
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
        return { ...prev, folders: updatedFolders, activeFileId: newActiveFileId }
      }

      if (mode === 'rename') {
        // フォルダ名が衝突する場合は「フォルダ名 (2)」のように別名で追加
        const updatedFolders = [...prev.folders]
        const existingFolderNames = new Set(updatedFolders.map(f => f.name))
        for (const importedFolder of safeImportedFolders) {
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
    moveFolder,
    moveFile,
    deleteFolder,
    deleteFile,
    restoreFromTrash,
    permanentlyDelete,
    emptyTrash,
    exportData,
    exportFolder,
    exportFile,
    importData,
    applyImport,
  }
}
