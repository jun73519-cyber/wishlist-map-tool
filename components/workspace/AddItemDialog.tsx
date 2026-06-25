"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type AddItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fieldLabel: string;
  fieldId: string;
  placeholder: string;
  onAdd: (name: string) => void;
  // --- 任意: 「AI下書き」機能（場所追加でのみ使用） ---
  // `onAiGenerate` を渡すと、参考 URL 入力欄と「AIで下書きして追加」ボタンが出る。
  // 渡さない場合（エリア追加など）は従来どおりの単純な追加ダイアログのまま。
  urlFieldLabel?: string;
  urlPlaceholder?: string;
  onAiGenerate?: (name: string, url: string) => Promise<void>;
};

export function AddItemDialog({
  open,
  onOpenChange,
  title,
  description,
  fieldLabel,
  fieldId,
  placeholder,
  onAdd,
  urlFieldLabel,
  urlPlaceholder,
  onAiGenerate,
}: AddItemDialogProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiEnabled = !!onAiGenerate;

  const reset = () => {
    setName("");
    setUrl("");
    setError(null);
    setLoading(false);
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || loading) return;
    onAdd(trimmed);
    reset();
    onOpenChange(false);
  };

  const handleAiGenerate = async () => {
    const trimmed = name.trim();
    if (!trimmed || !onAiGenerate || loading) return;
    setError(null);
    setLoading(true);
    try {
      await onAiGenerate(trimmed, url.trim());
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "下書きの生成に失敗しました。",
      );
      setLoading(false);
    }
  };

  // Enter は「主アクション」を呼ぶ。AI が使えるときは下書き生成、そうでなければ追加。
  const handleEnter = () => {
    if (aiEnabled) {
      void handleAiGenerate();
    } else {
      handleSubmit();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
            <Input
              id={fieldId}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEnter();
              }}
              placeholder={placeholder}
              disabled={loading}
            />
          </Field>
          {aiEnabled && (
            <Field>
              <FieldLabel htmlFor={`${fieldId}-url`}>
                {urlFieldLabel ?? "参考 URL（任意）"}
              </FieldLabel>
              <Input
                id={`${fieldId}-url`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEnter();
                }}
                placeholder={urlPlaceholder}
                type="url"
                disabled={loading}
              />
            </Field>
          )}
        </FieldGroup>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={loading}>
                キャンセル
              </Button>
            }
          />
          {aiEnabled ? (
            <>
              <Button
                variant="outline"
                onClick={handleSubmit}
                disabled={!name.trim() || loading}
              >
                空で追加
              </Button>
              <Button
                onClick={handleAiGenerate}
                disabled={!name.trim() || loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                AIで下書きして追加
              </Button>
            </>
          ) : (
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              追加
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
