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

/* ---------------- 썸네일 SVG (600×600 프리미엄) ---------------- */
function hashSeed(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
/* 주제별 라인 아이콘 (골드 라인 + 민트 포인트, 중앙 -80..80 좌표계) */
const GOLD = "#D8C289", MINT = "#9FE3AE", IVORY = "#EDE7D4";
const ICONS = {
  video: { en: ["Video", "Creative"], svg: `
    <rect x="-62" y="-44" width="124" height="88" rx="14" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <path d="M -12 -22 L 26 0 L -12 22 Z" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="-46" cy="58" r="3" fill="${MINT}"/><circle cx="0" cy="58" r="3" fill="${MINT}" opacity="0.6"/><circle cx="46" cy="58" r="3" fill="${MINT}" opacity="0.3"/>` },
  voice: { en: ["Voice", "Interface"], svg: `
    <rect x="-15" y="-52" width="30" height="62" rx="15" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <path d="M -32 -4 A 32 32 0 0 0 32 -4" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>
    <line x1="0" y1="28" x2="0" y2="48" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>
    <line x1="-18" y1="48" x2="18" y2="48" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>
    <path d="M 46 -26 A 26 26 0 0 1 46 14" fill="none" stroke="${MINT}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
    <path d="M 58 -36 A 40 40 0 0 1 58 24" fill="none" stroke="${MINT}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>` },
  eval: { en: ["Quality", "Evaluation"], svg: `
    <rect x="-46" y="-56" width="92" height="112" rx="12" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <line x1="-26" y1="-28" x2="26" y2="-28" stroke="${GOLD}" stroke-width="3" stroke-linecap="round" opacity="0.65"/>
    <line x1="-26" y1="-6" x2="26" y2="-6" stroke="${GOLD}" stroke-width="3" stroke-linecap="round" opacity="0.65"/>
    <path d="M -22 26 l 14 14 l 30 -30" fill="none" stroke="${MINT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` },
  agent: { en: ["Agent", "Orchestration"], svg: `
    <circle cx="0" cy="-38" r="17" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <circle cx="-44" cy="34" r="13" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <circle cx="44" cy="34" r="13" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <line x1="-9" y1="-24" x2="-36" y2="22" stroke="${GOLD}" stroke-width="2.5" opacity="0.7"/>
    <line x1="9" y1="-24" x2="36" y2="22" stroke="${GOLD}" stroke-width="2.5" opacity="0.7"/>
    <circle cx="0" cy="-38" r="5" fill="${MINT}"/>` },
  cost: { en: ["Token", "Economics"], svg: `
    <ellipse cx="-6" cy="-30" rx="42" ry="15" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <path d="M -48 -30 V 8 c 0 8 19 15 42 15 c 23 0 42 -7 42 -15 V -30" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <path d="M -48 -11 c 0 8 19 15 42 15 c 23 0 42 -7 42 -15" fill="none" stroke="${GOLD}" stroke-width="2.5" opacity="0.6"/>
    <path d="M 46 40 l 12 12 l 12 -12 M 58 20 v 30" fill="none" stroke="${MINT}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` },
  data: { en: ["Data", "Connection"], svg: `
    <rect x="-70" y="-24" width="48" height="48" rx="10" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <rect x="22" y="-24" width="48" height="48" rx="10" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <line x1="-22" y1="0" x2="22" y2="0" stroke="${MINT}" stroke-width="3" stroke-dasharray="7 6"/>
    <circle cx="-46" cy="0" r="5" fill="${MINT}"/><circle cx="46" cy="0" r="5" fill="${MINT}"/>` },
  search: { en: ["AI", "Search"], svg: `
    <circle cx="-10" cy="-10" r="38" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <line x1="18" y1="18" x2="52" y2="52" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/>
    <path d="M -50 -52 l 4 10 l 10 4 l -10 4 l -4 10 l -4 -10 l -10 -4 l 10 -4 Z" fill="${MINT}" opacity="0.9"/>` },
  code: { en: ["Vibe", "Coding"], svg: `
    <path d="M -34 -26 L -62 0 L -34 26" fill="none" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 34 -26 L 62 0 L 34 26" fill="none" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="12" y1="-38" x2="-12" y2="38" stroke="${MINT}" stroke-width="3.5" stroke-linecap="round"/>` },
  chart: { en: ["Growth", "Metrics"], svg: `
    <line x1="-58" y1="52" x2="62" y2="52" stroke="${GOLD}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    <rect x="-46" y="8" width="20" height="44" rx="4" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <rect x="-8" y="-16" width="20" height="68" rx="4" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <rect x="30" y="-40" width="20" height="92" rx="4" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <path d="M -46 -34 L 2 -52 L 44 -60 M 44 -60 l -12 -2 m 12 2 l -4 11" fill="none" stroke="${MINT}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  globe: { en: ["Global", "Reach"], svg: `
    <circle cx="0" cy="0" r="52" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <ellipse cx="0" cy="0" rx="52" ry="20" fill="none" stroke="${GOLD}" stroke-width="2.5" opacity="0.7"/>
    <ellipse cx="0" cy="0" rx="20" ry="52" fill="none" stroke="${GOLD}" stroke-width="2.5" opacity="0.7"/>
    <circle cx="18" cy="-14" r="5" fill="${MINT}"/>` },
  chat: { en: ["Answer", "Engine"], svg: `
    <path d="M -56 -40 h 112 a 12 12 0 0 1 12 12 v 48 a 12 12 0 0 1 -12 12 h -70 l -26 22 v -22 h -16 a 12 12 0 0 1 -12 -12 v -48 a 12 12 0 0 1 12 -12 Z" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M -22 -4 l 14 14 l 30 -28" fill="none" stroke="${MINT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` },
  gear: { en: ["Auto", "Mation"], svg: `
    <circle cx="0" cy="0" r="34" fill="none" stroke="${GOLD}" stroke-width="3"/>
    <circle cx="0" cy="0" r="13" fill="none" stroke="${MINT}" stroke-width="3"/>
    <g stroke="${GOLD}" stroke-width="3" stroke-linecap="round">
      <line x1="0" y1="-44" x2="0" y2="-56"/><line x1="0" y1="44" x2="0" y2="56"/>
      <line x1="-44" y1="0" x2="-56" y2="0"/><line x1="44" y1="0" x2="56" y2="0"/>
      <line x1="-31" y1="-31" x2="-40" y2="-40"/><line x1="31" y1="31" x2="40" y2="40"/>
      <line x1="-31" y1="31" x2="-40" y2="40"/><line x1="31" y1="-31" x2="40" y2="-40"/>
    </g>` },
};
const ICON_KEYS = Object.keys(ICONS);
const CATEGORY_ICON = { "AI 트렌드": "search", "AEO·GEO": "chat", "바이브 코딩": "code", "AI 도구": "gear", "케이스 스터디": "chart" };
function makeThumb(post) {
  const seed = hashSeed(post.slug);
  const iconKey = ICONS[post.icon] ? post.icon : (CATEGORY_ICON[post.category] || "search");
  const icon = ICONS[iconKey];
  const en = Array.isArray(post.en) && post.en.length === 2 ? post.en : icon.en;
  const title = post.title.length > 26 ? post.title.slice(0, 25) + "…" : post.title;
  let dust = "";
  for (let i = 0; i < 14; i++) {
    const x = (i * 173 + (seed % 557)) % 600;
    const y = (i * 131 + ((seed >> 4) % 431)) % 600;
    dust += `<circle cx="${x}" cy="${y}" r="${1 + (i % 2)}" fill="${i % 3 ? GOLD : MINT}" opacity="0.06"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${esc(post.category)} 썸네일">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#10281A"/><stop offset="0.6" stop-color="#081810"/><stop offset="1" stop-color="#050F0A"/>
</linearGradient>
<radialGradient id="vig" cx="0.5" cy="0.42" r="0.75">
<stop offset="0.6" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.4"/>
</radialGradient>
<pattern id="tex" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<line x1="0" y1="0" x2="0" y2="7" stroke="#FFFFFF" stroke-opacity="0.028" stroke-width="1"/>
</pattern>
</defs>
<rect width="600" height="600" fill="url(#g)"/>
<rect width="600" height="600" fill="url(#tex)"/>
${dust}
<rect width="600" height="600" fill="url(#vig)"/>
<text x="300" y="84" text-anchor="middle" font-family="'IBM Plex Mono',Consolas,monospace" font-size="13" letter-spacing="7" fill="#B9C7B4" opacity="0.75">SAENRU INSIGHT</text>
<line x1="272" y1="104" x2="328" y2="104" stroke="${GOLD}" stroke-width="1" opacity="0.55"/>
<g transform="translate(300,235)">${icon.svg}
</g>
<text x="300" y="404" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="56" letter-spacing="2" fill="${IVORY}">${esc(en[0])}</text>
<text x="300" y="456" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-size="40" letter-spacing="1" fill="${GOLD}">${esc(en[1])}</text>
<text x="300" y="512" text-anchor="middle" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="17" fill="#CFDCCB" opacity="0.85">${esc(title)}</text>
<line x1="272" y1="542" x2="328" y2="542" stroke="${GOLD}" stroke-width="1" opacity="0.4"/>
<text x="300" y="570" text-anchor="middle" font-family="'IBM Plex Mono',Consolas,monospace" font-size="12" letter-spacing="5" fill="#8FA98F">${esc(post.category)}</text>
</svg>
`;
}
function writeThumb(post) {
  const dir = path.join(BLOG, "thumbs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${post.slug}.svg`), makeThumb(post));
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
    <a href="${depth}en/blog/" lang="en">EN</a>
    <a class="nav-cta" href="${depth}#launch">LAUNCH 🚀</a>
  </div>
</nav>`;

const NAV_EN = `
<nav class="nav solid" aria-label="Main navigation">
  <a class="nav-logo" href="/en/"><img src="/assets/logo-icon.png" alt="SAENRU logo" width="34" height="34">세느루 <span class="en">SAENRU</span></a>
  <div class="nav-links">
    <a href="/en/">Home</a>
    <a href="/en/blog/">Blog</a>
    <a href="/en/ai/">AI Search (AEO)</a>
    <a href="/blog/" lang="ko">한국어</a>
    <a class="nav-cta" href="/en/#contact">CONTACT</a>
  </div>
</nav>`;

const FOOTER_EN = `
<footer>
  <div class="wrap">
    <img src="/assets/logo-icon.png" alt="SAENRU symbol" width="40" height="40" style="border-radius:10px;margin-bottom:8px" loading="lazy">
    <div class="biz">
      SAENRU · CEO: Jaehyun Lee · Business Reg. No. 698-25-01527<br>
      402, 9 Digital-ro 53ga-gil, Yeongdeungpo-gu, Seoul 07421, Republic of Korea · +82-507-1369-7319
    </div>
    <div class="cr">© 2026 SAENRU. ALL RIGHTS RESERVED.</div>
  </div>
</footer>`;

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
<link rel="canonical" href="${url}">${post.enTitle ? `
<link rel="alternate" hreflang="ko" href="${url}">
<link rel="alternate" hreflang="en" href="${SITE}/blog/posts/${post.slug}-en.html">` : ""}${HEAD_COMMON("../../")}
<title>${esc(post.title)} — 세느루 인사이트</title>
</head>
<body>
${NAV("../../")}
<main class="post-main">
  <article class="wrap-narrow">
    <header class="post-head">
      <div class="post-meta"><a class="cat" href="../">${esc(post.category)}</a><time datetime="${post.date}">${post.date}</time><span>${post.readMin}분 읽기</span>${post.enTitle ? `<a class="cat" href="${post.slug}-en.html" hreflang="en">READ IN ENGLISH</a>` : ""}</div>
      <h1>${esc(post.title)}</h1>
      <p class="post-summary">${esc(post.summary)}</p>
    </header>
    <img class="post-thumb" src="../thumbs/${post.slug}.svg" alt="${esc(post.category)} 대표 이미지" width="600" height="600">
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

/* ---------------- 영어 포스트 페이지 ---------------- */
function renderPostEn(post, enHtml, enFaq) {
  const url = `${SITE}/blog/posts/${post.slug}-en.html`;
  const koUrl = `${SITE}/blog/posts/${post.slug}.html`;
  const faqHTML = (enFaq || []).map(f => `
      <details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join("");
  const faqLD = (enFaq || []).length ? `
<script type="application/ld+json">
${JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: enFaq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
  })}
<\/script>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(post.enSummary || post.enTitle)}">
<meta property="og:title" content="${esc(post.enTitle)}">
<meta property="og:description" content="${esc(post.enSummary || "")}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ko" href="${koUrl}">
<link rel="alternate" hreflang="en" href="${url}">${HEAD_COMMON("../../")}
<title>${esc(post.enTitle)} — SAENRU Insight</title>
</head>
<body>
${NAV_EN}
<main class="post-main">
  <article class="wrap-narrow">
    <header class="post-head">
      <div class="post-meta"><a class="cat" href="/en/blog/">${esc(post.category)}</a><time datetime="${post.date}">${post.date}</time><span>${post.readMin} min read</span><a class="cat" href="${post.slug}.html" hreflang="ko">한국어로 읽기</a></div>
      <h1>${esc(post.enTitle)}</h1>
      <p class="post-summary">${esc(post.enSummary || "")}</p>
    </header>
    <img class="post-thumb" src="../thumbs/${post.slug}.svg" alt="" width="600" height="600">
    <div class="prose">
${enHtml}
    </div>${faqHTML ? `
    <section class="post-faq">
      <h2>FAQ</h2>
      <div class="faq">${faqHTML}
      </div>
    </section>` : ""}
    <aside class="post-cta">
      <div>
        <div class="mono-path">SAENRU INSIGHT</div>
        <b>Is your brand visible in AI search?</b>
        <p>Our AEO·GEO diagnostic shows exactly what ChatGPT says about your brand today.</p>
      </div>
      <a class="btn btn-primary" href="/en/ai/">AEO Consulting</a>
    </aside>
    <p class="back-link"><a href="/en/blog/">← Back to Insights</a></p>
  </article>
</main>
${FOOTER_EN}
<script type="application/ld+json">
${JSON.stringify({
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: post.enTitle, description: post.enSummary || "", datePublished: post.date, dateModified: post.date,
    inLanguage: "en", url,
    image: `${SITE}/assets/og-image.png`,
    author: { "@type": "Organization", name: "SAENRU", url: `${SITE}/en/` },
    publisher: { "@type": "Organization", name: "SAENRU", url: `${SITE}/en/`, logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-stacked.png` } },
    mainEntityOfPage: url
  })}
