import type { JSONContent } from '@tiptap/react'
import type { FileItem, Folder } from '@/hooks/useStore'

const MAX_NAME_LENGTH = 120
const MAX_FOLDERS = 200
const MAX_FILES = 1000
const MAX_CONTENT_NODES = 20000
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

const EMPTY_BULLET_CONTENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }],
}

const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'image',
  'youtube',
])

const ALLOWED_MARK_TYPES = new Set(['bold', 'italic', 'strike', 'code', 'link', 'textStyle'])
const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i
const SAFE_LOCAL_IMAGE_URL = /^\/[A-Za-z0-9/_.,~@-]+$/
const SAFE_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i
const SAFE_YOUTUBE_URL = /^(?:https:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/(?:[\w-]+\?v=|embed\/|v\/|shorts\/)?[\w-]+(?:[?&][\w=.-]+)*$/i

function safeName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().replace(/[\u0000-\u001f\u007f]/g, '')
  return trimmed.slice(0, MAX_NAME_LENGTH) || fallback
}

function safeId(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)
    ? value
    : crypto.randomUUID()
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function safeImageSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (SAFE_IMAGE_DATA_URL.test(value) || SAFE_LOCAL_IMAGE_URL.test(value)) return value
  return null
}

function safeYoutubeSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.startsWith('https://') ? value : `https://${value.replace(/^\/\//, '')}`
  return SAFE_YOUTUBE_URL.test(normalized) ? normalized : null
}

function sanitizeMarks(marks: JSONContent['marks']): JSONContent['marks'] {
  if (!Array.isArray(marks)) return undefined
  const sanitized = marks.flatMap(mark => {
    if (!mark || !ALLOWED_MARK_TYPES.has(mark.type)) return []
    if (mark.type === 'link') {
      const href = safeUrl(mark.attrs?.href)
      return href ? [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }] : []
    }
    if (mark.type === 'textStyle') {
      const color = mark.attrs?.color
      return typeof color === 'string' && SAFE_COLOR.test(color)
        ? [{ type: 'textStyle', attrs: { color } }]
        : [{ type: 'textStyle' }]
    }
    return [{ type: mark.type }]
  })
  return sanitized.length ? sanitized : undefined
}

function sanitizeNode(node: JSONContent, budget: { nodes: number }): JSONContent | null {
  if (!node || typeof node !== 'object' || !node.type || !ALLOWED_NODE_TYPES.has(node.type)) return null
  if (budget.nodes-- <= 0) throw new Error('Content too large')

  if (node.type === 'text') {
    return {
      type: 'text',
      text: typeof node.text === 'string' ? node.text.slice(0, 20000) : '',
      marks: sanitizeMarks(node.marks),
    }
  }

  if (node.type === 'image') {
    const src = safeImageSrc(node.attrs?.src)
    if (!src) return null
    return {
      type: 'image',
      attrs: {
        src,
        alt: typeof node.attrs?.alt === 'string' ? node.attrs.alt.slice(0, 200) : null,
        title: typeof node.attrs?.title === 'string' ? node.attrs.title.slice(0, 200) : null,
      },
    }
  }

  if (node.type === 'youtube') {
    const src = safeYoutubeSrc(node.attrs?.src)
    if (!src) return null
    return {
      type: 'youtube',
      attrs: {
        src,
        start: Number.isFinite(node.attrs?.start) ? Math.max(0, Number(node.attrs?.start)) : 0,
      },
    }
  }

  const content = Array.isArray(node.content)
    ? node.content.flatMap(child => sanitizeNode(child, budget) ?? [])
    : undefined

  const out: JSONContent = { type: node.type }
  if (content?.length) out.content = content
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level)
    out.attrs = { level: Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1 }
  }
  if (node.type === 'taskItem') out.attrs = { checked: node.attrs?.checked === true }
  return out
}

export function sanitizeContent(content: unknown): JSONContent {
  try {
    const sanitized = sanitizeNode(content as JSONContent, { nodes: MAX_CONTENT_NODES })
    return sanitized?.type === 'doc' ? sanitized : EMPTY_BULLET_CONTENT
  } catch {
    return EMPTY_BULLET_CONTENT
  }
}

export function sanitizeFolders(input: unknown): Folder[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Invalid folders')
  let fileCount = 0
  const folders = input.slice(0, MAX_FOLDERS).map((folder, folderIndex) => {
    if (!folder || typeof folder !== 'object') throw new Error('Invalid folder')
    const raw = folder as Record<string, unknown>
    const filesInput = raw.files
    if (!Array.isArray(filesInput)) throw new Error('Invalid files')
    const files: FileItem[] = filesInput.flatMap((file, fileIndex) => {
      if (fileCount >= MAX_FILES || !file || typeof file !== 'object') return []
      const rawFile = file as Record<string, unknown>
      fileCount++
      return [{
        id: safeId(rawFile.id),
        name: safeName(rawFile.name, `無題のノート ${fileIndex + 1}`),
        content: sanitizeContent(rawFile.content),
        createdOn: typeof rawFile.createdOn === 'string' ? rawFile.createdOn.slice(0, 20) : undefined,
      }]
    })
    if (files.length === 0) throw new Error('Folder has no files')
    return {
      id: safeId(raw.id),
      name: safeName(raw.name, `フォルダ ${folderIndex + 1}`),
      files,
    }
  })
  if (folders.length === 0 || fileCount === 0) throw new Error('Empty import')
  return folders
}

export function parseFoldersFromImport(json: unknown): Folder[] {
  const folders = Array.isArray(json) ? json : (json as { folders?: unknown })?.folders
  return sanitizeFolders(folders)
}
