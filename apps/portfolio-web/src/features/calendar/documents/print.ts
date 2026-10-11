/** Safe to import on the server. Browser resources are allocated only on explicit print. */
const allowedTags = new Set([
  "ARTICLE",
  "SECTION",
  "DIV",
  "H1",
  "H2",
  "H3",
  "P",
  "UL",
  "OL",
  "LI",
  "STRONG",
  "EM",
  "SPAN",
  "SMALL",
  "BLOCKQUOTE",
  "BR",
  "A",
]);
function escaped(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function content(node: Node): string {
  if (node.nodeType === 3) return escaped(node.textContent ?? "");
  if (node.nodeType !== 1) return "";
  const element = node as Element;
  if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG"].includes(element.tagName))
    return "";
  const children = Array.from(node.childNodes).map(content).join("");
  if (!allowedTags.has(element.tagName)) return children;
  const tag = element.tagName.toLowerCase();
  let href = "";
  if (tag === "a") {
    const value = element.getAttribute("href");
    if (value && /^https?:\/\//i.test(value))
      href = ` href="${escaped(value)}" rel="noopener noreferrer"`;
  }
  return `<${tag}${href}>${children}</${tag}>`;
}
export function printableMeetingHtml(
  source: HTMLElement,
  title: string,
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>${escaped(title)}</title><style>@page{margin:18mm}body{font:14px/1.45 system-ui,sans-serif;color:#0a0a0a;max-width:720px;margin:32px auto;padding:0 20px;overflow-wrap:anywhere}h1{font-size:20px;font-weight:500}h2,h3{font-size:14px;font-weight:500;margin:18px 0 8px}p,li,span,small,blockquote{white-space:pre-wrap}p{margin:8px 0}ul,ol{padding-left:22px}section{break-inside:avoid}a{color:inherit}a[href]::after{content:' (' attr(href) ')';font-size:11px}</style></head><body><h1>${escaped(title)}</h1>${content(source)}</body></html>`;
}
export function printMeetingDocument(
  source: HTMLElement,
  title: string,
  browser: Pick<Window, "open"> = window,
): void {
  const popup = browser.open("", "_blank", "width=820,height=1000");
  if (!popup)
    throw new Error(
      "Allow pop-ups for this site, then choose Print / Save as PDF again.",
    );
  try {
    popup.opener = null;
    popup.document.write(printableMeetingHtml(source, title));
    popup.document.close();
    popup.focus();
    // Explicit user action; the new document has no external fonts/assets to await.
    popup.print();
  } catch (error) {
    popup.close();
    throw error;
  }
}
