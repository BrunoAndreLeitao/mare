# Handoff: Maré — Design Visual (Diário de Surf)

## Overview
Passe de design visual para a Maré, uma app de diário de surf pessoal (React Native/Expo). O objetivo deste trabalho foi definir uma identidade visual própria — "diário pessoal", não app de meteorologia — e desenhar os ecrãs principais: lista de Sessões, registo de sessão, Spots, Perfil, detalhe da sessão, e a tab bar.

Foi explorado um conjunto de direções visuais e o sistema final escolhido é um **tema duplo**:
- **Claro — "Caderno de bordo"**: papel quente, serifa editorial, números em mono (como carimbo de instrumento).
- **Escuro — "Carta náutica"**: carvão/azul de carta, serifa itálica + sans, mood de "print emoldurado".

Os dois temas partilham exatamente a mesma estrutura, espaçamento e comportamento — só mudam as cores e as duas famílias tipográficas. Isto foi pensado deliberadamente para ser barato de manter em React Native (poucas cores exatas, escala tipográfica simples).

## About the Design Files
Os ficheiros incluídos (`Maré - Direções Visuais.dc.html`, `ios-frame.jsx`) são **referências de design em HTML/React web** — mockups de alta fidelidade que mostram o aspeto e comportamento pretendidos, não código de produção para copiar diretamente. A tarefa é **recriar estes ecrãs em React Native/Expo**, usando os componentes, navegação e state management já existentes no projeto (ou os mais adequados, se ainda não existirem) — nunca embutir HTML/CSS/DOM.

Notas específicas de tradução web → React Native:
- `<div>` → `<View>`, texto sempre dentro de `<Text>` (RN não tem herança de tipografia em containers).
- `display:flex` é o default de qualquer `View` em RN, mas `flexDirection` por omissão é `column` (na web é `row`) — confirmar sempre a direção nos estilos abaixo.
- `gap` é suportado nativamente em `View`/`flexbox` desde RN 0.71+; se o projeto usar uma versão mais antiga, substituir por `marginRight`/`marginBottom` nos filhos.
- `box-shadow` não existe — usar `shadowColor/shadowOffset/shadowOpacity/shadowRadius` (iOS) + `elevation` (Android).
- Os ícones são SVGs simples (paths incluídos abaixo) — recriar com `react-native-svg` (`Svg`, `Path`, `Circle`).
- As fontes (Newsreader, Spectral, IBM Plex Mono, Public Sans, Archivo) são Google Fonts — carregar via `expo-font`/`@expo-google-fonts/*` e usar `useFonts()` com um splash/loading gate, já que RN não tem `<link>`.
- `letter-spacing` em RN é `letterSpacing` (mesmo valor em px, sem unidade `em`/`px` a converter).

## Fidelity
**Alta fidelidade (hifi).** Cores, tipografia, espaçamento e conteúdo estão definidos e testados com os dados reais do produto — recriar pixel a pixel dentro das capacidades do RN, não reinterpretar.

## Design Tokens

### Tema claro — Caderno de bordo
| Token | Valor |
|---|---|
| Fundo do ecrã | `#F4EFE6` |
| Fundo do cartão | `#FBF8F2` |
| Contorno/divider | `#DDD1B8` (cartões), `#C9BE9F` (chips/inputs), `#EAE1CC` (dividers finos, pills) |
| Texto principal (tinta) | `#2B2A28` |
| Texto secundário (muted) | `#8B8375` |
| Acento (tinta-azul) | `#1F3A4D` |
| Fundo de acento suave (barras/pills) | `#E4DCC7` / `#EAE1CC` |
| Erro | `#A6472A` |
| Estrela vazia | `#D9CFB8` |
| Display (nome do spot, títulos) | `Newsreader`, itálico, peso 500 |
| Dados/números (swell, período, chips) | `IBM Plex Mono`, peso 500–600 |
| Corpo (labels, meta) | `Public Sans`, peso 400–600 |

