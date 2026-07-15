# Fecho de dívida de design + empty state + editar sessão

Data: 2026-07-15 · Aprovado em conversa (3 decisões via pergunta, todas na recomendação)

## Âmbito

Três peças, sem expansão:

- **A** — recolorir/retipografar os formulários de spot e prancha para consistência com os 6 ecrãs já migrados para o design system.
- **B** — empty state da lista de sessões com ícone + CTA.
- **C** — ecrã "Editar sessão" novo, reutilizando `sessionRepo.update`.

Fora de âmbito (não construir): onboarding, notificações, comparar sessões, estatísticas, partilhar, unidades, gamificação, UI de apagar sessão (`sessionRepo.delete` existe sem UI — fica para depois).

## A — Formulários de spot/prancha

A dívida vive nos componentes partilhados, não nos ecrãs listados (`spot/novo.tsx` e `board/nova.tsx` são wrappers sem estilo próprio):

- `src/components/SpotForm.tsx` e `src/components/BoardForm.tsx`: aplicar exatamente os estilos de `sessao/nova.tsx` — labels uppercase `bodySemiBold`/`inkMuted`, inputs `hairline`/`radius.input`/`font.body`/`colors.ink`, chips `radius.chip` com seleção `accent`, erro `colors.error`, `Button` nativos (submeter, localização) → `Pressable` estilo `registerButton`. Zero decisões novas de design.
- `board/[id].tsx` **e** `spot/[id].tsx`: `Button` de arquivar (`#c0392b`) → `Pressable` destrutivo com `colors.error`. (Desvio mínimo anunciado: `spot/[id].tsx` não estava na lista mas tem a dívida idêntica e o form partilhado já o restila.)

## B — Empty state das sessões

Em `(tabs)/index.tsx`, no `ListEmptyComponent` já estilizado:

- Ícone `Ionicons` `water-outline`, grande, `inkMuted`, por cima do título/texto existentes.
- Botão CTA "Registar sessão" estilo `registerButton` → `router.push('/sessao/nova')`.
- **Footer escondido quando `sessions.length === 0`** — evita dois botões idênticos; volta com a primeira sessão.

## C — Editar sessão

1. **Rota:** `src/app/sessao/editar/[id].tsx` + `Stack.Screen` no `_layout.tsx`. (Decidido: `sessao/[id]` já é o detalhe; o padrão spot/board de `[id]`=editar não transfere; a variante `[id]/editar` obrigava a mover o detalhe para `[id]/index.tsx`.)
2. **`SessionChanges`** em `db/types.ts`, padrão `SpotChanges`/`BoardChanges` (undefined = não toca, null = limpa): `spotId?`, `startedAt?`, `rating?` sem null; `boardId?`, `durationMin?`, `crowd?`, `notes?` com `| null`. `sessionRepo.update` muda a assinatura de `Partial<NewSession>` para `SessionChanges` (`buildSetClause` já trata null). **Teste novo:** null-clear de `boardId`/`notes`; testes de invalidação existentes intocados.
3. **`sessionsStore.update(id, changes)`** — padrão das outras ações (try/catch → `error`, devolve `Session | null`) seguido de `load()`.
4. **Extrair `SessionForm`** de `sessao/nova.tsx` para `src/components/` (`initial?`, `submitLabel`, `onSubmit`). No componente: chips de spot/hora/prancha/duração, picker, rating com scroll-to-error, notas, validação. No ecrã `nova`: pré-seleção do último spot, empty state "sem spots", trigger pós-create. No editar: valores pré-preenchidos (hora entra como data custom selecionada), trigger `runPendingQueue` pós-update (espelho do trigger 4; guarda singleFlight torna-o seguro). A invalidação de condições da Regra 3 é exclusiva do repo — o ecrã não a duplica.
5. **Detalhe (`sessao/[id].tsx`):** `headerRight` com ícone `create-outline` → push para editar. Correção necessária: condições carregadas em `useEffect([id])` → `useFocusEffect`, para refazer o fetch ao voltar do editar (invalidação → pending visível).
6. **i18n:** `sessions.editTitle: 'Editar sessão'`; `common.save` já existe.

## Testes

Só o exigido: teste de repo para null-clear via `SessionChanges` (ponto C2). UI sem testes (MVP, CLAUDE.md regra 4).
