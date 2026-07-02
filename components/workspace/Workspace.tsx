"use client";

/**
 * Workspace: 4 ペインの親コンポーネント。
 *
 * - Pane 1〜4 の state（candidates / selectedCandidateId / selectedDetail）を
 *   保持し、各ペインに props として渡す。
 *   `previousDetail` state は ADR-0011 §6 大決定 D で削除した（戻り先が候詳に固定
 *   されたため、直前の詳細を 1 段階覚える概念が不要になった）。
 * - Pane 3 = 場所ダッシュボード（場所軸の編集: ヘッダー帯 + 旅行メモ + 検討フロー）
 * - Pane 4 = ステージ軸の編集（検討ステージ詳細のみ）
 *   ADR-0015 §9 大決定 G により、Pane 4 のデフォルト state は `null`
 *   （ステージ未選択 = 畳み状態）。◀ ボタンは撤廃。
 *
 * レイアウト構造（shadcn/ui Sidebar を採用、ADR-0006 §3/§5 を本実装で改訂）:
 *
 * ```
 * <SidebarProvider> (h-screen, defaultOpen, Cmd+B でトグル)
 * ┌─ Sidebar (Pane 1) ─┬─ SidebarInset ─────────────────────┐
 * │ (画面最上端          │ ┌─ GlobalHeader (h-12) ─────────┐ │
 * │  〜最下端)           │ └─────────────────────────────────┘ │
 * │ collapsible="icon"  │ ┌─ Pane 2 ─┬─ Pane 3 ─┬─ Pane 4 ─┐ │
 * │ 240px ↔ 48px        │ │          │          │          │ │
 * └────────────────────┴─┴──────────┴──────────┴──────────┘
 * ```
 *
 * - Pane 1 のみ画面最上端〜最下端まで届く chrome（折りたたみ可）
 * - GlobalHeader は Pane 1 を除く右側全幅（Pane 2 / Pane 3 / Pane 4 の上）に渡る
 * - Pane 4 はヘッダー直下から最下端まで
 * - Pane 1 折りたたみトグルは Pane 1 ヘッダー右端の `Pane1Toggle` 1 箇所
 *   （ADR-0006 §5 で計画していた GlobalHeader 側の SidebarTrigger は本実装で撤回）
 *
 * 仕様の出典:
 *   - openspec/decision/0006-pane-background-hierarchy-and-shadcn-inset-header.md
 *     §2（4 段階背景色階層）/ §4（保存ステータス削除）はそのまま採用
 *     §3（Pane 4 = 画面最上端〜最下端 / ヘッダーは中央エリアのみ）は本実装で再改訂
 *     §5（SidebarTrigger は GlobalHeader）も本実装で再改訂（Pane 1 ヘッダー側に集約）
 *   - openspec/decision/0009-drilldown-card-affordance.md（Pane 3 ドリルダウンカードの ▶ 規律）
 *   - openspec/changes/add-4pane-workspace-template/specs/workspace-template/spec.md
 *   - openspec/changes/add-4pane-workspace-template/design.md D51〜D56 / D65
 */

import { useState, useEffect, useCallback, useMemo } from "react";

import {
  type Profile,
  type AxisKey,
  type StageKey,
  type Department,
  type Candidate,
  type Attachment,
  type Group,
  type SelectedDetail,
  STAGE_ORDER,
  candidatesSchema,
} from "@/lib/schema";
import {
  createMinimalProfile,
  createMinimalScorecard,
} from "@/lib/data/factories";
import { getCandidateAverageScore } from "@/lib/computed/scorecards";
import { ARCHIVED_GROUP_LABEL, STAGE_LABELS } from "@/lib/labels";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import dynamic from "next/dynamic";
import { MapPin, Map as MapIcon, NotebookText } from "lucide-react";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { GlobalHeader } from "@/components/workspace/GlobalHeader";
import { PositionPane } from "@/components/workspace/PositionPane";
import { CandidateListPane } from "@/components/workspace/CandidateListPane";
import { CandidateDashboardPane } from "@/components/workspace/CandidateDashboardPane";
import {
  CandidateDetailPane,
  Pane4CollapsedRail,
} from "@/components/workspace/CandidateDetailPane";

