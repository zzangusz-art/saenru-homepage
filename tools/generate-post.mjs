// 세느루 블로그 자동 발행기
// 사용법:
//   node tools/generate-post.mjs --seed tools/seed-posts.json  # 시드 글 일괄 발행(API 미사용)
//   node tools/generate-post.mjs --rebuild                     # posts.json으로 index/sitemap 재생성
//   node tools/generate-post.mjs                               # Claude API로 새 글 1편 생성·발행
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const BLOG = path.join(ROOT, "blog");
const POSTS_DIR = path.join(BLOG, "posts");
const POSTS_JSON = path.join(BLOG, "posts.json");

const SITE = "https://saenru.com";
const CATEGORIES = ["AI 트렌드", "AEO·GEO", "바이브 코딩", "AI 도구", "케이스 스터디"];

function todayKST() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()); // YYYY-MM-DD
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function loadPosts() {
  return fs.existsSync(POSTS_JSON) ? JSON.parse(fs.readFileSync(POSTS_JSON, "utf8")) : [];
}
function savePosts(posts) {
  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2) + "\n");
}
function readMinutes(html) {
  const chars = html.replace(/<[^>]+>/g, "").length;
  return Math.max(2, Math.round(chars / 500));
}

/* ---------------- 썸네일 SVG (브랜드 제너러티브) ---------------- */
function hashSeed(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function makeThumb(category, slug) {
  const seed = hashSeed(slug);
  // 시드 기반 배경 도트 (글마다 배치가 달라짐)
  let dots = "";
  for (let i = 0; i < 70; i++) {
    const x = (i * 149 + (seed % 977)) % 1200;
    const y = (i * 211 + ((seed >> 5) % 613)) % 630;
    const o = 0.05 + ((seed >> (i % 20)) % 10) / 100;
    const r = 2 + ((i + seed) % 3);
    dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="#97DBA0" opacity="${o.toFixed(2)}"/>`;
  }
  const rot = (seed % 21) - 10; // 모티프 미세 회전
  const MOTIFS = {
    "AI 트렌드": `
      <g stroke="#3EDC5B" stroke-width="9" fill="none" stroke-linecap="round">
        <path d="M 770 380 A 150 150 0 0 1 1070 380" opacity="0.35"/>
        <path d="M 810 380 A 110 110 0 0 1 1030 380" opacity="0.6"/>
        <path d="M 850 380 A 70 70 0 0 1 990 380" opacity="0.9"/>
      </g>
      <circle cx="920" cy="380" r="16" fill="#3EDC5B"/>
      <polyline points="760,300 840,250 900,270 1000,170 1060,190" stroke="#EAF6EC" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
      <path d="M 1060 190 l -34 -6 m 34 6 l -8 33" stroke="#EAF6EC" stroke-width="9" fill="none" stroke-linecap="round"/>`,
    "AEO·GEO": `
      <g stroke="#97DBA0" stroke-width="8" fill="none" opacity="0.9">
        <circle cx="880" cy="300" r="130"/>
        <ellipse cx="880" cy="300" rx="130" ry="50"/>
        <ellipse cx="880" cy="300" rx="50" ry="130"/>
      </g>
      <g transform="translate(990,150)">
        <rect x="0" y="0" width="190" height="120" rx="26" fill="#00AF1C"/>
        <path d="M 40 120 L 40 160 L 88 120 Z" fill="#00AF1C"/>
        <path d="M 50 62 l 28 28 l 60 -56" stroke="#04200C" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`,
    "바이브 코딩": `
      <g transform="rotate(${rot} 920 300)">
        <rect x="740" y="160" width="380" height="280" rx="24" fill="none" stroke="#97DBA0" stroke-width="8" opacity="0.85"/>
        <line x1="740" y1="222" x2="1120" y2="222" stroke="#97DBA0" stroke-width="8" opacity="0.85"/>
        <circle cx="778" cy="191" r="9" fill="#3EDC5B"/><circle cx="812" cy="191" r="9" fill="#97DBA0" opacity="0.6"/><circle cx="846" cy="191" r="9" fill="#97DBA0" opacity="0.35"/>
        <path d="M 830 280 l -46 46 l 46 46" stroke="#3EDC5B" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 1030 280 l 46 46 l -46 46" stroke="#3EDC5B" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="950" y1="270" x2="912" y2="382" stroke="#EAF6EC" stroke-width="12" stroke-linecap="round" opacity="0.9"/>
      </g>`,
    "AI 도구": `
      <g stroke="#97DBA0" stroke-width="7" opacity="0.8">
        <line x1="820" y1="220" x2="1000" y2="180"/><line x1="820" y1="220" x2="880" y2="390"/>
        <line x1="1000" y1="180" x2="1070" y2="330"/><line x1="880" y1="390" x2="1070" y2="330"/>
        <line x1="820" y1="220" x2="1070" y2="330"/>
      </g>
      <circle cx="820" cy="220" r="26" fill="#3EDC5B"/>
      <circle cx="1000" cy="180" r="20" fill="none" stroke="#EAF6EC" stroke-width="9"/>
      <circle cx="880" cy="390" r="20" fill="none" stroke="#EAF6EC" stroke-width="9"/>
      <circle cx="1070" cy="330" r="26" fill="#00AF1C"/>`,
    "케이스 스터디": `
      <g transform="rotate(${rot} 940 320)">
        <rect x="780" y="330" width="70" height="110" rx="12" fill="#97DBA0" opacity="0.55"/>
        <rect x="880" y="270" width="70" height="170" rx="12" fill="#3EDC5B" opacity="0.8"/>
        <rect x="980" y="200" width="70" height="240" rx="12" fill="#00AF1C"/>
        <path d="M 780 240 L 900 190 L 1000 140" stroke="#EAF6EC" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M 1000 140 l -36 -2 m 36 2 l -12 34" stroke="#EAF6EC" stroke-width="10" fill="none" stroke-linecap="round"/>
      </g>`,
  };
  const motif = MOTIFS[category] || MOTIFS["AI 트렌드"];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="${esc(category)} 썸네일">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#0C4A1E"/><stop offset="0.55" stop-color="#062A11"/><stop offset="1" stop-color="#04200C"/>
</linearGradient>
<radialGradient id="glow" cx="0.72" cy="0.42" r="0.65">
<stop offset="0" stop-color="#00AF1C" stop-opacity="0.28"/><stop offset="1" stop-color="#00AF1C" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="1200" height="630" fill="url(#g)"/>
<rect width="1200" height="630" fill="url(#glow)"/>
${dots}
${motif}
<text x="64" y="524" font-family="'IBM Plex Mono',Consolas,monospace" font-size="24" letter-spacing="8" fill="#52C868">SAENRU INSIGHT</text>
<text x="64" y="574" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="38" font-weight="700" fill="#EAF6EC">${esc(category)}</text>
</svg>
`;
}
function writeThumb(category, slug) {
  const dir = path.join(BLOG, "thumbs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.svg`), makeThumb(category, slug));
}

/* ---------------- 공통 조각 ---------------- */
const HEAD_COMMON = (depth) => `
<link rel="icon" href="/assets/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" href="/assets/logo-icon.png" sizes="512x512">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta name="theme-color" content="#062A11">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${depth}assets/blog.css">`;

const NAV = (depth) => `
<nav class="nav solid" aria-label="주 메뉴">
  <a class="nav-logo" href="${depth}"><img src="${depth}assets/logo-icon.png" alt="세느루 로고" width="34" height="34">세느루 <span class="en">SAENRU</span></a>
  <div class="nav-links">
    <a href="${depth}">홈</a>
    <a href="${depth}blog/">블로그</a>
    <a href="${depth}about/">소개</a>
    <a href="${depth}ai/">AI 컨설팅</a>
    <a class="nav-cta" href="${depth}#launch">LAUNCH 🚀</a>
  </div>
</nav>`;

const FOOTER = (depth) => `
<footer>
  <div class="wrap">
    <img src="${depth}assets/logo-icon.png" alt="세느루 심볼" width="40" height="40" style="border-radius:10px;margin-bottom:8px" loading="lazy">
    <div class="biz">
      법인명(상호): 세느루 · 대표자: 이재현 · 사업자등록번호: 698-25-01527<br>
      통신판매업 신고: 제2023-서울영등포-1610호 · 개인정보보호책임자: 이재현(dkdlslek1@naver.com)<br>
      전화: 0507-1369-7319 · 주소: 서울특별시 영등포구 디지털로53가길 9, 난아트빌 402호 (07421)
    </div>
    <div class="cr">© 2026 SAENRU. ALL RIGHTS RESERVED.</div>
  </div>
</footer>`;

/* ---------------- 포스트 페이지 ---------------- */
function renderPost(post, contentHTML, faq) {
  const url = `${SITE}/blog/posts/${post.slug}.html`;
  const faqHTML = (faq || []).map(f => `
      <details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join("");
  const faqLD = (faq || []).length ? `
<script type="application/ld+json">
${JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
  })}
<\/script>` : "";
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(post.summary)}">
<meta property="og:title" content="${esc(post.title)}">
<meta property="og:description" content="${esc(post.summary)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<link rel="canonical" href="${url}">${HEAD_COMMON("../../")}
<title>${esc(post.title)} — 세느루 인사이트</title>
</head>
<body>
${NAV("../../")}
<main class="post-main">
  <article class="wrap-narrow">
    <header class="post-head">
      <div class="post-meta"><a class="cat" href="../">${esc(post.category)}</a><time datetime="${post.date}">${post.date}</time><span>${post.readMin}분 읽기</span></div>
      <h1>${esc(post.title)}</h1>
      <p class="post-summary">${esc(post.summary)}</p>
    </header>
    <img class="post-thumb" src="../thumbs/${post.slug}.svg" alt="${esc(post.category)} 대표 이미지" width="1200" height="630">
    <div class="prose">
${contentHTML}
    </div>${faqHTML ? `
    <section class="post-faq">
      <h2>자주 묻는 질문</h2>
      <div class="faq">${faqHTML}
      </div>
    </section>` : ""}
    <aside class="post-cta">
      <div>
        <div class="mono-path">SAENRU INSIGHT</div>
        <b>AI 검색 시대, 당신의 브랜드는 준비됐나요?</b>
        <p>세느루의 AEO·GEO 진단 리포트로 ChatGPT가 당신의 브랜드를 뭐라고 답하는지 확인하세요.</p>
      </div>
      <a class="btn btn-primary" href="../../ai/">AI 컨설팅 보기</a>
    </aside>
    <p class="back-link"><a href="../">← 인사이트 목록으로</a></p>
  </article>
</main>
${FOOTER("../../")}
<script type="application/ld+json">
${JSON.stringify({
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: post.title, description: post.summary, datePublished: post.date, dateModified: post.date,
    inLanguage: "ko", url,
    image: `${SITE}/assets/og-image.png`,
    author: { "@type": "Organization", name: "세느루", url: SITE },
    publisher: { "@type": "Organization", name: "세느루", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-stacked.png` } },
    mainEntityOfPage: url
  })}