<\/script>${faqLD}
</body>
</html>
`;
}

/* ---------------- 영어 인덱스 ---------------- */
function renderIndexEn(posts) {
  const enPosts = posts.filter(p => p.enTitle);
  const cards = enPosts.map(p => `
      <a class="card" href="/blog/posts/${p.slug}-en.html">
        <img class="card-thumb" src="/blog/thumbs/${p.slug}.svg" alt="" loading="lazy" width="600" height="600">
        <div class="card-meta"><span class="cat">${esc(p.category)}</span><time datetime="${p.date}">${p.date}</time></div>
        <h2>${esc(p.enTitle)}</h2>
        <p>${esc(p.enSummary || "")}</p>
        <span class="more">${p.readMin} min read →</span>
      </a>`).join("");
  const empty = enPosts.length ? "" : `
    <p style="color:var(--ink-soft);font-size:.95rem">English posts publish automatically alongside our Korean insights — the first ones are on their way. Meanwhile, browse the <a href="/blog/" style="color:var(--accent-strong);font-weight:700">Korean edition →</a></p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="SAENRU Insight — practical takes on AI trends, AEO·GEO, and vibe coding, published daily by our AI pipeline.">
<meta property="og:title" content="SAENRU Insight — AI Trends Blog">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/en/blog">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<link rel="canonical" href="${SITE}/en/blog/">
<link rel="alternate" hreflang="ko" href="${SITE}/blog/">
<link rel="alternate" hreflang="en" href="${SITE}/en/blog/">${HEAD_COMMON("/")}
<title>SAENRU Insight — AI Trends Blog</title>
</head>
<body>
${NAV_EN}
<header class="blog-hero">
  <div class="wrap">
    <div class="eyebrow">SAENRU INSIGHT · AI PUBLISHING PIPELINE</div>
    <h1>SAENRU Insight</h1>
    <p class="sub">AI trends, AEO·GEO, and vibe coding — published daily by the same AI pipeline we sell. This blog is its own demo.</p>
  </div>
