"use client";

/**
 * Pane 4: 検討ステージ詳細パネル（ADR-0015 §19 でモード 1 を廃止）。
 *
 * ステージ詳細のみ表示する。場所詳細（旧モード 1）は Pane 3 のヘッダー帯
 * トグル内に移管済み。起動時は畳まれた 48px 帯で、Pane 3 のステージカード
 * クリックで自動展開する。
 *
 * 規律:
 *   - components/primitives/ の Inline* primitive を使う（shadcn 標準フォーム）
 *   - AttachmentList を再利用（添付セクション）
 *   - AxisScoreRow を CandidateDashboardPane から import
 *   - ステージ切替時の state リセットは `key` 再マウントで
 *
 * `SelectedDetail` 型は `lib/schema.ts` に集約（Phase 3A）。
 */

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";

import {
  type AxisKey,
  type StageKey,
  type Scorecard,
  type Attachment,
  type SelectedDetail,
  AXIS_ORDER,
} from "@/lib/schema";
import { EVALUATION_AXIS, PANE4_SECTION_IDS } from "@/lib/labels";
import { createMinimalScorecard } from "@/lib/data/factories";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  InlineDateField,
  InlineSelectField,
  InlineComboboxField,
  InlineTextareaField,
  InlineFieldRow,
  type ComboOption,
} from "@/components/primitives";
import { Pane4Section } from "@/components/workspace/Pane4Section";
import { AxisScoreRow } from "@/components/workspace/CandidateDashboardPane";
import { AttachmentList } from "@/components/workspace/AttachmentList";

// ===== Pane 4 内部型（ファイル外には出さない） =====

/**
 * Pane 4 モード 2 で inline 編集できる Scorecard のキー集合。
 * `onUpdateScorecardField` の `field` 引数の型として親 (Workspace.tsx) と整合させる。
 *
 * 旧実装は `date / format / interviewer / decision` の 4 フィールドのみだったが、
 * ADR-0014 でコメント / 要約も `InlineTextareaField` で編集対象にしたため
 * `comment` / `summary` を追加した。Workspace.tsx 側の `EditableScorecardKey`
 * 再宣言も同形に揃える必要がある（型を export しない設計のため両側で宣言する規律）。
 */
type EditableScorecardKey =
  | "date"
  | "format"
  | "interviewer"
  | "decision"
  | "comment"
  | "summary";

// ===== 定数（screening-lab / profile-card-lab から移植） =====

const FORMAT_OPTIONS = ["電車", "車", "飛行機", "バス", "徒歩"] as const;

const DECISION_OPTIONS = ["行きたい", "検討中", "見送り"] as const;

const INITIAL_INTERVIEWER_OPTIONS: ComboOption[] = [
  { value: "ひとり旅", description: "自分ひとりで" },
  { value: "家族（4人）", description: "家族と一緒に" },
  { value: "友人（2人）", description: "友人と一緒に" },
  { value: "パートナー", description: "パートナーと一緒に" },
];

