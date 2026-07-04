# Maré — Diário de Surf Inteligente

## Visão

Diário de surf onde o utilizador regista uma sessão em **menos de 30 segundos** (spot, rating, prancha, nota) e a app preenche automaticamente as condições do mar daquele momento via Open-Meteo Marine API. Com sessões acumuladas, a app aprende o perfil do surfista: em que condições **ele** surfa melhor em **cada spot** — e (fase premium) avisa quando o forecast se aproxima desse perfil.

**Proposta de valor numa frase:** o Surfline diz como vai estar o mar; a Maré diz como TU surfas nesse mar.

## Princípios inegociáveis

1. **Registo em 30 segundos.** Qualquer feature que adicione fricção ao registo é rejeitada por defeito. O utilizador dá o subjetivo (rating); a API dá o objetivo (condições).
2. **Local-first, offline-first.** Todos os dados vivem em expo-sqlite no dispositivo. Sem backend no MVP. Sem conta, sem login, sem sincronização. A app funciona 100% offline exceto o fetch de condições — que é diferido para quando houver rede (ver `docs/OPEN_METEO.md`, secção "Fila de pendentes").
3. **Estatística simples > IA.** Os insights são médias ponderadas e agrupamentos por bucket de condições. Nada de ML no roadmap até haver dados reais que o justifiquem.
4. **Sem dark patterns.** O free tier é genuinamente útil (registo ilimitado no MVP; limites só entram com o paywall na Fase 5). Premium desbloqueia insights e alertas, não funcionalidade básica.
5. **Scope feroz.** Se uma tarefa demora mais de 2 dias, parte-se ou corta-se.

## Stack

| Camada | Tecnologia | Notas |
|---|---|---|
| Framework | React Native + Expo (SDK 54+, New Architecture) | Mesmo padrão do FitAPP |
| Linguagem | TypeScript `strict: true` | Sem `any` — usar `unknown` + narrowing |
| Navegação | expo-router (file-based) | |
| Base de dados | expo-sqlite com migrations versionadas | Padrão de `schema_version` do FitAPP |
| Estado | Zustand (stores pequenas por domínio) | Nada de Redux |
| API externa | Open-Meteo Marine + Forecast | Contrato completo em `docs/OPEN_METEO.md` |
| Mapa (Fase 1) | react-native-maps OU lista com coordenadas manuais | Decidir na Fase 1 — lista primeiro se o mapa atrasar |
| Pagamentos (Fase 5) | RevenueCat | Não instalar antes da Fase 5 |
| Testes | Jest + @testing-library/react-native | Obrigatório: motor de matching de condições e motor de insights |

## Estrutura de pastas

```
mare/
├── src/
│   ├── app/                  # expo-router (ecrãs)
│   │   ├── (tabs)/
│   │   │   ├── index.tsx     # Sessões (histórico)
│   │   │   ├── spots.tsx     # Spots
│   │   │   └── perfil.tsx    # Perfil / definições / quiver
│   │   ├── sessao/
│   │   │   ├── nova.tsx      # Registo rápido de sessão
│   │   │   └── [id].tsx      # Detalhe de sessão
│   │   └── spot/[id].tsx     # Detalhe de spot (+ insights na Fase 4)
│   ├── db/
│   │   ├── database.ts       # init, migrations, schema_version
│   │   ├── migrations/       # 001_initial.ts, 002_...
│   │   └── repositories/     # spotRepo, sessionRepo, conditionsRepo, boardRepo
│   ├── services/
│   │   ├── openmeteo/        # client, tipos, mapeamento, fila de pendentes
│   │   └── insights/         # motor de correlação (Fase 4)
│   ├── stores/               # Zustand stores
│   ├── components/           # UI reutilizável
│   ├── i18n/                 # strings pt-PT (preparar para en no futuro)
│   └── utils/                # datas (UTC!), direções cardeais, formatação
├── docs/
│   ├── DATABASE.md           # Schema SQLite completo
│   └── OPEN_METEO.md         # Contrato da API
├── BACKLOG.md                # Backlog faseado com prioridades
└── CLAUDE.md                 # Este ficheiro
```