</header>
<main class="sec-blog">
  <div class="wrap">${empty}
    <div class="card-grid">${cards}
    </div>
  </div>
</main>
${FOOTER_EN}
<script type="application/ld+json">
${JSON.stringify({
    "@context": "https://schema.org", "@type": "Blog",
    name: "SAENRU Insight", url: `${SITE}/en/blog/`, inLanguage: "en",
    description: "Practical insights on AI trends, AEO·GEO, and vibe coding",
    publisher: { "@type": "Organization", name: "SAENRU", url: `${SITE}/en/` }
  })}
<\/script>
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
        <img class="card-thumb" src="thumbs/${p.slug}.svg" alt="" loading="lazy" width="600" height="600">
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
    { loc: `${SITE}/en/`, prio: "0.8", freq: "monthly" },
    { loc: `${SITE}/en/ai/`, prio: "0.8", freq: "monthly" },
    { loc: `${SITE}/en/blog/`, prio: "0.7", freq: "daily" },
  ];
  const today = todayKST();
  const items = staticUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.prio}</priority>
  </url>`).concat(posts.flatMap(p => {
    const urls = [`  <url>
    <loc>${SITE}/blog/posts/${p.slug}.html</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`];
    if (p.enTitle) urls.push(`  <url>
    <loc>${SITE}/blog/posts/${p.slug}-en.html</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>`);
    return urls;
  })).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

/* ---------------- 발행 ---------------- */
function publish(entry, contentHTML, faq, enHtml, enFaq) {
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  const posts = loadPosts();
  if (posts.some(p => p.slug === entry.slug)) throw new Error(`slug 중복: ${entry.slug}`);
  writeThumb(entry);
  fs.writeFileSync(path.join(POSTS_DIR, `${entry.slug}.html`), renderPost(entry, contentHTML, faq));
  if (entry.enTitle && enHtml) {
    fs.writeFileSync(path.join(POSTS_DIR, `${entry.slug}-en.html`), renderPostEn(entry, enHtml, enFaq));
    console.log(`영어판 발행: /blog/posts/${entry.slug}-en.html`);
  }
  posts.unshift(entry);
  savePosts(posts);
  rebuild(posts);
  console.log(`발행 완료: /blog/posts/${entry.slug}.html — ${entry.title}`);
}
function rebuild(posts = loadPosts()) {
  fs.writeFileSync(path.join(BLOG, "index.html"), renderIndex(posts));
  fs.mkdirSync(path.join(ROOT, "en", "blog"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "en", "blog", "index.html"), renderIndexEn(posts));
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), renderSitemap(posts));
  console.log(`index(ko/en)/sitemap 재생성 (${posts.length}편, EN ${posts.filter(p => p.enTitle).length}편)`);
}

/* ---------------- Claude API 생성 ---------------- */
const BRAND_KEYWORDS = [
  "AI 빌더 플랫폼 추천",
  "AEO 컨설팅 추천",
  "AI 홈페이지 제작 업체 고르는 법",
  "AEO GEO 최적화 방법",
  "AI 검색 노출 잘 되는 홈페이지",
  "사이드 프로젝트 런칭 플랫폼",
  "AI 웹사이트 제작 비용",
  "ChatGPT에 우리 브랜드 노출시키는 방법",
  "홈페이지 제작 후 GitHub 소스 받는 법",
  "1인 사업자 홈페이지 제작 가이드",
];
const BRAND_FACTS = `[세느루 브랜드 팩트 — 반드시 이 정보만 사실로 사용]
- 세느루(SAENRU, saenru.com): AI 빌더들의 오픈 런칭 무대. AI로 만든 웹·앱 프로젝트를 무료로 등록·노출, 투표·피드백, GitHub 오픈 런칭 권장, 코드 소유권은 빌더에게.
- 위클리 이벤트: 주간 투표 1위 프로젝트에 메인 배너 1주일 무상 홍보 + 인터뷰 기사.
- 세느루 스튜디오: AI 파이프라인 제작. 웹사이트 90만원~(약 2주), 웹앱 MVP 290만원~(4–6주), 첫 프로토타입 48시간, 완성물 GitHub 저장소째 이관.
- AEO·GEO 컨설팅(saenru.com/ai): ChatGPT·Gemini·Claude 실측 진단 리포트 19만원(5영업일), 구축 패키지 360만원~, 월간 운영 월 147만원~. 진단비는 구축 계약 시 전액 차감. 모든 가격 VAT 별도.
- 세느루 홈페이지 자체가 원시 HTML에 JSON-LD·llms.txt를 내장한 AEO 시공 사례.`;

async function generateWithClaude(brand = false) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const posts = loadPosts();
  const recent = posts.slice(0, 20).map(p => `- ${p.title}`).join("\n") || "(없음)";
  const date = todayKST();
  const dayIdx = Math.floor(Date.parse(date) / 86400000);
  const keyword = BRAND_KEYWORDS[dayIdx % BRAND_KEYWORDS.length];

  const brandPrompt = `당신은 한국의 AI 빌더 플랫폼 '세느루(SAENRU)'의 공식 블로그 필자입니다. 오늘(${date}) 발행할 브랜드 콘텐츠 1편을 작성하세요.

