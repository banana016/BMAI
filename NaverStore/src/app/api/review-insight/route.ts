import { NextResponse } from "next/server";

interface ReviewInput {
  rating: number | null;
  content: string | null;
}

interface ReviewInsightRequestBody {
  reviews: ReviewInput[];
}

// Keeps the prompt (and cost) bounded even for stores with thousands of reviews
// in the selected range. gpt-4o-mini's context window comfortably fits this.
const MAX_REVIEWS = 400;

function buildPrompt(reviews: ReviewInput[]): string {
  const usable = reviews.filter((r) => r.content && r.content.trim().length > 0);
  const truncated = usable.length > MAX_REVIEWS;
  const sample = truncated ? usable.slice(0, MAX_REVIEWS) : usable;

  const lines = sample.map((r, i) => `${i + 1}. [평점 ${r.rating ?? "미상"}] ${r.content}`).join("\n");

  const truncationNote = truncated
    ? `\n(참고: 선택 기간 리뷰가 ${usable.length}건으로 많아 이 중 최근 ${MAX_REVIEWS}건만 분석에 사용했습니다.)`
    : "";

  return `너는 네이버 스마트스토어 판매자를 위한 리뷰 분석 컨설턴트다. 아래는 한 스토어의 특정 기간 고객 후기 원문 목록이다(평점과 본문). 이 원문 데이터만 근거로 삼아 분석하고, 데이터에 없는 내용을 지어내지 마라.

[리뷰 원문 목록] (총 ${sample.length}건)${truncationNote}
${lines}

아래 형식 그대로, 한국어로 작성하라. 각 섹션은 실제 리뷰 내용에 근거해 구체적으로 작성하고, 상품명·특징이 반복 언급되면 함께 적어라.

## 우수 후기 인사이트
평점이 높은(4~5점) 후기들에서 반복적으로 나타나는 고객 만족 요인을 분석하라.

## 불만 후기 인사이트
평점이 낮은(1~3점) 후기들에서 반복적으로 나타나는 불만 요인을 분석하라.

## 종합 인사이트
위 두 분석을 종합해, 스토어 운영자가 바로 참고할 수 있도록 강화할 점과 보완할 점을 구체적이고 실행 가능한 제안으로 정리하라.`;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "서버에 OPENAI_API_KEY가 설정되어 있지 않습니다." }, { status: 500 });
  }

  let body: ReviewInsightRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!body?.reviews || body.reviews.length === 0) {
    return NextResponse.json({ error: "분석할 리뷰 데이터가 없습니다." }, { status: 400 });
  }

  const prompt = buildPrompt(body.reviews);

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });
  } catch {
    return NextResponse.json({ error: "OpenAI API 호출 중 네트워크 오류가 발생했습니다." }, { status: 502 });
  }

  if (!upstream.ok) {
    const errorText = await upstream.text();
    return NextResponse.json({ error: `OpenAI API 오류: ${errorText.slice(0, 300)}` }, { status: 502 });
  }

  const data = await upstream.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: "OpenAI 응답에서 내용을 찾을 수 없습니다." }, { status: 502 });
  }

  return NextResponse.json({ insight: content });
}