### Tema escuro — Carta náutica
| Token | Valor |
|---|---|
| Fundo do ecrã | `#14181B` |
| Fundo do cartão | `#1C2227` |
| Contorno/divider | `#2C343A` / `#3A424A` |
| Texto principal | `#EDE6D6` |
| Texto secundário (muted) | `#7C8790` |
| Acento (azul de carta) | `#4C7C9C` |
| Acento claro (pills lúdicas) | `#8FB6CE` |
| Fundo de acento suave | `#26333C` |
| Erro | `#C97B4A` |
| Estrela vazia | `#3A424A` |
| Display (nome do spot, títulos) | `Spectral`, itálico, peso 500 |
| Dados/números/labels | `Archivo`, peso 400–700 |

### Escala tipográfica (comum aos dois temas)
- Título de ecrã: 22–26px, peso 500–700
- Hero (swell · período no cartão/lista): 30–32px número + 18–20px segundo valor
- Hero (ecrã de detalhe): 38–44px número + 21–24px segundo valor
- Corpo/meta: 11–13px
- Micro-label (uppercase, tracking .05–.06em): 9.5–11px
- Stat pills (gamificação): número 16–18px peso 600–700, legenda 9.5–10px

### Espaçamento / raios
- Padding de cartão: 15–18px (topo/lados), 14–16px (fundo)
- Border-radius: cartões 10–14px, chips/pills 20px (totalmente arredondadas), stat tiles 9–11px
- Gap entre elementos de um cartão: 9–12px
- Tab bar: padding `9px 0 22px` (o valor de baixo dá espaço ao home indicator do iOS)

## Screens / Views

### 1. Sessões (lista / histórico)
**Propósito:** feed vertical de sessões passadas, ordenado por data (mais recente primeiro). É o ecrã de abertura da app.

**Layout:** `ScrollView` vertical, padding horizontal 16px. Título do ecrã no topo. Por baixo, uma **barra de gamificação** com 3 "stat pills" em `flexDirection:row`, `gap:8px`, cada uma `flex:1`: streak de semanas seguidas, recorde pessoal (maior swell + spot), contagem de sessões no spot mais surfado. Segue-se a lista de cartões de sessão, `gap:14px` entre eles.

**Cartão de sessão — 3 estados:**
1. **Pendente** ("a obter…"): nome do spot + data/hora + estrelas/prancha/duração (já preenchidos pelo utilizador) normais; onde estaria o hero de condições, mostrar texto itálico muted "a obter condições…" e uma barra fina com padrão listado diagonal (skeleton) em vez da barra de energia.
2. **Preenchido**: hero com swell (maior, ex. `1.2 m`) + período (menor, ex. `7.15 s`) na mesma linha; por baixo, uma barra de energia (`height:5–6px`, `border-radius:3px`) cujo preenchimento é proporcional à altura do swell (ex. 83% para 1.2m "boa", 17% para 0.26m "flat") — é o elemento que torna a diferença de qualidade óbvia à primeira vista. Por baixo da barra, uma linha secundária muted: vento + maré (ex. `15.5 km/h N · a vazar`). Quando a sessão está acima da média pessoal, mostrar um badge pill no canto superior direito do hero (`+70%`, fundo de acento, texto invertido).
3. **Erro** ("indisponível"): no lugar do hero, texto na cor de erro "Condições indisponíveis" + ação de texto sublinhado "Tentar de novo ↻" na cor de acento.

**Conteúdo de exemplo (dados reais para calibrar):**
- Boa: Carcavelos · qui 08:10 · ★★★★☆ · Shortboard 6'0 · 55 min · 1.2 m · 7.15 s · 15.5 km/h N · a vazar
- Flat: Carcavelos · ter 17:30 · ★★★★☆ · Mini-Malibu 7'6 · 30 min · 0.26 m · 8.1 s · 17.3 km/h NO · baixa-mar

### 2. Registo de sessão (formulário)
**Propósito:** registar uma sessão em ~10 segundos, saído de água. Tudo por toque; teclado só é necessário para as notas (opcionais).

