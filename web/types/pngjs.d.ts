/** Declaracao minima ambiente para `pngjs`: o pacote nao publica tipos e nao ha
 *  `@types/pngjs`. Cobre so a fatia sincrona (`PNG.sync.read`) usada pelo teste
 *  de rota real (`web/lib/domain/rota-real.test.ts`), que decodifica o PNG da
 *  mascara agua/terra direto do disco em Node. */
declare module "pngjs" {
  interface PNGDados {
    width: number
    height: number
    /** RGBA, 4 bytes por pixel — pngjs sempre normaliza pra esse formato na
     *  leitura, mesmo quando o PNG em disco e grayscale (colorType 0), como e
     *  o caso da mascara-agua.png gerada por scripts/gerar-mascara-agua.mjs. */
    data: Buffer
  }

  namespace PNG {
    const sync: {
      read(buffer: Buffer): PNGDados
    }
  }

  export { PNG }
}