// ===== 写真・資料アップロード =====

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 画像は最大 1280px / JPEG に縮小して localStorage を圧迫しないようにする。
function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1280;
      let { width, height } = img;
      if (Math.max(width, height) > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas unsupported"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 写真・PDF をアプリから追加するボタン。画像は縮小して data URL 化し、
 * `onAdd` で scorecard の attachments に足す（localStorage に保存される）。
 */
function AttachmentUploader({ onAdd }: { onAdd: (a: Attachment) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith("image/");
        let dataUrl: string;
        let size: string;
        if (isImage) {
          dataUrl = await downscaleImage(file);
          size = formatBytes(Math.round((dataUrl.length * 3) / 4));
        } else {
          if (file.size > 3 * 1024 * 1024) {
            setError(
              "3MB を超えるファイルは保存できないことがあります（画像は自動縮小されます）。",
            );
          }
          dataUrl = await readAsDataUrl(file);
          size = formatBytes(file.size);
        }
        onAdd({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: "file",
          name: file.name,
          size,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
        });
      }
    } catch {
      setError("ファイルの読み込みに失敗しました。");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="self-start"
      >
        {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        写真・PDFを追加
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ===== 検討ステージ詳細（旧モード 2、ADR-0015 で唯一のモードに） =====

/**
 * モード 2（検討ステージ詳細、全ステージ共通テンプレート）。
 * 基本情報 / 評価 / メモ / 要約 / 写真・資料 の 5 ブロック構成。
 *
 * ステージ別ラベル分岐:
 *   - 「同行者」フィールド: 全ステージ共通
 *   - 「要約」見出し: 「気になる」のみ「下調べメモ」、それ以外は「記録・要約」
 *   - 「写真・資料」見出し: 全ステージ共通
 *
 * 各フィールドは `components/primitives/` の Inline* primitive で常時表示される
 * （Type-direct）。`interviewerOptions` は場所+ステージ単位でメモリ保持し、
 * 親側 `key` でステージ・場所切替時に自然リセット（Effect 内同期 setState 禁止）。
 */
function Mode2StageDetail({
  scorecard,
  onUpdateAxis,
  onUpdateScorecardField,
  onAddAttachment,
  onRemoveAttachment,
}: {
  scorecard: Scorecard;
  onUpdateAxis: (stage: StageKey, axis: AxisKey, value: number | null) => void;
  onUpdateScorecardField: (
    stage: StageKey,
    field: EditableScorecardKey,
    value: string,
  ) => void;
  onAddAttachment: (stage: StageKey, attachment: Attachment) => void;
  onRemoveAttachment: (stage: StageKey, attachmentId: string) => void;
}) {
  const isScreening = scorecard.stage === "screening";
  const interviewerLabel = "同行者";
  const summaryHeading = isScreening ? "下調べメモ" : "記録・要約";
  const attachmentHeading = "写真・資料";

  const [interviewerOptions, setInterviewerOptions] = useState<ComboOption[]>(
    INITIAL_INTERVIEWER_OPTIONS,
  );

  const handleAddInterviewer = (newOpt: ComboOption) =>
    setInterviewerOptions((prev) =>
      prev.find((o) => o.value === newOpt.value) ? prev : [...prev, newOpt],
    );

  return (
    <div>
      {/* 基本情報（日付 / 交通手段 / 同行者 / ステータス） */}
      <Pane4Section id={PANE4_SECTION_IDS.m2.info} title="基本情報">
        <dl className="flex flex-col gap-2.5 text-sm">
          <InlineFieldRow label="日付">
            <InlineDateField
              value={scorecard.date}
              onSave={(v) => onUpdateScorecardField(scorecard.stage, "date", v)}
              ariaLabel="日付"
            />
          </InlineFieldRow>

          <InlineFieldRow label="交通手段">
            <InlineSelectField
              value={scorecard.format}
              options={FORMAT_OPTIONS}
              onSave={(v) =>
                onUpdateScorecardField(scorecard.stage, "format", v)
              }
              ariaLabel="交通手段"
            />
          </InlineFieldRow>

          <InlineFieldRow label={interviewerLabel}>
            <InlineComboboxField
              value={scorecard.interviewer}
              options={interviewerOptions}
              onSave={(v) =>
                onUpdateScorecardField(scorecard.stage, "interviewer", v)
              }
              onCreate={handleAddInterviewer}
              ariaLabel={interviewerLabel}
            />
          </InlineFieldRow>

          <InlineFieldRow label="ステータス">
            <InlineSelectField
              value={scorecard.decision ?? ""}
              options={DECISION_OPTIONS}
              onSave={(v) =>
                onUpdateScorecardField(scorecard.stage, "decision", v)
              }
              ariaLabel="ステータス"
            />
          </InlineFieldRow>
        </dl>
      </Pane4Section>

      <Separator />

      {/* 評価（行きたい度 ★、編集可能。★ クリックで値設定 / × でリセット） */}
      <Pane4Section id={PANE4_SECTION_IDS.m2.evaluation} title="評価">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-3">
          {AXIS_ORDER.map((key) => (
            <AxisScoreRow
              key={key}
              label={EVALUATION_AXIS[key]}
              value={scorecard.axisScores[key]}
              editable
              onChange={(v) => onUpdateAxis(scorecard.stage, key, v)}
              onReset={() => onUpdateAxis(scorecard.stage, key, null)}
            />
          ))}
        </div>
      </Pane4Section>

      <Separator />

      {/* メモ（textarea） */}
      <Pane4Section
        id={PANE4_SECTION_IDS.m2.comment}
        title="メモ"
        className="gap-2"
      >
        <InlineTextareaField
          value={scorecard.comment ?? ""}
          onSave={(v) => onUpdateScorecardField(scorecard.stage, "comment", v)}
          ariaLabel="メモ"
        />
      </Pane4Section>

      <Separator />

      {/* 要約（「気になる」: 下調べメモ / それ以外: 記録・要約） */}
      <Pane4Section
        id={PANE4_SECTION_IDS.m2.summary}
        title={summaryHeading}
        className="gap-2"
      >
        <InlineTextareaField
          value={scorecard.summary ?? ""}
          onSave={(v) => onUpdateScorecardField(scorecard.stage, "summary", v)}
          ariaLabel={summaryHeading}
        />
      </Pane4Section>

      <Separator />

      {/* 写真・資料（全ステージ共通）— 一覧 + アップロード */}
      <Pane4Section
        id={PANE4_SECTION_IDS.m2.attachments}
        title={attachmentHeading}
        className="gap-2"
      >
        <AttachmentList
          items={scorecard.attachments}
          onRemove={(id) => onRemoveAttachment(scorecard.stage, id)}
        />
        <AttachmentUploader
          onAdd={(a) => onAddAttachment(scorecard.stage, a)}
        />
      </Pane4Section>
    </div>
  );
}

// ===== Pane 4 メイン =====

/**
 * Pane 4: 検討ステージ詳細パネル（ADR-0015 §19 で場所詳細を Pane 3 に移管）。
 *
 * - ヘッダー: ステージ名 + Pane4Toggle の 2 要素（◀ は撤廃）
 * - ステージ切替: `<Mode2StageDetail key={...}>` で再マウント
 * - ステージ未選択時（selectedDetail === null 想定、Phase 3C 暫定で type=profile も
 *   ステージなしとして扱う）: コンテンツなし、ヘッダーのみ
 */
export function CandidateDetailPane({
  selectedCandidateId,
  scorecards,
  selectedDetail,
  scrollAnchor,
  onScrollAnchorConsumed,
  onUpdateAxis,
  onUpdateScorecardField,
  onAddAttachment,
  onRemoveAttachment,
  onTogglePane4,
}: {
  selectedCandidateId: string;
  scorecards: Scorecard[];
  selectedDetail: SelectedDetail;
  scrollAnchor: string | null;
  onScrollAnchorConsumed: () => void;
  onUpdateAxis: (stage: StageKey, axis: AxisKey, value: number | null) => void;
  onUpdateScorecardField: (
    stage: StageKey,
    field: EditableScorecardKey,
    value: string,
  ) => void;
  onAddAttachment: (stage: StageKey, attachment: Attachment) => void;
  onRemoveAttachment: (stage: StageKey, attachmentId: string) => void;
  onTogglePane4: () => void;
}) {
  useEffect(() => {
    if (!scrollAnchor) return;
    // 1 フレーム待つのは、Pane 4 が閉状態 → 開状態へ切り替わった直後に
    // 対象セクションの DOM がレイアウトされるのを待つため。
    // unmount された場合や anchor が変わった場合は cancel して、後続の
    // `scrollIntoView` と `onScrollAnchorConsumed`（state setter）が走らないようにする。
    const id = requestAnimationFrame(() => {
      document
        .getElementById(scrollAnchor)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
      onScrollAnchorConsumed();
    });
    return () => cancelAnimationFrame(id);
  }, [scrollAnchor, onScrollAnchorConsumed]);

  const heading =
    selectedDetail?.type === "stage"
      ? (scorecards.find((s) => s.stage === selectedDetail.stage)?.label ??
        "詳細")
      : "ステージ詳細";

  // 開いているときだけ Workspace が ResizablePanel 内にこのコンポーネントを描画する。
  // 幅は ResizablePanel が制御するので、ここでは h-full でパネルを満たすだけにする。
  return (
    <aside className="flex h-full min-w-0 flex-col border-l border-border bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <h2 className="flex-1 truncate text-sm font-semibold text-foreground">
          {heading}
        </h2>
        <Pane4Toggle open onToggle={onTogglePane4} />
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {selectedDetail?.type === "stage" && (
          <Mode2StageDetail
            key={`${selectedCandidateId}-${selectedDetail.stage}`}
            scorecard={
              scorecards.find((s) => s.stage === selectedDetail.stage) ??
              createMinimalScorecard(selectedDetail.stage)
            }
            onUpdateAxis={onUpdateAxis}
            onUpdateScorecardField={onUpdateScorecardField}
            onAddAttachment={onAddAttachment}
            onRemoveAttachment={onRemoveAttachment}
          />
        )}
      </ScrollArea>
    </aside>
  );
}

/**
 * Pane 4 が畳まれているときに右端へ出す細いレール（トグルだけ）。
 * Workspace が `pane4Open === false` のときにこれを ResizablePanelGroup の外側に置く。
 */
export function Pane4CollapsedRail({ onToggle }: { onToggle: () => void }) {
  return (
    <aside className="flex w-12 shrink-0 flex-col border-l border-border bg-background">
      <div className="flex h-12 shrink-0 items-center justify-center border-b border-border">
        <Pane4Toggle open={false} onToggle={onToggle} />
      </div>
    </aside>
  );
}
