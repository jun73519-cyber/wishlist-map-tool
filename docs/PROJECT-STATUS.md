# プロジェクト現状メモ（引き継ぎ用）

> 別マシン（家のMac等）や新しい Claude Code セッションで作業を再開するときに、まずこれを読む。
> このファイルは公開リポジトリに入るため**秘密情報は書かない**（接続文字列・APIキー等は Vercel / `.env.local` にのみ存在）。

最終更新: 2026-06-25

## このアプリは何か

「行きたい場所マップ帳」。行きたい旅行先を「気になる → 計画中 → 予約済 → 訪問済」の4ステージで管理する4ペインのワークスペース（採用管理の雛形 workspace-ui-kit を旅行ドメインに再スキンしたもの）。

- 公開URL: https://wishlist-map-tool.vercel.app
- 図解: https://jun73519-cyber.github.io/diagrams/wishlist-tool.html
- 技術: Next.js 16 / React 19 / TypeScript / Tailwind v4 / shadcn(base-ui) / Neon(Postgres) / Gemini

## 保存先の切り分け（いちばん大事な設計判断）

判断基準は「AIとの距離」＝動くデータはDB、安定したものはAIが読めるリポジトリに残す。

| データ | 置き場所 | 理由 |
| --- | --- | --- |
| 行きたい場所（candidates / places） | **Neon DB** | ユーザーが常に追加・編集する動くデータ。リロード・別端末・他人からも同じものが見える必要がある |
| エリア区分（`data/positions.json`） | リポジトリJSON | 滅多に変わらない分類マスタ。AIに読ませやすい |
| アプリ設定（`data/workspace.json`） | リポジトリJSON | 変わらない設定 |

## DB構成

- テーブルは1つだけ: `places(id PK, data jsonb, sort int, updated_at)` の **JSONBドキュメント型**。
  - `data` に `Candidate` を丸ごと保存（profile / scorecards / 添付まで）。既存型をそのまま入れられ変更最小。
  - `sort` は Pane2 の手動並び順（配列index）を保持するため。
- SQL・接続はすべて `lib/db.ts` に集約（冒頭コメントに切り分けの理由あり）。
  - `readPlaces()` … テーブル自動作成＋空なら `data/candidates.json` で初回シード＋全件取得
  - `writePlaces()` … 全件 upsert＋配列に無い id を削除（1トランザクション）
  - `resetPlaces()` … TRUNCATE＋再シード
- API: `app/api/places/route.ts`（GET 全件 / POST 全件同期保存）、`app/api/places/reset/route.ts`（サンプルに戻す）。
- クライアント: `components/workspace/Workspace.tsx` がマウント時 `GET /api/places`、`candidates` 変化で 600ms デバウンス `POST /api/places`。`lib/storage.ts` の `resetToSeedData()` は `/api/places/reset` を叩く。

## ローカル開発の始め方

```bash
git clone https://github.com/jun73519-cyber/wishlist-map-tool.git
cd wishlist-map-tool
npm install
# 直下に .env.local を作成（値は Vercel の Settings > Environment Variables からコピー）:
#   GEMINI_API_KEY=...
#   DATABASE_URL=...
npm run dev   # http://localhost:3000
```

- `.env.local` は gitignore 済みでリポジトリに**入っていない**。マシンごとに作り直す。
- 検証: `npm run build` / `npm run lint` / `npm run test`。

## 公開・運用

- GitHub: `jun73519-cyber/wishlist-map-tool`（Public）→ push すると Vercel が自動デプロイ。
- 学校 Gitea が `origin`（別途残置）。GitHub は `github` リモート。
- Vercel 環境変数に `DATABASE_URL` と `GEMINI_API_KEY` の両方が必要。
- 2台で編集するときは「作業前 `git pull` / 作業後 `git push`」を徹底。

## 未対応・今後やること

- [ ] **個人用データのプライベートDB分離**: 現状 localhost と本番（Vercel）が**同じDB**を指す。公開先＝サンプルのみ運用にしているため、ローカルで個人データを入れると公開先に漏れる。個人運用するなら localhost 用に別のNeon DB（or ブランチ）を用意し `.env.local` をそれに向ける。
- [ ] **DBパスワードのローテーション**: 構築中に接続文字列を一度共有したため、Neon の Reset password で作り直し → `.env.local` と Vercel を更新。
- [ ] （発展）認証（ログイン）。雛形方針では「次フェーズ」。

## 注意点

- 公開アプリは**認証なし**。URLを知る人は誰でも閲覧・編集できる。個人情報は入れない。
- 添付写真は `Candidate.data`(JSONB) に base64 で入るため、大量・大サイズは DB 行サイズに注意。
- base-ui のメニュー/ボタンのハンドラは `onClick`（`onSelect` は型は通るが無反応）。
