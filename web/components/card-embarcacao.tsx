import Link from "next/link"
import { Icone } from "@/components/icone"
import type { StatusFarol } from "@/lib/domain/semaforo"
import type { Embarcacao } from "@/lib/db/types"

const ROTULO: Record<StatusFarol, string> = {
  ok: "Tudo em dia",
  atencao: "Precisa de atenção",
  vencido: "Item vencido",
}

const COR: Record<StatusFarol, string> = {
  ok: "text-[#2fd07a]",
  atencao: "text-[#ffb020]",
  vencido: "text-[#ff5c5c]",
}

/**
 * O HERO: a foto do barco do dono, e mais nada.
 *
 * ONDA 57 — este componente carregava, ao mesmo tempo: monograma, selo de
 * status, nome, legenda, três mini-métricas e um botão dourado. Seis
 * decisões num bloco só, que é literalmente o defeito que o dono chamou de
 * "cara de IA" (docs/DESIGN.md §1). A foto é a ÚNICA decisão assumida do
 * redesenho (§4) — ela não divide o palco com um painel de instrumentos
 * colado embaixo.
 *
 * O que saiu, e pra onde foi:
 * - as três métricas (horas de motor / próxima revisão / documentos): viraram
 *   os cartões "Motores" e "Saúde" da Início, onde cabem inteiras;
 * - o botão "Ver embarcação": o cartão "Motores" tem "Ver ficha", e o trilho
 *   e a barra de baixo têm "Barco" — eram três caminhos pro mesmo lugar.
 *
 * `statusGeral` ficou OPCIONAL: em `/hoje` o estado tem cartão próprio, com o
 * vocabulário do PRD §5 ("Saudável / Atenção / Ação necessária"). Mostrar o
 * selo aqui junto significaria duas palavras diferentes pro mesmo estado na
 * mesma tela. Em `/barco`, onde não existe esse cartão, ele continua.
 */
export function CardEmbarcacao({
  embarcacao,
  statusGeral,
  urlCapa,
  podeEditarFotos,
  className = "",
}: {
  embarcacao: Embarcacao
  /** Só onde não há um cartão de Saúde na mesma tela — ver o cabeçalho. */
  statusGeral?: StatusFarol
  urlCapa: string | null
  podeEditarFotos: boolean
  className?: string
}) {
  const legenda = [embarcacao.estaleiro, embarcacao.modelo, embarcacao.ano].filter(Boolean).join(" · ")
  return (
    /* `sombra-1` e não `sombra-2`: a elevação flutuante é reservada ao que de
       fato paira sobre outra coisa — bottom sheet, menu, pastilha sobre o
       mapa (docs/DESIGN.md §5). A foto está encostada na página como
       qualquer cartão. Sombra funda em elemento que não flutua é, ao pé da
       letra, um dos sintomas que o §1 lista como "cara de IA". */
    <div className={`sombra-1 overflow-hidden rounded-[var(--raio-cartao)] ${className}`}>
      <div className="relative bg-[#0b1d2d]">
        {urlCapa ? (
          /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
          <img src={urlCapa} alt={`Foto de ${embarcacao.nome}`} className="h-44 w-full object-cover lg:h-64" />
        ) : (
          /* SEM FOTO NÃO PODE SER UM BURACO. A tela inteira foi desenhada em
             volta desta imagem: sem ela, o lugar dela tem que virar o convite
             mais claro do app — por isso este é o segundo (e último) uso do
             dourado da Início. O bloco todo é o link; a pílula dourada é só o
             alvo visível dentro dele. */
          <Link
            href={podeEditarFotos ? "/barco/fotos" : "/barco"}
            /* `pb-16` porque o nome do barco fica em `absolute bottom-0` por
               cima desta área: sem a folga, o convite cai em cima dele. */
            className="flex h-44 w-full flex-col items-center justify-center gap-2 pb-16 lg:h-64"
            style={{ backgroundImage: "radial-gradient(ellipse 90% 70% at 50% 15%, #16324a 0%, #0b1d2d 70%)" }}
          >
            <Icone nome="camera" className="size-6 text-meter-dim" />
            {podeEditarFotos ? (
              <>
                <span className="inline-flex min-h-11 items-center rounded-[var(--raio-pilula)] bg-accent px-5 text-sm font-semibold text-acao-texto">
                  Adicionar foto da embarcação
                </span>
                <span className="apoio text-meter-dim">É ela que abre o seu Commander</span>
              </>
            ) : (
              <span className="corpo text-meter-dim">Sem foto de capa</span>
            )}
          </Link>
        )}
        {/* Véu do topo: garante leitura do selo e do monograma sobre foto clara */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{ backgroundImage: "linear-gradient(to bottom, rgb(11 29 45 / .55), rgb(11 29 45 / 0))" }}
        />
        {/* Véu de baixo: alto e denso — o nome é o texto mais importante do app
            e precisa se manter legível sobre casco branco no sol. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-36"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgb(11 29 45 / .96) 0%, rgb(11 29 45 / .88) 32%, rgb(11 29 45 / .5) 62%, rgb(11 29 45 / 0) 100%)",
          }}
        />
        <span className="absolute left-3 top-3 flex items-center gap-1.5">
          <svg viewBox="0 0 48 34" className="h-3.5 w-auto" aria-hidden="true">
            <path d="M4 32 V10 L15 22 24 5 33 22 44 10 V32 H36 V24 L28 32 H20 L12 24 V32 Z" fill="#d4af37" />
          </svg>
          <span className="rounded-full bg-[#0b1d2d]/75 px-2 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.16em] text-meter-texto backdrop-blur">
            Commander
          </span>
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h1
            className="text-[22px] font-semibold uppercase tracking-[.06em] text-meter-texto"
            style={{ textShadow: "0 1px 8px rgb(11 29 45 / .8)" }}
          >
            {embarcacao.nome}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <p className="apoio text-[#c2d1de]">{[embarcacao.marina, legenda].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        {statusGeral && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#0b1d2d]/80 px-2.5 py-1.5 backdrop-blur">
            <Icone nome="escudo" className={`size-3.5 ${COR[statusGeral]}`} />
            <span className={`font-mono-instr text-[11px] uppercase tracking-[.1em] ${COR[statusGeral]}`}>
              {ROTULO[statusGeral]}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
