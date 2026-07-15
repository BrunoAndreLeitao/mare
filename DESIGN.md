# Design System — Maré

## Contexto do produto
- **O que é:** diário de surf pessoal — registo de sessão em <30s, condições do mar preenchidas automaticamente.
- **Para quem:** utilizador único (Bruno) no MVP; local-first, sem conta.
- **Categoria:** ferramenta pessoal de registo, não app de fitness social nem produto de consumo.
- **Tipo de projeto:** app móvel (React Native/Expo), pt-PT.

## Direção estética
- **Direção:** Diário de Bordo (logbook náutico) — não a app-de-fitness genérica azul-sobre-branco.
- **Nível de decoração:** intencional — a tipografia e a cor fazem o trabalho; sem padrões decorativos, sem ilustração.
- **A coisa memorável:** isto deve parecer um caderno de bordo que dá gosto continuar a preencher na sessão 200, não um formulário.
- **Humor:** papel quente, tinta de navegador, leituras de instrumento. Sério mas pessoal — um objeto, não um dashboard.

## Tipografia
- **Display/títulos (nomes de spot, headings de ecrã):** Fraunces — serif robusto de alto contraste, evoca cartas náuticas e placas gravadas. `Fraunces_600SemiBold` para títulos, `Fraunces_500Medium` para subtítulos.
- **Corpo/labels/botões:** Instrument Sans — geométrica mas com carácter, legível em chips e formulários. `InstrumentSans_400Regular` / `_600SemiBold` para labels ativos.
- **Dados/leituras (swell, vento, maré, volume de prancha):** JetBrains Mono com `tabular-nums` — as condições do mar são leituras de instrumento, devem parecer números alinhados, não prosa.
- **Carregamento:** `@expo-google-fonts/fraunces`, `@expo-google-fonts/instrument-sans`, `@expo-google-fonts/jetbrains-mono` (expo-font já está instalado). Uma dep nova por família — justificada pelo passe de design.
- **Escala:** hero 32/38, título ecrã 22/28, título cartão 17/22, corpo 15/21, label 13/16, dado destacado (swell+período) 17/22 mono, dado contexto (vento+maré) 13/18 mono.

## Cor
- **Abordagem:** restrita — um acento, o resto é tinta e papel.
- **Fundo (`background`):** `#F7F2E7` — papel/vitela quente, não branco clínico.
- **Superfície (`surface`, cartões):** `#FBF8F0` — um tom acima do fundo, quase impercetível, só para separar o cartão da página.
- **Tinta primária (`ink`):** `#16324F` — azul-marinho profundo, quase preto; texto principal e títulos.
- **Tinta secundária (`inkMuted`):** `#5C6B73` — cinza-azulado para metadados (hora, prancha, duração).
- **Acento (`accent`):** `#C4622D` — laranja queimado (bóia, corda, madeira tratada); usado só em CTAs primários, seleção ativa de chip, e estados de retry. Substitui o `#208AEF` genérico atual em todo o código.
- **Sucesso (`success`):** `#3D6B4F` — verde azeitona, para condições `ok`.
- **Erro (`error`):** `#A33B2E` — terracota escuro, para falhas e validação. Substitui `#c0392b`.
- **Aviso/pendente (`pending`):** `#8A7A5C` — sépia, para "a obter…".
- **Linhas/bordas (`hairline`):** `#DCD3BF` — bege-acinzentado, substitui `#ccc`/`#ddd`.
- **Modo escuro:** não é prioridade no MVP (app de uso diurno/pós-praia); se entrar, inverter para `ink` como fundo (`#16324F`→`#12202F`) e `background` como texto, reduzindo saturação do acento em ~15%.

## Espaçamento
- **Unidade base:** 4px.
- **Densidade:** confortável — os cartões de histórico já são densos em dados (rating, meta, sinal, contexto); o espaço em volta compensa.
- **Escala:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48).

## Layout
- **Abordagem:** disciplinado por grelha — listas e formulários em coluna única, sem assimetria. Este é um utilitário de registo rápido, não um site editorial.
- **Largura máxima de conteúdo:** full-bleed em mobile (sem max-width — é o ecrã todo do telemóvel).
- **Raio de borda:** chips `full` (pill, como já está), cartões `12px` (acima do `8px` genérico atual — mais próximo do papel/cartão físico), inputs `8px`.
- **Divisores de lista:** trocar `hairlineWidth` cinza por `hairline` (#DCD3BF) — mais quente que o cinza atual.

## Motion
- **Abordagem:** minimal-funcional — só transições que ajudam a perceção (scroll-to-error já implementado, seleção de chip, pull-to-refresh nativo).
- **Easing:** entrada ease-out, saída ease-in.
- **Duração:** micro 100ms (seleção de chip/estrela), curta 200ms (scroll-to-error, troca de estado do cartão).
- Sem animação de entrada coreografada — o valor aqui é velocidade de registo, não espetáculo.

## Aplicação aos ecrãs existentes (guia de migração)

**Cartão de sessão (histórico):**
- `spotName` → Fraunces SemiBold 17, cor `ink`.
- `when` → Instrument Sans 13, `inkMuted`.
- `condSignal` (swell+período) → JetBrains Mono 17 tabular-nums, `ink` — é o dado mais importante do cartão, ganha peso mono.
- `condContext` (vento+maré) → JetBrains Mono 13 tabular-nums, `inkMuted`.
- `condQuiet` (pending) → Instrument Sans itálico 13, `pending`.
- Estrelas preenchidas: `accent` (#C4622D) em vez de `#f5a623`.
- Fundo do cartão: `surface`; separador: `hairline`.

**Nova sessão:**
- Chips selecionados → fundo `accent`, texto `background` (não branco puro).
- Labels de secção (`t.sessions.spot`, `.when`, etc.) → Instrument Sans SemiBold 13, `inkMuted`, uppercase com letter-spacing leve (tom de etiqueta de caderno).
- `whenPreview` → JetBrains Mono 13 (é uma leitura de data/hora).
- Botão de registo → `accent` sólido, texto Instrument Sans SemiBold.
- Erros → `error` (#A33B2E) em vez de `#c0392b`.

**Geral:**
- Fundo de todos os ecrãs: `background` (#F7F2E7), não branco.
- Substituir todas as ocorrências de `#208AEF` por `accent`.

## Decisões e porquê
| Decisão | Racional |
|---|---|
| Serif (Fraunces) em vez de sans em todo o lado | Diferencia de todas as apps de fitness genéricas; reforça "logbook", não "tracker". Risco assumido conscientemente. |
| Monoespaçada para dados do mar | Swell/vento/maré são leituras de instrumento, não prosa — tabular-nums evita o "salto" de largura entre sessões. |
| Papel quente em vez de branco | Branco clínico é o padrão de toda app de produtividade; o tom quente é o que torna isto pessoal. |
| Laranja queimado em vez de azul genérico | `#208AEF` é o azul-app-default; o laranja tem referência marítima (bóias, cordame) e destaca-se de qualquer concorrente. |
| Sem motion expressivo | O princípio inegociável nº1 do CLAUDE.md é registo em <30s — coreografia visual é fricção, não valor. |
