import type { RoadmapPhase } from "@/lib/simulation/roadmap";

interface RoadmapProps {
  phases: RoadmapPhase[];
}

export function Roadmap({ phases }: RoadmapProps) {
  if (phases.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        우선 과제가 없어 로드맵을 생성하지 않았습니다.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">30/60/90일 실행 로드맵</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {phases.map((phase) => (
          <div key={phase.days} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{phase.label}</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-600 dark:text-zinc-300">
              {phase.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
