// Reader-view style text extraction from raw HTML (no DOM available in Workers).

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™", bull: "•", middot: "·",
};

export function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);/gi, (match, body) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function stripBlocks(html, tags) {
  let result = html;
  for (const tag of tags) {
    result = result.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi"), " ");
  }
  return result;
}

function largestBlock(html, tag) {
  const matches = html.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi")) || [];
  return matches.sort((a, b) => b.length - a.length)[0] || "";
}

function blocksToText(html) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, "\n\n\u0001$2\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|ul|ol|blockquote|section|tr|pre|figure|figcaption|table)\s*>/gi, "\n\n")
      .replace(/<(p|div|li|blockquote|section|tr|pre)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );
}

function pickTitle(html) {
  const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html);
  const title = og?.[1] || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "";
  return decodeEntities(title).replace(/\s+/g, " ").trim();
}

export function extractArticle(html) {
  const title = pickTitle(html);
  let body = stripBlocks(html, ["script", "style", "noscript", "template", "svg", "iframe", "form", "nav", "footer", "aside", "button", "select"]);
  body = body.replace(/<header\b[^>]*>[\s\S]*?<\/header\s*>/gi, (match) => (/<h1\b/i.test(match) ? match : " "));

  const article = largestBlock(body, "article");
  const main = largestBlock(body, "main");
  const bodyTag = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(body)?.[1] || body;
  const candidates = [article, main, bodyTag];
  const region = candidates.find((candidate) => candidate.replace(/<[^>]+>/g, "").length > 400) || bodyTag;

  const paragraphs = blocksToText(region)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("\u0001")) return line.length > 3;
      return line.split(" ").length >= 5 || /[.!?…]$/.test(line);
    })
    .map((line) => line.replace(/^\u0001/, ""));

  return { title, text: paragraphs.join("\n\n") };
}

export function detectCharset(contentType, headBytes) {
  const header = /charset=([\w-]+)/i.exec(contentType || "")?.[1];
  if (header) return header;
  const head = new TextDecoder("latin1").decode(headBytes);
  return /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] || "utf-8";
}
