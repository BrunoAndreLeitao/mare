# Maré — Backlog Faseado

Regras: trabalhar por ordem; uma fase só fecha quando a Definition of Done (DoD) estiver cumprida; P0 = bloqueante da fase, P1 = importante, P2 = corta-se sem culpa. Estimativas para 10-15 h/semana.

---

## Fase 0 — Fundação (Semana 1)

- [x] P0 — Scaffold Expo SDK 54+ com TypeScript strict, expo-router, estrutura de pastas do CLAUDE.md
  <!-- Feito com SDK 57 (template default, expo-router em src/app/ — CLAUDE.md atualizado). Reconciliação: script morto reset-project removido, .gitattributes LF, example/ do template apagada. -->
- [x] P0 — `src/db/database.ts`: init expo-sqlite, sistema de migrations com `schema_version` (portar padrão do FitAPP)
  <!-- Decisões: runner é o dono exclusivo de schema_version (migrations não a tocam); runner extraído para src/db/migrationRunner.ts sem imports expo (testável sem mocks); transações via BEGIN/COMMIT em execAsync para manter a interface MigrationDb mínima; getDatabase() limpa o singleton em caso de falha de init para permitir retry. -->
- [x] P0 — Migration `001_initial` conforme `docs/DATABASE.md`
  <!-- Decisões (2026-07-05): runner-dono aplicado — SQL da 001 sem bloco schema_version nem PRAGMAs, docs/DATABASE.md atualizado com nota; tipo Migration movido para migrationRunner.ts (o runner define o contrato; evita ciclo index↔001); 7 statements individuais por ordem de dependência de FK; teste (e) com schema real: schema_version=1, 5 tabelas, 3 índices; tsconfig ganhou "types": ["jest"] porque a auto-inclusão de @types falhou com TS 6.0.3 (item P2 no fim da fase). -->
- [x] P0 — Repositories vazios com interfaces tipadas: `spotRepo`, `boardRepo`, `sessionRepo`, `conditionsRepo`
  <!-- Decisões (2026-07-05): tipos de domínio em src/db/types.ts (camelCase; mapeamento row→domínio é das implementações, Fases 1-2); leituras devolvem null, mutações LANÇAM em id inexistente; inputs New* com opcionais ?, leituras com | null; sem stubs — só interfaces, tsc é a verificação. Snapshot parcial: saveSnapshot(parcial) + markFailed(id,false), por esta ordem (contrato no conditionsRepo). listFetchable pode evoluir para FetchableSession na Fase 2 (autorizado). LIMITAÇÃO CONHECIDA (decisão consciente): Partial<New*> nos updates não permite limpar campos para NULL (ex: apagar notes, desassociar boardId) — resolve-se na Fase 1 com tipos *Changes dedicados (campos limpáveis aceitam | null) quando o primeiro ecrã de edição precisar. -->
- [x] P1 — Setup Jest + primeiro teste (migrations correm de 0 → v1 numa BD em memória)
  <!-- jest-expo preset; teste do runner contra better-sqlite3 (adaptador MigrationDb, zero mocks): 0→topo, idempotência, rollback de SQL inválido, ordenação. O cenário "0→v1 com schema real" acresce ao mesmo ficheiro quando a 001_initial existir. -->
- [x] P1 — `src/i18n` com strings pt-PT centralizadas
  <!-- (2026-07-05, feito no arranque da Fase 1 por ser pré-requisito da UI) Objeto tipado sem bibliotecas; labels de BoardType com satisfies Record<BoardType, string>; 'en' futuro troca o objeto, não a infraestrutura. -->
- [ ] P2 — ESLint + Prettier alinhados com o FitAPP
- [ ] P2 — Investigar auto-inclusão de @types com TS 6.0.3 via `tsc --explainFiles` (cosmético, não bloqueante — o `"types": ["jest"]` explícito no tsconfig é suficiente por construção)

**DoD:** ✅ **cumprido 2026-07-05** — app arranca no dispositivo, BD criada com schema v1, teste de migrations verde. Prova: dispositivo real via Expo Go (SDK 57), `[mare] schema_version = 1` em dois arranques consecutivos (init + idempotência), confirmado pelo Bruno; testes 5/5 PASS. Pendentes não-bloqueantes da fase: P1 i18n, P2 ESLint/Prettier, P2 investigação @types.

---

## Fase 1 — Spots e Quiver (Semana 2)

- [ ] P0 — CRUD de spots: lista + formulário (nome, coordenadas, notas). Coordenadas por input manual **ou** "usar a minha localização" (expo-location) — mapa interativo é P2
  <!-- Progresso (2026-07-05, Tarefa 1 da fase): camada de dados feita — SqlDb + RepoDeps em src/db/sqlDb.ts (runAsync devolve { changes } para lançar-em-inexistente numa só round-trip; desvio aprovado), createSpotRepo + rowToSpot exportado em repositories/spotRepo.ts, composição em src/db/index.ts (expo-crypto), 9 testes better-sqlite3 com schema real (inclui edge: update com valores idênticos não lança). Falta a UI (Tarefa 4). -->
- [ ] P0 — Validação de coordenadas (lat/lon plausíveis; avisar se o ponto parecer interior/terra — heurística simples, não bloqueante)
  <!-- Progresso (2026-07-05, Tarefa 3 da fase): parcial. Validação bloqueante feita em src/utils/coords.ts — validateCoords (intervalo lat [-90,90] / lon [-180,180], não-finito, rejeição de (0,0) exato) devolve CoordsError | null com chaves que mapeiam 1:1 para t.spots do i18n (a UI faz t.spots[err]; utils não importa i18n), + parseCoordinate (Number, não parseFloat — 'abc12'/'12abc' dão null; vírgula decimal normalizada para ponto) para a Tarefa 4 não usar parseFloat cru. 11 testes. O aviso de terra fica adiado para a Fase 2: sai da heurística e passa a probe da Marine API (se a Open-Meteo não devolver dados marinhos para o ponto, provavelmente é interior — ver docs/OPEN_METEO.md). -->
- [ ] P1 — CRUD de boards (quiver): nome, tipo, volume
  <!-- Progresso (2026-07-05, Tarefa 2 da fase): camada de dados feita — createBoardRepo + rowToBoard exportado em repositories/boardRepo.ts (decalque do spotRepo; board_type tipado BoardType | null no row sem validação runtime, premissa: o repo é o único escritor da coluna — se surgir outro (import, sync), a validação entra nesse momento), getBoardRepo() na composição, adaptador better-sqlite3 + makeDeps extraídos para __tests__/helpers/testDb.ts (segundo uso chegou, como planeado), 9 testes espelho dos do spot. Nota: o jest-expo usa afinal o testMatch default do Jest (qualquer .ts sob __tests__ é suite), pelo que o helper era recolhido como suite vazia — resolvido com testPathIgnorePatterns no package.json a excluir __tests__/helpers/ (repondo o default de node_modules). Falta a UI (Tarefa 5). -->

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
