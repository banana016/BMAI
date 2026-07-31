"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NormalizedReviewRow } from "@/types/normalized";
import type { DateRange } from "@/lib/metrics/period";
import {
  computeProductProblems,
  computeRatingDistribution,
  computeReviewSummary,
  filterReviewsByRange,
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

export function ReviewsDetail({ rows, range }: ReviewsDetailProps) {
  const inRange = filterReviewsByRange(rows, range);
  const summary = computeReviewSummary(inRange);
  const distribution = computeRatingDistribution(inRange);
  const problems = computeProductProblems(inRange, 2);

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
