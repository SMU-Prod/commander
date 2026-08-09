-- 028: o indice unico de origem_id era PARCIAL (where origem_id is not null)
-- e o Postgres nao aceita ON CONFLICT (origem_id) contra indice parcial sem
-- repetir o predicado — o upsert de gravarSondagens falhava com 42P10 em TODA
-- gravacao (provado no emulador em 09/08/2026: rede 200, banco zerado, fila
-- retentando pra sempre). A tabela esta vazia e origem_id e sempre preenchido
-- pela action, entao: coluna obrigatoria + indice total, que o ON CONFLICT
-- simples casa.
drop index if exists sondagens_origem_id_idx;
alter table sondagens alter column origem_id set not null;
create unique index sondagens_origem_id_idx on sondagens (origem_id);
