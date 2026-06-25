/**
 * アプリの表示文言（labels）。
 *
 * このファイルは「行きたい場所マップ帳」ドメインに合わせた表示名の集約先。
 * 別の用途に作り変えるときは、ここの値（評価軸・ステージ名・セクション見出し）を
 * 書き換える。内部キー（schema の `wishLevel` / `screening` 等）は据え置いたまま、
 * 表示名だけを差し替える運用にしている。
 *
 * 後フェーズの予定:
 *   - Phase C: 評価軸と検討ステージを Tagged Union 化したデータ駆動に
 *   - 現時点では key → 日本語ラベルの単純なマッピングとして持つ
 */

import { type AxisKey, type StageKey } from "@/lib/schema";

// ===== 評価軸（1 軸: 行きたい度） =====
// 「行きたい場所マップ帳」では場所への "行きたい度" を 1 軸 ★ で表す。

export const EVALUATION_AXIS: Record<AxisKey, string> = {
  wishLevel: "行きたい度",
} as const;

// Pane 2 のグループ見出しに出すステージ表示名（日本語）。
// 場所の「検討ステージ」: 気になる → 計画中 → 予約済 → 訪問済。
// `Scorecard.label` とは独立に持つ（場所ごとの個別ラベルではなく、
// 列としてのステージ名なので Record で固定）。内部キー（screening 等）は
// 雛形の構造を維持するため据え置き、表示名のみ旅行ドメインに差し替えている。
export const STAGE_LABELS: Record<StageKey, string> = {
  screening: "気になる",
  first: "計画中",
  second: "予約済",
  final: "訪問済",
};

// Pane 2 末尾の「見送り」グループの見出しラベル。
// archived === true の場所を束ねる仮想グループで、ステージとは直交した概念。
export const ARCHIVED_GROUP_LABEL = "見送り";

// ===== Pane 3 ダッシュボードのセクション見出し =====

export const PANE3_SECTION = {
  applicationInfo: "基本情報",
  recruitingConditions: "旅行メモ",
  screeningFlow: "検討フロー",
  screeningFlowDescription: "ステージごとのメモと記録",
} as const;

// ===== Pane 4 セクション id（ADR-0015 §19 でモード 1 廃止、m2 のみ） =====

export const PANE4_SECTION_IDS = {
  m2: {
    info: "pane4-m2-info",
    evaluation: "pane4-m2-evaluation",
    comment: "pane4-m2-comment",
    summary: "pane4-m2-summary",
    attachments: "pane4-m2-attachments",
  },
} as const;
