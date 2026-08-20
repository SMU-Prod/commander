# Changelog — signalk-commander-connector

## 1.0.0 — 2026-08-20

Primeira versão pública.

- Envio de telemetria do barco para a conta Commander, por categoria e com
  consentimento explícito (tudo desligado por padrão): posição, motor,
  profundidade, elétrica e ambiente.
- Lotes a cada 30 s (configurável) com a leitura mais recente de cada dado —
  nunca inunda a rede nem o servidor.
- Fila em disco com teto de 5.000 leituras e backoff exponencial: internet
  da marina caiu, o dado espera e chega depois.
- Somente leitura: o plugin nunca escreve no barramento nem no servidor
  Signal K.
- Testado contra o signalk-server 2.31.1 com dados de amostra (testes de
  conformidade no repositório, pasta `e2e/`).
