"use client";

/**
 * InlineTextField — Pane 4 編集 UI の「1 行 input」プリミティブ。
 *
 * shadcn `<Input>` をラップし、Lab v3 で確定した規律で編集体験を統一する:
 *   - 常に `<Input>` 表示（Type-direct、ADR-0014）
 *   - `border-input` + `bg-card` で「手前」感を出し、編集可能と一目で分かる
 *   - 保存: blur / Enter（値が変わっていれば onSave）
 *   - キャンセル: Esc で defaultValue に戻して blur
 *
 * ADR-0014 で旧 ADR-0010 §6 D R5「shadcn Input MUST 禁止」を撤回。
 * 雛形では場所の「場所名・同行者・連絡先・予算（min/max）」等で再利用。
 */

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type InlineTextFieldProps = {
  /** 現在の値（空文字で「未設定」placeholder 表示） */
  value: string;
  /** 値が変わって blur した時に呼ばれる */
  onSave: (v: string) => void;
  /** スクリーンリーダー向けラベル */
  ariaLabel: string;
  /** input の type 属性（`text` / `email` / `tel` / `number` / `url`） */
  inputType?: "text" | "email" | "tel" | "number" | "url";
  /** 空のときの placeholder。デフォルト "未設定" */
  placeholder?: string;
  /** className override（width 制限などに使う） */
  className?: string;
};

export function InlineTextField({
  value,
  onSave,
  ariaLabel,
  inputType = "text",
  placeholder,
  className,
}: InlineTextFieldProps) {
  return (
    // `key={value}` で「保存済みの値」が変わったら input を作り直す。
    // 非制御（defaultValue）のため、これが無いと値が外から変わったとき Base UI が
    // 「uncontrolled FieldControl の default が初期化後に変わった」と警告する
    // （React 公式の「非制御コンポーネントは key でリセットする」パターン）。
    // 入力中はこの `value` prop は変わらないので、打鍵ごとの再マウントは起きない。
    <Input
      key={value}
      type={inputType}
      defaultValue={value}
      placeholder={placeholder ?? "未設定"}
      aria-label={ariaLabel}
      onBlur={(e) => {
        if (e.target.value !== value) onSave(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          (e.target as HTMLInputElement).value = value;
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn("h-8 bg-card", className)}
    />
  );
}
