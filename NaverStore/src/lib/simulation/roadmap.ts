import type { Insight } from "@/types/insight";

export interface RoadmapPhase {
  days: 30 | 60 | 90;
  label: string;
  items: string[];
}

/**
 * Builds a 3-phase action plan grounded in the actual TOP-priority insights'
 * own action/title text — no fabricated projections or invented milestones,
 * consistent with design doc 3.5's ban on unfounded claims.
 */
export function buildRoadmap(insights: Insight[]): RoadmapPhase[] {
  const top = insights.slice(0, 3);
  if (top.length === 0) return [];

  return [
    {
      days: 30,
      label: "30일: 즉시 실행",
      items: top.map((i) => i.action),
    },
    {
      days: 60,
      label: "60일: 효과 점검·조정",
      items: top.map((i) => `"${i.title}" 관련 조치의 효과를 KPI로 점검하고, 개선이 없다면 대안을 검토하세요.`),
    },
    {
      days: 90,
      label: "90일: 재평가",
      items: [
        "종합 건강도와 KPI 점수를 다시 계산해 다음 우선 과제를 선정하세요.",
        "이번 기간의 시나리오 가정과 실제 결과를 비교해 다음 시나리오의 가정치를 조정하세요.",
      ],
    },
  ];
}
