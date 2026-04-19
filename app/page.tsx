'use client'

import Editor from '@/components/Editor'
import Sidebar from '@/components/Sidebar'
import { useStore } from '@/hooks/useStore'

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
  } = useStore()

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF8]">
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
      />
      <main className="flex-1 overflow-y-auto">
        <Editor file={activeFile} onChange={updateFileContent} />
      </main>
    </div>
  )
}