<\/script>${faqLD}
</body>
</html>
`;
}

/* ---------------- 인덱스 페이지 ---------------- */
function renderIndex(posts) {
  const cats = [...new Set(posts.map(p => p.category))];
  const chips = [`<button class="chip on" data-cat="all" type="button">전체</button>`]
    .concat(cats.map(c => `<button class="chip" data-cat="${esc(c)}" type="button">${esc(c)}</button>`)).join("\n      ");
  const cards = posts.map(p => `
      <a class="card" data-cat="${esc(p.category)}" href="posts/${p.slug}.html">
        <img class="card-thumb" src="thumbs/${p.slug}.svg" alt="" loading="lazy" width="1200" height="630">
        <div class="card-meta"><span class="cat">${esc(p.category)}</span><time datetime="${p.date}">${p.date}</time></div>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.summary)}</p>
        <span class="more">${p.readMin}분 읽기 →</span>
      </a>`).join("");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="세느루 인사이트 — AI 트렌드, AEO·GEO, 바이브 코딩에 대한 실전 인사이트를 매일 발행합니다.">
<meta property="og:title" content="세느루 인사이트 — AI 트렌드 블로그">
<meta property="og:description" content="AI 트렌드, AEO·GEO, 바이브 코딩 실전 인사이트. 매일 발행.">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/blog">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<link rel="canonical" href="${SITE}/blog/">${HEAD_COMMON("../")}
<title>세느루 인사이트 — AI 트렌드 블로그</title>
</head>
<body>
${NAV("../")}
<header class="blog-hero">
  <div class="wrap">
    <div class="eyebrow">SAENRU INSIGHT · AI PUBLISHING PIPELINE</div>
    <h1>세느루 인사이트</h1>
    <p class="sub">AI 트렌드, AEO·GEO, 바이브 코딩 — 빌더에게 필요한 인사이트를 세느루의 AI 파이프라인이 매일 발행합니다. 이 블로그 자체가 세느루가 파는 자동화의 데모입니다.</p>
  </div>
</header>
<main class="sec-blog">
  <div class="wrap">
    <div class="chips" role="group" aria-label="카테고리 필터">
      ${chips}
    </div>
    <div class="card-grid" id="grid">${cards}
    </div>
  </div>
</main>
${FOOTER("../")}
<script type="application/ld+json">
${JSON.stringify({
    "@context": "https://schema.org", "@type": "Blog",
    name: "세느루 인사이트", url: `${SITE}/blog/`, inLanguage: "ko",
    description: "AI 트렌드, AEO·GEO, 바이브 코딩 실전 인사이트 블로그",
    publisher: { "@type": "Organization", name: "세느루", url: SITE },
    blogPost: posts.slice(0, 10).map(p => ({
      "@type": "BlogPosting", headline: p.title, datePublished: p.date,
      url: `${SITE}/blog/posts/${p.slug}.html`
    }))
  })}
<\/script>
<script>
(function(){
"use strict";
var chips=document.querySelectorAll(".chip");
chips.forEach(function(ch){
  ch.addEventListener("click",function(){
    chips.forEach(function(c){c.classList.remove("on");});
    ch.classList.add("on");
    var cat=ch.dataset.cat;
    document.querySelectorAll(".card").forEach(function(p){
      p.style.display=(cat==="all"||p.dataset.cat===cat)?"":"none";
    });
  });
});
})();
<\/script>
</body>
</html>
`;
}

