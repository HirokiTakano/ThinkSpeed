'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Youtube from '@tiptap/extension-youtube'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import type { FileItem } from '@/hooks/useStore'
import { matchesEvent, type ShortcutConfig } from '@/hooks/shortcuts'

// ProseMirror plugin for search-jump highlight decoration.
// State machine: armed=false → (dispatch {from,to}) → armed=true → (user click or type) → armed=false
type HighlightState = { decos: DecorationSet; armed: boolean }
const searchHighlightKey = new PluginKey<HighlightState>('searchHighlight')
const SearchHighlightExtension = Extension.create({
  name: 'searchHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<HighlightState>({
        key: searchHighlightKey,
        state: {
          init() { return { decos: DecorationSet.empty, armed: false } },
          apply(tr, old) {
            const meta = tr.getMeta(searchHighlightKey)
            if (meta === null) return { decos: DecorationSet.empty, armed: false }
            if (meta !== undefined) {
              return {
                decos: DecorationSet.create(tr.doc, [
                  Decoration.inline(meta.from, meta.to, { class: 'search-jump-highlight' }),
                ]),
                armed: true,
              }
            }
            // ユーザーがクリック（pointer=true）またはタイプ（docChanged）したら解除
            if (old.armed && (tr.docChanged || tr.getMeta('pointer') === true)) {
              return { decos: DecorationSet.empty, armed: false }
            }
            return { decos: old.decos.map(tr.mapping, tr.doc), armed: old.armed }
          },
        },
        props: {
          decorations(state) { return searchHighlightKey.getState(state)?.decos ?? DecorationSet.empty },
        },
      }),
    ]
  },
})

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

        // taskItem のインデント
        if (editor.commands.sinkListItem('taskItem')) return true
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
      'Shift-Tab': () => {
        const { editor } = this
        if (editor.commands.liftListItem('taskItem')) return true
        if (editor.commands.liftListItem('listItem')) return true
        return false
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

    case 'taskList':
      return (node.content ?? [])
        .map(c => nodeToMarkdown(c, depth))
        .join('\n')

    case 'taskItem': {
      const checked = (node.attrs?.checked as boolean) ?? false
      const parts: string[] = []
      for (const child of node.content ?? []) {
        if (child.type === 'paragraph') {
          const text = (child.content ?? []).map(c => nodeToMarkdown(c)).join('')
          parts.push(`${indent}- [${checked ? 'x' : ' '}] ${text}`)
        } else if (child.type === 'taskList' || child.type === 'bulletList') {
          parts.push(nodeToMarkdown(child, depth + 1))
        }
      }
      return parts.join('\n')
    }

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

    case 'image': {
      const src = (node.attrs?.src as string) ?? ''
      const alt = (node.attrs?.alt as string) ?? 'image'
      return `![${alt}](${src.startsWith('data:') ? '[base64 image]' : src})`
    }

    default:
      return (node.content ?? []).map(c => nodeToMarkdown(c, depth)).join('')
  }
}

export type EditorHandle = {
  findAndSelect: (query: string, occurrenceIndex?: number) => void
}

type Props = {
  file: FileItem | null
  onChange: (fileId: string, content: JSONContent) => void
  shortcuts: ShortcutConfig
  emphasisColors: [string, string, string]
  onOpenSearch?: () => void
  onFileReady?: () => void
}

