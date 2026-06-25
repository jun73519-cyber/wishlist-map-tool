"use client";

/**
 * 添付の中身プレビューモーダル（AttachmentList から開く）。
 *
 * - txt: 本文を whitespace-pre-wrap で表示
 * - file（画像）: 画像を表示
 * - file（PDF など）: iframe で表示
 * - アップロードした file は dataUrl から実際にダウンロードできる
 */

import { Download } from "lucide-react";

import { type Attachment } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AttachmentPreviewDialog({
  item,
  onOpenChange,
}: {
  item: Attachment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isImageFile =
    item?.kind === "file" && item.mimeType.startsWith("image/");
  const isOtherFile =
    item?.kind === "file" && !item.mimeType.startsWith("image/");

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-3">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="truncate">{item?.name ?? ""}</DialogTitle>
            {item?.kind === "file" ? (
              <Button
                variant="outline"
                size="xs"
                nativeButton={false}
                render={
                  <a
                    href={item.dataUrl}
                    download={item.name}
                    aria-label={`${item.name} をダウンロード`}
                  />
                }
                className="shrink-0"
              >
                <Download data-icon="inline-start" />
                ダウンロード
              </Button>
            ) : item ? (
              <Button
                variant="outline"
                size="xs"
                aria-label={`${item.name} をダウンロード`}
                onClick={() => console.info("[stub] download:", item.id)}
                className="shrink-0"
              >
                <Download data-icon="inline-start" />
                ダウンロード
              </Button>
            ) : null}
          </div>
          <DialogDescription>
            Esc キーまたは右上 × で閉じます。
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          {item?.kind === "txt" ? (
            <div className="py-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {item.previewText}
            </div>
          ) : isImageFile && item?.kind === "file" ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL は next/image 非対応
            <img
              src={item.dataUrl}
              alt={item.name}
              className="mx-auto h-auto max-w-full rounded-md"
            />
          ) : isOtherFile && item?.kind === "file" ? (
            <iframe
              src={item.dataUrl}
              title={item.name}
              className="h-[65vh] w-full rounded-md border border-border"
            />
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
