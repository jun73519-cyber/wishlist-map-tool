"use client";

/**
 * 写真・資料の一覧（Pane 4 の「写真・資料」セクション）。
 *
 * Attachment の種類:
 *   - txt: メモ・旅程など（previewText をモーダルで表示）
 *   - pdf: seed の予約確認書など（実体なし。プレビュー不可・表示のみ）
 *   - file: アプリからアップロードした写真・PDF（dataUrl を保持）。画像はサムネ表示
 *     ＋クリックで拡大、PDF はモーダルで表示できる。
 *
 * `onRemove` を渡すと各行に削除（×）ボタンが出る。場所・ステージ切替は親
 * （CandidateDetailPane）の `key` 再マウントで openItem も自然にリセットされる。
 */

import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";

import { type Attachment } from "@/lib/schema";
import { Separator } from "@/components/ui/separator";
import { AttachmentPreviewDialog } from "@/components/workspace/AttachmentPreviewDialog";

export function AttachmentList({
  items,
  onRemove,
}: {
  items: Attachment[];
  onRemove?: (id: string) => void;
}) {
  const [openItem, setOpenItem] = useState<Attachment | null>(null);

  if (items.length === 0) {
    return (
      <p className="px-1 py-1 text-sm text-muted-foreground">
        まだありません。下の「写真・PDFを追加」から登録できます。
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {items.map((file) => {
          const isImage =
            file.kind === "file" && file.mimeType.startsWith("image/");
          // プレビュー可能: txt と、アップロードした file（画像・PDF）。
          // seed の "pdf"（dataUrl なし）はプレビュー不可。
          const canPreview = file.kind === "txt" || file.kind === "file";
          return (
            <li
              key={file.id}
              className="flex items-stretch overflow-hidden rounded-lg border border-border bg-card transition"
            >
              <button
                type="button"
                onClick={() => canPreview && setOpenItem(file)}
                disabled={!canPreview}
                aria-label={
                  canPreview
                    ? `${file.name} を開く`
                    : `${file.name}（プレビュー不可）`
                }
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2.5 py-2 text-left transition outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent"
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL のサムネは next/image 非対応
                  <img
                    src={file.dataUrl}
                    alt=""
                    className="size-9 shrink-0 rounded object-cover"
                  />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-sm text-foreground">
                  {file.name}
                </span>
                {!canPreview && (
                  <span className="ml-1 shrink-0 rounded border border-border px-1 text-[10px] text-muted-foreground">
                    プレビュー不可
                  </span>
                )}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {file.size}
                </span>
              </button>

              {onRemove && (
                <>
                  <Separator orientation="vertical" aria-hidden />
                  <button
                    type="button"
                    onClick={() => onRemove(file.id)}
                    aria-label={`${file.name} を削除`}
                    className="flex shrink-0 items-center px-2.5 text-muted-foreground transition outline-none hover:bg-muted hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <AttachmentPreviewDialog
        item={openItem}
        onOpenChange={(open) => {
          if (!open) {
            setOpenItem(null);
          }
        }}
      />
    </>
  );
}
