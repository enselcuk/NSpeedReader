import { detectCharset, extractArticle } from "./extract.js";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.includes(":") || // IPv6 literal
    /^\d+\.\d+\.\d+\.\d+$/.test(host) // IPv4 literal
  );
}

async function handleExtract(request) {
  const target = new URL(request.url).searchParams.get("url") || "";
  let url;
  try {
    url = new URL(target);
  } catch {
    return json({ error: "Geçersiz bağlantı." }, 400);
  }
  if (!/^https?:$/.test(url.protocol) || isBlockedHost(url.hostname)) {
    return json({ error: "Bu bağlantı desteklenmiyor." }, 400);
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; NSpeedReader/1.0; +reader-view)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "tr,en;q=0.8",
      },
    });
  } catch {
    return json({ error: "Sayfaya ulaşılamadı." }, 502);
  }

  if (isBlockedHost(new URL(response.url).hostname)) {
    return json({ error: "Bu bağlantı desteklenmiyor." }, 400);
  }
  if (!response.ok) return json({ error: `Sayfa yüklenemedi (${response.status}).` }, 502);

  const type = response.headers.get("content-type") || "";
  if (!/html|xml|text\/plain/i.test(type)) return json({ error: "Bu bağlantı bir web sayfası değil." }, 415);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) return json({ error: "Sayfa çok büyük." }, 413);

  let decoder;
  try {
    decoder = new TextDecoder(detectCharset(type, bytes.subarray(0, 2048)));
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  const raw = decoder.decode(bytes);

  if (/text\/plain/i.test(type)) return json({ title: url.hostname, text: raw.trim() });

  const { title, text } = extractArticle(raw);
  if (text.length < 200) return json({ error: "Sayfada okunabilir bir makale bulunamadı." }, 422);
  return json({ title, text });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/api/extract") return handleExtract(request);
    return env.ASSETS.fetch(request);
  },
};
