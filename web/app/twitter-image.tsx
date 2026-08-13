// Mesma composição do card do WhatsApp/Facebook (app/opengraph-image.tsx),
// só reexportada sob a convenção de arquivo que o Next usa pra gerar as
// tags `twitter:image*` — sem isso o card do Twitter/X cairia no
// fallback (às vezes inconsistente) do og:image em vez de ter o próprio.
export { default, alt, size, contentType } from "./opengraph-image"