/* ---------------- sitemap ---------------- */
function renderSitemap(posts) {
  const staticUrls = [
    { loc: `${SITE}/`, prio: "1.0", freq: "daily" },
    { loc: `${SITE}/ai/`, prio: "0.9", freq: "monthly" },
    { loc: `${SITE}/about/`, prio: "0.8", freq: "monthly" },
    { loc: `${SITE}/blog/`, prio: "0.9", freq: "daily" },
  ];
  const today = todayKST();
  const items = staticUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.prio}</priority>
  </url>`).concat(posts.map(p => `  <url>
    <loc>${SITE}/blog/posts/${p.slug}.html</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

/* ---------------- 발행 ---------------- */
function publish(entry, contentHTML, faq) {
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  const posts = loadPosts();
  if (posts.some(p => p.slug === entry.slug)) throw new Error(`slug 중복: ${entry.slug}`);
  writeThumb(entry.category, entry.slug);
  fs.writeFileSync(path.join(POSTS_DIR, `${entry.slug}.html`), renderPost(entry, contentHTML, faq));
  posts.unshift(entry);
  savePosts(posts);
  rebuild(posts);
  console.log(`발행 완료: /blog/posts/${entry.slug}.html — ${entry.title}`);
}
function rebuild(posts = loadPosts()) {
  fs.writeFileSync(path.join(BLOG, "index.html"), renderIndex(posts));
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), renderSitemap(posts));
  console.log(`index/sitemap 재생성 (${posts.length}편)`);
}

