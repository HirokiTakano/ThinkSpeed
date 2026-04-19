# ThinkSpeed — アプリケーション徹底解説

> このドキュメントは、ThinkSpeed のソースコードをリバースエンジニアリングし、
> プログラミング初心者でも理解できるよう、設計・技術・コードを丁寧に解説したものです。

---

## 目次

1. [このアプリは何をするもの？](#1-このアプリは何をするもの)
2. [使われている技術・ライブラリ一覧](#2-使われている技術ライブラリ一覧)
3. [ファイル構成の全体像](#3-ファイル構成の全体像)
4. [データの流れ（アーキテクチャ）](#4-データの流れアーキテクチャ)
5. [各ファイルの詳細解説](#5-各ファイルの詳細解説)
   - [package.json — アプリの「材料リスト」](#51-packagejson--アプリの材料リスト)
   - [tsconfig.json — TypeScriptの設定ファイル](#52-tsconfigjson--typescriptの設定ファイル)
   - [next.config.ts — Next.jsの設定ファイル](#53-nextconfigts--nextjsの設定ファイル)
   - [app/layout.tsx — 全ページ共通の外枠](#54-applayouttsx--全ページ共通の外枠)
   - [app/globals.css — 見た目のスタイル定義](#55-appglobalscss--見た目のスタイル定義)
   - [app/page.tsx — アプリのメイン画面](#56-apppagetsx--アプリのメイン画面)
   - [hooks/useStore.ts — データ管理の中枢](#57-hooksusestorets--データ管理の中枢)
   - [components/Sidebar.tsx — 左のファイルツリー](#58-componentssidebartsx--左のファイルツリー)
   - [components/Editor.tsx — テキストエディタ本体](#59-componentseditortsxテキストエディタ本体)
   - [customHttp.yml — AWS Amplify用のヘッダー設定](#510-customhttpyml--aws-amplify用のヘッダー設定)
6. [設計思想・なぜこう作られているか](#6-設計思想なぜこう作られているか)
7. [キーボードショートカットの仕組み](#7-キーボードショートカットの仕組み)
8. [データの保存・読み込みの仕組み](#8-データの保存読み込みの仕組み)
9. [よく使われているプログラミングパターン](#9-よく使われているプログラミングパターン)
10. [用語集（初心者向け）](#10-用語集初心者向け)

---

## 1. このアプリは何をするもの？

ThinkSpeed は「**箇条書きベースの思考整理ツール**」です。
メモ帳やノートアプリに近いですが、以下の特徴があります。

- **箇条書き（アウトライン）が中心** — Tabキーで階層を深くでき、思考をツリー状に整理できる
- **フォルダ・ファイル管理** — 左のサイドバーで複数のノートを整理できる
- **インターネット不要** — データはすべてブラウザの中（localStorage）に保存される。サーバーは不要
- **JSONでバックアップ** — データをJSONファイルとしてダウンロード・復元できる
- **Markdownにコピー** — 書いた内容をMarkdown形式でクリップボードにコピーできる
- **YouTube埋め込み** — YouTubeのURLを貼り付けると動画が埋め込まれる

---

## 2. 使われている技術・ライブラリ一覧

### 🏗️ フレームワーク・言語

| 技術名 | バージョン | 役割 | 初心者向け説明 |
|--------|-----------|------|---------------|
| **TypeScript** | ^5 | プログラミング言語 | JavaScriptに「型」という仕組みを追加した言語。変数の種類（数値・文字列など）を明示することでバグを防げる |
| **React** | 19.2.4 | UIライブラリ | 画面の部品（コンポーネント）を作るためのライブラリ。Facebookが開発 |
| **Next.js** | 16.2.4 | Webフレームワーク | Reactをより便利に使うためのフレームワーク。ページ構成やルーティング（URLの管理）を担当 |

### 🎨 スタイリング

| 技術名 | バージョン | 役割 | 初心者向け説明 |
|--------|-----------|------|---------------|
| **Tailwind CSS** | ^4 | CSSフレームワーク | HTMLに `className="flex h-screen"` のように書くだけでスタイルを適用できる。CSSをファイルに別途書かなくて済む |

### ✏️ エディタ

| 技術名 | バージョン | 役割 | 初心者向け説明 |
|--------|-----------|------|---------------|
| **Tiptap** | ^3.22.4 | リッチテキストエディタ | テキストを太字・斜体・箇条書きなどに整形できるエディタ。VSCodeやNotionのような入力体験を作れる |
| **@tiptap/starter-kit** | ^3.22.4 | Tiptapの基本機能セット | 箇条書き・見出し・太字・リンクなど基本的な機能をまとめたパッケージ |
| **@tiptap/extension-placeholder** | ^3.22.4 | プレースホルダー表示 | エディタが空のときに薄いグレーで「思考を書き始めよう...」と表示する機能 |
| **@tiptap/extension-youtube** | ^3.22.4 | YouTube埋め込み | YouTubeのURLを貼り付けると動画を埋め込んで表示する機能 |

### ☁️ デプロイ・公開

| 技術名 | 役割 | 初心者向け説明 |
|--------|------|---------------|
| **AWS Amplify** | ホスティング | Amazonのクラウドサービスを使い、ウェブサイトを世界中に公開する |

---

## 3. ファイル構成の全体像

```
ThinkSpeed/
│
├── app/                    ← Next.jsの「ページ」フォルダ
│   ├── layout.tsx          ← 全ページ共通の枠組み（フォントや<html>タグの設定）
│   ├── page.tsx            ← メインページ（サイドバーとエディタを並べる）
│   └── globals.css         ← 全体のスタイル（見た目のCSS）
│
├── components/             ← 画面の部品（Reactコンポーネント）
│   ├── Sidebar.tsx         ← 左側のファイルツリーナビゲーション
│   └── Editor.tsx          ← 右側のテキストエディタ本体
│
├── hooks/                  ← カスタムフック（データ管理ロジック）
│   └── useStore.ts         ← フォルダ・ファイル・内容を管理する「頭脳」
│
├── public/                 ← 静的ファイル（画像など）
│
├── package.json            ← プロジェクトの設定と使用ライブラリ一覧
├── tsconfig.json           ← TypeScriptの設定
├── next.config.ts          ← Next.jsの設定（セキュリティヘッダーなど）
├── customHttp.yml          ← AWS Amplify専用のHTTPヘッダー設定
├── eslint.config.mjs       ← コードの品質チェックツールの設定
└── postcss.config.mjs      ← CSS処理ツールの設定（Tailwind用）
```

### ポイント：責務の分離

このアプリは「どこに何を書くか」がはっきり分かれています。

- **データの操作** → `hooks/useStore.ts`
- **データの表示・入力** → `components/` の各ファイル
- **ページの組み立て** → `app/page.tsx`
- **見た目のスタイル** → `app/globals.css`

---

## 4. データの流れ（アーキテクチャ）

アプリ全体でデータがどう流れているかを図で示します。

```
┌─────────────────────────────────────────────────────────────┐
│                       ブラウザ                              │
│                                                             │
│  ┌──────────────┐       ┌──────────────────────────────┐   │
│  │ localStorage │ ←──── │        useStore.ts           │   │
│  │ (データ保存) │ ────→ │   (全データ管理・State管理)   │   │
│  └──────────────┘       └──────┬───────────────────────┘   │
│                                │ データを渡す（Props）      │
│                    ┌───────────▼───────────────────┐       │
│                    │         page.tsx              │       │
│                    │   (サイドバー+エディタを並べる) │       │
│                    └──────┬────────────────┬───────┘       │
│                           │                │               │
│               ┌───────────▼───┐    ┌───────▼──────────┐   │
│               │  Sidebar.tsx  │    │   Editor.tsx     │   │
│               │ (フォルダ/    │    │  (文章を書く      │   │
│               │  ファイル一覧) │    │   エディタ本体)  │   │
│               └───────────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### データの流れの仕組み

1. **アプリ起動時**: `useStore.ts` が `localStorage` からデータを読み込む
2. **表示**: `page.tsx` がデータを `Sidebar` と `Editor` に渡す
3. **操作**: ユーザーがファイルを選んだり文章を書いたりすると、`useStore.ts` のデータが更新される
4. **保存**: データが変わると自動的に `localStorage` に保存される

この「データは上から下に流れる」という設計を **単方向データフロー** と呼びます。

---

## 5. 各ファイルの詳細解説

---

### 5.1 `package.json` — アプリの「材料リスト」

**役割**: プロジェクトで使う外部ライブラリ（npm パッケージ）の一覧と、実行コマンドの定義。

```json
{
  "name": "thinkspeed",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",       // 開発用サーバーを起動（ローカルで動かす）
    "build": "next build",   // 本番用にビルド（ファイルを最適化・圧縮）
    "start": "next start",   // ビルド済みアプリを起動
    "lint": "eslint"         // コードの品質チェック
  },
  ...
}
```

**`dependencies`（本番用ライブラリ）** と **`devDependencies`（開発時だけ使うライブラリ）** に分かれています。

- `dependencies` = アプリが実際に動くときに必要なもの（Tiptap、React、Next.js など）
- `devDependencies` = 開発・ビルド時だけ使うもの（TypeScript、Tailwind、ESLint など）

---

### 5.2 `tsconfig.json` — TypeScriptの設定ファイル

**役割**: TypeScriptコンパイラ（TypeScriptをJavaScriptに変換するツール）の動作を設定する。

重要な設定をいくつか説明します。

```json
{
  "compilerOptions": {
    "strict": true,          // 厳格な型チェックを有効化（バグを早期に発見できる）
    "jsx": "react-jsx",      // JSXをReact用に変換する
    "paths": {
      "@/*": ["./*"]         // "@/components/..." のような短い書き方を有効にする
    }
  }
}
```

`"paths"` の設定により、`import Editor from '@/components/Editor'` と書けます。
これがないと `import Editor from '../../components/Editor'` のような長い相対パスが必要になります。

---

### 5.3 `next.config.ts` — Next.jsの設定ファイル

**役割**: Next.js フレームワーク自体の動作設定。このアプリではセキュリティヘッダーの設定に使われています。

```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',     // 全URLに適用
      headers: [{
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",                                // 基本的に自サイトのみ許可
          "script-src 'self' 'unsafe-inline' ... https://www.youtube.com",  // スクリプトの読み込み元
          "frame-src 'self' https://www.youtube.com ...",      // iframeで表示できる場所
          ...
        ].join('; ')
      }]
    }]
  }
}
```

**CSP（Content Security Policy）** とは、ブラウザに「このサイトはどこのリソースを読み込んでいいか」を伝えるセキュリティ設定です。
YouTubeの埋め込み動画を表示するために、`youtube.com` からの iframe を明示的に許可しています。

---

### 5.4 `app/layout.tsx` — 全ページ共通の外枠

**役割**: Next.js の App Router において、すべてのページに共通する `<html>` や `<body>` タグを定義する「外枠」。

```tsx
import { Geist, Geist_Mono } from "next/font/google";  // Googleフォントを読み込む

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ThinkSpeed",   // ブラウザのタブに表示されるタイトル
  description: "思考整理に特化した超軽量アウトライナー",
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
```

- **Geist フォント**: Vercel（Next.jsの開発会社）が作ったモダンなフォント
- `{children}` には実際のページの内容が入る。`layout.tsx` はその「器」にあたる
- `antialiased` はフォントを滑らかに表示するCSSクラス（Tailwind）

---

### 5.5 `app/globals.css` — 見た目のスタイル定義

**役割**: アプリ全体のCSSスタイル定義。特にTiptapエディタのスタイルを詳細に設定している。

#### ファイルの構成

```css
@import "tailwindcss";   /* Tailwind CSS v4 を読み込む */

:root {
  --background: #ffffff; /* CSS変数でテーマカラーを定義 */
  --foreground: #171717;
}
```

#### Tailwind v4 との衝突問題

このアプリではTailwind CSS v4 の **プリフライト（デフォルトのCSSリセット）** が箇条書きのスタイルを上書きしてしまうという問題がありました。

```css
/* ❌ Tailwind v4でこう書くと "disc" が消えてしまう */
list-style: disc outside !important;

/* ✅ 個別プロパティで書くと正しく動く */
list-style-type: disc !important;
list-style-position: outside;
```

そのため `globals.css` では以下のように Tiptap の箇条書きスタイルを「強制的に上書き」しています。

```css
.outliner-editor ul, .ProseMirror ul {
  list-style-type: disc !important;   /* !important で強制上書き */
  list-style-position: outside;
  padding-left: 1.75em;
}
.outliner-editor ul ul { list-style-type: circle !important; }  /* 2階層目 */
.outliner-editor ul ul ul { list-style-type: square !important; } /* 3階層目 */
```

箇条書きの記号（●◯■）の色もレベルごとに変えています。
- 1階層目: インディゴ系 (`#818cf8`)
- 2階層目: 薄い紫 (`#a78bfa`)
- 3階層目: グレー (`#9ca3af`)

#### リンクのスタイル

```css
.outliner-editor a.editor-link {
  color: #4338ca;
  background-color: rgba(99, 102, 241, 0.08); /* 薄い紫の背景 */
  text-decoration: underline;
  text-decoration-color: #818cf8;
  cursor: pointer;
}
```

#### YouTube埋め込みのスタイル

```css
.outliner-editor div[data-youtube-video] {
  aspect-ratio: 16 / 9;  /* 横:縦 = 16:9 の比率を保つ */
  width: 100%;
  max-width: 640px;
  border-radius: 10px;
  overflow: hidden;
}
```

`aspect-ratio: 16 / 9` は「横16、縦9の比率を維持する」という意味です。
これにより画面幅が変わっても動画の比率が崩れません。

---

### 5.6 `app/page.tsx` — アプリのメイン画面

**役割**: アプリのメインページ。サイドバーとエディタを横に並べて表示する「組み立て役」。

```tsx
'use client'  // ← これが非常に重要！後述します
```

#### `'use client'` とは何か？

Next.js では、コンポーネントを2種類に分けて考えます。

| 種類 | 動く場所 | 特徴 |
|------|---------|------|
| **Server Component**（デフォルト） | サーバー | 高速表示。`useState` など使えない |
| **Client Component** | ブラウザ | インタラクティブ。`useState`, `useEffect` が使える |

`'use client'` と書くことで、「このファイルはブラウザで動かしてください」と宣言しています。
ThinkSpeed はデータをブラウザの `localStorage` に保存するため、ほぼすべてのコンポーネントが `'use client'` になっています。

#### ページの構造

```tsx
export default function Home() {
  const { store, activeFile, setActiveFile, ... } = useStore()  // データ管理フックを使う

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF8]">
      {/* 左：サイドバー */}
      <Sidebar
        folders={store.folders}
        activeFileId={store.activeFileId}
        onSelectFile={setActiveFile}
        onAddFolder={addFolder}
        // ... 他の操作関数も渡す
      />
      {/* 右：エディタ */}
      <main className="flex-1 overflow-y-auto">
        <Editor file={activeFile} onChange={updateFileContent} />
      </main>
    </div>
  )
}
```

- `flex h-screen` — 横並び（flex）で画面の高さ全体（h-screen）を使うレイアウト
- `flex-1` — エディタ部分が残りの横幅を全部使う
- `overflow-hidden` — 画面外にはみ出した部分を隠す

#### Props（プロパティ）の渡し方

`Sidebar` や `Editor` には「データ」と「操作する関数」の両方を渡しています。
例えば `onSelectFile={setActiveFile}` は「ファイルを選んだら `setActiveFile` 関数を呼んでね」という約束です。

---

### 5.7 `hooks/useStore.ts` — データ管理の中枢

**役割**: アプリの全データ（フォルダ・ファイル・内容）を管理する「カスタムフック」。

#### カスタムフックとは？

React の「フック」は、コンポーネントに機能（状態管理・副作用など）を追加する関数です。
`useState`、`useEffect` などが代表例。

**カスタムフック** とは、これらを組み合わせて自作した関数のことです。
`use` で始まる名前にするのが慣例です（`useStore`）。

#### データ構造の定義

```typescript
// 1つのファイル
export type FileItem = {
  id: string          // ユニークなID（例: "abc123-def456"）
  name: string        // ファイル名（例: "会議メモ"）
  content: JSONContent // Tiptapのドキュメント内容（JSON形式）
}

// 1つのフォルダ（複数のファイルを持つ）
export type Folder = {
  id: string
  name: string
  files: FileItem[]   // FileItemの配列
}

// アプリ全体のデータ
type Store = {
  folders: Folder[]          // フォルダの配列
  activeFileId: string | null // 現在開いているファイルのID
}
```

#### localStorage との連携

```typescript
const STORE_KEY = 'outliner-store-v2'  // localStorageのキー名

function loadFromStorage(): Store {
  const saved = localStorage.getItem(STORE_KEY)
  if (saved) {
    const parsed = JSON.parse(saved) as Store
    if (parsed.folders && Array.isArray(parsed.folders)) return parsed
  }
  // ...旧バージョンからのマイグレーション処理
  return defaultStore()  // 何もなければ初期データを返す
}
```

`localStorage` はブラウザ内蔵のミニデータベースです。
キーと値のペアを保存でき、ブラウザを閉じても消えません。

#### ハイドレーションミスマッチの回避

```typescript
export function useStore() {
  // ★ 初期値は空のデータ（サーバー側もこれを使う）
  const [store, setStore] = useState<Store>({ folders: [], activeFileId: null })
  const hydrated = useRef(false)

  // ★ ブラウザで動いたとき（クライアントのみ）にlocalStorageを読む
  useEffect(() => {
    setStore(loadFromStorage())
    hydrated.current = true
  }, [])

  // ★ データが変わったら自動保存（ハイドレーション後のみ）
  useEffect(() => {
    if (!hydrated.current) return
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  }, [store])
  ...
}
```

**なぜこうするか？** Next.js はサーバー側でも最初にHTMLを生成します（SSR）。
このとき `localStorage` はブラウザにしか存在しないため、`useState` の初期値でアクセスしてはいけません。
もし初期値で `localStorage` にアクセスしようとすると、サーバーとブラウザで異なる値になり「ハイドレーションエラー」が発生します。

解決策：`useState` の初期値は空データにして、`useEffect`（ブラウザでのみ実行される）でlocalStorageを読み込む。

#### データ操作の各関数

```typescript
// ファイルの内容を更新（イミュータブルな更新）
const updateFileContent = useCallback((fileId: string, content: JSONContent) => {
  setStore(s => ({
    ...s,  // 既存データをコピー（スプレッド構文）
    folders: s.folders.map(folder => ({
      ...folder,
      files: folder.files.map(f => (f.id === fileId ? { ...f, content } : f))
    })),
  }))
}, [])
```

**イミュータブル（不変）な更新** とは、元のデータを直接変更するのではなく、新しいコピーを作って更新する手法です。
`{ ...s }` は「sの全プロパティをコピーした新しいオブジェクト」を意味します（スプレッド構文）。

#### エクスポート（バックアップ）の仕組み

```typescript
const exportData = useCallback(() => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),  // 「2024-01-01T12:00:00Z」のような形式
    folders: store.folders,
  }
  // JSONをBlob（バイナリデータ）に変換
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)  // ダウンロード用の一時URLを生成
  const a = document.createElement('a') // <a>タグを動的に作成
  a.href = url
  a.download = `thinkspeed-backup-${...}.json`
  a.click()  // クリックしてダウンロード開始
  URL.revokeObjectURL(url)  // 一時URLを解放（メモリ解放）
}, [store.folders])
```

「ファイルをダウンロードさせる」という処理をJavaScriptで行う定番のパターンです。
目に見えない `<a>` タグを作り、プログラムからクリックさせることでダウンロードを発動します。

#### インポート（復元）の仕組み

```typescript
const importData = useCallback((file: File) => {
  const reader = new FileReader()  // ブラウザ組み込みのファイル読み込みAPI
  reader.onload = (e) => {
    const json = JSON.parse(e.target?.result as string)
    const folders: Folder[] = Array.isArray(json) ? json : json.folders
    // バリデーション（正しい形式かチェック）
    if (!Array.isArray(folders) || folders.length === 0) throw new Error('Invalid')
    for (const f of folders) {
      if (typeof f.id !== 'string' || !Array.isArray(f.files)) throw new Error('Invalid')
    }
    setStore({ folders, activeFileId: folders.flatMap(f => f.files)[0]?.id ?? null })
  }
  reader.readAsText(file)  // ファイルをテキストとして読み込む
}, [])
```

---

### 5.8 `components/Sidebar.tsx` — 左のファイルツリー

**役割**: 左側のナビゲーションバー。フォルダ・ファイルの一覧表示、追加・削除・名前変更・エクスポート/インポートを担当。

#### 型定義（Props）

```typescript
type Props = {
  folders: Folder[]
  activeFileId: string | null
  onSelectFile: (id: string) => void   // ファイルを選んだとき呼ぶ関数
  onAddFolder: () => void
  onAddFile: (folderId: string) => void
  onRenameFolder: (id: string, name: string) => void
  onRenameFile: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onDeleteFile: (id: string) => void
  onExport: () => void
  onImport: (file: File) => void
}
```

`Props` とは「親コンポーネントから渡されるデータと関数の型定義」です。
TypeScript で型を定義することで、正しいデータが渡されているかコンパイル時にチェックできます。

#### インライン編集コンポーネント

```tsx
function InlineEdit({ value, onCommit }) {
  const [val, setVal] = useState(value)  // 入力中の値をローカルで管理
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()   // マウント直後にフォーカスを当てる
    ref.current?.select()  // テキストを全選択状態にする
  }, [])

  const commit = () => onCommit(val.trim() || value)  // 空なら元の名前に戻す

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}          // フォーカスが外れたら確定
      onKeyDown={e => {
        if (e.key === 'Enter') commit()   // Enterで確定
        if (e.key === 'Escape') onCommit(value) // Escapeでキャンセル
        e.stopPropagation()    // キーイベントが親に伝播しないようにする
      }}
    />
  )
}
```

これはダブルクリックで名前を編集できる「インライン編集」のUIコンポーネントです。
`useRef` でDOM要素（inputタグ）への参照を保持し、マウント時に自動フォーカスします。

#### フォルダの開閉管理

```typescript
const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set())

const toggleFolder = (id: string) => {
  setClosedFolders(prev => {
    const next = new Set(prev)  // Setのコピーを作る
    next.has(id) ? next.delete(id) : next.add(id)  // あれば削除、なければ追加
    return next
  })
}
```

`Set` はJavaScriptの組み込みデータ型で「重複しない値の集合」を管理します。
「閉じているフォルダのIDの集合」を管理することで、どのフォルダが開いているかを把握します。

#### ホバーしたときだけボタンを表示する

```tsx
<div className="group flex items-center ...">
  {/* ホバーアクション — group-hover:flex で親にhoverしたときだけ表示 */}
  <div className="hidden group-hover:flex items-center gap-0.5">
    <button onClick={() => onAddFile(folder.id)}>+</button>
    <button onClick={() => onDeleteFolder(folder.id)}>🗑</button>
  </div>
</div>
```

Tailwind の `group` と `group-hover:` を組み合わせたテクニックです。
`group` を親に付け、子に `hidden group-hover:flex` と書くと「親にマウスが乗ったときだけ表示」が実現できます。

#### ファイルインポートのトリック

```tsx
{/* 見えないファイル選択input */}
<input
  ref={fileInputRef}
  type="file"
  accept=".json,application/json"
  className="hidden"   // 見えない状態にする
  onChange={handleImportFile}
/>
{/* 実際に表示するボタン */}
<button onClick={() => fileInputRef.current?.click()}>
  JSONをインポート
</button>
```

ブラウザ標準の `<input type="file">` はスタイリングが難しいため、見えない状態で配置しておき、
カスタムボタンからプログラムで `.click()` を呼び出すテクニックです。

---

### 5.9 `components/Editor.tsx` — テキストエディタ本体

**役割**: Tiptapを使ったリッチテキストエディタ。箇条書き・リンク・YouTube埋め込みなどの機能を担当。

#### Tiptapの基本的な使い方

```tsx
const editor = useEditor({
  extensions: [...],  // 有効にする機能（拡張機能）の一覧
  content: ...,       // 初期表示するコンテンツ
  onUpdate({ editor }) {
    // 内容が変わるたびに呼ばれる
    onChange(id, editor.getJSON())  // JSONとして親に通知
  }
})

return <EditorContent editor={editor} />  // エディタをDOMに描画
```

Tiptap は ProseMirror というエディタエンジンをReact向けにラップしたものです。
内部では文書をJSONのツリー構造で管理しており、`editor.getJSON()` でその構造を取り出せます。

#### ドキュメントのJSON構造

Tiptapが管理するドキュメントの構造はこのようになっています。

```json
{
  "type": "doc",
  "content": [
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                { "type": "text", "text": "ここに文章が入る" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

これが `localStorage` にそのまま保存されています。

#### カスタム拡張機能1: BulletListToggle

```typescript
const BulletListToggle = Extension.create({
  name: 'bulletListToggle',
  addKeyboardShortcuts() {
    return {
      'Mod-.': () => this.editor.commands.toggleBulletList()
      // Mod = MacではCmd、WindowsではCtrl
    }
  },
})
```

`Ctrl+.`（Mac: `Cmd+.`）で箇条書きのオン/オフを切り替えるカスタム拡張です。
`Extension.create()` は Tiptap に新しい機能を追加するAPIです。

#### カスタム拡張機能2: LinkToggle

```typescript
const LinkToggle = Extension.create({
  name: 'linkToggle',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const { editor } = this
        // すでにリンクなら解除
        if (editor.isActive('link')) return editor.commands.unsetLink()
        // テキストが選択されているかチェック
        const { from, to } = editor.state.selection
        if (from === to) return false  // 何も選択されていなければ何もしない
        const selectedText = editor.state.doc.textBetween(from, to).trim()
        try {
          const url = new URL(selectedText)  // URLとして有効かチェック
          return editor.commands.setLink({ href: url.href, target: '_blank' })
        } catch {
          return false  // 無効なURLなら何もしない
        }
      }
    }
  }
})
```

`Ctrl+K`（Mac: `Cmd+K`）でリンクの設定・解除を行います。
URLを選択した状態でショートカットを押すとリンクになり、もう一度押すと解除されます。

#### カスタム拡張機能3: DeepIndent（最も複雑）

```typescript
const DeepIndent = Extension.create({
  name: 'deepIndent',
  priority: 150,  // 他の拡張より先に処理される（高い値ほど優先）
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { editor } = this
        // まず標準のインデント（sinkListItem）を試みる
        if (editor.commands.sinkListItem('listItem')) return true

        // 先頭のアイテムでは sinkListItem が失敗するため、
        // 空の兄弟アイテムを挿入してから再試行する
        const { state } = editor
        const { $from } = state.selection
        const { schema } = state

        // listItemノードの深さを探す
        let liDepth = -1
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'listItem') { liDepth = d; break }
        }
        if (liDepth < 0) return false  // リスト内でなければ何もしない

        const liStart = $from.before(liDepth)
        // 空のlistItemを直前に挿入する
        const emptyLi = schema.nodes.listItem.create(null, schema.nodes.paragraph.create())
        editor.view.dispatch(state.tr.insert(liStart, emptyLi))

        // 挿入後は前の兄弟ができるのでインデント成功する
        editor.commands.sinkListItem('listItem')
        return true
      }
    }
  }
})
```

Tiptapの標準インデント（`sinkListItem`）は「前に兄弟アイテムがある場合のみ動作する」という制限があります。
この拡張はリストの先頭アイテムでも無制限にインデントできるよう、空の兄弟を一瞬挿入してから再インデントする「裏技」を使っています。

#### ファイル切り替え時の注意点

```typescript
const activeFileIdRef = useRef<string | null>(null)  // 現在のファイルIDを追跡

useEffect(() => {
  if (!editor || !file) return
  if (activeFileIdRef.current === file.id) return  // 同じファイルなら何もしない

  activeFileIdRef.current = file.id
  editor.commands.setContent(contentToSet, { emitUpdate: false })  // emitUpdate:false = 保存イベントを発火させない
  editor.commands.focus('start')  // カーソルを先頭に移動
}, [editor, file])
```

ファイルを切り替えるとき、エディタの内容を新しいファイルの内容に差し替えます。
このとき `emitUpdate: false` を指定しないと、「内容が変わった！保存しなきゃ！」というイベントが発火して誤保存が起きる可能性があります。

#### Markdown変換機能

エディタ右下の「Markdown をコピー」ボタンを押すと、TiptapのJSON形式をMarkdownテキストに変換してクリップボードにコピーします。

```typescript
function nodeToMarkdown(node: TiptapNode, depth = 0): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(c => nodeToMarkdown(c, 0)).join('\n\n').trim()
    case 'bulletList':
      return (node.content ?? []).map(c => nodeToMarkdown(c, depth)).join('\n')
    case 'listItem': {
      const parts: string[] = []
      for (const child of node.content ?? []) {
        if (child.type === 'paragraph') {
          const text = (child.content ?? []).map(c => nodeToMarkdown(c)).join('')
          parts.push(`${'  '.repeat(depth)}- ${text}`)  // depth * 2スペースでインデント
        } else if (child.type === 'bulletList') {
          parts.push(nodeToMarkdown(child, depth + 1))   // 再帰で深くなる
        }
      }
      return parts.join('\n')
    }
    case 'text': {
      let t = node.text ?? ''
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') t = `**${t}**`         // 太字
        else if (mark.type === 'italic') t = `*${t}*`   // 斜体
        else if (mark.type === 'code') t = `\`${t}\``   // コード
        else if (mark.type === 'link') t = `[${t}](${mark.attrs?.href})` // リンク
      }
      return t
    }
    ...
  }
}
```

これは**再帰関数**（関数の中で自分自身を呼ぶ関数）の典型的な使い方です。
ツリー構造（入れ子になったデータ）を処理するのに適しています。

---

### 5.10 `customHttp.yml` — AWS Amplify用のヘッダー設定

**役割**: AWS Amplify にデプロイしたとき、HTTPレスポンスヘッダーにCSPを追加する設定ファイル。

`next.config.ts` と同じ内容のCSP設定を AWS Amplify 独自の形式（YAML）で書いています。
Next.js のヘッダー設定は Next.js サーバーで動いているときだけ有効で、Amplify の静的ホスティングでは別途 `customHttp.yml` が必要です。

---

## 6. 設計思想・なぜこう作られているか

### 「シンプルさ」を保つ哲学

このアプリは「機能を増やさない」ことを意識して設計されています。

- **外部APIを使わない** → ユーザーのデータはブラウザ外に出ない。プライバシーが守られる
- **データベース不要** → `localStorage` だけで完結。サーバーのコストや管理が不要
- **認証不要** → ログインなしで即座に使い始められる

### コンポーネント設計の原則

```
データ管理（useStore） ←→ ページ（page.tsx） ←→ UI部品（Sidebar, Editor）
```

- **データと表示を分離**: データの操作は `useStore` に集中させ、コンポーネントは表示だけに集中する
- **Props でデータを渡す**: 親から子へデータと操作関数を渡す「単方向データフロー」
- **状態の最小化**: 必要最低限の状態だけを持ち、派生する値は計算で求める

### イミュータブル（不変）更新

```typescript
// ❌ 直接変更（ミュータブル）
store.folders[0].name = '新しい名前'

// ✅ コピーして更新（イミュータブル）
setStore(s => ({
  ...s,
  folders: s.folders.map(f => f.id === id ? { ...f, name: '新しい名前' } : f)
}))
```

Reactは「データが変わったか」を検知してUIを再描画します。
直接変更すると「変わった」と検知できないため、必ずコピーして新しいオブジェクトを作ります。

---

## 7. キーボードショートカットの仕組み

| ショートカット | 処理 | 実装場所 |
|-------------|------|---------|
| `Ctrl/Cmd + .` | 箇条書きのオン/オフ | `BulletListToggle` 拡張 |
| `Tab` | インデント（深くする） | `DeepIndent` 拡張 |
| `Shift + Tab` | アウトデント（浅くする） | Tiptap 標準機能 |
| `Ctrl/Cmd + K` | リンクのオン/オフ | `LinkToggle` 拡張 |

Tiptap の `addKeyboardShortcuts()` でキーと関数をマッピングするだけで実装できます。
`Mod-` は「Mac では Cmd、Windows では Ctrl」を意味する Tiptap の特殊記法です。

---

## 8. データの保存・読み込みの仕組み

### localStorage の構造

キー: `outliner-store-v2`

```json
{
  "folders": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "はじめのフォルダ",
      "files": [
        {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "name": "無題のノート",
          "content": {
            "type": "doc",
            "content": [...]
          }
        }
      ]
    }
  ],
  "activeFileId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### UUID（ユニークID）の生成

```typescript
function newFile(name = '無題のノート'): FileItem {
  return { id: crypto.randomUUID(), ... }
}
```

`crypto.randomUUID()` はブラウザ・Node.js 組み込みのAPI。
`"550e8400-e29b-41d4-a716-446655440000"` のような世界に1つだけのIDを生成します。

### 旧バージョンからのマイグレーション

```typescript
const LEGACY_KEY = 'outliner-content'  // 旧バージョンのキー

function loadFromStorage(): Store {
  // 新形式を先に探す
  const saved = localStorage.getItem(STORE_KEY)
  if (saved) { /* 新形式のデータがあればそれを使う */ }

  // 旧形式があれば新形式に変換
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy) {
    const content = JSON.parse(legacy) as JSONContent
    const folder = newFolder('はじめのフォルダ')
    folder.files[0] = { ...folder.files[0], content }
    return { folders: [folder], activeFileId: folder.files[0].id }
  }

  return defaultStore()  // 何もなければデフォルトデータ
}
```

アプリのアップデートで保存形式が変わったとき、古いデータを読み込めなくなる問題を「マイグレーション」で解決しています。

---

## 9. よく使われているプログラミングパターン

### パターン1: useCallback でメモ化

```typescript
const addFolder = useCallback(() => {
  const folder = newFolder()
  setStore(s => ({ folders: [...s.folders, folder], activeFileId: folder.files[0].id }))
}, [])  // 依存配列が空 = 初回のみ作成
```

`useCallback` は「この関数を毎回作り直さない」ための最適化です。
これにより `Sidebar` などの子コンポーネントが不要な再描画をしません。

### パターン2: スプレッド構文によるコピー

```typescript
// オブジェクトのコピーと一部上書き
const newStore = { ...existingStore, activeFileId: newId }
// 配列のコピーと要素追加
const newFolders = [...existingFolders, newFolder]
```

`...` はスプレッド構文（展開演算子）です。配列やオブジェクトの内容を展開します。

### パターン3: オプショナルチェーン

```typescript
ref.current?.focus()  // refが null でも エラーにならない
files?.[0]?.id        // 配列やプロパティが undefined でも エラーにならない
```

`?.` は「存在すればアクセス、なければ undefined を返す」演算子です。

### パターン4: Nullish Coalescing（Null合体演算子）

```typescript
const activeFileId = allFiles[0]?.id ?? null
// allFiles[0]?.id が undefined か null なら null を使う
```

`??` は「左辺が null か undefined のとき、右辺を使う」演算子です。

### パターン5: 配列のflatMap

```typescript
const allFiles = store.folders.flatMap(f => f.files)
// folders の各 files 配列を1つの配列に平坦化
// 例: [[file1, file2], [file3]] → [file1, file2, file3]
```

`flatMap` は `map` した後に配列を1段階平坦化します。

---

## 10. 用語集（初心者向け）

| 用語 | 説明 |
|------|------|
| **コンポーネント** | 画面の部品。`Sidebar`、`Editor` がそれぞれコンポーネント |
| **フック（Hook）** | React の機能を使うための特別な関数。`useState`、`useEffect` など |
| **State（状態）** | コンポーネントが管理する変数。変わるとUIが更新される |
| **Props** | 親コンポーネントから子コンポーネントに渡すデータや関数 |
| **useEffect** | コンポーネントが描画された後（または特定の値が変わった後）に実行される処理 |
| **useRef** | DOMの要素や変更しても再描画しない値を保持するためのフック |
| **useCallback** | 関数をメモ化（キャッシュ）して毎回作り直さないようにするフック |
| **TypeScript** | JavaScriptに型システムを加えた言語。変数に「これは数値」「これは文字列」と明示できる |
| **localStorage** | ブラウザ内蔵のミニデータベース。キーと値のペアを保存できる |
| **UUID** | 世界に1つだけのユニークなID文字列 |
| **JSON** | データを人間が読めるテキスト形式で表現する標準フォーマット |
| **CSP** | Content Security Policy。ブラウザに「どこのリソースを読み込んでいいか」を伝えるセキュリティ設定 |
| **イミュータブル** | 変更不可能なこと。Reactでは直接変更せず新しいオブジェクトを作る |
| **ハイドレーション** | サーバーで生成したHTMLにReactの機能を「注入」するプロセス |
| **SSR** | Server-Side Rendering。サーバー側でHTMLを生成する手法 |
| **ProseMirror** | Tiptapの内部で使われているエディタエンジン |
| **AST（抽象構文木）** | 文書やコードをツリー構造で表現したもの。TiptapのJSONもこれの一種 |
| **再帰** | 関数が自分自身を呼び出す手法。ツリー構造を処理するのに使われる |
| **スプレッド構文** | `...` を使って配列・オブジェクトを展開する構文 |
| **メモ化** | 計算結果をキャッシュして再利用すること |
| **単方向データフロー** | データは上（親）から下（子）にのみ流れる設計原則 |

---

*このドキュメントは ThinkSpeed v0.1.0 のソースコードをもとに作成されました。*