**Layout:** header com "Cancelar" (esquerda, texto muted) e título "Nova sessão" (centro); CTA principal fixo no fundo (`position` sticky / fora do `ScrollView`), texto "Guardar sessão" + legenda muted "as condições do mar chegam a seguir" (liga a UX ao facto de os dados de mar serem obtidos de forma assíncrona depois de guardar).

**Campos (todos com label micro-uppercase por cima):**
- **Spot**: chips horizontais (`flexWrap`), o selecionado com fundo de acento e texto invertido; os outros com contorno.
- **Quando**: chip "Hoje · agora" selecionado por omissão + link de texto "editar hora" para abrir um seletor.
- **Como foi?**: 5 estrelas grandes (tamanho de toque ≥ 40px), tocáveis, cor de acento quando preenchidas.
- **Prancha** (opcional): mesmo padrão de chips do Spot.
- **Duração**: segmentos pill (30 / 45 / 55 / 90 min), o selecionado com fundo de acento.
- **Notas** (opcional): caixa de texto multi-linha com placeholder itálico.

### 3. Spots
**Propósito:** lista dos spots onde o utilizador já surfou, com contagem de sessões.

**Layout:** título "Spots" + lista agrupada num único cartão com `border-radius:12px`, cada linha separada por um divider fino: nome do spot (fonte display, itálico) à esquerda, chevron à direita; por baixo do nome, meta muted "N sessões · última [quando]". No fim da lista, ação de texto "+ Adicionar spot" na cor de acento.

### 4. Perfil
**Propósito:** identidade do utilizador + definições essenciais.

**Layout:** avatar circular com iniciais (fundo de acento, texto invertido) + nome + meta muted ("a surfar desde [data] · N sessões"). Por baixo, lista agrupada estilo iOS settings: Unidades (métricas/imperiais), Notificações, Exportar dados, Sobre a Maré — cada linha com chevron à direita (exceto Unidades, que mostra o valor atual em vez de chevron).

### 5. Detalhe da sessão
**Propósito:** ecrã de leitura completa ao tocar num cartão da lista.

**Layout:** header com back-chevron, data por extenso, e ícone de editar (pencil) à direita. Corpo: nome do spot (display, itálico, maior) + meta (dia da semana · hora · duração) + estrelas + prancha. Hero de condições ampliado (mesma lógica do cartão da lista, mas maior: 38–44px). Grid 2×2 com as 4 medidas soltas (Altura, Período, Vento, Maré) em stat tiles individuais — dá uma leitura rápida além do hero. Secção de Notas com o texto livre do utilizador. Ações "Editar" / "Eliminar" em texto, discretas, no fundo (não competem visualmente com o conteúdo).

### 6. Tab bar (Sessões · Spots · Perfil)
**Propósito:** navegação principal, 3 tabs.

**Ícones** (ligados ao produto, não genéricos — ver paths SVG abaixo): Sessões = curva de swell (leitura de instrumento); Spots = pin de localização; Perfil = silhueta simples (círculo + arco). Ativo = preenchido/cor de acento + label a negrito na cor de acento; inativo = apenas contorno + label muted. Cada item tem `minWidth:64` e área de toque vertical (ícone + label) confortável (>44px de altura efetiva com o padding do tab bar).

**Paths SVG dos ícones** (viewBox e path exatos, para recriar com `react-native-svg`):
```
Sessões (swell): viewBox 0 0 20 12
  d="M1 8c1.8 0 1.8-5.5 3.8-5.5S6.6 8 8.4 8s1.8-5.5 3.6-5.5S13.8 8 15.6 8s1.8-5.5 3.4-5.5"
  stroke-width 2 (ativo) / 1.5 (inativo), fill none, stroke-linecap/linejoin round

Spots (pin): viewBox 0 0 14 18
  d="M7 0C3.1 0 0 3.1 0 7c0 5.3 7 11 7 11s7-5.7 7-11c0-3.9-3.1-7-7-7z"
  Ativo: fill = cor de acento + <circle cx="7" cy="7" r="2.3" fill="{cor de fundo do ecrã}" /> (o "furo" do pin)
  Inativo: fill none, stroke = muted, stroke-width 1.4

Perfil (silhueta): viewBox 0 0 16 16
  <circle cx="8" cy="5.2" r="3" />  +  <path d="M2 15c0-3.9 2.7-6.2 6-6.2s6 2.3 6 6.2" />
  Ativo: fill = cor de acento (ambas as formas)
  Inativo: fill none, stroke = muted, stroke-width 1.4 (ambas as formas)
```

