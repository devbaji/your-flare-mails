/**
 * Minimal HTML neutralization for sandboxed iframe srcdoc.
 * Not a full sanitizer — always render inside sandbox without allow-scripts.
 */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}