// Leaflet は window に依存するため SSR では読み込まない（クライアント側でのみ描画）。
const MapView = dynamic(
  () => import("@/components/workspace/MapView").then((m) => m.MapView),
  { ssr: false },
);

// ========== UI 内部型 ==========
//
// 種データは `data/*.json` → Server Component（app/page.tsx）で Zod parse → props で受け取る。
// ヘルパー関数（createMinimalProfile / createMinimalScorecard）は `lib/data/factories.ts`。
// Pane 2 の表示用派生型 (CandidateRow / Group) と `SelectedDetail` 型は
// `lib/schema.ts` に集約（複数ペインで共有するため）。
// Pane 4 モード 2 用の `EditableScorecardKey` は
// `components/workspace/CandidateDetailPane.tsx` 内部の閉じた型。

// `updateScorecardField` の field 引数で使う key の union 型。Pane 4 内部の
// `EditableScorecardKey` と同形。CandidateDetailPane 内部に閉じた型として扱い
// たいため export せず、親側で同じ形を再宣言して持つ。
//
// ADR-0014「shadcn 標準フォームによる Pane 4 編集 UI」で `comment` / `summary`
// を `InlineTextareaField` で編集対象に追加したため、旧 4 フィールドから 6 フィールド
// に拡張。CandidateDetailPane.tsx 側の同型宣言（line 70-76）と同期させる。
// `onUpdateScorecardField` 実装本体は `[field]: value` のスプレッドで
// 動作するため、ロジックの追加修正は不要。
type EditableScorecardKey =
  | "date"
  | "format"
  | "interviewer"
  | "decision"
  | "comment"
  | "summary";

type WorkspaceProps = {
  initialDepartments: Department[];
  initialCandidates: Candidate[];
  workspace: { name: string; icon: string };
};

