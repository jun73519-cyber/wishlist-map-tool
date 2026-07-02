import { describe, it, expect } from "vitest";

import { type Candidate, type Scorecard } from "@/lib/schema";
import {
  calculateAverageScore,
  getCandidateAverageScore,
  getCommentedScorecards,
  getLatestDoneScorecard,
  getScorecardsAverageScore,
} from "@/lib/computed/scorecards";

const baseScorecard = (over: Partial<Scorecard>): Scorecard => ({
  stage: "screening",
  label: "気になる",
  date: "",
  format: "",
  interviewer: "",
  axisScores: {
    wishLevel: null,
  },
  attachments: [],
  ...over,
});

describe("calculateAverageScore", () => {
  it("全フィールドが null なら null", () => {
    expect(
      calculateAverageScore({
        wishLevel: null,
      }),
    ).toBeNull();
  });

  it("値が入っていればその値を返す", () => {
    expect(
      calculateAverageScore({
        wishLevel: 4,
      }),
    ).toBe(4);
  });
});

describe("getLatestDoneScorecard", () => {
  it("現在位置より先のステージしか無ければ undefined", () => {
    const cards = [
      baseScorecard({ stage: "first", date: "2026-04-01" }),
      baseScorecard({ stage: "second" }),
    ];
    expect(getLatestDoneScorecard(cards, "screening")).toBeUndefined();
  });

  it("配列末尾に近い done（現在位置以前）を返す", () => {
    const cards = [
      baseScorecard({ stage: "screening", date: "2026-04-01" }),
      baseScorecard({ stage: "first", date: "2026-04-10" }),
      baseScorecard({ stage: "second", date: "2026-04-20" }),
    ];
    // 現在位置が「計画中(first)」なら screening / first が done → 末尾に近い first
    const latest = getLatestDoneScorecard(cards, "first");
    expect(latest?.stage).toBe("first");
  });
});

describe("getCandidateAverageScore / getScorecardsAverageScore", () => {
  it("done scorecard が無ければ null", () => {
    const candidate: Candidate = {
      id: "c1",
      profile: {
        name: "テスト 太郎",
        birthday: "",
        source: "",
        email: "",
        phone: "",
        address: "",
        recruiter: "",
        desiredSalaryMin: "",
        desiredSalaryMax: "",
        availableStartDate: "",
        careerText: "",
        motivationFull: "",
      },
      scorecards: [],
      stage: "screening",
      area: "",
      archived: false,
    };
    expect(getCandidateAverageScore(candidate)).toBeNull();
    expect(getScorecardsAverageScore([], "screening")).toBeNull();
  });

  it("最新 done（現在位置以前）の axisScores を平均する", () => {
    const cards = [
      baseScorecard({
        stage: "screening",
        axisScores: {
          wishLevel: 5,
        },
      }),
      baseScorecard({
        stage: "first",
        axisScores: {
          wishLevel: 3,
        },
      }),
    ];
    expect(getScorecardsAverageScore(cards, "first")).toBe(3);
  });
});

describe("getCommentedScorecards", () => {
  it("done（現在位置以前）かつ comment 付きのみ STAGE_ORDER 順に返す", () => {
    const cards = [
      baseScorecard({
        stage: "first",
        comment: "前向き",
      }),
      baseScorecard({
        stage: "screening",
        comment: "下調べ済み",
      }),
      baseScorecard({
        stage: "second",
        date: "2026-05-01",
        comment: "未確定だが期待",
      }),
    ];
    // 現在位置が first なら second はまだ done でない
    const result = getCommentedScorecards(cards, "first");
    expect(result.map((c) => c.stage)).toEqual(["screening", "first"]);
  });
});
