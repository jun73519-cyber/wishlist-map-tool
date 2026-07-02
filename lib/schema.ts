/**
 * 「行きたい場所マップ帳」ドメインの Zod スキーマと派生型。
 * 雛形の SSoT として、UI コンポーネントはここから型をインポートする。
 *
 * 仕様の出典:
 *   - openspec/decision/0005-dashboard-drilldown-and-global-header.md
 *   - openspec/changes/add-4pane-workspace-template/specs/workspace-template/spec.md
 */

import { z } from "zod";

// ===== Pane 1: 部署 → ポジション 階層 =====

/** 部署配下の単一ポジション。Pane 1 の階層 Sidebar に表示する単位。 */
export const positionSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number(),
});
export type Position = z.infer<typeof positionSchema>;

/** 部署と配下のポジション一覧。Pane 1 の階層 Sidebar の最上位単位。 */
export const departmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  positions: z.array(positionSchema),
});
export type Department = z.infer<typeof departmentSchema>;

// ===== 場所プロフィール =====

/**
 * 場所プロフィール。Pane 3 ヘッダー帯トグル内 + 旅行メモカードで表示・編集される。
 *
 * 構成: 12 フィールド（基本情報 3 / リンク・連絡先 3 / 旅行メモ 3 / 読み物 2 / 同行者 1）。
 *
 * ADR-0014「shadcn 標準フォームによる Pane 4 編集 UI」で Lab v3 の最小構成を採用し、
 * 旧 ADR-0010 §10 H の Profile 型を supersede。削除されたフィールド
 * (`initial` / `currentCompany` / `currentRole` / `nextActionDeadline` /
 * `otherCompanies` / `desiredSalary` / `age` / `experienceYears` / `applyPosition` /
 * `careerSummary` / `motivationSummary`) は「最小プロフィール」方針により撤去:
 *
 *   - `name[0]` 派生で avatar の頭文字を生成（`initial` 廃止）
 *   - `desiredSalary` は min/max に分割（`min`〜`max` 万円の構造化編集）
 *   - `age` は `birthday` から `calculateAge` で派生表示
 *   - アクセスや見どころは「アクセス・見どころ」textarea に集約
 *   - サマリ系（`careerSummary` / `motivationSummary`）は full 文字列だけで運用
 */