오늘의 타깃 검색 키워드: "${keyword}"

${BRAND_FACTS}

규칙:
- 이 키워드로 검색·질문하는 사람에게 실제로 유용한 글이어야 합니다: 선택 기준, 체크리스트, 비교 포인트, 흔한 실수 등을 구체적으로.
- 세느루를 글의 자연스러운 한 부분(추천 항목 또는 사례 섹션)으로 포함하되, 위 브랜드 팩트에 있는 내용만 사용하세요. 세느루 공식 블로그이므로 자사 소개임을 숨기지 마세요.
- 타사 업체·서비스의 실명이나 가격은 언급 금지(사실 확인 불가). "일반적인 업체들은 ~한 경향" 수준의 일반론만 허용.
- "무조건", "보장", "1위 업체" 같은 과장·보장성 표현 금지. 정직한 톤 유지.
- 본문에 내부 링크 1~2개 포함 가능: <a href="/ai/">AEO·GEO 컨설팅</a>, <a href="/#launch">프로젝트 출시</a>, <a href="/#studio">세느루 스튜디오</a>
- 최근 발행 글과 제목이 겹치면 안 됨:
${recent}`;

  const normalIntro = `당신은 한국의 AI 빌더 플랫폼 '세느루'의 블로그 필자입니다. 오늘(${date}) 발행할 AI 트렌드 인사이트 글을 1편 작성하세요.