const Editor = forwardRef<EditorHandle, Props>(function Editor({ file, onChange, shortcuts, emphasisColors, onOpenSearch, onFileReady }, ref) {
  const [copied, setCopied] = useState(false)
  // 現在表示中のファイルIDを追跡（ファイル切替時の誤保存防止）
  const activeFileIdRef = useRef<string | null>(null)
  // 常に最新のショートカット設定を参照できるよう ref で保持
  const shortcutsRef = useRef<ShortcutConfig>(shortcuts)
  useEffect(() => { shortcutsRef.current = shortcuts }, [shortcuts])
  // emphasisColors が変わっても常に最新値を参照できるよう ref で保持
  const emphasisColorsRef = useRef<[string, string, string]>(emphasisColors)
  useEffect(() => { emphasisColorsRef.current = emphasisColors }, [emphasisColors])
  // editor インスタンスへの参照（handleKeyDown 内から commands を呼ぶため）
  const editorRef = useRef<TiptapEditor | null>(null)

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
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { class: 'editor-image' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      DeepIndent,
      SearchHighlightExtension,
      Placeholder.configure({ placeholder: '思考を書き始めよう...' }),
    ],
    content: isEmptyDoc(file?.content) ? EMPTY_BULLET : (file?.content ?? EMPTY_BULLET),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'outliner-editor outline-none min-h-full px-8 py-10',
      },
      handleKeyDown(_view, e) {
        const sc = shortcutsRef.current
        const ed = editorRef.current
        if (!ed) return false

        if (matchesEvent(e, sc.bulletList)) {
          e.preventDefault()
          ed.commands.toggleBulletList()
          return true
        }
        if (matchesEvent(e, sc.taskList)) {
          e.preventDefault()
          ed.commands.toggleTaskList()
          return true
        }
        if (matchesEvent(e, sc.link)) {
          e.preventDefault()
          if (ed.isActive('link')) {
            ed.commands.unsetLink()
            return true
          }
          const { from, to } = ed.state.selection
          if (from === to) return false
          const selectedText = ed.state.doc.textBetween(from, to).trim()
          try {
            const url = new URL(selectedText)
            ed.commands.setLink({ href: url.href, target: '_blank' })
            return true
          } catch {
            return false
          }
        }
        if (matchesEvent(e, sc.textColor1) || matchesEvent(e, sc.textColor2) || matchesEvent(e, sc.textColor3)) {
          e.preventDefault()
          const { from, to } = ed.state.selection
          if (from === to) return false
          const colorIndex = matchesEvent(e, sc.textColor1) ? 0 : matchesEvent(e, sc.textColor2) ? 1 : 2
          const color = emphasisColorsRef.current[colorIndex]
          if (ed.isActive('textStyle', { color })) {
            ed.commands.unsetColor()
          } else {
            ed.commands.setColor(color)
          }
          return true
        }
        return false
      },
    },
    onUpdate({ editor }) {
      const id = activeFileIdRef.current
      if (id) onChange(id, editor.getJSON())
    },
    onCreate({ editor }) {
      editorRef.current = editor
    },
  })

  // クエリの N 番目のマッチにジャンプ・黄色ハイライト（ユーザーがクリック or タイプするまで継続）
  useImperativeHandle(ref, () => ({
    findAndSelect(query: string, occurrenceIndex = 0) {
      if (!editor || !query.trim()) return
      const q = query.toLowerCase()
      let matchesFound = 0
      let found = false
      editor.state.doc.descendants((node, pos) => {
        if (found) return false
        if (node.isText) {
          const text = node.text ?? ''
          let searchFrom = 0
          while (!found) {
            const idx = text.toLowerCase().indexOf(q, searchFrom)
            if (idx === -1) break
            if (matchesFound === occurrenceIndex) {
              const from = pos + idx
              const to = from + q.length
              // カーソルのみ移動（選択なし）→ 黄色ハイライトが選択色に隠れない
              editor.commands.setTextSelection(from)
              // armed=true にセット → 次のユーザー操作（pointer/docChanged）で自動解除
              editor.view.dispatch(editor.state.tr.setMeta(searchHighlightKey, { from, to }))
              editor.commands.scrollIntoView()
              found = true
              break
            }
            matchesFound++
            searchFrom = idx + q.length
          }
        }
      })
      if (!found) editor.commands.focus()
    },
  }), [editor])

  // ファイルが切り替わったらエディタの内容を差し替える
  useEffect(() => {
    if (!editor || !file) return
    if (activeFileIdRef.current === file.id) return

    activeFileIdRef.current = file.id
    const contentToSet = isEmptyDoc(file.content) ? EMPTY_BULLET : file.content
    editor.commands.setContent(contentToSet, { emitUpdate: false })
    editor.commands.focus('start')
    onFileReady?.()
  }, [editor, file, onFileReady])

  // 画像ペースト: items/files 両方を試みて base64 挿入
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData
      if (!cd) return

      let imageFile: File | null = null
      const items = Array.from(cd.items ?? [])
      const imgItem = items.find(it => it.type.startsWith('image/'))
      if (imgItem) imageFile = imgItem.getAsFile()
      if (!imageFile && cd.files.length > 0 && cd.files[0].type.startsWith('image/')) {
        imageFile = cd.files[0]
      }
      if (!imageFile) return

      e.preventDefault()
      e.stopPropagation()

      const reader = new FileReader()
      reader.onload = (re) => {
        const src = re.target?.result as string
        if (!src) return
        editor.commands.insertContent({ type: 'image', attrs: { src } })
      }
      reader.readAsDataURL(imageFile)
    }
    dom.addEventListener('paste', onPaste)
    return () => dom.removeEventListener('paste', onPaste)
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

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-zinc-500 select-none">
        サイドバーからファイルを選択してください
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[var(--ts-bg-main)] relative">
      {/* ファイル名表示 */}
      <div className="sticky top-0 z-10 h-12 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center justify-between px-8">
        <span className="text-sm font-medium text-gray-600 dark:text-zinc-300 truncate">{file.name}</span>
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            aria-label="検索 (Ctrl+F)"
            title="検索 (Ctrl+F)"
            className="ml-3 flex-shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-300 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        )}
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
            ? 'bg-indigo-500 border-indigo-400 text-white shadow-indigo-100 dark:shadow-indigo-900'
            : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-lg'
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
})

export default Editor
