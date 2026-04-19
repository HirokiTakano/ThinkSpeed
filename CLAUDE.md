@AGENTS.md

# ThinkSpeed — AI コーディングガイド

## プロジェクト概要

**ThinkSpeed** は「箇条書きベースの思考整理」に特化した超軽量アウトライナーアプリ。
余計な機能を排除し、仕事・勉強で素早く思考をまとめることを目的としたOSS。

- **公開先**: AWS Amplify (静的ホスティング)
- **リポジトリ**: GitHub (OSS)
- **データ永続化**: ブラウザの `localStorage` のみ（サーバー不要）

---

## 技術スタック（バージョンに注意）

| ライブラリ | バージョン | 注意事項 |
|-----------|-----------|---------|
| Next.js | 16.2.4 | App Router 使用 |
| React | 19.2.4 | |
| TypeScript | ^5 | |
| Tailwind CSS | **v4** | v3 と API が異なる。`@apply` の挙動が変わった |
| Tiptap | **v3.22.4** | v2 と API が大きく異なる。`@tiptap/starter-kit` に `Link` が内包済み |
| `@tiptap/extension-youtube` | ^3.22.4 | |
| `@tiptap/extension-placeholder` | ^3.22.4 | |

---

## ディレクトリ構成

```
ThinkSpeed/
├── app/
│   ├── layout.tsx       # ルートレイアウト
│   ├── page.tsx         # 'use client' — useStore + Sidebar + Editor を統合
│   └── globals.css      # Tailwind v4 + Tiptap スタイル上書き（重要）
├── components/
│   ├── Editor.tsx       # Tiptap エディタ本体
│   └── Sidebar.tsx      # フォルダ/ファイルツリー + エクスポート/インポート
├── hooks/
│   └── useStore.ts      # 全状態管理（フォルダ・ファイル・localStorage）
├── public/
├── next.config.ts       # CSP ヘッダー設定（YouTube iframe 許可）
├── customHttp.yml       # AWS Amplify 用カスタムレスポンスヘッダー
└── package.json
```

---

## 重要な設計上の注意事項（必ず読むこと）

### 1. Tiptap v3 — StarterKit に Link が内包されている

`@tiptap/starter-kit` v3 は `Link` 拡張を内部に持つ。
**`Link` を別途 `import` して追加すると `Duplicate extension names: ['link']` エラーになる。**

```typescript
// ✅ 正しい
StarterKit.configure({ link: { openOnClick: true, ... } })

// ❌ NG — 重複エラー
import Link from '@tiptap/extension-link'
extensions: [StarterKit, Link.configure(...)]
```

### 2. YouTube 拡張の priority を 200 に設定すること

`StarterKit`（内包 Link）と `Youtube` の優先度が同じだと、Link の `linkOnPaste` が YouTube URL を先に横取りして通常リンクになってしまう。

```typescript
Youtube.extend({ priority: 200 }).configure({ nocookie: true, ... })
```

### 3. Tailwind v4 — `list-style` ショートハンドで `disc` が消える

Tailwind v4 のプリフライトが `list-style: disc outside` をコンパイル時に `list-style: outside` にしてしまう（`disc` が落ちる）。

```css
/* ❌ NG */
list-style: disc outside !important;

/* ✅ 正しい — 個別プロパティを使う */
list-style-type: disc !important;
list-style-position: outside !important;
```

### 4. ハイドレーションミスマッチの回避

`useState` の初期値で `crypto.randomUUID()` を呼ぶと、サーバーとクライアントで異なる値が生成されてハイドレーションエラーになる（本番環境で顕在化）。

```typescript
// ✅ 安全な初期化パターン
const [store, setStore] = useState<Store>({ folders: [], activeFileId: null })
useEffect(() => { setStore(loadFromStorage()) }, []) // クライアントのみで実行
```

### 5. Tiptap v3 の `setContent` API 変更

第2引数が `boolean` から `SetContentOptions` オブジェクトに変わった。

```typescript
// ✅ v3 の書き方
editor.commands.setContent(content, { emitUpdate: false })
```

### 6. `listItem` のスキーマ制約

ProseMirror の `listItem` は「最初の子が `paragraph`」でなければならない。
`bulletList` を `listItem` の直接の子にするとスキーマエラーになる。

### 7. Sidebar のフレックスボックスと `min-h-0`

`flex-1 overflow-y-auto` の div は `min-h-0` がないとコンテンツ量によって親を突き破る。
フォルダツリーの div には必ず `min-h-0` を付けること。

---

## 主要コンポーネントの責務

### `hooks/useStore.ts`
- フォルダ/ファイルの CRUD 操作をすべて管理
- `localStorage` への読み書き（キー: `outliner-store-v2`）
- レガシーキー `outliner-content` からのマイグレーション対応
- `exportData()`: JSON ファイルをダウンロード
- `importData(file)`: JSON ファイルを読み込んでストアを置き換え

### `components/Editor.tsx`
カスタム Tiptap 拡張を3つ持つ:
- `BulletListToggle`: `Ctrl+.` / `Cmd+.` で箇条書きトグル
- `DeepIndent` (priority 150): `Tab` で深いインデント（sibling がなくても動く）
- `LinkToggle`: `Ctrl+K` / `Cmd+K` でリンクトグル

### `components/Sidebar.tsx`
- フォルダ/ファイルのツリー表示・インライン名前変更・追加・削除
- JSON エクスポート/インポートボタン
- キーボードショートカット一覧の表示

### `app/globals.css`
- Tailwind v4 プリフライトのリセット対策（Tiptap の `ul/ol` スタイルを強制上書き）
- `.editor-link`: リンクのビジュアルスタイル
- `div[data-youtube-video]`: YouTube 埋め込みの16:9 アスペクト比スタイル

---

## キーボードショートカット（実装済み）

| ショートカット | 動作 |
|-------------|------|
| `Ctrl/Cmd` + `.` | 箇条書きトグル |
| `Tab` | インデント（深く） |
| `Shift+Tab` | アウトデント（浅く） |
| `Ctrl/Cmd` + `K` | リンクトグル |

---

## デプロイ (AWS Amplify)

- **ビルドコマンド**: `npm run build`
- **出力ディレクトリ**: `.next`
- **カスタムヘッダー**: `customHttp.yml`（YouTube iframe 許可の CSP を含む）
- `next.config.ts` にも同内容の CSP を記載（Next.js 標準ホスティング用）
- `.env` ファイルは不要（外部 API キーなし、全データは localStorage）

---

## やってはいけないこと

1. `Link` 拡張を `StarterKit` と別に `extensions` 配列に追加しない
2. Tailwind の `list-style` ショートハンドを `globals.css` で使わない
3. `useState(defaultStore)` で `crypto.randomUUID()` を初期値に使わない
4. `.env` ファイルを commit しない（現状は不要だが将来追加する場合）
5. `customHttp.yml` を削除しない（Amplify の CSP が壊れる）

---

## 今後の開発方針（オーナーの意図）

- **機能はシンプルに保つ** — 思考整理に集中できる最小限の機能セットを維持する
- **UIは軽量・ミニマル** — 装飾ボタン類を増やさない
- **箇条書きベース** — エディタのデフォルトは常に箇条書きモード
- **ローカルファースト** — データはすべて localStorage。外部サービス依存を増やさない
- **OSSとして公開中** — コードはクリーンで他者が読みやすい状態を保つ