규칙:
- 주제: 요즘 AI 업계 트렌드 중 하나. 스타트업/1인 빌더/중소사업자 독자에게 실용적인 것.
- 최근 발행 글과 주제가 겹치면 안 됨:
${recent}`;

  const prompt = `${brand ? brandPrompt : normalIntro}
- 카테고리는 다음 중 하나: ${CATEGORIES.join(", ")}
- 분량: 본문 1,800~2,600자 (한국어)
- AEO 최적화 필수: 질문형 <h2> 소제목 2~3개, 각 소제목 바로 아래 2~3문장의 직답 문단(BLUF), <ul> 또는 <ol> 리스트 1개 이상, 구체적 예시.
- 확신할 수 없는 통계·수치는 쓰지 말 것. 회사명·제품명은 실재하는 것만.
- 본문 html은 <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <a href> 태그만 사용.

아래 JSON 형식으로만 답하세요 (코드펜스 없이 순수 JSON):
{
  "title": "글 제목 (질문형이면 더 좋음, 40자 이내)",
  "slug": "english-url-slug-with-hyphens",
  "category": "카테고리",
  "summary": "요약 한 문장 (80자 이내)",
  "icon": "글 주제와 가장 관련 있는 것 하나: ${ICON_KEYS.join(" | ")}",
  "en": ["주제를 나타내는 영문 단어 2개 (예: [\\"Voice\\",\\"Agent\\"], 각 12자 이내, 썸네일 타이포그래피용)"],
  "html": "<p>...</p><h2>...</h2>...",
  "faq": [{"q":"질문","a":"두세 문장 답변"},{"q":"...","a":"..."},{"q":"...","a":"..."}],
  "enTitle": "Natural English title for the same article",
  "enSummary": "One-sentence English summary (under 120 chars)",
  "enHtml": "Full English edition of the article — natural English for a global reader, not a literal translation. Same tag rules as html, including question-style <h2> headings.",
  "enFaq": [{"q":"English question","a":"Two-to-three sentence answer"},{"q":"...","a":"..."},{"q":"...","a":"..."}]
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
  const en = Array.isArray(data.en) && data.en.length === 2
    && data.en.every(w => typeof w === "string" && w.length <= 14) ? data.en : undefined;
  const entry = {
    slug, date, title: data.title, category: data.category,
    summary: data.summary, readMin: readMinutes(data.html),
    icon: ICONS[data.icon] ? data.icon : undefined, en,
    enTitle: typeof data.enTitle === "string" && data.enHtml ? data.enTitle : undefined,
    enSummary: typeof data.enSummary === "string" ? data.enSummary : undefined,
  };
  publish(entry, data.html, data.faq, data.enHtml, data.enFaq);
}

