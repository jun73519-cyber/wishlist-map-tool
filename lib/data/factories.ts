import { type Profile, type StageKey, type Scorecard } from "@/lib/schema";
import { STAGE_LABELS } from "@/lib/labels";

/**
 * 未作成ステージをクリックした時に Workspace が自動生成するための最小 Scorecard。
 * 全フィールド空（`deriveStageStatus` で pending 派生）。Pane 4 Mode 2 で inline edit すれば
 * 同行者や日付の設定ができる。
 */
export function createMinimalScorecard(stage: StageKey): Scorecard {
  return {
    stage,
    label: STAGE_LABELS[stage],
    date: "",
    format: "",
    interviewer: "",
    axisScores: {
      wishLevel: null,
    },
    attachments: [],
  };
}

/**
 * c1 / c3 / c4 / c5 / c6 など「c2 以外の場所」用の最小 Profile 生成ヘルパー。
 * ADR-0014 で Profile が 12 フィールド最小構成になり、avatar 頭文字は
 * 呼び出し側で `name[0]` 派生に統一されたため、`initial` 引数は削除済み。
 * 氏名以外は空文字に揃え、Pane 3 / Pane 4 では空欄として可視化される。
 *
 * `addCandidate`（Workspace 本体）からも参照されるため export する。
 */
export function createMinimalProfile(name: string): Profile {
  return {
    // 基本 (3): 場所名 / 登録日(未使用) / 情報源
    name,
    birthday: "",
    source: "",

    // リンク・連絡先 (3): 公式サイト / 電話 / 所在地
    email: "",
    phone: "",
    address: "",

    // 旅行メモ (4): 同行者 / 予算下限 / 予算上限 / 行く予定日
    recruiter: "",
    desiredSalaryMin: "",
    desiredSalaryMax: "",
    availableStartDate: "",

    // 読み物 (2): アクセス・見どころ / 行きたい理由
    careerText: "",
    motivationFull: "",
  };
}