### 7. Onboarding
**Propósito:** primeira abertura da app, 3 ecrãs, sem tour de funcionalidades a mais.
1. **Welcome**: mark do ícone de swell + wordmark "Maré" itálico + tagline "O teu diário de surf". Por baixo, a frase de posicionamento a duas linhas: "O Surfline diz como vai estar o mar." / "**A Maré diz como tu surfas nesse mar.**" (2ª linha a cor de acento). CTA "Começar" + 3 dots de progresso (1º ativo).
2. **Como funciona**: 3 linhas, cada uma com o ícone da tab bar correspondente + título a negrito + descrição muted de uma frase: "Regista em 10 segundos", "As condições chegam sozinhas" (ícone de pin), "Vê o padrão ao longo do tempo" (novo ícone: linha ascendente com 4 pontos, ver path abaixo). CTA "Seguinte" + dots (2º ativo) + link "Saltar".
3. **CTA final**: "Pronto para a primeira entrada?" (display, itálico) + subtexto + CTA "Registar sessão" + link "Talvez mais tarde" + dots (3º ativo).

Path do ícone de tendência (novo, só usado aqui): viewBox `0 0 20 14`, `d="M1 12l5-4 5 2 8-9"` + 4 `<circle r="1.6">` nos pontos (1,12) (6,8) (11,10) (19,1).

### 8. Adicionar novo spot
**Propósito:** alcançado a partir do "+ Adicionar spot" no ecrã de Spots. Dois estados:
- **Pesquisa** (fluxo principal): campo de busca (ícone de lupa) + lista "Sugeridos perto de ti" (nome + distância, ex. "Costa da Caparica · 4.8 km") + fallback em texto "Não encontras o teu spot? → Adicionar manualmente".
- **Manual**: campo "Nome do spot" + um placeholder de mapa (padrão listado diagonal, sem imagem real — ver convenção de placeholders) com o pin da tab bar centrado e a legenda "mapa · toca para colocar o pin"; por baixo, o par de coordenadas (lat/lon) em mono, só leitura, que resulta do toque no mapa. CTA "Guardar spot". As coordenadas são obrigatórias — é o que a Open-Meteo Marine API precisa para dar condições a este spot.

### 9. Editar sessão
**Propósito:** a partir do "Editar" no Detalhe. Estrutura idêntica ao Registo (mesmos chips/estrelas/segmentos), pré-preenchida com os valores da sessão. Duas diferenças:
- **"Quando"** deixa de ser um chip tocável — passa a um pill só de leitura (fundo mais claro, sem interação) com uma nota em itálico por baixo: "não editável — as condições já foram obtidas para este momento". Isto evita que o utilizador mude a hora e desalinhe as condições já associadas.
- **"Eliminar sessão"** fica disponível aqui, como link de texto na cor de erro, junto ao CTA "Guardar alterações" no fundo.

### 10. Notificações
**Propósito:** a partir de Perfil → Notificações. Lista agrupada de 4 toggles (switch pill 40×24px, bola 20px; ativo = fundo de acento + bola na cor de fundo do ecrã, inativo = fundo/contorno muted + bola muted à esquerda), cada um com título a negrito + descrição muted de uma linha:
1. **Condições prontas** (on) — quando o swell/vento/maré ficam disponíveis para uma sessão.
2. **Resumo semanal** (on) — streak, recorde e sessões da semana, ao domingo.
3. **Lembrete de registo** (off) — um toque depois de estar perto de um spot habitual.
4. **Alertas do teu spot** (on) — o diferenciador: compara condições futuras com as sessões mais bem cotadas do utilizador nesse spot, não com um limiar genérico de "bom surf".

