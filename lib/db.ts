/**
 * Neon (Postgres) データアクセス層 — 「場所(places)」の保存・読み出し。
 *
 * 保存先の切り分け（第7回「AI との距離」の実践）:
 *   - 場所(candidates) … ★ここ＝データベース(Neon)。ユーザーが常に書き換える「動く
 *     データ」で、リロード・別端末・他人からも同じものが見える必要がある唯一のデータ。
 *   - エリア(positions.json) / アプリ設定(workspace.json) … リポジトリの JSON のまま。
 *     滅多に変わらない「分類マスタ／設定」。AI の手元に残しておくと、後で
 *     「アジアの場所を要約して」のような依頼で分類表をすぐ読める。
 *
 * テーブル設計（JSONB ドキュメント型）:
 *   places(id PK, data jsonb, sort int, updated_at timestamptz)
 *   - data … Candidate を丸ごと（profile / scorecards / 添付まで）。既存の型を
 *     そのまま保存でき、コード変更とバグ余地が最小。
 *   - sort … Pane 2 の手動並び替え（D&D）順を保つための表示順（配列の index）。
 *
 * 規律:
 *   - 接続文字列は環境変数 `DATABASE_URL`（.env.local / Vercel 環境変数）からのみ参照。直書き禁止。
 *   - SQL はサーバー（route handler）でのみ実行。鍵をクライアントに出さない。
 */
import { neon } from "@neondatabase/serverless";
import { candidatesSchema, type Candidate } from "@/lib/schema";
import candidatesSeed from "@/data/candidates.json";

// 初期サンプル（data/candidates.json）。DB が空のときの種データ／「サンプルに戻す」で使う。
// schema の .default() でエリア・アーカイブ等を補完した正規形にしておく。
const SEED: Candidate[] = candidatesSchema.parse(candidatesSeed);

/** Neon クライアントを取得（接続文字列が無ければ分かりやすいエラーを投げる）。 */
function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL が未設定です。Vercel で Neon を追加し、その接続情報を .env.local（ローカル）/ Vercel の環境変数（本番）に設定してください。",
    );
  }
  return neon(url);
}

type Sql = ReturnType<typeof getSql>;

/** places テーブルが無ければ作る（冪等。マイグレーションツールは使わず IF NOT EXISTS で簡潔に）。 */
async function ensureTable(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS places (
      id         TEXT PRIMARY KEY,
      data       JSONB NOT NULL,
      sort       INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

/** SEED を一括 INSERT（既存 id は触らない）。トランザクションで原子的に。 */
async function insertSeed(sql: Sql) {
  if (SEED.length === 0) return;
  const queries = SEED.map(
    (c, i) =>
      sql`INSERT INTO places (id, data, sort)
          VALUES (${c.id}, ${JSON.stringify(c)}::jsonb, ${i})
          ON CONFLICT (id) DO NOTHING`,
  );
  await sql.transaction(queries);
}

/** テーブルが空なら SEED を流し込む（初回アクセス時の自動シード）。 */
async function seedIfEmpty(sql: Sql) {
  const rows = (await sql`SELECT count(*)::int AS n FROM places`) as {
    n: number;
  }[];
  if (rows[0]?.n === 0) {
    await insertSeed(sql);
  }
}

/**
 * 全ての場所を読み出す。テーブル作成と初回シードもここで面倒を見る。
 * 並び順は sort（= 保存時の配列 index）昇順で、Pane 2 の手動並び替えを再現する。
 */
export async function readPlaces(): Promise<Candidate[]> {
  const sql = getSql();
  await ensureTable(sql);
  await seedIfEmpty(sql);
  const rows = (await sql`
    SELECT data FROM places ORDER BY sort ASC, id ASC
  `) as { data: unknown }[];
  return candidatesSchema.parse(rows.map((r) => r.data));
}

/**
 * 場所の配列を丸ごと同期保存する（クライアントが持つ全件をそのまま反映）。
 * - 各 id を upsert（data と sort=配列 index を更新）
 * - 配列に無い id は削除（場所の削除に対応）
 * 全部 1 トランザクションなので、途中失敗でデータが半端に消えることはない。
 */
export async function writePlaces(candidates: Candidate[]): Promise<void> {
  const sql = getSql();
  await ensureTable(sql);
  const ids = candidates.map((c) => c.id);
  const queries = candidates.map(
    (c, i) =>
      sql`INSERT INTO places (id, data, sort, updated_at)
          VALUES (${c.id}, ${JSON.stringify(c)}::jsonb, ${i}, now())
          ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, sort = EXCLUDED.sort, updated_at = now()`,
  );
  // 配列に無い id を削除。空配列なら全削除（id <> ALL('{}') は全行 true）。
  queries.push(sql`DELETE FROM places WHERE id <> ALL(${ids}::text[])`);
  await sql.transaction(queries);
}

/** 保存内容を消して初期サンプルに戻す（「サンプルデータに戻す」ボタン）。 */
export async function resetPlaces(): Promise<Candidate[]> {
  const sql = getSql();
  await ensureTable(sql);
  await sql`TRUNCATE TABLE places`;
  await insertSeed(sql);
  return readPlaces();
}