export const profileSchema = z.object({
  name: z.string(),
  birthday: z.string(),
  source: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  recruiter: z.string(),
  desiredSalaryMin: z.string(),
  desiredSalaryMax: z.string(),
  availableStartDate: z.string(),
  careerText: z.string(),
  motivationFull: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

// ===== 評価軸（1 軸: 行きたい度） =====
// 「行きたい場所マップ帳」では場所への "行きたい度" を 1 軸 ★ で評価する。
// 雛形は元々 4 軸（実績/思考力/コミュニケーション/カルチャーフィット）だったが、
// 旅行ドメインでは 1 軸（wishLevel）に集約した。AxisScores を Record 的に
// 扱う派生計算（calculateAverageScore 等）は軸数に依存しないため変更不要。

/** 評価軸キー。Scorecard.axisScores のキーと一致する。 */
export const axisKeySchema = z.enum(["wishLevel"]);
export type AxisKey = z.infer<typeof axisKeySchema>;

/** 軸別スコア。未評価は null。平均スコアは null 除外で派生計算する。 */
export const axisScoresSchema = z.object({
  wishLevel: z.number().nullable(),
});
export type AxisScores = z.infer<typeof axisScoresSchema>;

/** 評価軸の表示順。Pane 3 評価カードと Pane 4 モード 2 で共通に使う。 */
export const AXIS_ORDER = axisKeySchema.options;

// ===== 検討フロー =====

/** 検討ステージのキー。`STAGE_ORDER` と一致する 4 段階。 */
export const stageKeySchema = z.enum(["screening", "first", "second", "final"]);
export type StageKey = z.infer<typeof stageKeySchema>;

/** ステージの実施ステータス。done = 実施済 / planned = 予定済 / pending = 未定。 */
export const stageStatusSchema = z.enum(["done", "planned", "pending"]);
export type StageStatus = z.infer<typeof stageStatusSchema>;

/**
 * 添付ファイル（Attachment）。Pane 4 モード 2 の「写真・資料」セクションで
 * 共通のファイル一覧として表示される（ADR-0010 §13 D75、ADR-0008 / ADR-0009 と整合）。
 *
 * `kind: "txt" | "pdf"` の discriminated union で、`txt` は `previewText` 必須、
 * `pdf` は持たない（雛形では PDF の中身プレビューはスコープ外。行は `disabled` で
 * 「プレビュー不可」バッジ表示、DL のみ可能）。`id` は React の `key` と一意性確保
 * のために必須。
 */
const txtAttachmentSchema = z.object({
  id: z.string(),
  kind: z.literal("txt"),
  name: z.string(),
  size: z.string(),
  previewText: z.string(),
});
const pdfAttachmentSchema = z.object({
  id: z.string(),
  kind: z.literal("pdf"),
  name: z.string(),
  size: z.string(),
});
// アプリからアップロードした写真・PDF。実体を base64 data URL で保持し、
// localStorage に保存される（サーバー保存は次フェーズ）。画像は表示・拡大でき、
// それ以外（PDF 等）は新しいタブで開ける。
// dataUrl は「画像 or PDF の data: URL」だけを許可する（セキュリティ）。
// 無認証 API のため、第三者が data:text/html,<script>… を仕込むと
// プレビューの iframe で任意コードが実行され得る。SVG はスクリプトを内包できるため除外。
const SAFE_DATA_URL =
  /^data:(?:image\/(?:png|jpe?g|gif|webp|avif)|application\/pdf)[;,]/i;
const fileAttachmentSchema = z.object({
  id: z.string(),
  kind: z.literal("file"),
  name: z.string(),
  size: z.string(),
  mimeType: z.string(),
  dataUrl: z
    .string()
    .refine((s) => SAFE_DATA_URL.test(s), {
      message: "許可されていない形式です（画像または PDF のみ）",
    }),
});
export const attachmentSchema = z.discriminatedUnion("kind", [
  txtAttachmentSchema,
  pdfAttachmentSchema,
  fileAttachmentSchema,
]);
export type Attachment = z.infer<typeof attachmentSchema>;

/**
 * 検討ステージごとのスコアカード（メタ情報 + 評価 + コメント + 要約 + 添付）。
 *
 * ADR-0010 §13 D75 / ADR-0008 で「写真・資料」を `attachments` 統一型に
 * 集約した。旧 `transcript?: string[]` / `documents?: Array<{ name; size }>` は
 * 削除済（互換層なし、KISS）。どのステージも同じ `Attachment[]` を持ち、
 * UI 側（`AttachmentList`）で同型のファイル一覧として描画される。
 */
export const scorecardSchema = z.object({
  stage: stageKeySchema,
  label: z.string(),
  date: z.string(),
  format: z.string(),
  interviewer: z.string(),
  decision: z.string().optional(),
  comment: z.string().optional(),
  summary: z.string().optional(),
  axisScores: axisScoresSchema,
  attachments: z.array(attachmentSchema),
});
export type Scorecard = z.infer<typeof scorecardSchema>;

/**
 * Pane 2 で表示するステージの並び順（左から右へ進行する検討フローと一致）。
 * `STAGE_ORDER` は派生計算（candidateGroups）と「+ 追加」UI の両方から参照する。
 */
export const STAGE_ORDER = stageKeySchema.options;

// ===== 場所 =====

/**
 * 場所の最上位データ。Pane 2 の所属グループは `stage` で決まる。
 * 各 scorecard の派生 status (`deriveStageStatus`) とは独立に持ち、
 * 「現在どのステージに居るか」を表す。
 */
export const candidateSchema = z.object({
  id: z.string(),
  profile: profileSchema,
  scorecards: z.array(scorecardSchema),
  stage: stageKeySchema,
  // 所属エリア（Pane 1 の position.id。例 "p-asia"）。空文字 "" は「未分類」。
  // Pane 1 でエリアを選ぶと、その area を持つ場所だけが Pane 2 に表示される。
  // 「すべて」表示中に追加した場所は area: "" になる。JSON シードでは省略可
  // （`.default("")` で補完）。
  area: z.string().default(""),
  // 論理削除フラグ。`stage` とは直交する。アーカイブされた場所は通常のステージ
  // グループから外れ、Pane 2 末尾の「アーカイブ済み」グループに表示される。
  // 復元時は `stage` をそのまま使って元のステージへ戻る。JSON シードでは省略可
  // （`.default(false)` で読み込み時に補完）。
  archived: z.boolean().default(false),
  // 地図ビュー用の座標（任意）。未設定の場所はピンが立たないだけで他機能に影響しない。
  // 入り方は 3 通り: AI 下書きの推定 / 基本情報の手入力 / 地図クリックで指定。
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type Candidate = z.infer<typeof candidateSchema>;

// ===== JSON 全体用スキーマ =====

export const departmentsSchema = z.array(departmentSchema);
export const candidatesSchema = z.array(candidateSchema);
export const workspaceSchema = z.object({
  name: z.string(),
  icon: z.string(),
});

// ===== 「AI下書き」機能（/api/draft-place） =====
//
// 場所名（任意で参考URL）から Claude が profile の一部を下書きするときの
// レスポンス型。キーは profile のキーと一致させてあり、`createMinimalProfile`
// にマージするだけで新規の場所に流し込める。サーバー（route.ts）の JSON Schema
// と本スキーマは同じフィールド集合で揃える。
export const placeDraftSchema = z.object({
  address: z.string(),
  source: z.string(),
  email: z.string(),
  desiredSalaryMin: z.string(),
  desiredSalaryMax: z.string(),
  careerText: z.string(),
  motivationFull: z.string(),
  // 地図ビュー用の推定座標（10進の文字列。不明なら空文字）。
  // profile ではなく Candidate.lat/lng に数値化して格納する。
  lat: z.string(),
  lng: z.string(),
});
export type PlaceDraft = z.infer<typeof placeDraftSchema>;

// ===== Pane 4 の表示状態（SelectedDetail） =====

/**
 * Pane 4 に「何を開いているか」を表す型（ADR-0015 §9 大決定 G）。
 *
 * - `{ type: "stage"; stage }`: 検討ステージ詳細を表示中
 * - `null`: ステージ未選択（Pane 4 は畳み状態）
 *
 * 旧 `{ type: "profile" }` はモード 1 廃止（ADR-0015 §4 大決定 B）に伴い削除。
 */
export type SelectedDetail = { type: "stage"; stage: StageKey } | null;

// ===== Pane 2 の派生計算用 UI 表示型 =====
// Workspace の派生計算 (candidateGroups) と CandidateListPane の props 型として共有する。
// candidates 配列から生成される表示単位。
//
// `averageScore` は `lib/computed/scorecards.ts` の `getCandidateAverageScore` で
// 派生計算した値を Workspace 側で詰めて渡す。Pane 2 場所行の右端に
// `★ 4.5` または `—`（未評価）として表示される。Pane 3 評価カードの「平均スコア」
// と同じ意味（最新 done scorecard の axisScores 平均、ADR-0013）。

export type CandidateRow = {
  id: string;
  name: string;
  averageScore: number | null;
};

// Pane 2 のグループ表示単位（ステージ or アーカイブ済み）。
// 場所データは `INITIAL_CANDIDATES` を SSoT とし、`candidateGroups` で
// 派生計算して CandidateListPane に props で渡す（Workspace 内で計算）。
//
// `kind: "stage"` は通常の検討ステージグループ。`stage: StageKey` は
// 「+ ボタン」から `addCandidate(stage)` を呼ぶときの引数に使う。
// `kind: "archived"` は archived === true の場所を集めた末尾の仮想グループで、
// 「+ 追加」操作は持たず、復元のみ可能。並び順は `kind: "stage"` を STAGE_ORDER で
// 並べた後、最後に `kind: "archived"` を 1 つだけ置く（要素があるときのみ表示）。
export type Group =
  | { kind: "stage"; stage: StageKey; label: string; items: CandidateRow[] }
  | { kind: "archived"; label: string; items: CandidateRow[] };
