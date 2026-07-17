# Partilhar sessão — imagem do cartão

Data: 2026-07-17 · Aprovado em conversa (deps, o que capturar, tema, e 2 correções + 2 ajustes técnicos do Bruno na aprovação)

## Âmbito

A partir do ecrã de Detalhe, um botão "Partilhar" gera uma imagem do cartão da sessão e abre o share sheet nativo. Secção 14 (t14) do `Maré - Direções Visuais.dc.html`.

**Só a T14 nesta ronda.** A T15 (definições de unidades) foi **adiada**: não existe persistência de preferências no projeto (nem AsyncStorage nem settings na BD), as unidades estão hardcoded em 8+ sítios, e o Bruno surfa em métrico — a justificação era "completar o mockup", a mais fraca, e sem beta a começar a infra ficaria meses parada. Retoma-se quando um tester precisar de pés/nós.

Fora de âmbito também: t13 (estatísticas/perfil = Fase 4 disfarçada, bloqueada por dados), t12 (comparar), t10 (notificações), t7 (onboarding). O toggle Story/Post do mockup (9:16 vs 1:1) — polish, um formato só nesta ronda.

## Dependências (novas, justificadas)

`expo install react-native-view-shot expo-sharing` — ambas no `bundledNativeModules` do SDK 57 (`react-native-view-shot@5.1.0`, `expo-sharing@~57.0.2`), instaladas nas versões certas sem adivinhar. Justificação no commit (CLAUDE.md regra 6).

**Deliberadamente NÃO `expo-media-library`:** pediria permissão de galeria. O `view-shot` captura para o cache e devolve um URI de ficheiro que o `expo-sharing` partilha direto — sem permissões, sem guardar na galeria do utilizador.

## Arquitetura — a fronteira intestável reduzida ao mínimo

A parte que não se testa em Jest é só `captureRef` + `shareAsync` (módulos nativos). Tudo o resto é puro e testável. Três camadas:

### 1. `buildShareCardModel(session, conditions)` — função pura (correção do Bruno)

`src/services/share/shareCardModel.ts`. Zero JSX, zero nativo. Recebe o `SessionListItem` (que o detalhe já tem) e as `SessionConditions`, e decide **o que aparece**:

```ts
export interface ShareCardModel {
  spotName: string;
  startedAt: number;
  rating: number;
  meta: string[];               // prancha, duração — só os que existem
  hero: { swell: string; period: string } | null; // null se pending/sem swell
  context: string | null;       // "16 km/h N · a vazar" — null se nada
}
export function buildShareCardModel(
  session: SessionListItem,
  conditions: SessionConditions | null,
): ShareCardModel;
```

Regras (as mesmas do cartão da lista, já decididas na Fase 2): pending ou sem swell → `hero: null`; campo em falta → omitido, não "—" (o cartão de partilha não mostra ausências, ao contrário do detalhe); funciona com **qualquer** sessão. **É aqui que vivem os testes.**

### 2. `ShareCard.tsx` — só renderiza o modelo

`src/components/ShareCard.tsx`. Recebe um `ShareCardModel` e desenha o "print emoldurado" do mockup: spot (Fraunces), data, estrelas, hero swell+período (mono grande), contexto, marca "Maré" discreta no fundo. Tokens do `useTheme()` ativo (claro partilha claro, escuro partilha escuro). Sem lógica de decisão — essa está no modelo.

### 3. `shareSession(ref)` — a fronteira nativa

`src/services/share/shareSession.ts`:

```ts
export async function shareSession(ref: RefObject<View>): Promise<void>;
```

`captureRef(ref, { format: 'png', quality: 1, pixelRatio: 3 })` → `Sharing.shareAsync(uri, { mimeType: 'image/png' })`.

- **`pixelRatio: 3` + `format: 'png'`** (ajuste do Bruno): sem `pixelRatio`, a imagem sai na densidade lógica e fica esborratada nos ecrãs retina.
- **`mimeType: 'image/png'` explícito** (ajuste do Bruno): o default nem sempre é reconhecido pelo share sheet do Android.
- **try/catch: cancelar não é erro.** O utilizador fechar o share sheet, ou o SO recusar, é estado normal — como o fetch de condições falhar (CLAUDE.md). Nunca parte nada; no máximo um aviso silencioso via `console.warn`.

## Como se captura sem o utilizador ver o cartão

O `ShareCard` renderiza-se **fora do ecrã** (posição absoluta, deslocado para além dos limites do viewport) no ecrã de detalhe, com um `ref`. Ao tocar em "Partilhar", `captureRef(ref)` gera o PNG e o share sheet abre. O utilizador nunca vê o cartão na app — só a imagem no share sheet. Sem ecrã intermédio, sem navegação nova.

## Spike primeiro — gate de infraestrutura (correção do Bruno)

**Antes de estilizar o ShareCard**, provar a técnica de risco no dispositivo, à imagem do smoke test da rede antes do matcher:

- Uma view mínima (caixa + texto), fora do ecrã, com `ref`.
- Botão temporário → `captureRef(ref, { format: 'png', pixelRatio: 3 })` → `Sharing.shareAsync(uri, { mimeType: 'image/png' })`.
- **DoD do spike:** o share sheet abre no dispositivo com uma imagem válida (não em branco, não esborratada).

**Se o spike falhar** (o `view-shot` não captura uma view deslocada nalgum dispositivo), o plano B é um ecrã de pré-visualização real: mostra-se o cartão, depois partilha-se. Mais simples de garantir, custa um ecrã. **Não se avança para o ShareCard completo sem o spike verde** — e o Bruno vê o resultado do spike antes de o resto ser construído.

## UI

Botão "Partilhar" no `sessao/[id].tsx`, junto ao "Editar" (o mockup põe-nos juntos). Ícone `share-outline` (Ionicons, já instalado).

## i18n

`t.sessions.share` (label do botão). O cancelamento não é erro, não tem mensagem. Se o `captureRef` falhar de verdade (raro), `console.warn` chega — não vale um alerta ao utilizador por uma partilha falhada.

## Testes

- **`buildShareCardModel`**: pending → `hero: null`; sem swell → `hero: null`; campos de meta em falta omitidos (não "—"); contexto parcial (só vento, ou só maré); sessão completa. É a lógica toda — testada como o resto do projeto.
- **`shareSession` e `ShareCard`**: sem testes. `captureRef`/`shareAsync` são nativos (não correm em Jest; mocká-los testaria o mock, não o comportamento — a mesma razão pela qual o cliente Open-Meteo injeta o `fetch`). O DoD é no dispositivo.

## DoD no dispositivo

1. **Spike** (gate, antes de tudo): captura mínima fora do ecrã → share sheet com imagem válida.
2. Detalhe → "Partilhar" → share sheet com a imagem do cartão, identidade Maré, tema ativo.
3. Uma sessão pending (sem condições) partilha na mesma — sem hero, sem partir.
4. Cancelar o share sheet não deixa a app num estado estranho.
5. Nos dois temas.
