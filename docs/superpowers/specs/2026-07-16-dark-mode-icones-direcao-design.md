# Dark mode "Carta Náutica" + ícones de direção e maré

Data: 2026-07-16 · Aprovado em conversa (âmbito, tema, controlo, faseamento e deps decididos por pergunta)

## Âmbito

Os dois itens P2 da Fase 3 que **não dependem de volume de dados**:

- **Dark mode** — tema "Carta Náutica" do README, aplicado à app toda.
- **Ícones de direção e maré** — seta rodada por `*_direction_deg`, indicador de fase de maré.

### Fora de âmbito (adiado deliberadamente, não esquecido)

Filtros (P1), detalhe de spot (P1), onboarding (P1) e paginação do histórico ficam para quando existirem sessões reais que lhes deem forma. Razão registada: com <5 sessões, filtrar filtra o que já cabe no ecrã, o detalhe de spot conta 4 sessões, a paginação está a 46 sessões de distância (o `ponytail:` comment em `sessionsStore.ts` já o diz), e o onboarding tem valor zero para o utilizador zero — o seu valor aparece no Beta Pessoal com os 5-10 testers. Os dois P0 da Fase 3 ("lista de sessões", "detalhe de sessão") já saíram na Fase 2 Tarefa 7 e ficam por marcar no BACKLOG.

Também fora: override manual de tema no Perfil; ícones SVG próprios da tab bar (README §6); `react-native-svg`.

## Decisões tomadas (e o que as fecha)

1. **O tema escuro do README governa tal e qual** — fontes próprias (Spectral/Archivo) e acento azul incluídos. Confirmado explicitamente pelo Bruno depois de lhe ser apresentado o custo: a app troca de tipografia E de acento com o tema, o que é uma mudança de identidade, não uma mudança de iluminação. **Foi escolha dele, vista no mockup. Assunto encerrado — não reabrir.**
2. **O tema claro mantém os valores do DESIGN.md** (`#F7F2E7` fundo, `#C4622D` acento, Fraunces/Instrument/JetBrains), não os do README (`#F4EFE6`, azul `#1F3A4D`, Newsreader/Public Sans/IBM Plex). Já está implementado e validado no dispositivo; o README só governa o escuro, que era o que faltava. O DESIGN.md passa a documentar os dois temas.
3. **Sem definição de tema** — `useColorScheme()` e mais nada. Zero UI nova, zero persistência, zero deps.
4. **Sem `react-native-svg`** — `@expo/vector-icons` (já instalado) chega para setas rodadas.

## Arquitetura do tema

`src/theme.ts` passa de constantes exportadas a dois temas com a mesma forma, mais um hook:

```ts
export interface Theme {
  colors: {
    background; surface; ink; inkMuted; accent; accentOn; accentSoft;
    success; error; pending; hairline; hairlineStrong; starEmpty;
  };
  font: {
    display; displayItalic; displaySemiBold;
    body; bodySemiBold; mono; monoMedium; monoSemiBold;
  };
}
export const lightTheme: Theme; // Caderno de bordo
export const darkTheme: Theme;  // Carta náutica
export function useTheme(): Theme; // useColorScheme() === 'dark' ? darkTheme : lightTheme
```

`space` e `radius` continuam constantes exportadas — não variam com o tema.

**Os nomes das fontes passam de famílias a papéis** (`display`, `body`, `mono` em vez de `Fraunces_600SemiBold`): é o que permite dois temas com tipografias diferentes sem condicionais espalhadas pelo código.

**Consumo nos ecrãs** — cada ficheiro de UI troca `import { colors, font } from '../theme'` por:

```tsx
const theme = useTheme();
const styles = useMemo(() => makeStyles(theme), [theme]);
// makeStyles(theme: Theme) => StyleSheet.create({...}) — definido fora do componente
```

Alternativas rejeitadas: Context+Provider (só ganha valor com override manual, que não existe — YAGNI); cores inline no JSX (perde o StyleSheet e fica ilegível).

### Tokens

