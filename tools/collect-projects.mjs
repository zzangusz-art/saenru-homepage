// GitHub 검색 API로 카테고리별 레퍼런스 수집 → data/projects.json
// 사용법: node tools/collect-projects.mjs   (gh CLI 인증 필요)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 15개 카테고리: [key, 표시명, 이모지, 검색 쿼리(2개까지)]
const CATS = [
  ["agent", "AI 에이전트", "🤖", ["topic:ai-agents stars:>300", "topic:autonomous-agents stars:>200"]],
  ["llm", "LLM 도구", "🧠", ["topic:llm stars:>1500"]],
  ["genai", "생성형 이미지·영상", "🎨", ["topic:stable-diffusion stars:>500", "topic:text-to-video stars:>200"]],
  ["chat", "챗봇·어시스턴트", "💬", ["topic:chatbot stars:>800", "topic:chatgpt stars:>1500"]],
  ["auto", "자동화·워크플로", "⚙️", ["topic:automation stars:>800", "topic:workflow stars:>800"]],
  ["dev", "개발자 도구", "🛠️", ["topic:developer-tools stars:>1500"]],
  ["web", "웹 프레임워크", "🌐", ["topic:web-framework stars:>500", "topic:frontend stars:>3000"]],
  ["nocode", "노코드·로우코드", "🧩", ["topic:no-code stars:>300", "topic:low-code stars:>300"]],
  ["data", "데이터·분석", "📊", ["topic:data-visualization stars:>1000", "topic:analytics stars:>1500"]],
  ["voice", "음성·오디오", "🎙️", ["topic:speech-recognition stars:>300", "topic:text-to-speech stars:>300"]],
  ["rag", "검색·RAG", "🔎", ["topic:rag stars:>300", "topic:vector-database stars:>300"]],
  ["prod", "생산성", "✅", ["topic:productivity stars:>800"]],
  ["sec", "보안·프라이버시", "🔐", ["topic:security stars:>2000"]],
  ["selfhost", "셀프호스팅 앱", "📦", ["topic:self-hosted stars:>1000"]],
  ["learn", "학습·리소스", "📚", ["topic:awesome-list stars:>2000"]],
];

function ghSearch(q, page = 1) {
  const out = execFileSync("gh", [
    "api", "-X", "GET", "search/repositories",
    "-f", `q=${q}`, "-f", "sort=stars", "-f", "order=desc",
    "-f", "per_page=100", "-f", `page=${page}`,
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out).items || [];
}

const seen = new Set();
const all = [];
for (const [key, label, emoji, queries] of CATS) {
  let count = 0;
  for (const q of queries) {
    let items = [];
    try { items = ghSearch(q); } catch (e) { console.error("query 실패:", q, e.message); }
    for (const it of items) {
      if (seen.has(it.full_name)) continue;
      if (!it.description) continue;
      seen.add(it.full_name);
      all.push({
        n: it.name,
        f: it.full_name,
        d: String(it.description).slice(0, 140),
        s: it.stargazers_count,
        l: it.language || "",
        u: it.html_url,
        c: key,
      });
      count++;
    }
    // rate limit 완화
    await new Promise(r => setTimeout(r, 2500));
  }
  console.log(`${label}: ${count}개 (누적 ${all.length})`);
}

// 전체 후보 반영 (star 내림차순)
all.sort((a, b) => b.s - a.s);
const dataset = all;

const meta = {
  collectedAt: new Date().toISOString().slice(0, 10),
  source: "GitHub Search API (stars 기준 스냅샷)",
  total: dataset.length,
  categories: CATS.map(([key, label, emoji]) => ({ key, label, emoji })),
};
fs.writeFileSync(path.join(ROOT, "data", "projects.json"), JSON.stringify({ meta, items: dataset }));
console.log(`저장 완료: data/projects.json — ${dataset.length}개`);
