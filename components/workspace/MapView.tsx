"use client";

/**
 * 地図ビュー（Pane 3 の「地図」モード）。Leaflet + OpenStreetMap（無料・API キー不要）。
 *
 * - Pane 2 と同じ絞り込み（エリア・非アーカイブ）の場所を、ステージ色のピンで俯瞰する
 * - ピンをクリック → その場所を選択（パンくず・Pane 4 が連動）+ ポップアップ表示
 * - 「位置を設定」ボタンで武装 → 地図クリックで選択中の場所に座標を保存（誤クリック防止）
 *
 * 実装メモ:
 * - 本コンポーネントは Workspace 側で `next/dynamic` の ssr:false 読み込みに固定している
 *   （Leaflet は import 時に window を参照するため SSR 不可）。
 * - ピンは画像アイコンではなく L.circleMarker（SVG）を使う。Leaflet 既定アイコンの
 *   アセットパス問題を回避でき、ステージ色をトークン（--chart-*）から流せる。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed } from "lucide-react";

import { type StageKey, STAGE_ORDER } from "@/lib/schema";
import { STAGE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export type MapPlace = {
  id: string;
  name: string;
  stage: StageKey;
  lat: number;
  lng: number;
};

type MapViewProps = {
  places: MapPlace[];
  /** 絞り込み後の全件数（座標なし件数のヒント表示用） */
  totalCount: number;
  selectedId: string;
  /** 選択中の場所名（「位置を設定」ボタンのラベル用。空なら設定不可） */
  activeName: string;
  onSelectPlace: (id: string) => void;
  /** ポップアップの「詳細を見る」→ Pane 3 を詳細モードへ */
  onOpenDetail: () => void;
  onSetCoords: (lat: number, lng: number) => void;
};

// ステージ → 色トークンの対応。地図ピンとレジェンドで共用する。
const STAGE_CHART_VAR: Record<StageKey, string> = {
  screening: "--chart-1",
  first: "--chart-2",
  second: "--chart-3",
  final: "--chart-4",
};

