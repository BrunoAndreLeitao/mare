# Onboarding — 3 ecrãs

Data: 2026-07-16 · Aprovado em conversa (âmbito, persistência e conteúdo decididos por pergunta)

## Âmbito

Onboarding de primeira abertura: 3 passos, terminando na criação do primeiro spot. Secção 7 do `Maré - Direções Visuais.dc.html`, com dois desvios deliberados (ver "Divergências do mockup").

Fecha o P1 da Fase 3 ("Onboarding mínimo: 2 ecrãs — o que é a Maré, criar primeiro spot"), com 3 ecrãs em vez de 2 porque o mockup tem um ecrã intermédio que vale a pena.

## Contexto da decisão de âmbito

O ficheiro de design tem 15 secções. Levantamento feito em 2026-07-16 do que existe lá e não na app, e porque só este entra agora:

| Secção | Ecrã | Porque não entra |
|---|---|---|
| 2 | Barra de gamificação (streak, recorde) | Depende de dados reais (<5 sessões hoje) — Fase 4 |
| 8 | Adicionar spot (pesquisa + mapa) | Precisa de base/API de spots que não existe + `react-native-maps` (P2). O fallback manual já está feito |
| 10 | Notificações (4 toggles) | Os alertas são Fase 5 |
| 12 | Comparar duas sessões | Depende de dados reais |
| 13 | Estatísticas do perfil | É literalmente o ecrã de insights da Fase 4 (gate: ≥20 sessões) |
| 14 | Partilhar sessão | Precisa de pelo menos uma sessão boa |
| 15 | Definições de unidades | Exigiria persistência de preferências (migration ou dep) para um ecrã decorativo hoje; valor só com utilizadores não-métricos |

**Onboarding é o único construível hoje sem infraestrutura nova.** O seu valor não é para o utilizador zero (o Bruno já sabe o que a app faz) — é para o Beta Pessoal com os 5-10 surfistas de Carcavelos, o próximo marco do BACKLOG.

## Conflito resolvido: secção 9 vs. o código

O mockup (secção 9, "Editar sessão") diz: *"Quando deixa de ser um chip tocável — a hora já tem condições associadas, por isso é só leitura"*. **A app faz o contrário** (hora editável, com invalidação de condições) e foi validado no dispositivo em 2026-07-16. **Decisão: fica editável** — corrigir uma hora mal registada é um caso real, e a invalidação já existe testada. O mockup perde neste ponto; registar no DESIGN.md para não voltar a colidir.

## Quando aparece

Rota `/onboarding`. O `(tabs)/index.tsx` decide após carregar: se `spots.length === 0 && sessions.length === 0` → `router.replace('/onboarding')`.

- **`replace`, não `push`:** o onboarding não é sítio a que se volte com o back.
- **A conjunção importa:** quem arquive todos os spots mas tenha 30 sessões no histórico não é utilizador novo. Só "sem spots E sem sessões" é.
- **Sem flag persistida** (decisão): o estado do utilizador É o critério. Zero infra, zero deps, zero migration. Custo aceite: quem apagar tudo revê o onboarding — o que é correto, não um bug.
- **Consequência intencional:** "Saltar" e "Talvez mais tarde" não gravam nada, logo o onboarding reaparece no próximo arranque enquanto não houver spot. É a intenção: sem spot, o utilizador não consegue registar nada.
- **"Próximo arranque" precisa de mecânica, não só de intenção** (lacuna da 1ª versão desta spec, apanhada na revisão final): o critério (estado do utilizador) continua verdadeiro depois de saltar, por isso o redirect voltava a disparar assim que o ecrã remontava — "saltar" não funcionava de todo. Resolve-se com uma flag `redirectedThisLaunch` de âmbito de módulo em `(tabs)/index.tsx`: sobrevive à remontagem do ecrã e morre com o processo, que É o "próximo arranque". Não é persistência — é o outro meio da decisão de não persistir.

## Topologia de navegação (as saídas do onboarding)

Todos os bugs encontrados na revisão final foram de forma da pilha, não de lógica. Fica explícito:

- O onboarding chega por `replace`, logo a pilha é `[onboarding]` — as tabs saíram.
- **"Saltar" / "Talvez mais tarde":** `replace('/(tabs)')`. A flag do arranque impede o bounce de volta.
- **"Criar spot":** `replace('/(tabs)')` **seguido de** `push('/spot/novo')` → pilha `[(tabs), spot/novo]`. As duas navegações são deliberadas: sem o `replace`, a pilha ficaria só com o formulário — sem chevron de voltar (cancelar impossível) e com o `router.back()` pós-criação do `spot/novo.tsx` sem destino, encalhando o utilizador no formulário que acabou de submeter. O `spot/novo.tsx` não se toca: o `back()` dele está certo para todos os outros chamadores.
- **Enquanto os loads não terminam**, com a lista vazia, o ecrã de sessões renderiza só o fundo: mostrar "Sem sessões — regista a primeira" a quem vai ser mandado para o onboarding é uma mensagem errada a piscar.

## Os três passos

Um único ficheiro `src/app/onboarding.tsx` com estado local `step: 0 | 1 | 2` — não são três rotas; é um ecrã com três passos e dots de progresso.

**Passo 1 — Welcome.** "Maré" (display itálico) + "O teu diário de surf". A frase de posicionamento a duas linhas: "O Surfline diz como vai estar o mar." / "A Maré diz como tu surfas nesse mar." (2ª linha em `accent`). CTA "Começar".

**Passo 2 — Como funciona.** Três linhas, cada uma com ícone + título + descrição:
- `water` — "Regista em 10 segundos" / "Spot, hora, rating, prancha. Saído da água, sem fricção."
- `location` — "As condições chegam sozinhas" / "Swell, vento e maré, associados à tua sessão automaticamente."
- `person` — "Vê o padrão ao longo do tempo" / "Cada sessão fica registada com as condições que a fizeram."

CTA "Seguinte" + link "Saltar".

**Passo 3 — CTA final.** "Pronto para a primeira entrada?" (display itálico) + "Cria o teu primeiro spot para começares a registar." CTA "Criar spot" → `router.replace('/spot/novo')`. Link "Talvez mais tarde" → `router.replace('/(tabs)')`.

Dots de progresso (3) em todos os passos, o ativo em `accent`.

## Divergências do mockup (deliberadas)

1. **A 3ª linha do passo 2 muda.** O mockup promete "Recordes, streaks, e como cada spot te serve" — **nada disso existe** (gamificação e insights são Fase 4, adiados). Prometer streaks a quem abre a app e não os encontra é uma promessa quebrada no primeiro minuto. Texto novo diz o que é verdade hoje.
2. **O CTA final leva a criar spot, não a registar sessão.** O mockup manda para "Registar sessão", que sem spots mostra "Cria primeiro um spot" — uma parede. O BACKLOG já pedia que o onboarding acabasse no primeiro spot.
3. **Ícones: Ionicons da tab bar** (`water`/`location`/`person`), não os SVG paths próprios do mockup (curva de swell, pin, tendência). Estes exigiriam `react-native-svg` — dep nova para 3 ícones, quando a app inteira já usa Ionicons.

## Implementação

- **i18n:** bloco `t.onboarding` novo em `src/i18n/index.ts` com todos os textos. Zero strings nos componentes (CLAUDE.md).
- **Tema:** `useTheme()` + `makeStyles(theme)` como todo o resto — funciona nos dois temas desde o dia 1.
- **Rota:** `Stack.Screen name="onboarding"` com `headerShown: false` (é um ecrã de boas-vindas, não tem chrome).

## Testes

**Nenhum.** É UI pura (MVP, CLAUDE.md regra 4) e a única lógica — `spots.length === 0 && sessions.length === 0` — é uma condição de uma linha. Verificação: `npx tsc --noEmit` limpo, `npm test` verde (100, inalterados), e o DoD no dispositivo.

## DoD no dispositivo

1. App com spots apagados → arranca no onboarding; os 3 passos navegam; "Criar spot" leva ao formulário.
2. Criar o spot → voltar à app → o onboarding não reaparece.
3. Os 3 passos nos dois temas (claro e escuro).

## Fora de âmbito

Pedido de permissão de notificações (o mockup sugere; é Fase 5), criar o spot dentro do onboarding (reutiliza-se `/spot/novo`, que já existe e valida), SVGs próprios, swipe gesture entre passos (os CTAs bastam), e os ecrãs da tabela do contexto acima.
