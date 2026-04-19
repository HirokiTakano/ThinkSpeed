'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Youtube from '@tiptap/extension-youtube'
import { Extension } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileItem } from '@/hooks/useStore'

// 空のドキュメントかどうか判定するヘルパー
const EMPTY_BULLET: JSONContent = {
  type: 'doc',
  content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }],
}

function isEmptyDoc(content: JSONContent | null | undefined): boolean {
  if (!content) return true
  const nodes = content.content ?? []
  if (nodes.length === 0) return true
  if (nodes.length === 1 && nodes[0].type === 'paragraph' && !(nodes[0].content?.length)) return true
  return false
}

// Ctrl+. / Cmd+. でBulletListをトグル
const BulletListToggle = Extension.create({
  name: 'bulletListToggle',
  addKeyboardShortcuts() {
    return {
      'Mod-.': () => this.editor.commands.toggleBulletList(),
    }
  },
})

// Ctrl+K / Cmd+K でリンクをトグル
const LinkToggle = Extension.create({
  name: 'linkToggle',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const { editor } = this
        if (editor.isActive('link')) {
          return editor.commands.unsetLink()
        }
        const { from, to } = editor.state.selection
        if (from === to) return false
        const selectedText = editor.state.doc.textBetween(from, to).trim()
        try {
          const url = new URL(selectedText)
          return editor.commands.setLink({ href: url.href, target: '_blank' })
        } catch {
          return false
        }
      },
    }
  },
})

/**
 * Tab でのインデントを無制限に深くする拡張。
 * 標準の sinkListItem（前の兄弟アイテムへの入れ子）を先に試み、
 * 失敗した場合（先頭アイテム）は空の兄弟アイテムを直前に挿入してから
 * sinkListItem を再実行する。
 */
const DeepIndent = Extension.create({
  name: 'deepIndent',
  priority: 150,
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { editor } = this
        // 標準の sink が成功すればそれを使う
        if (editor.commands.sinkListItem('listItem')) return true

        const { state } = editor
        const { $from } = state.selection
        const { schema } = state

        // listItem の中にいるか探す
        let liDepth = -1
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'listItem') { liDepth = d; break }
        }
        if (liDepth < 0) return false

        const listItemType  = schema.nodes.listItem
        const paragraphType = schema.nodes.paragraph
        if (!listItemType || !paragraphType) return false

        const liStart = $from.before(liDepth)

        // 空の兄弟アイテムを直前に挿入（スキーマ上は paragraph が必要）
        const emptyLi = listItemType.create(null, paragraphType.create())
        editor.view.dispatch(state.tr.insert(liStart, emptyLi))

        // 挿入後は現在のアイテムに前の兄弟ができるので sinkListItem が成功する
        editor.commands.sinkListItem('listItem')
        return true
      },
    }
  },
})

type TiptapNode = {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
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
        else if (mark.type === 'link') {
          const href = (mark.attrs?.href as string) ?? ''
          t = `[${t}](${href})`
        }
      }
      return t
    }

    case 'hardBreak':
      return '\n'

    case 'youtube': {
      const src = (node.attrs?.src as string) ?? ''
      return `[YouTube Video](${src})`
    }

    default:
      return (node.content ?? []).map(c => nodeToMarkdown(c, depth)).join('')
  }
}

type Props = {
  file: FileItem | null
  onChange: (fileId: string, content: JSONContent) => void
}

export default function Editor({ file, onChange }: Props) {
  const [copied, setCopied] = useState(false)
  // 現在表示中のファイルIDを追跡（ファイル切替時の誤保存防止）
  const activeFileIdRef = useRef<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: true,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            class: 'editor-link',
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        },
      }),
      // YoutubeをLinkより高い優先度(200)にしてペーストルールを優先させる
      Youtube.extend({ priority: 200 }).configure({
        width: 640,
        height: 360,
        allowFullscreen: true,
        nocookie: true,
        HTMLAttributes: { class: 'youtube-embed' },
      }),
      BulletListToggle,
      DeepIndent,
      LinkToggle,
      Placeholder.configure({ placeholder: '思考を書き始めよう...' }),
    ],
    content: isEmptyDoc(file?.content) ? EMPTY_BULLET : (file?.content ?? EMPTY_BULLET),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'outliner-editor outline-none min-h-full px-8 py-10',
      },
    },
    onUpdate({ editor }) {
      const id = activeFileIdRef.current
      if (id) onChange(id, editor.getJSON())
    },
  })

  // ファイルが切り替わったらエディタの内容を差し替える
  useEffect(() => {
    if (!editor || !file) return
    if (activeFileIdRef.current === file.id) return

    activeFileIdRef.current = file.id
    const contentToSet = isEmptyDoc(file.content) ? EMPTY_BULLET : file.content
    editor.commands.setContent(contentToSet, { emitUpdate: false })
    // フォーカスを先頭に
    editor.commands.focus('start')
  }, [editor, file])

  const copyMarkdown = useCallback(async () => {
    if (!editor) return
    try {
      const md = nodeToMarkdown(editor.getJSON() as TiptapNode)
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* noop */ }
  }, [editor])

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 select-none">
        サイドバーからファイルを選択してください
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FAFAF8] relative">
      {/* ファイル名表示 */}
      <div className="sticky top-0 z-10 h-12 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center px-8">
        <span className="text-sm font-medium text-gray-600 truncate">{file.name}</span>
      </div>

      {/* エディタ本体 */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>

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
