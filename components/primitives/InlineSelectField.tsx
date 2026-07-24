"use client";

/**
 * InlineSelectField — Pane 4 編集 UI の「固定リスト Select」プリミティブ。
 *
 * shadcn `<Select>` をラップし、ComboOption ベースの `<InlineComboboxField>` よりも
 * 軽量な「固定 N 択」の場面で使う:
 *   - `string[]` だけ渡せば良い（`{ value, description }` 構造は不要）
 *   - 新規追加機能は持たない（場所個別に増やす想定がない場合に使う）
 *   - SelectTrigger 素体（`border-input` + `h-8`）に `bg-card` + `w-full` +
 *     `hover:bg-accent/40` を加えて他の InlineXxxField と完全に揃える
 *
 * 雛形では「交通手段（電車 / 車 / 飛行機）」「ステータス（行きたい / 検討中 / 見送り）」
 * のような検討ステージのメタ情報フィールドで再利用される。
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InlineSelectFieldProps = {
  /** 現在の値（空文字で placeholder 表示） */
  value: string;
  /** 選択肢（順序が表示順、`readonly` 配列も受け取る） */
  options: readonly string[];
  /** 選択時に呼ばれる */
  onSave: (v: string) => void;
  /** スクリーンリーダー向けラベル */
  ariaLabel: string;
  /** 空のときの placeholder。デフォルト "選択..." */
  placeholder?: string;
};

export function InlineSelectField({
  value,
  options,
  onSave,
  ariaLabel,
  placeholder = "選択...",
}: InlineSelectFieldProps) {
  return (
    // Base UI の Select は「未選択」を null で表す（undefined は uncontrolled 扱いになり、
    // 値が入った瞬間に controlled へ切り替わって警告が出る）。空文字は常に null に写像し、
    // コンポーネントの生涯を通じて controlled（string | null）で一貫させる。
    <Select
      value={value === "" ? null : value}
      onValueChange={(v) => onSave(v ?? "")}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-8 w-full bg-card hover:bg-accent/40"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
