"use client";

import * as ResizablePrimitive from "react-resizable-panels";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Resizable — ペイン間のドラッグ幅調整（react-resizable-panels ラッパー）。
 *
 * shadcn の `resizable` 部品に倣いつつ、本プロジェクトの semantic token に揃えた:
 *   - ハンドルは細い区切り線（`bg-border`）。hover / drag で `primary` に色変化
 *   - `withHandle` でグリップ（つまみ）を常時表示し「掴んで動かせる」ことを明示
 */

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-3 shrink-0 items-center justify-center outline-none",
        // 区切り線本体（中央 1px）。hover / drag で primary に
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border after:transition-colors",
        "hover:after:bg-primary/60 data-[resize-handle-state=drag]:after:bg-primary",
        "focus-visible:after:bg-primary focus-visible:after:w-0.5",
        "data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-full",
        "data-[panel-group-direction=vertical]:after:inset-x-0 data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-px data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-7 w-3.5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground data-[panel-group-direction=vertical]:h-3.5 data-[panel-group-direction=vertical]:w-7 data-[panel-group-direction=vertical]:rotate-90">
          <GripVertical className="size-3" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