### 11. Empty state — sem sessões
**Propósito:** primeira abertura do ecrã de Sessões, antes de qualquer registo. Substitui a barra de gamificação e a lista de cartões (não há dados ainda) por um convite centrado: ícone de swell em tom apagado (muted) + "Ainda sem sessões" (display, itálico) + subtexto de uma frase + CTA "Registar sessão". A tab bar mantém-se normal.

### 12. Comparar duas sessões
**Propósito:** compara duas sessões lado a lado (ex. a partir do Detalhe ou da lista). Em vez de colunas lado a lado (compressas em ecrã estreito), usa **barras empilhadas por medida**: cada métrica (Altura, Período, Vento) mostra duas linhas — valor + barra de energia — uma por sessão, a de cima a cor cheia de acento, a de baixo em tom muted. Maré é só texto (categórico, sem barra). Termina com uma frase de insight editorial (itálico, fonte display) que é honesta com os números dessa comparação específica — não uma alegação genérica.

### 13. Estatísticas do perfil
**Propósito:** acessível a partir de Perfil (nova linha "Estatísticas"). Estrutura:
- 3 stat tiles no topo: sessões totais, streak atual, sessões no spot mais surfado.
- **"Condições preferidas"** (a peça central): duas barras de gama (altura e período), cada uma com uma faixa de destaque posicionada sobre uma escala completa (ex. altura 0–2.5m, faixa destacada 1.0–1.6m) — calculada a partir das sessões de 4–5 estrelas do utilizador. É a estatística mais alinhada com a tese do produto.
- **Pranchas**: barra horizontal de 2 segmentos (percentagem de uso por prancha) + legenda.
- **Spots**: lista ranqueada com barra proporcional ao nº de sessões por spot.

### 14. Partilhar sessão
**Propósito:** gera um cartão partilhável (formato Story 9:16 ou Post quadrado, via segmento por cima do CTA) com a mesma leitura hero do cartão da lista (spot, data, estrelas, swell·período, barra de energia, vento/maré) dentro de uma moldura de cartão com sombra, e uma legenda discreta "registado na maré" + wordmark no canto. Ações no fundo: CTA "Partilhar" + links de texto "Guardar imagem" / "Copiar texto" — **sem ícones de apps de terceiros** (nada de logótipos do Instagram/WhatsApp/etc.).

### 15. Definições de unidades
**Propósito:** a partir de Perfil → Unidades. Um preset rápido "Sistema" (segmentado Métrico/Imperial) no topo, seguido de duas listas de escolha única com checkmark (path `M1 5.5l4 4 8-8`, viewBox `0 0 14 11`) na opção selecionada: **Altura da onda** (Metros / Pés) e **Vento** (km/h / Nós / mph). A Maré (estado categórico "a vazar"/"baixa-mar") não tem unidade, por isso não aparece aqui.

