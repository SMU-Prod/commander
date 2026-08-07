/** Valida o parâmetro `volta` do login contra open redirect (CWE-601).
 *  Canonicaliza com o MESMO parser WHATWG que o browser usa ao resolver o
 *  header Location: qualquer truque (\, TAB/LF/CR, //host, dot-segments)
 *  que mude o host ou produza um path scheme-relative cai no padrão. */
export function destinoSeguro(bruto: unknown, padrao: string): string {
  const v = String(bruto ?? "")
  if (!v.startsWith("/")) return padrao
  try {
    const u = new URL(v, "http://interno.local")
    if (u.host !== "interno.local" || u.protocol !== "http:") return padrao
    // dot-segments colapsados podem deixar um pathname "//..." (network-path)
    if (u.pathname.startsWith("//")) return padrao
    return u.pathname + u.search + u.hash
  } catch {
    return padrao
  }
}
