# Estatísticas de sessões — tiles do cabeçalho + badge de swell

Data: 2026-07-17 · Aprovado em conversa (âmbito, LIMIT, ranking, arquitetura do streak e testes decididos por pergunta; 2 clarificações do Bruno na aprovação final)

## Âmbito

Peça **D** de um pedido de 5 peças (A-E). **A, B, C e E já existiam** — verificado contra o código antes de planear:

| Peça | Estado |
|---|---|
| A — tokens nos formulários de spot/prancha | Feito 2026-07-16, commit `e98d21a` |
| B — empty state com ícone + CTA | Feito 2026-07-16, commit `46245da` |
| C — editar sessão + botão no detalhe | Feito 2026-07-16, commit `13f12de` |
| E — tema claro/escuro (`useColorScheme`) | Feito 2026-07-16/17, commits `da190f3..d15edf3` |
| **D — estatísticas + badge** | **Esta spec.** Não existe. |

Fora de âmbito: onboarding, notificações, comparar sessões, partilhar, unidades (todos adiados por decisão anterior); motor de insights da Fase 4 (gate ≥20 sessões); undo do eliminar (P2).

## Conflitos resolvidos antes de desenhar

**Tokens do tema claro.** O pedido trazia tokens diferentes dos que estão no código (fundo `#F4EFE6` vs `#F7F2E7`, marca azul `#1F3A4D` vs laranja `#C4622D`, Newsreader/IBM Plex/Public Sans vs Fraunces/JetBrains/Instrument). **Decisão: fica o que está** — o `DESIGN.md` é a fonte de verdade (CLAUDE.md), justifica o laranja por escrito, e o tema foi validado no dispositivo. O tema escuro do pedido bate certo com o implementado.

**D1 (editar sessão: hora não editável).** Contradiz o que está construído e validado. Já registado no `DESIGN.md` a favor do código, em 2026-07-17. Fora do âmbito desta spec, não se mexe.

**Ranking tautológico.** O pedido descrevia a posição do spot ("Nª em X"). Com um só utilizador é sempre 1º — não há com quem competir. **Decisão: o tile mostra a contagem** ("Carcavelos · 12"), que é o facto informativo.

## Arquitetura

**Nenhuma query nova era estritamente necessária** (o `SessionListItem` já traz tudo), mas a store carrega `listWithDetails(50, 0)` — **LIMIT 50**. Calcular "recorde de sempre" ou streak sobre as últimas 50 sessões está certo hoje (<5 sessões) e passa a mentir em silêncio na 51ª. **Decisão: query de agregação no repo**, sobre a tabela toda.

### Camada de dados — `sessionRepo.getStats()`

O repo devolve **factos crus, não conclusões**:

```ts
export interface SessionStatsRaw {
  /** started_at (epoch s, UTC) de TODAS as sessões, desc. Base do streak. */
  startedAtAll: number[];
  /** Maior swell entre sessões com condições ok, e o spot dela. null sem sessões ok. */
  record: { swellHeightM: number; spotName: string } | null;
  /** Contagem por spot, desc. Vazio sem sessões. */
  sessionsBySpot: { spotName: string; count: number }[];
}

getStats(): Promise<SessionStatsRaw>;
```

Três `SELECT` numa chamada. Sobre a tabela toda — imune ao LIMIT da lista.

**Filtro de `fetch_status` — a distinção importa (clarificação do Bruno):**
- `record` **filtra `fetch_status='ok'`**: o swell tem de existir para ser recorde.
- `sessionsBySpot` **NÃO filtra**: "o spot que mais surfas" não depende de a API ter respondido. Conta todas.
- `startedAtAll` **NÃO filtra**: idem — surfaste nessa semana, com ou sem condições obtidas.

Os três comentam esta razão no código.

### Lógica — `src/services/stats/` (módulos puros)

```ts
// streak.ts
export function weekStreak(startedAtAll: number[], now: Date): number;
```

Agrupa por semana ISO (segunda-domingo) em **hora local** — a semana do surfista é a do relógio dele, não UTC. Anda para trás desde a última semana com sessão; para no primeiro buraco.

**A semana atual não conta como buraco enquanto não acabar.** Sem isto, uma streak de 8 semanas mostraria `0` à segunda-feira de manhã — falso e desmoralizante. Convenção do Duolingo/GitHub.

```ts
// badge.ts
export function swellVsAverage(
  session: SessionListItem,
  spotSessions: SessionListItem[],
): number | null;
```

`null` se o spot tiver **<10 sessões `ok`** (amostra insuficiente para uma média significar algo) ou se a percentagem não for positiva. A média é das **outras** sessões `ok` do spot — a própria sessão sai da média, senão compara-se consigo mesma.

Porquê SQL para uns e TS para o streak: `MAX`/`COUNT GROUP BY` são triviais em SQL; "semanas ISO consecutivas com a atual a não contar como buraco" em SQLite exige `strftime` + window functions — ilegível, e só testável com BD. Assim cada camada faz o que faz bem.

### Estado — `statsStore`

Store pequena pelo padrão das outras (repo por ação, try/catch → `error`): `stats: SessionStatsRaw | null`, `load()`. Carrega junto com a lista, no `useFocusEffect` existente.

**Falhar não pode partir o histórico:** se as stats falharem, os tiles não aparecem e a lista funciona na mesma.

### UI

**Três tiles** como `ListHeaderComponent` do `FlatList` (não um `View` acima — senão não faz scroll com o conteúdo):
- streak: `8 semanas`
- recorde: `1.2 m · Carcavelos`
- spot mais surfado: `Carcavelos · 12`

**Cada tile desaparece se não tiver dado** (streak 0; sem sessões `ok`; sem sessões). Zero placeholders, zero "—". Com a lista vazia não há barra — o empty state já manda a mensagem.

**Badge:** pill `+70%` em `accent`/`accentOn`, no canto superior direito da zona de condições do cartão. Só aparece com ≥10 sessões `ok` no spot e percentagem positiva; caso contrário o cartão simplesmente não o tem (sem espaço reservado).

Tudo com os tokens do tema ativo via `useTheme()` — funciona nos dois temas.

## Testes

- **`weekStreak`**: buracos, semana atual vazia (não parte a streak), semana única, array vazio, e a fronteira WET/WEST (a app já tem epochs reais de 29/03 e 25/10 nos testes do matcher — reutilizar a técnica).
- **`swellVsAverage`**: percentagem correta; a própria sessão não entra na média; percentagem negativa → null; **fronteira exata: 9 sessões `ok` no spot → sem badge, 10 → com badge** (clarificação do Bruno: fecha a ambiguidade `>=10` vs `>10` por prova, não por leitura do código).
- **`getStats`**: teste de repo (better-sqlite3, dados semeados) — imune ao LIMIT da lista; `record` filtra `ok`; `sessionsBySpot` e `startedAtAll` NÃO filtram; ordenações corretas.
- UI sem testes (MVP, CLAUDE.md regra 4).

## Realidade dos dados (assumida)

Com <5 sessões, isto mostra "1 semana", um recorde, e "Carcavelos · 4". **O badge nunca vai aparecer** (precisa de 10 sessões `ok` no mesmo spot). É estrutura correta à espera de dados — escolha consciente do Bruno, com contas honestas: nada é fabricado, e o que não tem dados não renderiza.
