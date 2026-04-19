'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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

export default function Editor() {
  const [copied, setCopied] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit, BulletListToggle],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'outliner-editor outline-none min-h-screen px-8 py-12 max-w-2xl mx-auto',
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
    <div className="relative">
      <EditorContent editor={editor} />
      <button
        onClick={copyMarkdown}
        className="fixed bottom-5 right-5 text-xs px-3 py-1.5 rounded-md border border-gray-200 bg-white/90 text-gray-400 hover:text-gray-700 hover:border-gray-400 backdrop-blur-sm shadow-sm transition-all duration-150 select-none cursor-pointer"
      >
        {copied ? '✓ Copied!' : 'Markdown をコピー'}
      </button>
    </div>
  )
}
