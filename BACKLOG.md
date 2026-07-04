# Maré — Backlog Faseado

Regras: trabalhar por ordem; uma fase só fecha quando a Definition of Done (DoD) estiver cumprida; P0 = bloqueante da fase, P1 = importante, P2 = corta-se sem culpa. Estimativas para 10-15 h/semana.

---

## Fase 0 — Fundação (Semana 1)

- [ ] P0 — Scaffold Expo SDK 54+ com TypeScript strict, expo-router, estrutura de pastas do CLAUDE.md
- [ ] P0 — `src/db/database.ts`: init expo-sqlite, sistema de migrations com `schema_version` (portar padrão do FitAPP)
- [ ] P0 — Migration `001_initial` conforme `docs/DATABASE.md`
- [ ] P0 — Repositories vazios com interfaces tipadas: `spotRepo`, `boardRepo`, `sessionRepo`, `conditionsRepo`
- [ ] P1 — Setup Jest + primeiro teste (migrations correm de 0 → v1 numa BD em memória)
- [ ] P1 — `src/i18n` com strings pt-PT centralizadas
- [ ] P2 — ESLint + Prettier alinhados com o FitAPP

**DoD:** app arranca no dispositivo, BD criada com schema v1, teste de migrations verde.

---

## Fase 1 — Spots e Quiver (Semana 2)

- [ ] P0 — CRUD de spots: lista + formulário (nome, coordenadas, notas). Coordenadas por input manual **ou** "usar a minha localização" (expo-location) — mapa interativo é P2
- [ ] P0 — Validação de coordenadas (lat/lon plausíveis; avisar se o ponto parecer interior/terra — heurística simples, não bloqueante)
- [ ] P1 — CRUD de boards (quiver): nome, tipo, volume
- [ ] P1 — Arquivar (soft delete) spots e boards
- [ ] P2 — Mapa com pin arrastável (react-native-maps) para afinar a posição do spot
- [ ] P2 — Seed opcional: 5-10 spots conhecidos da Linha/Ericeira para arranque rápido

**DoD:** criar "Carcavelos" com coordenadas reais em <1 minuto; criar uma prancha; ambos aparecem nas listas após restart da app.

---

## Fase 2 — Sessões + Condições (Semanas 3-5) ← coração do produto

- [ ] P0 — Ecrã "Nova sessão": spot (último usado pré-selecionado), data/hora (default agora), rating 1-5 (estrelas grandes), prancha (opcional), duração (presets 30/60/90/120), notas. **Meta medida: registo completo em <30 s**
- [ ] P0 — Transação de criação: `sessions` + `session_conditions(pending)` (ver DATABASE.md §Regras)
- [ ] P0 — `OpenMeteoProvider` conforme `docs/OPEN_METEO.md` (marine + wind em paralelo, tipos, null-safety)
- [ ] P0 — Matching de hora + derivação de `tide_phase` — **com testes** (XX:29/XX:31, limites do array, delta >90 min)
- [ ] P0 — Fila de pendentes com triggers (arranque, netinfo, pull-to-refresh) e retry_count
- [ ] P1 — Cache de dia em memória (OPEN_METEO.md §7)
- [ ] P1 — Editar sessão (mudança de hora/spot invalida condições e re-agenda fetch — **com teste**)
- [ ] P1 — Estado visual das condições no cartão de sessão: a obter… / ok / indisponível + retry manual
- [ ] P2 — Apagar sessão com undo (snackbar 5 s)

**DoD:** registar sessão em modo avião → condições chegam sozinhas ao voltar o Wi-Fi; valores conferidos manualmente contra open-meteo.com para o mesmo dia/hora/coordenadas; testes do matching verdes.

---

## Fase 3 — Histórico e Polish (Semanas 6-7)

- [ ] P0 — Ecrã principal: lista de sessões (cartão: spot, data, rating, mini-resumo de condições: altura • período • vento • maré) com paginação
- [ ] P0 — Detalhe de sessão: tudo, incluindo condições completas e notas
- [ ] P1 — Filtros: por spot, por rating mínimo
- [ ] P1 — Ecrã de spot: sessões desse spot + contagem por rating
- [ ] P1 — Onboarding mínimo: 2 ecrãs (o que é a Maré, criar primeiro spot)
- [ ] P2 — Dark mode
- [ ] P2 — Ícones de direção (seta rodada por `*_direction_deg`) e fase da maré

**DoD:** a app é usável de ponta a ponta e o Bruno começa a usá-la em TODAS as sessões reais. **Gate: nada da Fase 4 arranca sem ≥20 sessões reais registadas.**

---

## Beta Pessoal (Semanas 8+, em paralelo com a vida)

- [ ] P0 — Usar na água. Anotar fricções reais no registo
- [ ] P0 — Internal testing (Play Console) + TestFlight com 5-10 surfistas de Carcavelos
- [ ] P1 — Corrigir o top 5 de fricções reportadas antes de qualquer feature nova

---

## Fase 4 — Insights (Premium candidato) — só com dados reais

- [ ] P0 — Migration 002: `spots.facing_direction_deg` + cálculo de `wind_relation`
- [ ] P0 — Motor de insights (`src/services/insights/`): buckets (altura 0.3 m, período 2 s, direção 45°, fase de maré), `n>=5` por conclusão — **com testes sobre dataset fixo**
- [ ] P0 — Ecrã "O teu perfil em {spot}": condições das sessões 4-5★ vs 1-2★
- [ ] P1 — Confiança visual do insight (n de sessões que o suportam)
- [ ] P2 — Comparação entre pranchas no mesmo spot

## Fase 5 — Alertas + Monetização

- [ ] P0 — Decisão de licenciamento API (plano comercial Open-Meteo vs alternativa — ver OPEN_METEO.md §8) ANTES de ativar pagamentos
- [ ] P0 — RevenueCat: subscrição 3,99 €/mês | 29,99 €/ano; free = registo + histórico; premium = insights + alertas + spots ilimitados (definir limite free nesta altura, não antes)
- [ ] P0 — Alertas: comparar forecast 7 dias com perfil do utilizador por spot; notificação local diária (sem backend: a app calcula localmente ao abrir + background fetch best-effort)
- [ ] P1 — Paywall honesto com preview real dos insights do próprio utilizador (dados dele, desfocados)

## Fase 6+ — Backlog frio (NÃO tocar)

- Conta + backup/sync cloud (Supabase) · Health Connect: detetar treino "surf" e lembrar registo · Export CSV/GPX · Fotos por sessão · en-US · Import de dados de outras apps

---

## Registo de decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-07-02 | UTC em toda a BD; conversão só na UI | Matching de condições sensível a DST |
| 2026-07-02 | Sem backend, sem login no MVP | Custo 0, RGPD trivial, velocidade |
| 2026-07-02 | Cliente API atrás de interface `MarineDataProvider` | Migração comercial/troca de fornecedor sem refactor |
