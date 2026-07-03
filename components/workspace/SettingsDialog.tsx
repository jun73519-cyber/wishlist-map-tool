"use client";

import { useRef, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";

import { type Department, type Candidate, candidatesSchema } from "@/lib/schema";
import {
  resetToSeedData,
  getWriteToken,
  setWriteToken,
  writeHeaders,
} from "@/lib/storage";
import { DeleteConfirmDialog } from "@/components/workspace/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type SettingsDialogContentProps = {
  departments: Department[];
  onAddDepartment: (name: string) => void;
  onDeleteDepartment: (deptId: string) => void;
};

export function SettingsDialogContent({
  departments,
  onAddDepartment,
  onDeleteDepartment,
}: SettingsDialogContentProps) {
  const [newDeptName, setNewDeptName] = useState("");
  const [deleteDeptTarget, setDeleteDeptTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  // バックアップ（エクスポート/インポート）。データは DB（/api/places）と直接やり取りする。
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [importCandidates, setImportCandidates] = useState<Candidate[] | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddDept = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) return;
    onAddDepartment(trimmed);
    setNewDeptName("");
  };

  // 全場所を JSON ファイルとしてダウンロード（データ消失への保険）。
  const handleExport = async () => {
    setBackupMsg(null);
    try {
      const res = await fetch("/api/places", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.text();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wishlist-backup-${new Date().toLocaleDateString("en-CA")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg("バックアップを保存しました。");
    } catch {
      setBackupMsg("バックアップの取得に失敗しました。");
    }
  };

  // バックアップ JSON を検証してから、確認ダイアログを経て全置換する。
  const handleImportFile = async (file: File) => {
    setBackupMsg(null);
    try {
      const parsed = candidatesSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        setBackupMsg(
          "このファイルはバックアップの形式と一致しません（このアプリで保存した JSON を選んでください）。",
        );
        return;
      }
      setImportCandidates(parsed.data);
    } catch {
      setBackupMsg("ファイルを読み込めませんでした。");
    }
  };

  const handleImportConfirm = async () => {
    if (!importCandidates) return;
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: writeHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(importCandidates),
      });
      if (res.status === 401) {
        setImportCandidates(null);
        setBackupMsg(
          "編集の合言葉が違います。下の「編集の合言葉」を入力してから再度お試しください。",
        );
        return;
      }
      if (!res.ok) throw new Error();
      location.reload();
    } catch {
      setImportCandidates(null);
      setBackupMsg("復元に失敗しました。時間をおいて再度お試しください。");
    }
  };

  // 編集の合言葉（サーバーが WRITE_TOKEN で書き込み保護しているときに必要）。
  const [tokenInput, setTokenInput] = useState(() => getWriteToken());
  const [tokenMsg, setTokenMsg] = useState<string | null>(null);
  const handleSaveToken = () => {
    setWriteToken(tokenInput.trim());
    setTokenMsg(
      tokenInput.trim()
        ? "合言葉を保存しました。次の保存から使われます。"
        : "合言葉を削除しました。",
    );
  };

  return (
    <>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ワークスペース設定</DialogTitle>
          <DialogDescription>
            エリア区分やワークスペース名を管理します
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="settings-new-dept">エリア区分</FieldLabel>
            <ScrollArea className="max-h-48">
              <div className="divide-y divide-border rounded-lg border border-border">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-sm">{dept.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        setDeleteDeptTarget({ id: dept.id, name: dept.name })
                      }
                      aria-label={`${dept.name} を削除`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                {departments.length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    エリア区分がありません
                  </div>
                )}
              </div>
            </ScrollArea>
            <InputGroup>
              <InputGroupInput
                id="settings-new-dept"
                placeholder="新しいエリア区分名"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddDept();
                }}
              />
              <InputGroupAddon align="inline-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddDept}
                  disabled={!newDeptName.trim()}
                >
                  <Plus data-icon="inline-start" />
                  追加
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          <Separator />

          <Field>
            <FieldLabel htmlFor="settings-workspace-name">
              ワークスペース名
            </FieldLabel>
            <Input id="settings-workspace-name" defaultValue="行きたい場所マップ帳" />
          </Field>

          <Separator />

          <Field>
            <FieldLabel htmlFor="settings-write-token">編集の合言葉</FieldLabel>
            <p className="text-xs text-muted-foreground">
              公開サイトが書き込み保護されている場合、ここに合言葉を入れると編集できます（この端末に記憶されます）。
            </p>
            <InputGroup>
              <InputGroupInput
                id="settings-write-token"
                type="password"
                placeholder="合言葉"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setTokenMsg(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveToken();
                }}
              />
              <InputGroupAddon align="inline-end">
                <Button variant="outline" size="sm" onClick={handleSaveToken}>
                  保存
                </Button>
              </InputGroupAddon>
            </InputGroup>
            {tokenMsg && (
              <p className="text-xs text-muted-foreground">{tokenMsg}</p>
            )}
          </Field>

          <Separator />

          <Field>
            <FieldLabel>データ</FieldLabel>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  すべての場所を JSON ファイルに保存／ファイルから復元します。
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                  >
                    <Download data-icon="inline-start" />
                    保存
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload data-icon="inline-start" />
                    復元
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImportFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              {backupMsg && (
                <p className="text-xs text-muted-foreground">{backupMsg}</p>
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  追加・編集した内容を消して初期サンプルに戻します。
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setResetConfirmOpen(true)}
                >
                  サンプルデータに戻す
                </Button>
              </div>
            </div>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">閉じる</Button>} />
        </DialogFooter>
      </DialogContent>

      <DeleteConfirmDialog
        open={deleteDeptTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDeptTarget(null);
        }}
        title="エリア区分を削除しますか？"
        itemName={deleteDeptTarget?.name ?? ""}
        onConfirm={() => {
          if (deleteDeptTarget) {
            onDeleteDepartment(deleteDeptTarget.id);
            setDeleteDeptTarget(null);
          }
        }}
      />

      <DeleteConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="サンプルデータに戻しますか？"
        itemName=""
        description="追加・編集した場所やエリアはすべて消え、初期サンプルに戻ります。この操作は元に戻せません。"
        actionLabel="戻す"
        onConfirm={resetToSeedData}
      />

      <DeleteConfirmDialog
        open={importCandidates !== null}
        onOpenChange={(open) => {
          if (!open) setImportCandidates(null);
        }}
        title="バックアップから復元しますか？"
        itemName=""
        description={`現在のすべての場所が、このバックアップの内容（${importCandidates?.length ?? 0} 件）に置き換わります。この操作は元に戻せません。`}
        actionLabel="復元する"
        onConfirm={handleImportConfirm}
      />
    </>
  );
}