/* ---------------- Claude API 생성 ---------------- */
async function generateWithClaude() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const posts = loadPosts();
  const recent = posts.slice(0, 20).map(p => `- ${p.title}`).join("\n") || "(없음)";
  const date = todayKST();

  const prompt = `당신은 한국의 AI 빌더 플랫폼 '세느루'의 블로그 필자입니다. 오늘(${date}) 발행할 AI 트렌드 인사이트 글을 1편 작성하세요.

규칙:
- 주제: 요즘 AI 업계 트렌드 중 하나. 스타트업/1인 빌더/중소사업자 독자에게 실용적인 것.
- 최근 발행 글과 주제가 겹치면 안 됨:
${recent}
- 카테고리는 다음 중 하나: ${CATEGORIES.join(", ")}
- 분량: 본문 1,800~2,600자 (한국어)
- AEO 최적화 필수: 질문형 <h2> 소제목 2~3개, 각 소제목 바로 아래 2~3문장의 직답 문단(BLUF), <ul> 또는 <ol> 리스트 1개 이상, 구체적 예시.
- 확신할 수 없는 통계·수치는 쓰지 말 것. 회사명·제품명은 실재하는 것만.
- 본문 html은 <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong> 태그만 사용.

아래 JSON 형식으로만 답하세요 (코드펜스 없이 순수 JSON):
{
  "title": "글 제목 (질문형이면 더 좋음, 40자 이내)",
  "slug": "english-url-slug-with-hyphens",
  "category": "카테고리",
  "summary": "요약 한 문장 (80자 이내)",
  "html": "<p>...</p><h2>...</h2>...",
  "faq": [{"q":"질문","a":"두세 문장 답변"},{"q":"...","a":"..."},{"q":"...","a":"..."}]
}`;

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });
  const response = await stream.finalMessage();
  if (response.stop_reason === "refusal") throw new Error("모델이 요청을 거절했습니다 (refusal)");
  let text = "";
  for (const block of response.content) if (block.type === "text") text += block.text;
  const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const data = JSON.parse(jsonStr);

  if (!CATEGORIES.includes(data.category)) data.category = "AI 트렌드";
  let slug = `${date}-${String(data.slug || "post").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}`;
  const entry = {
    slug, date, title: data.title, category: data.category,
    summary: data.summary, readMin: readMinutes(data.html),
  };
  publish(entry, data.html, data.faq);
}

