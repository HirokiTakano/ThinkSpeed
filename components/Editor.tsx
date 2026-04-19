'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'outliner-content'

// Ctrl+. / Cmd+. でBulletListをトグル
const BulletListToggle = Extension.create({
  name: 'bulletListToggle',
  addKeyboardShortcuts() {
    return {
      'Mod-.': () => this.editor.commands.toggleBulletList(),
    }
  },
})

type TiptapNode = {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string }>
  content?: TiptapNode[]
}

function nodeToMarkdown(node: TiptapNode, depth = 0): string {
  const indent = '  '.repeat(depth)

  switch (node.type) {
    case 'doc':
      return (node.content ?? [])
        .map(c => nodeToMarkdown(c, 0))
        .filter(Boolean)
        .join('\n\n')
        .trim()

    case 'paragraph':
      return (node.content ?? []).map(c => nodeToMarkdown(c)).join('')

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const text = (node.content ?? []).map(c => nodeToMarkdown(c)).join('')
      return `${'#'.repeat(level)} ${text}`
    }

    case 'bulletList':
      return (node.content ?? [])
        .map(c => nodeToMarkdown(c, depth))
        .join('\n')

    case 'listItem': {
      const parts: string[] = []
      for (const child of node.content ?? []) {
        if (child.type === 'paragraph') {
          const text = (child.content ?? []).map(c => nodeToMarkdown(c)).join('')
          parts.push(`${indent}- ${text}`)
        } else if (child.type === 'bulletList') {
          parts.push(nodeToMarkdown(child, depth + 1))
        }
      }
      return parts.join('\n')
    }

    case 'text': {
      let t = node.text ?? ''
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') t = `**${t}**`
        else if (mark.type === 'italic') t = `*${t}*`
        else if (mark.type === 'code') t = `\`${t}\``
        else if (mark.type === 'strike') t = `~~${t}~~`
      }
      return t
    }

    case 'hardBreak':
      return '\n'

    default:
      return (node.content ?? []).map(c => nodeToMarkdown(c, depth)).join('')
  }
}

function KbdHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-500 leading-none">
        {keys}
      </kbd>
      <span>{label}</span>
    </span>
  )
}

export default function Editor() {
  const [copied, setCopied] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      BulletListToggle,
      Placeholder.configure({ placeholder: '思考を書き始めよう...' }),
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'outliner-editor outline-none min-h-[calc(100vh-56px)] px-8 py-10 max-w-2xl mx-auto',
      },
    },
    onUpdate({ editor }) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(editor.getJSON()))
      } catch { /* noop */ }
    },
  })

  // localStorage から復元
  useEffect(() => {
    if (!editor) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) editor.commands.setContent(JSON.parse(saved))
    } catch { /* noop */ }
  }, [editor])

  const copyMarkdown = useCallback(async () => {
    if (!editor) return
    try {
      const md = nodeToMarkdown(editor.getJSON() as TiptapNode)
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* noop */ }
  }, [editor])

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 h-14 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="max-w-2xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-indigo-500 font-bold text-base leading-none select-none">✦</span>
            <span className="font-semibold text-gray-700 text-sm tracking-tight">ThinkSpeed</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-gray-400">
            <KbdHint keys="Ctrl+." label="リスト切替" />
            <KbdHint keys="Tab" label="インデント" />
            <KbdHint keys="Shift+Tab" label="アウトデント" />
          </div>
        </div>
      </header>

      {/* エディタ本体 */}
      <EditorContent editor={editor} />

      {/* Markdownコピーボタン */}
      <button
        onClick={copyMarkdown}
        aria-label="Markdownをクリップボードにコピー"
        className={`fixed bottom-6 right-6 flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border shadow-md transition-all duration-200 select-none cursor-pointer
          ${copied
            ? 'bg-indigo-500 border-indigo-400 text-white shadow-indigo-100'
            : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:shadow-lg'
          }`}
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Markdown をコピー
          </>
        )}
      </button>
    </div>
  )
}