/** CSS 変数の実値（oklch 文字列）を読む。Leaflet には具体的な色文字列を渡す必要がある。 */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export function MapView({
  places,
  totalCount,
  selectedId,
  activeName,
  onSelectPlace,
  onOpenDetail,
  onSetCoords,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  // id → マーカー。選択変更時にスタイルだけ更新するための索引
  // （全消し全描きするとクリック直後にポップアップが消えてしまう）。
  const markerByIdRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const didFitRef = useRef(false);

  // 「位置を設定」の武装状態。武装中のみ地図クリックが座標設定になる。
  const [arming, setArming] = useState(false);

  // Leaflet のイベントハンドラから最新の props/state を参照するための ref。
  // （ハンドラ登録は初期化時の一度きりにして、再購読を避ける。
  //   ref の更新はレンダー中ではなく effect で行う = react-hooks/refs 準拠）
  const armingRef = useRef(arming);
  const selectedIdRef = useRef(selectedId);
  const onSelectPlaceRef = useRef(onSelectPlace);
  const onOpenDetailRef = useRef(onOpenDetail);
  const onSetCoordsRef = useRef(onSetCoords);
  useEffect(() => {
    armingRef.current = arming;
    selectedIdRef.current = selectedId;
    onSelectPlaceRef.current = onSelectPlace;
    onOpenDetailRef.current = onOpenDetail;
    onSetCoordsRef.current = onSetCoords;
  }, [arming, selectedId, onSelectPlace, onOpenDetail, onSetCoords]);

  // 地図の初期化（マウント時に一度だけ）。
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, { worldCopyJump: true }).setView([36, 138], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersRef.current = layer;

    // 武装中の地図クリック = 選択中の場所に座標を設定。
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!armingRef.current) return;
      onSetCoordsRef.current(e.latlng.lat, e.latlng.lng);
      setArming(false);
    });

    // ペイン幅のドラッグや Pane 4 開閉でサイズが変わると表示が崩れるため追従させる。
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      // StrictMode の再マウントや詳細⇄地図の往復で、新しい地図インスタンスにも
      // 初回フィットが効くようにリセットする。
      didFitRef.current = false;
    };
  }, []);

  // 武装中はカーソルを十字に。Esc で解除できるようにする。
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.style.cursor = arming ? "crosshair" : "";
    if (!arming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArming(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arming]);

  // 選択中ピンの強調スタイル（選択変更時はこれだけ更新し、ピンは作り直さない）。
  const applySelectionStyle = (
    marker: L.CircleMarker,
    selected: boolean,
    colors: { border: string; ring: string },
  ) => {
    marker.setStyle({
      weight: selected ? 3 : 2,
      color: selected ? colors.ring : colors.border,
    });
    marker.setRadius(selected ? 10 : 7);
  };

  // ピンの描画（places の変化でのみ描き直す）。
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;

    const colors = { border: cssVar("--background"), ring: cssVar("--ring") };

    layer.clearLayers();
    markerByIdRef.current.clear();
    for (const p of places) {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        weight: 2,
        color: colors.border,
        fillColor: cssVar(STAGE_CHART_VAR[p.stage]),
        fillOpacity: 0.9,
      }).addTo(layer);
      applySelectionStyle(marker, p.id === selectedIdRef.current, colors);
      markerByIdRef.current.set(p.id, marker);

      // ポップアップは Leaflet 管理の DOM なので、ここだけ素の DOM 組み立てで作る
      // （React ポータルは過剰。クラスは Tailwind のセマンティックトークンを使う）。
      const content = document.createElement("div");
      content.className = "flex flex-col gap-1";
      const title = document.createElement("div");
      title.className = "text-sm font-semibold text-foreground";
      title.textContent = p.name;
      const stage = document.createElement("div");
      stage.className = "text-xs text-muted-foreground";
      stage.textContent = STAGE_LABELS[p.stage];
      const open = document.createElement("button");
      open.type = "button";
      open.className =
        "self-start text-xs font-medium text-primary underline underline-offset-2";
      open.textContent = "詳細を見る";
      open.addEventListener("click", () => {
        onSelectPlaceRef.current(p.id);
        onOpenDetailRef.current();
        map.closePopup();
      });
      content.append(title, stage, open);

      marker.bindPopup(content, { closeButton: true });
      marker.on("click", () => onSelectPlaceRef.current(p.id));
    }

    // 初回だけ全ピンが収まるようにズームを合わせる（以後はユーザーの視点を尊重）。
    // animate:false 必須: ResizeObserver の初回発火（invalidateSize）がフィットの
    // アニメーションを中断し、中途半端なズームで止まるのを防ぐ。
    if (!didFitRef.current && places.length > 0) {
      didFitRef.current = true;
      map.invalidateSize();
      map.fitBounds(
        L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [40, 40], maxZoom: 10, animate: false },
      );
    }
  }, [places]);

  // 選択の変化はスタイル更新のみ（ピンを作り直すとポップアップが閉じてしまうため）。
  useEffect(() => {
    const colors = { border: cssVar("--background"), ring: cssVar("--ring") };
    for (const [id, marker] of markerByIdRef.current) {
      applySelectionStyle(marker, id === selectedId, colors);
    }
  }, [selectedId]);

  const missingCount = totalCount - places.length;
  const legendStages = useMemo(() => STAGE_ORDER, []);

  return (
    <div className="relative h-full min-h-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/* 位置設定ボタン（Leaflet のズームコントロールと被らない右上に置く） */}
      <div className="absolute top-3 right-3 z-[1000]">
        <Button
          variant={arming ? "default" : "outline"}
          size="sm"
          disabled={!activeName}
          onClick={() => setArming((v) => !v)}
          className="shadow-md"
        >
          <LocateFixed data-icon="inline-start" />
          {arming
            ? "地図をクリックして確定（Escで解除）"
            : `「${activeName || "—"}」の位置を設定`}
        </Button>
      </div>

      {/* レジェンド（ステージ色）と座標なし件数のヒント */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-md">
        {legendStages.map((stage) => (
          <div key={stage} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: `var(${STAGE_CHART_VAR[stage]})` }}
            />
            <span className="text-xs text-foreground">
              {STAGE_LABELS[stage]}
            </span>
          </div>
        ))}
        {missingCount > 0 && (
          <div className="mt-1 border-t border-border pt-1 text-[11px] text-muted-foreground">
            座標なし {missingCount} 件（ピン非表示）
          </div>
        )}
      </div>
    </div>
  );
}