## Interactions & Behavior
- **Fluxo de registo → pendente → preenchido/erro**: ao guardar uma sessão, ela aparece de imediato na lista em estado "pendente" (os dados que o utilizador introduziu já visíveis); quando a chamada à Open-Meteo Marine API resolve, o cartão atualiza para "preenchido" ou "erro" sem re-render disruptivo (idealmente uma transição suave do skeleton para o conteúdo real).
- **Tentar de novo**: no estado de erro, o toque relança o pedido à API para essa sessão.
- **Navegação**: tocar num cartão da lista de Sessões abre o Detalhe; back-chevron do Detalhe volta à lista mantendo a posição de scroll.
- **Formulário**: todos os campos são optimistic/local até "Guardar sessão"; duração e prancha têm valores por omissão sensatos (última prancha usada, 45–60min) para minimizar toques.
- **Gamificação**: streak, recorde pessoal e contagem por spot são derivados (calculados), não editáveis; o badge "+N% vs média" no cartão compara o swell da sessão com a média histórica pessoal do utilizador nesse spot (ou global, a decidir).
- **Onboarding**: 3 ecrãs com swipe/CTA "Seguinte", "Saltar" disponível a partir do 2º; termina em "Registar sessão" (leva ao Registo) ou "Talvez mais tarde" (leva ao Empty state / Sessões).
- **Adicionar spot**: a pesquisa é o caminho principal; "Adicionar manualmente" só deve aparecer depois de uma pesquisa sem resultados úteis (ou sempre visível como fallback, a decidir). No estado manual, tocar no mapa atualiza o pin e o par de coordenadas em tempo real.
- **Editar sessão**: "Guardar alterações" não deve permitir gravar sem spot/rating; "Eliminar sessão" pede confirmação antes de remover.
- **Notificações**: cada toggle é independente; "Alertas do teu spot" só faz sentido depois de existir histórico suficiente para calcular o perfil de "melhores sessões" nesse spot — considerar um estado desativado/explicativo antes disso.
- **Comparar sessões**: o utilizador escolhe as duas sessões a partir da lista (ex. seleção múltipla) ou a partir do Detalhe ("comparar com...").
- **Partilhar sessão**: o toggle Story/Post troca as proporções do cartão de preview (9:16 vs 1:1); "Partilhar" abre a share sheet nativa do SO com a imagem gerada.
- **Unidades**: mudar o preset "Sistema" deve atualizar as duas escolhas de baixo automaticamente (mantendo a opção de override individual).

## State Management
- Lista de sessões (array, ordenado por data desc) com um campo de estado por sessão para as condições de mar: `'pending' | 'ready' | 'error'`.
- Estado do formulário de registo: spot selecionado, timestamp, rating (1–5), prancha (opcional), duração (minutos), notas (string opcional).
- Estatísticas derivadas para a barra de gamificação (streak, recorde, contagem por spot) — calculadas a partir do histórico, não guardadas como estado próprio.
- Tema (claro/escuro): pode seguir o tema do sistema (`useColorScheme()`) ou ser uma preferência explícita no ecrã de Perfil — a decidir com o utilizador; os tokens acima já cobrem os dois.

## Assets
- **Fontes** (Google Fonts, precisam de ser adicionadas ao projeto Expo via `expo-font` ou pacotes `@expo-google-fonts/*`): Newsreader (400/500/600 + itálico), IBM Plex Mono (400/500/600), Public Sans (400/500/600/700), Spectral (400/500/600 + itálico), Archivo (400/500/600/700).
- **Ícones**: nenhum ficheiro de imagem — todos os ícones são paths SVG simples, listados acima, para recriar com `react-native-svg`.
- Não há fotografia/imagens no design atual — todos os ecrãs são só tipografia + forma.

## Files
- `Maré - Direções Visuais.dc.html` — ficheiro principal com todo o histórico de exploração e todos os ecrãs finais. Secções relevantes (o número mais alto = mais recente, fica mais acima no ficheiro):
  - **6** — Sistema final: Sessões, Registo, Spots, Perfil, Detalhe (opções 6a claro / 6b escuro)
  - **7** — Onboarding (7a/7b)
  - **8** — Adicionar novo spot (8a/8b)
  - **9** — Editar sessão (9a/9b)
  - **10** — Notificações (10a/10b)
  - **11** — Empty state sem sessões (11a/11b)
  - **12** — Comparar duas sessões (12a/12b)
  - **13** — Estatísticas do perfil (13a/13b)
  - **14** — Partilhar sessão (14a/14b)
  - **15** — Definições de unidades (15a/15b)
  - Secções 1–5 são exploração de direções anteriores (histórico) — não fazem parte do sistema final, mas mostram o raciocínio de chegada.
- `ios-frame.jsx` — bezel de iPhone usado só para preview nos mockups; não faz parte do design em si.

Todos os ecrãs usam sempre os mesmos dois temas (a = Caderno de bordo/claro, b = Carta náutica/escuro) e os mesmos tokens/ícones definidos nas secções Design Tokens e Screens acima.
