-- 024: parceiro escolhe o icone e a cor do proprio pino no mapa (onda 10,
-- Pedido 2 do dono). Antes disso o icone era fixo por categoria e a cor
-- sempre a mesma (dourado da marca) — ver TRACADO_ICONE em
-- web/components/mapa/navegar-mapa.tsx (que esta migration torna obsoleto
-- pro pino: o marcador passa a ler `icone`/`cor` da propria linha).
--
-- Paleta e conjunto de icones sao CURADOS, nao livres — a fonte da verdade
-- do lado do app e web/lib/mapa/pino-parceiro.ts (CORES_PARCEIRO,
-- ICONES_PARCEIRO); os CHECKs abaixo sao o espelho no banco. Postgres nao
-- importa TS: qualquer mudanca de paleta/icones precisa mudar os dois
-- lados, e os dois arquivos se citam no comentario.

alter table public.parceiros
  add column icone text,
  add column cor text;

-- Backfill do parceiro ja existente: ganha o icone que HOJE ja aparece pra
-- ele no mapa (mesma logica de TRACADO_ICONE, por categoria) e a cor que
-- HOJE ja e a UNICA cor de qualquer pino (dourado da marca) — a migration
-- nao muda o visual de ninguem, so destrava a escolha pra proxima edicao.
update public.parceiros set
  icone = case categoria
    when 'marina' then 'ancora'
    when 'posto' then 'oleo'
    when 'pousada' then 'inicio'
    when 'restaurante' then 'estrela'
  end,
  cor = '#d4af37';

alter table public.parceiros
  alter column icone set not null,
  add constraint parceiros_icone_check check (
    icone in ('ancora','oleo','inicio','estrela','embarcacao','ferramenta','escudo','pessoas')
  ),
  alter column cor set not null,
  add constraint parceiros_cor_check check (
    cor in ('#0b1d2d','#d4af37','#7a1f3d','#0f5c4a','#4b3f72','#8a4b2c')
  );

-- Sem DEFAULT fixo na coluna: o default certo depende da CATEGORIA da linha
-- (marina -> ancora, posto -> oleo, ...), e Postgres nao deixa um DEFAULT de
-- coluna enxergar outra coluna da mesma linha. Um trigger BEFORE INSERT
-- resolve isso — só entra em ação se `icone`/`cor` vierem NULL (o app
-- sempre manda os dois explicitos, ver lib/acoes/parceiro.ts; isto é rede
-- de segurança pra inserts diretos/scripts).
create or replace function public.parceiro_icone_cor_padrao()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.icone is null then
    new.icone := case new.categoria
      when 'marina' then 'ancora'
      when 'posto' then 'oleo'
      when 'pousada' then 'inicio'
      when 'restaurante' then 'estrela'
      else 'ancora'
    end;
  end if;
  if new.cor is null then
    new.cor := '#d4af37';
  end if;
  return new;
end $$;
create trigger parceiros_icone_cor_padrao before insert on public.parceiros
  for each row execute function public.parceiro_icone_cor_padrao();

-- privilegio de coluna: mesma trava da migration 020 (revoke update on
-- table, grant so nas colunas explicitas) — icone/cor entram no rol
-- editavel pelo proprio parceiro.
grant update (icone, cor) on table public.parceiros to authenticated;
