"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NormalizedReviewRow } from "@/types/normalized";
import type { DateRange } from "@/lib/metrics/period";
import {
  buildReviewNarrative,
  computeNegativeKeywords,
  computePositiveKeywords,
  computeProductProblems,
  computeRatingDistribution,
  computeReviewSummary,
  filterReviewsByRange,
  summarizeReviewKeywordInsights,
  type KeywordFrequency,
} from "@/lib/analysis/reviews";
import { formatByUnit } from "./format";

interface ReviewsDetailProps {
  rows: NormalizedReviewRow[];
  range: DateRange;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

interface AiInsightSection {
  title: string;
  body: string;
}

function parseAiInsightSections(text: string): AiInsightSection[] {
  const parts = text.split(/^##\s+/m).filter((part) => part.trim().length > 0);
  if (parts.length === 0) return [{ title: "GPT 심층 분석 결과", body: text.trim() }];
  return parts.map((part) => {
    const [firstLine, ...rest] = part.split("\n");
    return { title: firstLine.trim(), body: rest.join("\n").trim() };
  });
}

function KeywordChip({ item, tone }: { item: KeywordFrequency; tone: "positive" | "negative" }) {
  const toneClass =
    tone === "positive"
      ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300";
  return (
    <span
      title={item.examples.join("\n\n")}
      className={`inline-flex cursor-help items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      {item.word}
      <span className="opacity-60">{item.count}</span>
    </span>
  );
}

export function ReviewsDetail({ rows, range }: ReviewsDetailProps) {
  const inRange = filterReviewsByRange(rows, range);
  const summary = computeReviewSummary(inRange);
  const distribution = computeRatingDistribution(inRange);
  const problems = computeProductProblems(inRange, 2);
  const positiveKeywords = computePositiveKeywords(inRange, 12);
  const negativeKeywords = computeNegativeKeywords(inRange, 12);
  const keywordInsights = summarizeReviewKeywordInsights(positiveKeywords, negativeKeywords);
  const narrative = buildReviewNarrative(summary, positiveKeywords, negativeKeywords, problems);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleAiAnalysis() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/review-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviews: inRange.map((r) => ({ rating: r.rating, content: r.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "분석 요청에 실패했습니다.");
        return;
      }
      setAiInsight(data.insight);
    } catch {
      setAiError("네트워크 오류로 분석 요청에 실패했습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="리뷰 수" value={formatByUnit(summary.count, "count")} />
        <StatTile label="평균 평점" value={summary.averageRating !== null ? summary.averageRating.toFixed(2) : "-"} />
        <StatTile label="1~3점 비중" value={formatByUnit(summary.lowRatingShare, "ratio")} />
        <StatTile label="포토리뷰 비중" value={formatByUnit(summary.photoShare, "ratio")} />
        <StatTile label="답글률" value={formatByUnit(summary.replyRate, "ratio")} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">평점 분포</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563EB" name="리뷰 수" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {summary.averageReplyDays !== null && (
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            평균 답글 소요일: {summary.averageReplyDays.toFixed(1)}일
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">고객 후기 키워드 분석</p>
        <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
          평점 4~5점을 좋은 후기, 1~3점을 안좋은 후기로 나누어 자주 등장한 단어를 집계했습니다. 단어에 마우스를
          올리면 실제 리뷰 예시를 볼 수 있습니다. 빈도 집계일 뿐이며 원인을 확정하지 않습니다.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-green-700 dark:text-green-400">좋은 후기에서 자주 나온 단어</p>
            <div className="flex flex-wrap gap-2">
              {positiveKeywords.length > 0 ? (
                positiveKeywords.map((k) => <KeywordChip key={k.word} item={k} tone="positive" />)
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">데이터 없음</p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-red-700 dark:text-red-400">안좋은 후기에서 자주 나온 단어</p>
            <div className="flex flex-wrap gap-2">
              {negativeKeywords.length > 0 ? (
                negativeKeywords.map((k) => <KeywordChip key={k.word} item={k} tone="negative" />)
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">후기 기반 강화·보완 포인트</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-green-700 dark:text-green-400">강화할 점</p>
            {keywordInsights.strengths.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-600 dark:text-zinc-300">
                {keywordInsights.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">분석할 좋은 후기가 충분하지 않습니다.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-red-700 dark:text-red-400">보완할 점</p>
            {keywordInsights.improvements.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-600 dark:text-zinc-300">
                {keywordInsights.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">분석할 안좋은 후기가 충분하지 않습니다.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">종합 진단</p>
        <div className="space-y-3">
          {narrative.paragraphs.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              선택한 기간의 리뷰 원문(평점 포함, 최대 {"400"}건)을 OpenAI API로 전송해 우수 후기·불만 후기를 각각 분석하고
              종합 인사이트를 받아볼 수 있습니다. 작성자 정보나 주문번호는 애초에 수집하지 않으므로 전송되지 않습니다.
            </p>
            <button
              type="button"
              onClick={handleAiAnalysis}
              disabled={aiLoading}
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {aiLoading ? "분석 중..." : "AI 심층 분석 받기 (GPT)"}
            </button>
          </div>

          {aiError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{aiError}</p>}

          {aiInsight && (
            <div className="mt-3 space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
              {parseAiInsightSections(aiInsight).map((section, i) => (
                <div key={i}>
                  <p className="mb-1 text-xs font-semibold text-blue-700 dark:text-blue-300">{section.title}</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                    {section.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <p className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
          평점이 낮은 상품과 저평점 리뷰에서 자주 등장한 단어입니다. 빈도 집계일 뿐 원인을 확정하지 않으니, 실제 리뷰
          원문을 확인해 판단해 주세요.
        </p>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-2">상품명</th>
              <th className="px-3 py-2">리뷰 수</th>
              <th className="px-3 py-2">평균 평점</th>
              <th className="px-3 py-2">1~3점 수</th>
              <th className="px-3 py-2">자주 등장한 단어</th>
            </tr>
          </thead>
          <tbody>
            {problems.slice(0, 10).map((p) => (
              <tr key={p.productId} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{p.productName}</td>
                <td className="px-3 py-2">{p.reviewCount}</td>
                <td className="px-3 py-2">{p.averageRating !== null ? p.averageRating.toFixed(2) : "-"}</td>
                <td className="px-3 py-2">{p.lowRatingCount}</td>
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                  {p.topComplaintWords.length > 0 ? p.topComplaintWords.join(", ") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