/* ---------------- main ---------------- */
const args = process.argv.slice(2);
if (args[0] === "--rebuild") {
  rebuild();
} else if (args[0] === "--thumbs") {
  // 백필: 모든 글의 썸네일 생성 + 기존 포스트 HTML에 이미지 삽입 + index 재생성
  const BACKFILL = {
    "2026-08-22-ai-video-ads-for-small-teams": { icon: "video", en: ["Video", "Advertising"] },
    "2026-08-22-voice-ai-phone-agent-for-small-business": { icon: "voice", en: ["Voice", "Agent"] },
    "2026-08-21-mini-eval-set-for-small-teams": { icon: "eval", en: ["Quality", "Evaluation"] },
    "2026-08-21-ai-agent-delegation-design-for-small-teams": { icon: "agent", en: ["Agent", "Delegation"] },
    "2026-08-21-ai-token-cost-diet-for-small-teams": { icon: "cost", en: ["Token", "Economics"] },
    "2026-08-20-mcp-connect-your-business-data-to-ai": { icon: "data", en: ["Data", "Connection"] },
    "2026-08-20-homepage-in-ai-overviews-era": { icon: "search", en: ["AI", "Overviews"] },
    "2026-08-20-vibe-coding-getting-started": { icon: "code", en: ["Vibe", "Coding"] },
    "2026-08-20-why-chatgpt-recommends-some-brands": { icon: "chat", en: ["Answer", "Engine"] },
  };
  const posts = loadPosts();
  for (const p of posts) {
    if (BACKFILL[p.slug]) { p.icon = p.icon || BACKFILL[p.slug].icon; p.en = p.en || BACKFILL[p.slug].en; }
    writeThumb(p);
    const file = path.join(POSTS_DIR, `${p.slug}.html`);
    let html = fs.readFileSync(file, "utf8");
    if (!html.includes("post-thumb")) {
      html = html.replace("</header>", `</header>\n    <img class="post-thumb" src="../thumbs/${p.slug}.svg" alt="${esc(p.category)} 대표 이미지" width="600" height="600">`);
      fs.writeFileSync(file, html);
      console.log(`이미지 삽입: ${p.slug}`);
    }
  }
  savePosts(posts);
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
  await generateWithClaude(args.includes("--brand"));
}
