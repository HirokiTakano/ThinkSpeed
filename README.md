# ThinkSpeed

**思考を、速く。** — 箇条書きベースの思考整理ツール

ThinkSpeed は、仕事や勉強で「頭の中を素早く整理する」ことに特化した、超軽量なアウトライナーアプリです。
余計な装飾ボタンや複雑な機能は一切なく、キーボードだけで思考を書き出し・構造化することを重視しています。

---

## 特徴

- **常に箇条書きモード** — ファイルを開いた瞬間から箇条書きで書き始められる
- **階層インデント** — `Tab` / `Shift+Tab` で思考を深掘り・整理
- **フォルダ管理** — テーマや用途ごとにフォルダを作り、複数のノートを整理
- **YouTube 埋め込み** — YouTube URL を貼り付けるとその場で再生できる
- **リンク化** — URL を貼り付けてショートカットでハイパーリンクに切り替え
- **Markdown エクスポート** — ノートの内容をワンクリックでクリップボードにコピー
- **JSON バックアップ** — 全データを JSON で書き出し・読み込み可能
- **ローカルファースト** — データはすべてブラウザの `localStorage` に保存。アカウント不要

---

## キーボードショートカット

| ショートカット | 動作 |
|-------------|------|
| `Ctrl / Cmd` + `.` | 箇条書きトグル |
| `Tab` | インデント（階層を深く） |
| `Shift + Tab` | アウトデント（階層を浅く） |
| `Ctrl / Cmd` + `K` | リンクのトグル（ON/OFF） |

---

## ローカルで動かす

**必要なもの**: Node.js 18 以上

```bash
# リポジトリをクローン
git clone https://github.com/HirokiTakano/ThinkSpeed.git
cd ThinkSpeed

# 依存パッケージをインストール
npm install

# 開発サーバーを起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

---

## 技術スタック

| 技術 | バージョン |
|-----|-----------|
| [Next.js](https://nextjs.org) (App Router) | 16.2.x |
| [React](https://react.dev) | 19.x |
| [TypeScript](https://www.typescriptlang.org) | 5.x |
| [Tailwind CSS](https://tailwindcss.com) | v4 |
| [Tiptap](https://tiptap.dev) | v3 |

---

## デプロイ

このアプリは [AWS Amplify](https://aws.amazon.com/amplify/) でホスティングしています。

```bash
npm run build
```

ビルド出力は `.next/` ディレクトリに生成されます。
Amplify のカスタムヘッダー設定は `customHttp.yml` を参照してください。

---

## ライセンス

MIT

