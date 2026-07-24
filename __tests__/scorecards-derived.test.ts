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
    const cards = [baseScorecard({ stage: "final", date: "2026-04-01" })];
    expect(getLatestDoneScorecard(cards, "screening")).toBeUndefined();
  });

  it("配列末尾に近い done（現在位置以前）を返す", () => {
    const cards = [
      baseScorecard({ stage: "screening", date: "2026-04-01" }),
      baseScorecard({ stage: "final", date: "2026-04-20" }),
    ];
    // 現在位置が「訪問済(final)」なら screening / final が done → 末尾に近い final
    const latest = getLatestDoneScorecard(cards, "final");
    expect(latest?.stage).toBe("final");
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
        stage: "final",
        axisScores: {
          wishLevel: 3,
        },
      }),
    ];
    expect(getScorecardsAverageScore(cards, "final")).toBe(3);
  });
});

describe("getCommentedScorecards", () => {
  it("done（現在位置以前）かつ comment 付きのみ STAGE_ORDER 順に返す", () => {
    const cards = [
      baseScorecard({
        stage: "final",
        date: "2026-05-01",
        comment: "行ってよかった",
      }),
      baseScorecard({
        stage: "screening",
        comment: "下調べ済み",
      }),
    ];
    // 現在位置が screening なら final はまだ done でない
    const result = getCommentedScorecards(cards, "screening");
    expect(result.map((c) => c.stage)).toEqual(["screening"]);
  });
});