/* ---------------- main ---------------- */
const args = process.argv.slice(2);
if (args[0] === "--rebuild") {
  rebuild();
} else if (args[0] === "--thumbs") {
  // 백필: 모든 글의 썸네일 생성 + 기존 포스트 HTML에 이미지 삽입 + index 재생성
  const posts = loadPosts();
  for (const p of posts) {
    writeThumb(p.category, p.slug);
    const file = path.join(POSTS_DIR, `${p.slug}.html`);
    let html = fs.readFileSync(file, "utf8");
    if (!html.includes("post-thumb")) {
      html = html.replace("</header>", `</header>\n    <img class="post-thumb" src="../thumbs/${p.slug}.svg" alt="${esc(p.category)} 대표 이미지" width="1200" height="630">`);
      fs.writeFileSync(file, html);
      console.log(`이미지 삽입: ${p.slug}`);
    }
  }
  rebuild(posts);
} else if (args[0] === "--seed") {
  const seeds = JSON.parse(fs.readFileSync(path.resolve(args[1]), "utf8"));
  for (const s of seeds) {
    const entry = {
      slug: s.slug, date: s.date || todayKST(), title: s.title, category: s.category,
      summary: s.summary, readMin: readMinutes(s.html),
    };
    publish(entry, s.html, s.faq);
  }
} else {
  await generateWithClaude();
}