export function Workspace({
  initialDepartments,
  initialCandidates,
  workspace,
}: WorkspaceProps) {
  const [departments, setDepartments] =
    useState<Department[]>(initialDepartments);
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("c2");
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail>(null);
  const [scrollAnchor, setScrollAnchor] = useState<string | null>(null);
  // ユーザーが手動で Pane 4 を畳んだか。ステージ選択は保持しつつ畳む用途。
  const [pane4ManuallyClosed, setPane4ManuallyClosed] = useState(false);
  // Pane 3 ヘッダー帯（Collapsible）の開閉。場所切替で閉じ、新規追加で開く。
  const [applicationInfoOpen, setApplicationInfoOpen] = useState(false);
  // Pane 1 で選択中のエリア（position.id）。null は「すべて」（全件表示）。
  // エリアを選ぶと Pane 2 はその area を持つ場所だけに絞り込まれる。
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  // Pane 3 の表示モード。"detail" = 場所の詳細（従来） / "map" = 地図ビュー。
  const [pane3View, setPane3View] = useState<"detail" | "map">("detail");

  // 場所(candidates)はデータベース(Neon)に保存し、リロード・別端末・他人からも
  // 同じものが見えるようにする。`/api/places` 経由で読み書きする（SQL や接続文字列は
  // サーバー側だけが扱う）。エリア(departments)・アプリ設定はリポジトリの JSON のまま
  // で、props（seed）から受け取る（保存先の切り分けの理由は lib/db.ts 冒頭参照）。
  //
  // 初期描画は props（seed）で行い、マウント後に DB の内容を読み込んで差し替える
  // （SSR とのハイドレーション不一致を避けるため初期 state は props のまま）。
  const [hydrated, setHydrated] = useState(false);
  // DB は外部ストレージ。props 由来の派生 state の複製ではなく、マウント後一度きりの
  // ハイドレーション（SSR 一致のため初期 state は props のまま）。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/places", { cache: "no-store" });
        if (res.ok) {
          const parsed = candidatesSchema.safeParse(await res.json());
          if (!cancelled && parsed.success) setCandidates(parsed.data);
        }
      } catch {
        // 通信・DB 失敗時は seed（props）のまま続行する
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // 保存は hydrated 後のみ（初回の seed を DB に書き戻して読み込みを上書きするのを防ぐ）。
  // 連続編集で叩きすぎないよう少しデバウンスしてから全件を同期保存する。
  // 保存状態を UI に出す（無言のデータ喪失を防ぐ）。保存中／保存済み／失敗。
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(candidates),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        // 保存失敗は致命的でないが、UI に出してユーザーが気づけるようにする。
        setSaveState("error");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [candidates, hydrated]);

  // Pane 4 の展開状態を派生計算（ADR-0015 §9 大決定 G）。
  // selectedDetail !== null かつ手動で畳んでいない → 開いている。
  const pane4Open = selectedDetail !== null && !pane4ManuallyClosed;

  // アクティブ場所を取得。全件削除などで candidates が空になると undefined になり得る。
  // その場合は Pane 3/4 を空状態に切り替え、`undefined.profile` でのクラッシュを防ぐ。
  const activeCandidate =
    candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0];
  const scorecards = activeCandidate?.scorecards ?? [];

  // Mode1ProfileDetail は `setProfile: React.Dispatch<React.SetStateAction<Profile>>`
  // を期待している（採用案 X）。子コンポーネント側の signature を変えないために、
  // candidates 配列を更新するアダプタをここで作る。
  // 関数形 (p => next) と値形 (next) の両方に対応する。
  const setProfile = useCallback<React.Dispatch<React.SetStateAction<Profile>>>(
    (action) => {
      setCandidates((prev) =>
        prev.map((c) => {
          if (c.id !== selectedCandidateId) return c;
          const next =
            typeof action === "function" ? action(c.profile) : action;
          return { ...c, profile: next };
        }),
      );
    },
    [selectedCandidateId],
  );

  const openDetail = useCallback(
    (next: SelectedDetail, anchor?: string) => {
      if (next?.type === "stage") {
        setCandidates((prev) =>
          prev.map((c) => {
            if (c.id !== selectedCandidateId) return c;
            if (c.scorecards.some((s) => s.stage === next.stage)) return c;
            return {
              ...c,
              scorecards: [...c.scorecards, createMinimalScorecard(next.stage)],
            };
          }),
        );
      }
      setSelectedDetail(next);
      setScrollAnchor(anchor ?? null);
      setPane4ManuallyClosed(false);
    },
    [selectedCandidateId],
  );

  // Pane 2 の場所行クリックでアクティブ場所を切り替える。
  // - selectedDetail が「ステージ詳細」だった場合、新場所にそのステージの
  //   scorecard が無ければ Pane 4 を **場所詳細にフォールバック**する
  //   （ADR-0011 §7 大決定 E、旧 null フォールバックを撤回）。c2 以外は
  //   scorecards: [] のため、c2 → 別場所の切替時はほぼ常に候詳へフォールバック。
  // - selectedDetail が「場所詳細」のときは維持してよい（profile はどの場所にも
  //   必ず存在する）。
  // - previousDetail state は ADR-0011 §6 大決定 D で削除済みのため、リセット不要。
  const selectCandidate = useCallback((id: string) => {
    setSelectedCandidateId(id);
    setSelectedDetail(null);
    setApplicationInfoOpen(false);
    setPane4ManuallyClosed(false);
  }, []);

  const addCandidate = useCallback(
    (stage: StageKey, name: string) => {
      const newId = `c-${Date.now()}`;
      const newCandidate: Candidate = {
        id: newId,
        profile: createMinimalProfile(name),
        scorecards: [],
        stage,
        area: selectedAreaId ?? "",
        archived: false,
      };
      setCandidates((prev) => [...prev, newCandidate]);
      setSelectedCandidateId(newId);
      setSelectedDetail(null);
      setApplicationInfoOpen(true);
      setPane4ManuallyClosed(false);
    },
    [selectedAreaId],
  );

  // 「AI下書き」で生成済みの profile を持つ場所を追加する。`addCandidate` と
  // 同じ挙動（追加 → アクティブ化 → 基本情報を開く）だが、最小 profile の代わりに
  // 渡された profile をそのまま使う。生成は呼び出し側（CandidateListPane）が
  // `/api/draft-place` を叩いて行い、ここには完成した profile が渡る。
  const addCandidateWithProfile = useCallback(
    (
      stage: StageKey,
      profile: Profile,
      coords?: { lat: number; lng: number },
    ) => {
      const newId = `c-${Date.now()}`;
      const newCandidate: Candidate = {
        id: newId,
        profile,
        scorecards: [],
        stage,
        area: selectedAreaId ?? "",
        archived: false,
        ...(coords ?? {}),
      };
      setCandidates((prev) => [...prev, newCandidate]);
      setSelectedCandidateId(newId);
      setSelectedDetail(null);
      setApplicationInfoOpen(true);
      setPane4ManuallyClosed(false);
    },
    [selectedAreaId],
  );

  // 場所をアーカイブ（論理削除）する。データは残し `archived: true` を立てる。
  // 復元は `restoreCandidate` から、もしくは Pane 2「アーカイブ済み」グループの
  // 「復元」ボタン経由。アクティブ場所をアーカイブした場合は、非 archived の
  // 先頭場所にフォールバックし、ステージ詳細（Pane 4）はクリアする。
  const archiveCandidate = useCallback((id: string) => {
    setCandidates((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, archived: true } : c,
      );
      setSelectedCandidateId((prevId) => {
        if (prevId !== id) return prevId;
        const fallback = next.find((c) => !c.archived);
        return fallback ? fallback.id : "";
      });
      return next;
    });
    setSelectedDetail(null);
    setPane4ManuallyClosed(false);
  }, []);

  // アーカイブ済み場所を元のステージに復元する。`stage` は archived 中も保持
  // しているので、そのステージへ戻すだけでよい。
  const restoreCandidate = useCallback((id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, archived: false } : c)),
    );
  }, []);

  // 場所を完全に削除する（重複・誤追加の削除用。「見送り」=アーカイブとは別物で
  // 復元不可）。アクティブな場所を削除したら、非 archived の先頭 → なければ先頭へ
  // フォールバックし、ステージ詳細（Pane 4）はクリアする。
  const deleteCandidate = useCallback((id: string) => {
    setCandidates((prev) => {
      const next = prev.filter((c) => c.id !== id);
      setSelectedCandidateId((prevId) => {
        if (prevId !== id) return prevId;
        const fallback = next.find((c) => !c.archived) ?? next[0];
        return fallback ? fallback.id : "";
      });
      return next;
    });
    setSelectedDetail(null);
    setPane4ManuallyClosed(false);
  }, []);

  // 場所を別ステージへ移動 / 同ステージ内で並び替え。
  //
  // `toStage` は移動先のステージキー。`toIndex` はそのステージグループ内での
  // 0-origin の挿入位置。配列順を SSoT としているため、candidates 配列上の
  // 絶対インデックスに変換して `splice` 相当の挿入を行う。
  //
  // 同ステージ内ドラッグ・別ステージへのドラッグの両方をこの 1 関数で扱う。
  // archived 場所は対象外（DnD はアクティブな場所のみ可能）。
  const moveCandidate = useCallback(
    (id: string, toStage: StageKey, toIndex: number) => {
      setCandidates((prev) => {
        const subjectIndex = prev.findIndex((c) => c.id === id);
        if (subjectIndex < 0) return prev;
        const subject = prev[subjectIndex];
        if (subject.archived) return prev;

        const without = prev.filter((_, i) => i !== subjectIndex);
        const updated: Candidate = { ...subject, stage: toStage };

        let count = 0;
        let absInsertAt = without.length;
        for (let i = 0; i < without.length; i++) {
          const c = without[i];
          if (!c.archived && c.stage === toStage) {
            if (count === toIndex) {
              absInsertAt = i;
              break;
            }
            count++;
          }
        }
        return [
          ...without.slice(0, absInsertAt),
          updated,
          ...without.slice(absInsertAt),
        ];
      });
    },
    [],
  );

  const addDepartment = useCallback((name: string) => {
    setDepartments((prev) => [
      ...prev,
      { id: `d-${Date.now()}`, name, positions: [] },
    ]);
  }, []);

  const deleteDepartment = useCallback((deptId: string) => {
    setDepartments((prev) => prev.filter((d) => d.id !== deptId));
  }, []);

  const addPosition = useCallback((deptId: string, posName: string) => {
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: [
                ...d.positions,
                { id: `p-${Date.now()}`, name: posName, count: 0 },
              ],
            }
          : d,
      ),
    );
  }, []);

  const deletePosition = useCallback((deptId: string, posId: string) => {
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === deptId
          ? { ...d, positions: d.positions.filter((p) => p.id !== posId) }
          : d,
      ),
    );
  }, []);

  // 評価観点 ★ の編集ハンドラ。フェーズ 3A から「アクティブ場所」の
  // scorecards を更新する形に変更（candidates 配列の中の該当場所だけを差し替え）。
  const updateAxisScore = useCallback(
    (stage: StageKey, axis: AxisKey, value: number | null) => {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidateId
            ? {
                ...c,
                scorecards: c.scorecards.map((s) =>
                  s.stage === stage
                    ? { ...s, axisScores: { ...s.axisScores, [axis]: value } }
                    : s,
                ),
              }
            : c,
        ),
      );
    },
    [selectedCandidateId],
  );

  // Pane 4 モード 2「メタ情報」の inline edit から呼ばれる。
  // `decision` だけ undefined を許すため、空文字は undefined として扱う
  // （`MetaRow` 廃止前の "未判定" 表示の代替: `EditableFieldRow` 側で空 = "未設定"）。
  // フェーズ 3A: アクティブ場所の scorecards を更新する形に変更。
  const updateScorecardField = useCallback(
    (stage: StageKey, field: EditableScorecardKey, value: string) => {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidateId
            ? {
                ...c,
                scorecards: c.scorecards.map((s) => {
                  if (s.stage !== stage) return s;
                  if (field === "decision") {
                    const trimmed = value.trim();
                    return {
                      ...s,
                      decision: trimmed === "" ? undefined : trimmed,
                    };
                  }
                  return { ...s, [field]: value };
                }),
              }
            : c,
        ),
      );
    },
    [selectedCandidateId],
  );

  // 写真・資料（添付）の追加。アクティブな場所の該当ステージ scorecard に足す。
  const addAttachment = useCallback(
    (stage: StageKey, attachment: Attachment) => {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidateId
            ? {
                ...c,
                scorecards: c.scorecards.map((s) =>
                  s.stage === stage
                    ? { ...s, attachments: [...s.attachments, attachment] }
                    : s,
                ),
              }
            : c,
        ),
      );
    },
    [selectedCandidateId],
  );

  // 写真・資料（添付）の削除。
  const removeAttachment = useCallback(
    (stage: StageKey, attachmentId: string) => {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidateId
            ? {
                ...c,
                scorecards: c.scorecards.map((s) =>
                  s.stage === stage
                    ? {
                        ...s,
                        attachments: s.attachments.filter(
                          (a) => a.id !== attachmentId,
                        ),
                      }
                    : s,
                ),
              }
            : c,
        ),
      );
    },
    [selectedCandidateId],
  );

  // 選択中の場所に座標を設定する（地図クリック / 基本情報の手入力から呼ばれる）。
  const updateCoords = useCallback(
    (lat: number, lng: number) => {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidateId ? { ...c, lat, lng } : c,
        ),
      );
    },
    [selectedCandidateId],
  );

  // Pane 4 内の `useEffect` 依存安定化のため、Workspace 側でメモ化して props で渡す。
  const consumeScrollAnchor = useCallback(() => setScrollAnchor(null), []);
  const togglePane4 = useCallback(() => setPane4ManuallyClosed((v) => !v), []);

  // Pane 1 のエリア選択（position.id か null=すべて）。切替時は Pane 4 を畳んでおく。
  const selectArea = useCallback((areaId: string | null) => {
    setSelectedAreaId(areaId);
    setSelectedDetail(null);
    setPane4ManuallyClosed(false);
  }, []);

  // エリアごとの件数（非アーカイブの場所数）を派生計算し、Pane 1 の数字に反映する。
  // これで Pane 1 の count は飾りではなく実データに連動する。
  const departmentsWithCounts: Department[] = useMemo(() => {
    const countByArea = new Map<string, number>();
    for (const c of candidates) {
      if (c.archived) continue;
      countByArea.set(c.area, (countByArea.get(c.area) ?? 0) + 1);
    }
    return departments.map((d) => ({
      ...d,
      positions: d.positions.map((p) => ({
        ...p,
        count: countByArea.get(p.id) ?? 0,
      })),
    }));
  }, [departments, candidates]);

  // 選択中エリアの表示名（パンくず用）。null は「すべて」。
  const selectedPosition =
    selectedAreaId === null
      ? null
      : (departments
          .flatMap((d) => d.positions.map((p) => ({ ...p, deptName: d.name })))
          .find((p) => p.id === selectedAreaId) ?? null);
  const departmentTitle = selectedPosition ? selectedPosition.deptName : "すべて";
  const positionTitle = selectedPosition ? selectedPosition.name : "";

  const candidateGroups: Group[] = useMemo(() => {
    // Pane 1 で選択中のエリアで先に絞り込む（null=すべては全件）。
    const visible =
      selectedAreaId === null
        ? candidates
        : candidates.filter((c) => c.area === selectedAreaId);

    // ステージグループは常に 4 段階すべて表示する。空ステージも残すことで、
    // 「最後の 1 名を別ステージへ動かしたら戻し先が消える」事故を防ぐ
    // （ADR-006 §2-2 の補足）。
    const stageGroups: Group[] = STAGE_ORDER.map((stage) => ({
      kind: "stage" as const,
      stage,
      label: STAGE_LABELS[stage],
      items: visible
        .filter((c) => !c.archived && c.stage === stage)
        .map((c) => ({
          id: c.id,
          name: c.profile.name,
          averageScore: getCandidateAverageScore(c),
        })),
    }));

    const archivedItems = visible
      .filter((c) => c.archived)
      .map((c) => ({
        id: c.id,
        name: c.profile.name,
        averageScore: getCandidateAverageScore(c),
      }));

    if (archivedItems.length === 0) return stageGroups;
    return [
      ...stageGroups,
      { kind: "archived" as const, label: ARCHIVED_GROUP_LABEL, items: archivedItems },
    ];
  }, [candidates, selectedAreaId]);

  // 地図ビュー用の派生計算。Pane 2 と同じ絞り込み（エリア・非アーカイブ）を適用し、
  // 座標を持つ場所だけをピンとして渡す（座標なしは件数ヒントとして表示）。
  const mapData = useMemo(() => {
    const visible = candidates.filter(
      (c) =>
        !c.archived && (selectedAreaId === null || c.area === selectedAreaId),
    );
    const places = visible.flatMap((c) =>
      typeof c.lat === "number" && typeof c.lng === "number"
        ? [
            {
              id: c.id,
              name: c.profile.name,
              stage: c.stage,
              lat: c.lat,
              lng: c.lng,
            },
          ]
        : [],
    );
    return { places, totalCount: visible.length };
  }, [candidates, selectedAreaId]);

  return (
    // shadcn/ui の SidebarProvider が外側を取り、Pane 1 (`<Sidebar>`) を全高で固定
    // 表示する。SidebarInset が右側ブロック（GlobalHeader + Pane 2/3/4）を担う。
    // Cmd+B のキーバインドは SidebarProvider 側で標準実装されている。
    // SidebarProvider のラッパー div は既定 `min-h-svh w-full`。雛形では
    // ビューポート高に固定したいので h-screen を併記し、ペイン内で min-h-0 が
    // 効くようにする（既存 ScrollArea の挙動と整合）。
    <SidebarProvider
      defaultOpen
      className="h-screen w-full overflow-hidden bg-background text-foreground"
    >
      <PositionPane
        workspaceName={workspace.name}
        departments={departmentsWithCounts}
        selectedAreaId={selectedAreaId}
        onSelectArea={selectArea}
        onAddPosition={addPosition}
        onDeletePosition={deletePosition}
      />
      <SidebarInset className="flex min-w-0 flex-col bg-background">
        <GlobalHeader
          departmentTitle={departmentTitle}
          positionTitle={positionTitle}
          candidateName={activeCandidate?.profile.name ?? ""}
          saveState={saveState}
          departments={departments}
          onAddDepartment={addDepartment}
          onDeleteDepartment={deleteDepartment}
        />
        {/* SidebarInset 自体が <main> を出すので、内側は <div> で組み、
            Pane 2 / Pane 3 / Pane 4 を横並びにする。 */}
        {/* Pane 2 / 3 / 4 はドラッグで幅を調整できる（react-resizable-panels）。
            Pane 4 は開いているときだけパネルとして並び、畳むと右端の細いレールになる。 */}
        <div className="flex min-h-0 flex-1">
          <ResizablePanelGroup
            direction="horizontal"
            className="min-h-0 flex-1"
          >
            <ResizablePanel
              id="pane-list"
              order={1}
              defaultSize={24}
              minSize={16}
              maxSize={34}
            >
              <CandidateListPane
                groups={candidateGroups}
                selectedCandidateId={selectedCandidateId}
                onSelectCandidate={selectCandidate}
                onAddCandidate={addCandidate}
                onAddCandidateWithProfile={addCandidateWithProfile}
                onArchiveCandidate={archiveCandidate}
                onRestoreCandidate={restoreCandidate}
                onDeleteCandidate={deleteCandidate}
                onMoveCandidate={moveCandidate}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="pane-dashboard" order={2} minSize={30}>
              <div className="flex h-full min-h-0 flex-col">
                {/* Pane 3 のビュー切替（詳細 ⇄ 地図）。地図は Pane 2 と同じ絞り込みの全場所を俯瞰する。 */}
                <div className="flex h-12 shrink-0 items-center justify-end border-b border-border bg-background px-3">
                  <ToggleGroup
                    variant="outline"
                    size="sm"
                    value={[pane3View]}
                    onValueChange={(groupValue) => {
                      const next = groupValue[0];
                      if (next === "detail" || next === "map")
                        setPane3View(next);
                    }}
                    aria-label="Pane 3 の表示切替"
                  >
                    <ToggleGroupItem value="detail" aria-label="詳細を表示">
                      <NotebookText data-icon="inline-start" />
                      詳細
                    </ToggleGroupItem>
                    <ToggleGroupItem value="map" aria-label="地図を表示">
                      <MapIcon data-icon="inline-start" />
                      地図
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="min-h-0 flex-1">
                  {pane3View === "map" ? (
                    <MapView
                      places={mapData.places}
                      totalCount={mapData.totalCount}
                      selectedId={selectedCandidateId}
                      activeName={activeCandidate?.profile.name ?? ""}
                      onSelectPlace={selectCandidate}
                      onOpenDetail={() => setPane3View("detail")}
                      onSetCoords={updateCoords}
                    />
                  ) : activeCandidate ? (
                    <CandidateDashboardPane
                      profile={activeCandidate.profile}
                      scorecards={activeCandidate.scorecards}
                      selectedDetail={selectedDetail}
                      onOpenDetail={openDetail}
                      setProfile={setProfile}
                      applicationInfoOpen={applicationInfoOpen}
                      onApplicationInfoOpenChange={setApplicationInfoOpen}
                      selectedCandidateId={selectedCandidateId}
                      coords={{
                        lat: activeCandidate.lat,
                        lng: activeCandidate.lng,
                      }}
                      onUpdateCoords={updateCoords}
                    />
                  ) : (
                    <EmptyDashboard />
                  )}
                </div>
              </div>
            </ResizablePanel>
            {pane4Open && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="pane-detail"
                  order={3}
                  defaultSize={32}
                  minSize={22}
                  maxSize={50}
                >
                  <CandidateDetailPane
                    selectedCandidateId={selectedCandidateId}
                    scorecards={scorecards}
                    selectedDetail={selectedDetail}
                    scrollAnchor={scrollAnchor}
                    onScrollAnchorConsumed={consumeScrollAnchor}
                    onUpdateAxis={updateAxisScore}
                    onUpdateScorecardField={updateScorecardField}
                    onAddAttachment={addAttachment}
                    onRemoveAttachment={removeAttachment}
                    onTogglePane4={togglePane4}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
          {!pane4Open && <Pane4CollapsedRail onToggle={togglePane4} />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// 場所が 1 件も無いとき（全件削除・サンプルに戻す直後など）に Pane 3 に出す空状態。
// クラッシュ防止だけでなく「次に何をすればいいか」を示す（Refactoring UI の Polish）。
function EmptyDashboard() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MapPin className="size-6" />
          </div>
          <CardTitle>まだ場所がありません</CardTitle>
          <CardDescription>
            左の一覧の「＋」から、行きたい場所を追加しましょう。
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