| Token | Claro (DESIGN.md) | Escuro (README) |
|---|---|---|
| background | `#F7F2E7` | `#14181B` |
| surface | `#FBF8F0` | `#1C2227` |
| ink | `#16324F` | `#EDE6D6` |
| inkMuted | `#5C6B73` | `#7C8790` |
| accent | `#C4622D` | `#4C7C9C` |
| accentOn | `#F7F2E7` | `#14181B` |
| accentSoft | `#EAE1CC` | `#26333C` |
| error | `#A33B2E` | `#C97B4A` |
| hairline | `#DCD3BF` | `#2C343A` |
| hairlineStrong | `#C9BE9F` | `#3A424A` |
| starEmpty | `#D9CFB8` | `#3A424A` |
| success | `#3D6B4F` | `#4C7C9C` |
| pending | `#8A7A5C` | `#7C8790` |
| display / displayItalic / displaySemiBold | Fraunces 500 / 500 Italic / 600 | Spectral 500 / 500 Italic / 600 |
| body / bodySemiBold | Instrument Sans 400 / 600 | Archivo 400 / 600 |
| mono / monoMedium / monoSemiBold | JetBrains Mono 400 / 500 / 600 | Archivo 500 / 600 / 700 |

Notas: `accentSoft` e `hairlineStrong` são tokens novos (vêm do README, sem equivalente hoje). O escuro não tem monoespaçada própria no README — usa Archivo, aceitando a perda de tabular-nums (o DESIGN.md justificava a mono por causa do "salto" de largura; é o preço da decisão 1, registado aqui).

## Fontes

`expo install @expo-google-fonts/spectral @expo-google-fonts/archivo` (nunca editar o package.json à mão). O `_layout.tsx` carrega **as 5 famílias** independentemente do tema ativo: carregar só as do tema pouparia arranque mas daria flash de fonte ao trocar o tema com a app aberta. Justificação da dep vai no commit (CLAUDE.md regra 6).

Pesos: Spectral 500, 500 Italic, 600; Archivo 400, 500, 600, 700.

## Ícones de direção e maré

Componente novo `src/components/DirectionArrow.tsx` — `Ionicons name="arrow-up"` com `transform: [{ rotate: '<deg>deg' }]`.

**A regra que decide se está certo:** a Open-Meteo dá direção meteorológica, "de onde vem" (322° = vem de NO). Uma seta apontada a 322° apontaria *para* NO — ao contrário do vento real. Para o utilizador ler "vem dali", a rotação é **`(deg + 180) % 360`**. Função pura `bearingToArrowRotation(deg)` em `src/utils/directions.ts` (onde já vive o `degToCardinal`), comentada e **testada** — é a única lógica nova desta entrega.

Aplicação: no cartão da lista e no detalhe, ao lado do valor existente (`↓ 322° NO`), sem substituir o texto — a seta acelera a leitura, não a substitui. Maré: `arrow-up` (a encher), `arrow-down` (a vazar), `remove` (preia-mar/baixa-mar, o traço = pico).

## Faseamento

Cinco blocos, cada um validável no dispositivo:

1. **Infra** — fontes, `Theme`/`lightTheme`/`darkTheme`/`useTheme`, `_layout` (Stack e tab bar por tema). DoD: app arranca nos dois temas do sistema; ecrãs ainda claros.
2. **Sessões** — `(tabs)/index.tsx` + cartão + `(tabs)/_layout.tsx`. É o ecrã de todos os dias; prova-se primeiro.
3. **Registo + detalhe + editar** — `SessionForm` (partilhado, cobre dois), `sessao/[id].tsx`.
4. **Spots + Perfil + forms** — `(tabs)/spots.tsx`, `(tabs)/perfil.tsx`, `SpotForm`, `BoardForm`, `spot/[id]`, `spot/novo`, `board/[id]`, `board/nova`.
5. **Ícones** — `DirectionArrow` + `bearingToArrowRotation` com teste, aplicados ao cartão e ao detalhe.

## Testes

- **Novo:** `bearingToArrowRotation` (rotação +180, wrap em 360, 0°→180°, 322°→142°).
- **Gate de tipos:** `npx tsc --noEmit`. `Theme` como interface faz o compilador apanhar um token em falta num dos temas — o erro provável desta entrega. (Nota: jest-expo usa babel-jest e **não** type-checka; o tsc é o único gate de tipos.)
- UI continua sem testes (MVP, CLAUDE.md regra 4).

## Documentação a atualizar no fecho

- `DESIGN.md` — passa a documentar os dois temas e a decisão 1 (com o custo assumido).
- `BACKLOG.md` — marcar os dois P0 da Fase 3 (já feitos na Fase 2 T7), o P2 do dark mode e o P2 dos ícones; anotar o adiamento dos P1 com a razão.
