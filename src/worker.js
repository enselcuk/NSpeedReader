// /api/extract?url=… : verilen sayfadan okunabilir ana metni çıkarır (okuyucu modu benzeri).
// Diğer tüm istekler public/ içindeki statik dosyalara gider (assets binding).

const MAX_BYTES = 3 * 1024 * 1024;
const BLOCK_SELECTORS = ["p", "h1", "h2", "h3", "h4", "li", "blockquote"];
// Öncelik sırası: makale gövdesi, ana içerik, sayfanın tamamı.
const SCOPES = ["article", "main, [role=main]", "body"];

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true; // IPv6 adresleri
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return false;
}

function detectCharset(contentType, bytes) {
  const header = /charset=["']?([\w-]+)/i.exec(contentType || "");
  if (header) return header[1];
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
  return meta ? meta[1] : "utf-8";
}

function decodeHtml(bytes, contentType) {
  try {
    return new TextDecoder(detectCharset(contentType, bytes)).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function readLimited(response) {
  const reader = response.body.getReader();
  const parts = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function stripNoise(html) {
  return html.replace(/<(script|style|nav|footer|aside|form|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, "");
}

async function extractBlocks(html, scope) {
  const blocks = [];
  const rewriter = new HTMLRewriter();

  for (const tag of BLOCK_SELECTORS) {
    let current = null;
    const selector = scope
      .split(",")
      .map((part) => `${part.trim()} ${tag}`)
      .join(", ");
    rewriter.on(selector, {
      element(element) {
        current = { text: "", tag };
        blocks.push(current);
        element.onEndTag(() => {
          current = null;
        });
      },
      text(chunk) {
        if (current) current.text += chunk.text;
      },
    });
  }

  await rewriter.transform(new Response(html)).text();

  return blocks
    .map((block) => ({ ...block, text: decodeEntities(block.text).replace(/\s+/g, " ").trim() }))
    .filter((block) => block.text);
}

async function extractTitle(html) {
  let title = "";
  let h1 = "";
  await new HTMLRewriter()
    .on("title", { text(chunk) { title += chunk.text; } })
    .on("h1", { text(chunk) { if (h1.length < 300) h1 += chunk.text; } })
    .transform(new Response(html))
    .text();
  const clean = (value) => decodeEntities(value).replace(/\s+/g, " ").trim();
  return clean(h1) || clean(title);
}

function joinBlocks(blocks) {
  // Çok kısa menü benzeri satırları ve tekrarları at; başlıkları cümle gibi bitir.
  const seen = new Set();
  const lines = [];
  for (const block of blocks) {
    const words = block.text.split(" ").length;
    const isHeading = /^h\d$/.test(block.tag);
    if (!isHeading && words < 4) continue;
    if (seen.has(block.text)) continue;
    seen.add(block.text);
    lines.push(isHeading && !/[.!?…:]$/.test(block.text) ? `${block.text}.` : block.text);
  }
  return lines.join("\n\n");
}

async function handleExtract(request) {
  const target = new URL(request.url).searchParams.get("url");
  let url;
  try {
    url = new URL(target || "");
  } catch {
    return json({ error: "Geçerli bir adres girin." }, 400);
  }
  if (!/^https?:$/.test(url.protocol) || isBlockedHost(url.hostname)) {
    return json({ error: "Bu adres desteklenmiyor." }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(url.toString(), {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; NSpeedReader/1.0; +https://github.com/enselcuk/nspeedreader)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "tr,en;q=0.8",
      },
      cf: { cacheTtl: 300 },
    });
  } catch {
    return json({ error: "Sayfaya ulaşılamadı." }, 502);
  }

  if (!upstream.ok) return json({ error: `Sayfa ${upstream.status} döndürdü.` }, 502);
  const type = upstream.headers.get("content-type") || "";
  if (!/html|xml|text\/plain/i.test(type)) return json({ error: "Sayfa bir HTML belgesi değil." }, 415);

  const bytes = await readLimited(upstream);
  const html = stripNoise(decodeHtml(bytes, type));

  if (/text\/plain/i.test(type)) {
    const text = html.replace(/\s+/g, " ").trim();
    return text ? json({ title: "", text }) : json({ error: "Okunabilir metin bulunamadı." }, 422);
  }

  let text = "";
  for (const scope of SCOPES) {
    text = joinBlocks(await extractBlocks(html, scope));
    if (text.length >= 400) break;
  }
  if (text.length < 100) return json({ error: "Bu sayfadan okunabilir metin çıkarılamadı." }, 422);

  return json({ title: await extractTitle(html), text });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/extract") {
      if (request.method !== "GET") return json({ error: "Yalnızca GET desteklenir." }, 405);
      return handleExtract(request);
    }
    return env.ASSETS.fetch(request);
  },
};
