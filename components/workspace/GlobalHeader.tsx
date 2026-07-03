"use client";

import { Settings } from "lucide-react";

import { type Department } from "@/lib/schema";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsDialogContent } from "@/components/workspace/SettingsDialog";

type SaveState = "idle" | "saving" | "saved" | "error" | "unauthorized";

const SAVE_LABEL: Record<Exclude<SaveState, "idle">, string> = {
  saving: "保存中…",
  saved: "保存済み",
  error: "保存できません",
  unauthorized: "合言葉が必要（設定⚙で入力）",
};

type GlobalHeaderProps = {
  departmentTitle: string;
  positionTitle: string;
  candidateName: string;
  saveState?: SaveState;
  departments: Department[];
  onAddDepartment: (name: string) => void;
  onDeleteDepartment: (deptId: string) => void;
};

export function GlobalHeader({
  departmentTitle,
  positionTitle,
  candidateName,
  saveState = "idle",
  departments,
  onAddDepartment,
  onDeleteDepartment,
}: GlobalHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <Breadcrumb
        className="min-w-0 flex-1 overflow-hidden"
        aria-label="パンくず"
      >
        <BreadcrumbList className="flex-nowrap text-[11px]">
          <BreadcrumbItem className="shrink-0">
            <BreadcrumbLink>{departmentTitle}</BreadcrumbLink>
          </BreadcrumbItem>
          {positionTitle && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="shrink-0">
                <BreadcrumbLink>{positionTitle}</BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-medium">
              {candidateName}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {saveState !== "idle" && (
        <span
          aria-live="polite"
          className={`shrink-0 text-[11px] ${
            saveState === "error" || saveState === "unauthorized"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {SAVE_LABEL[saveState]}
        </span>
      )}

      <Dialog>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="ワークスペース設定"
                  >
                    <Settings />
                  </Button>
                }
              />
            }
          />
          <TooltipContent side="bottom">ワークスペース設定</TooltipContent>
        </Tooltip>
        <SettingsDialogContent
          departments={departments}
          onAddDepartment={onAddDepartment}
          onDeleteDepartment={onDeleteDepartment}
        />
      </Dialog>
    </header>
  );
}
