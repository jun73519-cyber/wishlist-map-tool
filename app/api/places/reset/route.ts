import { NextResponse } from "next/server";
import { resetPlaces } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/places/reset
 * DB の場所をすべて消し、初期サンプル（data/candidates.json）に戻す。
 * 「サンプルデータに戻す」ボタンから呼ばれる。
 */
export async function POST() {
  try {
    const places = await resetPlaces();
    return NextResponse.json(places);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "サンプルへのリセットに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
