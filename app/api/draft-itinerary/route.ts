import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createRateLimiter, clientIp } from "@/lib/rate-limit";

// Google GenAI SDK は Node ランタイムで動かす（Edge 不可）。
export const runtime = "nodejs";

/**
 * AI 旅程案の生成 API（Google Gemini 版・発展課題）。
 *
 * 入力: { name: string; days: string; address?: string;
 *         budgetMin?: string; budgetMax?: string; companion?: string }
 * 出力: { itinerary: string } / { error: string }
 *
 * 規律は /api/draft-place と同じ:
 *   - API キーは環境変数（GEMINI_API_KEY）からのみ。サーバー側でのみ呼ぶ
 *   - IP ごとの簡易レート制限 + 入力長の上限（公開 URL のため）
 *   - エラー詳細はログのみに残し、クライアントには固定文言を返す
 */

// 日数はプロンプトに直接埋め込むため、自由入力ではなく許可リストで縛る。
// アフリカ縦断のような長期旅行にも対応（UI 側 ITINERARY_DAYS_OPTIONS と揃える）。
const ALLOWED_DAYS = [
  "日帰り",
  "1泊2日",
  "2泊3日",
  "3泊4日",
  "4泊5日",
  "6泊7日",
  "10日間",
  "2週間",
  "3週間",
  "1か月",
] as const;

const MAX_NAME_LEN = 200;
const MAX_ADDRESS_LEN = 300;
const MAX_COMPANION_LEN = 100;
const MAX_BUDGET_LEN = 20;

const isRateLimited = createRateLimiter(60_000, 6);

const SYSTEM_INSTRUCTION =
  "あなたは旅程プランナーです。指定された行き先と日数で、現実的な旅程案を日本語で作ってください。" +
  "各日を「1日目」「2日目」…の見出しで区切り、午前・午後・夜のざっくりした流れと、移動手段・食事のヒントを箇条書きで書いてください。" +
  "1週間を超える長期の場合は、数日をまとめて「3〜5日目: 〜」のように区切ってかまいません。" +
  "事実が不確かな固有名詞（店名・便名・料金など）は創作せず、「〜エリアで昼食」のような一般的な表現にとどめてください。" +
  "同行者や予算の情報があれば無理のない範囲で反映してください。" +
  "出力はプレーンテキストのみ（記号は改行と「・」程度）。全体で 800 字以内にまとめてください。";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY が未設定です。プロジェクト直下の .env.local に設定し、開発サーバーを再起動してください。",
      },
      { status: 500 },
    );
  }

  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。少し待ってから再度お試しください。" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(input.name);
  const days = str(input.days);
  const address = str(input.address);
  const budgetMin = str(input.budgetMin);
  const budgetMax = str(input.budgetMax);
  const companion = str(input.companion);

  if (!name) {
    return NextResponse.json(
      { error: "場所名がありません。" },
      { status: 400 },
    );
  }
  if (!(ALLOWED_DAYS as readonly string[]).includes(days)) {
    return NextResponse.json(
      { error: "日数の指定が不正です。" },
      { status: 400 },
    );
  }
  if (
    name.length > MAX_NAME_LEN ||
    address.length > MAX_ADDRESS_LEN ||
    companion.length > MAX_COMPANION_LEN ||
    budgetMin.length > MAX_BUDGET_LEN ||
    budgetMax.length > MAX_BUDGET_LEN
  ) {
    return NextResponse.json(
      { error: "入力が長すぎます。" },
      { status: 400 },
    );
  }

  const lines = [
    `行き先: ${name}`,
    `日数: ${days}`,
    address && `所在地: ${address}`,
    (budgetMin || budgetMax) &&
      `予算の目安: ${budgetMin || "?"}〜${budgetMax || "?"} 万円`,
    companion && `同行者: ${companion}`,
  ].filter(Boolean);

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: lines.join("\n"),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    // プレーンテキスト指示でも Markdown の太字(**)が混ざることがあるため除去する。
    const itinerary = (response.text ?? "").trim().replace(/\*\*/g, "");
    if (!itinerary) {
      return NextResponse.json(
        { error: "AI の出力が空でした。もう一度お試しください。" },
        { status: 502 },
      );
    }
    return NextResponse.json({ itinerary });
  } catch (err) {
    // 内部エラーの詳細はサーバーログのみに残し、クライアントには固定文言を返す。
    console.error("[draft-itinerary] generateContent failed:", err);
    return NextResponse.json(
      { error: "AI の呼び出しに失敗しました。時間をおいて再度お試しください。" },
      { status: 502 },
    );
  }
}
