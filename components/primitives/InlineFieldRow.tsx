/**
 * InlineFieldRow — ラベル + 値の縦積み行プリミティブ。
 *
 * Pane 3 / Pane 4 のフォーム系セクションで「ラベル + Inline*Field」を
 * 並べる用途で再利用する MUST。dl/dt/dd セマンティクスで a11y を確保。
 *
 * 利用例:
 *   <dl className="flex flex-col gap-2.5 text-sm">
 *     <InlineFieldRow label="場所名">
 *       <InlineTextField value={name} onSave={...} ariaLabel="場所名" />
 *     </InlineFieldRow>
 *     <InlineFieldRow label="行く予定日">
 *       <InlineDateField value={date} onSave={...} ariaLabel="行く予定日" />
 *     </InlineFieldRow>
 *   </dl>
 *
 * 雛形では Pane 3 の「基本情報」/「リンク・連絡先」、
 * 旅行メモカード、Pane 4 モード 2「基本情報」で使う。
 */

export type InlineFieldRowProps = {
  /** ラベルテキスト */
  label: string;
  /** 値（Inline*Field など） */
  children: React.ReactNode;
};

export function InlineFieldRow({ label, children }: InlineFieldRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
