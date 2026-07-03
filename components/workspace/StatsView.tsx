"use client";

/**
 * 統計ビュー（Pane 3 の「統計」モード）— 訪問済みダッシュボード。
 *
 * Pane 2 と同じ絞り込み（エリア・非アーカイブ）の場所を対象に、
 *   - サマリー: 訪問済み件数 / 達成率 / 訪れたエリア数 / 使った予算の目安合計
 *   - 年別の訪問数（訪問済ステージの日付から派生）
 *   - エリア別の訪問数
 * を表示する。すべてレンダー時の派生計算（保存データは増やさない）。
 *
 * ※「国数」はデータに国フィールドが無いため「訪れたエリア数」で代替している。
 */

import { useMemo } from "react";

import { type Candidate, type Department } from "@/lib/schema";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type StatsViewProps = {
  /** Pane 2 と同じ絞り込み後の場所（非アーカイブ） */
  candidates: Candidate[];
  /** エリア名の解決用（position.id → 表示名） */
  departments: Department[];
};

/** 予算の目安（万円）。min/max の中間値、どちらかだけならその値、無ければ null。 */
function budgetOf(c: Candidate): number | null {
  const min = Number(c.profile.desiredSalaryMin);
  const max = Number(c.profile.desiredSalaryMax);
  const hasMin = c.profile.desiredSalaryMin !== "" && Number.isFinite(min);
  const hasMax = c.profile.desiredSalaryMax !== "" && Number.isFinite(max);
  if (hasMin && hasMax) return (min + max) / 2;
  if (hasMin) return min;
  if (hasMax) return max;
  return null;
}

export function StatsView({ candidates, departments }: StatsViewProps) {
  const stats = useMemo(() => {
    const areaName = new Map<string, string>();
    for (const d of departments)
      for (const p of d.positions) areaName.set(p.id, p.name);

    const visited = candidates.filter((c) => c.stage === "final");

    // 年別: 訪問済ステージ(final)の scorecard 日付から年を取る。未記入は「年未記入」。
    const byYear = new Map<string, number>();
    for (const c of visited) {
      const date = c.scorecards.find((s) => s.stage === "final")?.date ?? "";
      const year = /^\d{4}/.test(date) ? `${date.slice(0, 4)}年` : "年未記入";
      byYear.set(year, (byYear.get(year) ?? 0) + 1);
    }
    const years = [...byYear.entries()].sort((a, b) =>
      b[0].localeCompare(a[0], "ja"),
    );

    // エリア別（訪問済のみ）。
    const byArea = new Map<string, number>();
    for (const c of visited) {
      const name = areaName.get(c.area) ?? "未分類";
      byArea.set(name, (byArea.get(name) ?? 0) + 1);
    }
    const areas = [...byArea.entries()].sort((a, b) => b[1] - a[1]);

    // 予算の目安合計（訪問済で予算が入っているもの）。
    let budgetSum = 0;
    let budgetCount = 0;
    for (const c of visited) {
      const b = budgetOf(c);
      if (b !== null) {
        budgetSum += b;
        budgetCount++;
      }
    }

    return {
      visitedCount: visited.length,
      totalCount: candidates.length,
      areaCount: byArea.size,
      years,
      areas,
      budgetSum: Math.round(budgetSum),
      budgetCount,
    };
  }, [candidates, departments]);

  const rate =
    stats.totalCount > 0
      ? Math.round((stats.visitedCount / stats.totalCount) * 100)
      : 0;
  const maxYear = Math.max(1, ...stats.years.map(([, n]) => n));
  const maxArea = Math.max(1, ...stats.areas.map(([, n]) => n));

  return (
    <section className="h-full w-full min-w-0 bg-canvas">
      <ScrollArea className="h-full">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-8 py-8">
          {/* サマリー 3 枚 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="訪問済み"
              value={`${stats.visitedCount}`}
              unit={`/ ${stats.totalCount} 件（${rate}%）`}
            />
            <SummaryCard
              label="訪れたエリア"
              value={`${stats.areaCount}`}
              unit="エリア"
            />
            <SummaryCard
              label="使った予算の目安"
              value={stats.budgetCount > 0 ? `${stats.budgetSum}` : "—"}
              unit={
                stats.budgetCount > 0
                  ? `万円（${stats.budgetCount} 件分）`
                  : "予算未記入"
              }
            />
          </div>

          {stats.visitedCount === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>まだ訪問済みの場所がありません</CardTitle>
                <CardDescription>
                  行った場所を Pane 2 で「訪問済」へ動かすと、ここに旅の記録が積み上がります。
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              {/* 年別 */}
              <Card>
                <CardHeader>
                  <CardTitle emphasis="prominent">年別の訪問数</CardTitle>
                  <CardDescription>
                    訪問済ステージの日付から集計（未記入は「年未記入」）
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {stats.years.map(([year, n]) => (
                      <BarRow key={year} label={year} value={n} max={maxYear} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* エリア別 */}
              <Card>
                <CardHeader>
                  <CardTitle emphasis="prominent">エリア別の訪問数</CardTitle>
                  <CardDescription>どの地域に行ったかの内訳</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {stats.areas.map(([area, n]) => (
                      <BarRow key={area} label={area} value={n} max={maxArea} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold">{value}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {unit}
          </span>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

/** 件数の横棒（最大値に対する割合幅）。色はテーマの primary トークン。 */
function BarRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm text-foreground">
        {label}
      </span>
      <div className="h-5 min-w-0 flex-1 rounded-md bg-muted">
        <div
          className="flex h-full items-center rounded-md bg-primary px-2"
          style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
        >
          <span className="text-xs font-semibold text-primary-foreground">
            {value}
          </span>
        </div>
      </div>
    </div>
  );
}
