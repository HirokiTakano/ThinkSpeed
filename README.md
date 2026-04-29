# ThinkSpeed

**思考を、速く。**

ThinkSpeed は、箇条書きで考えを素早く書き出し、構造化するための軽量アウトライナーです。仕事、勉強、アイデア整理、議事メモなどで「まず書く」「すぐ並べ替えて考える」ことに集中できるように作っています。

データはブラウザの `localStorage` に保存されます。アカウント登録やサーバー保存はありません。

## 特徴

- **箇条書き中心のエディタ**: ファイルを開いたらすぐアウトラインを書き始められます。
- **階層インデント**: `Tab` / `Shift + Tab` で思考を深掘り、整理できます。
- **フォルダとファイル管理**: テーマや用途ごとにノートを分けて管理できます。
- **検索**: 現在のファイル、現在のフォルダ、全ファイルを対象に検索できます。
- **カスタムショートカット**: 主要な編集ショートカットをアプリ内で変更できます。
- **テーマと色設定**: ライト/ダークテーマ、背景色、文字色、アクセント色などを調整できます。
- **YouTube 埋め込み**: YouTube URL を貼り付けると、その場で動画を表示できます。
- **画像ペースト**: クリップボード内の画像をそのままノートに貼り付けられます。
- **Markdown コピー**: ノート内容を Markdown としてクリップボードにコピーできます。
- **JSON バックアップ**: 全データ、フォルダ単位、ファイル単位で書き出し・読み込みできます。
- **ゴミ箱**: 削除したフォルダやファイルを復元できます。

## 開発に参加する方へ

ThinkSpeed は OSS として、一緒に改善してくれる仲間を歓迎しています。大きな機能追加だけでなく、UI の細かな改善、README やドキュメントの整理、不具合修正、アクセシビリティ改善も価値のある貢献です。

まずはローカルで動かして、実際にメモを書き、フォルダ作成、検索、エクスポート/インポート、ショートカット変更を試してみてください。使ってみて「ここが分かりづらい」「この操作が少し面倒」と感じた部分が、よい改善候補になります。

開発時に大切にしている方針:

- **思考整理に集中できること**: 画面や操作を過度に複雑にしない。
- **キーボードで速く使えること**: マウス操作だけに依存しない。
- **ローカルファーストであること**: 現状、データ保存は `localStorage` を前提にする。
- **既存データを壊さないこと**: ストア構造や import/export の互換性に注意する。
- **小さく安全に変更すること**: 変更範囲を絞り、既存の設計に沿って実装する。

## ローカルで動かす

必要なもの:

- Node.js 18 以上
- npm

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

品質チェック:

```bash
npm run lint
npm run build
```

## よく使うショートカット

| ショートカット | 動作 |
| --- | --- |
| `Ctrl / Cmd + .` | 箇条書きのオン / オフ |
| `Ctrl / Cmd + /` | チェックリストのオン / オフ |
| `Ctrl / Cmd + K` | 選択した URL をリンク化 / リンク解除 |
| `Ctrl / Cmd + F` | アプリ内検索 |
| `Tab` | 一段深くインデント |
| `Shift + Tab` | 一段浅くアウトデント |
| `Ctrl / Cmd + Shift + 1` | 文字色 1 を適用 / 解除 |
| `Ctrl / Cmd + Shift + 2` | 文字色 2 を適用 / 解除 |
| `Ctrl / Cmd + Shift + 3` | 文字色 3 を適用 / 解除 |

ショートカットはアプリ内の使い方ガイドから変更できます。

## 技術スタック

| 技術 | バージョン / 用途 |
| --- | --- |
| Next.js | 16.2.4 / App Router |
| React | 19.2.4 |
| TypeScript | 5.x |
| Tailwind CSS | v4 |
| Tiptap | v3.22.4 / エディタ |
| AWS Amplify | ホスティング |

## コードの見取り図

```text
ThinkSpeed/
├── app/
│   ├── layout.tsx       # ルートレイアウト、メタデータ
│   ├── page.tsx         # アプリ全体の結合点
│   └── globals.css      # Tailwind v4、テーマ変数、Tiptap 用スタイル
├── components/
│   ├── Editor.tsx       # Tiptap エディタ、Markdown コピー、検索ジャンプ
│   ├── Sidebar.tsx      # フォルダ/ファイル管理、設定、ヘルプ
│   ├── SearchPanel.tsx  # アプリ内検索
│   └── CalendarOverlay.tsx
├── hooks/
│   ├── useStore.ts      # localStorage 永続化、CRUD、import/export
│   ├── shortcuts.ts     # ショートカット定義、競合判定
│   ├── themes.ts        # テーマカラー定義、保存、DOM 適用
│   └── parseEvents.ts
├── next.config.ts       # Next.js 設定、CSP ヘッダー
├── customHttp.yml       # AWS Amplify 用カスタムヘッダー
└── package.json
```

主な責務:

- `app/page.tsx`: `useStore`、`Sidebar`、`Editor`、`SearchPanel` をつなぐ画面の中心です。
- `hooks/useStore.ts`: フォルダ、ファイル、ゴミ箱、JSON import/export、`localStorage` 保存を扱います。
- `components/Editor.tsx`: Tiptap の設定、編集ショートカット、画像ペースト、Markdown 変換を扱います。
- `components/Sidebar.tsx`: ファイルツリー、テーマ設定、色設定、ショートカット設定、ゴミ箱 UI を扱います。
- `components/SearchPanel.tsx`: Tiptap JSON 内のテキストを検索し、該当位置へジャンプします。

## 実装時の注意

このリポジトリは Next.js 16 を使っています。Next.js まわりを変更する場合は、一般的な知識だけで判断せず、必要に応じて `node_modules/next/dist/docs/` の該当ドキュメントを確認してください。

Tiptap と Tailwind もメジャーバージョン差分に注意が必要です。

- Tiptap v3 の `StarterKit` には Link 拡張が含まれています。別途 Link を追加すると拡張名が重複します。
- YouTube 埋め込みは Link の自動リンク化より優先する必要があるため、`Youtube.extend({ priority: 200 })` を使っています。
- Tiptap v3 の `setContent` は `{ emitUpdate: false }` のようなオプション形式です。
- Tailwind CSS v4 では list style まわりの挙動に注意してください。Tiptap のリスト表示は `app/globals.css` で補正しています。
- `localStorage` 読み込みはクライアント側の `useEffect` で行います。初期 state で `crypto.randomUUID()` を呼ぶと hydration mismatch の原因になります。

## データ保存とバックアップ

アプリの主データは `localStorage` の `outliner-store-v2` に保存されます。古い単一ドキュメント形式の `outliner-content` からの移行処理も残しています。

JSON import/export はユーザーのバックアップ手段です。データ構造を変更する場合は、既存ユーザーのデータや過去に書き出した JSON を読めるかを確認してください。

## デプロイ

本番環境は AWS Amplify を想定しています。

```bash
npm run build
```

セキュリティヘッダーとキャッシュ設定は `customHttp.yml` にあります。YouTube 埋め込みのため、CSP で `youtube.com` / `youtube-nocookie.com` を許可しています。

## ライセンス

MIT