## Convenções de código

- **Identificadores em inglês** (tabelas, colunas, funções, tipos); **strings de UI em pt-PT** via `src/i18n`. Nunca hardcode de texto visível nos componentes.
- **Datas e horas sempre em UTC** na base de dados (INTEGER, epoch seconds). Conversão para hora local só na camada de apresentação. A Open-Meteo é consultada com `timeformat=unixtime&timezone=UTC` para eliminar ambiguidade de fusos (crítico: PT muda de WET/WEST e um erro de 1h corrompe o matching de condições).
- **Unidades métricas fixas na BD:** metros, segundos, km/h, graus (0° = Norte, convenção meteorológica "de onde vem"). Conversões (ft, nós) só na UI, se alguma vez existirem.
- **Repositories** são a única camada que toca SQL. Ecrãs e stores nunca escrevem SQL.
- **Migrations aditivas e irreversíveis** — nunca editar uma migration já publicada; criar sempre a seguinte.
- **Erros de rede nunca bloqueiam o registo de sessão.** O fetch de condições falhar é um estado normal do sistema (fila de pendentes), não uma exceção.
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).

## Regras para o Claude Code

1. Ler `BACKLOG.md` e trabalhar **apenas** na tarefa indicada. Não avançar tarefas por iniciativa própria.
2. Antes de mexer no schema, ler `docs/DATABASE.md` e criar migration nova — nunca alterar migrations existentes.
3. Antes de mexer no cliente Open-Meteo, ler `docs/OPEN_METEO.md`. Os nomes dos parâmetros da API estão verificados contra a documentação oficial — não inventar variantes.
4. Testes obrigatórios para: matching de hora de sessão → hora de condições, fila de pendentes, e (Fase 4) motor de insights. UI pode viver sem testes no MVP.
5. Ao terminar uma tarefa, atualizar o estado dela no `BACKLOG.md` (`[ ]` → `[x]`) e listar decisões tomadas em comentário.
6. Nunca adicionar dependências sem justificação escrita no PR/commit. O objetivo é manter a app leve.

## Decisões-chave (e porquê)

- **Sem backend no MVP.** Custos ~0€, zero superfície de ataque, zero RGPD complicado (dados nunca saem do dispositivo). Backup/sync é feature premium futura (Fase 6+), não requisito.
- **Sem integração com smartwatches no MVP.** Fragmentação alta, valor marginal. Único hook futuro (Fase 6+): detetar treino "surf" via Health Connect no Android para lembrar o utilizador de avaliar a sessão.
- **Maré via `sea_level_height_msl`.** A Open-Meteo dá altura do nível do mar relativa ao MSL, hora a hora. Não é uma tabela de marés oficial, mas para o nosso caso (correlacionar rating com fase da maré: a encher / a vazar / cheia / vazia) é suficiente — a fase deriva-se comparando horas adjacentes. Documentado em `docs/OPEN_METEO.md`.
- **⚠️ Licenciamento Open-Meteo:** a API é gratuita **apenas para uso não-comercial**. Durante desenvolvimento, beta e enquanto a app for gratuita, estamos dentro dos termos. **No momento em que a subscrição for ativada (Fase 5), é obrigatório migrar para o plano comercial da Open-Meteo (com API key, a partir de ~29€/mês) ou para alternativa equivalente.** Este custo entra no break-even da Fase 5 e o cliente da API deve ser escrito desde o dia 1 com o host e a API key configuráveis por env/config para que a migração seja uma mudança de configuração, não de código.

## Métricas de decisão (definidas antes do lançamento, para não haver batota)

- Utilizador zero (Bruno) com 20+ sessões registadas antes de qualquer trabalho na Fase 4.
- 3 meses pós-lançamento público: ≥100 utilizadores ativos e ≥5 pagantes, ou reavaliar distribuição/produto sem afeição.
- Retenção D30 dos utilizadores com ≥3 sessões é a métrica norte — não downloads.
