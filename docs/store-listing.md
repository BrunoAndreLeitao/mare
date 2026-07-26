# Ficha da Store — Maré

Texto pronto a colar no Play Console / App Store Connect.

## Nome
Maré — Diário de Surf

## Categoria
Desporto (Sports)

## Descrição curta (Play Store, máx. 80 caracteres)
Regista sessões de surf em 30s. A Maré aprende como TU surfas em cada spot.

## Descrição longa (Play Store, máx. 4000 caracteres / App Store, máx. 4000)

O Surfline diz como vai estar o mar. A Maré diz como TU surfas nesse mar.

A Maré é o teu diário de surf pessoal. Regista uma sessão em menos de 30 segundos — spot, avaliação, prancha, nota — e a app preenche automaticamente as condições do mar desse momento: ondulação, vento e maré, via dados marítimos abertos.

Com as sessões acumuladas, a Maré começa a mostrar-te padrões: em que condições costumas surfar melhor, em cada um dos teus spots.

**Como funciona**
- Regista a sessão: spot, avaliação de 1 a 5, prancha usada, duração, nota livre
- A Maré associa automaticamente as condições reais do mar a essa hora e local
- O histórico mostra ondulação, período, vento e fase da maré de cada sessão
- Funciona offline — o registo nunca espera pela internet

**Porquê a Maré**
- Sem conta, sem login. Os teus dados ficam no teu telemóvel.
- Sem anúncios, sem tracking.
- Feita para durar 30 segundos, não 5 minutos — regista-se depois de sair de água, não em vez de surfar.

Gestão do teu quiver (pranchas), estatísticas de sequência de sessões, e partilha de sessões com os amigos incluídas.

## Palavras-chave (App Store, máx. 100 caracteres)
surf,diário,ondas,maré,marés,ondulação,swell,spot,prancha,surfista,registo,sessões

## Screenshots

Capturados no emulador (Medium Phone API 36.1, tema escuro "Carta Náutica") em `docs/store-screenshots/`:
0. `screenshot-0-onboarding.png` — primeiro ecrã de onboarding (a proposta de valor: "O Surfline diz como vai estar o mar. A Maré diz como TU surfas nesse mar.")
1. `screenshot-1-nova-sessao.png` — ecrã "Nova sessão" (registo rápido)
2. `screenshot-2-historico.png` — histórico de sessões com tiles de estatísticas e cartão de condições
3. `screenshot-3-detalhe-sessao.png` — detalhe de sessão com condições completas (dados reais Open-Meteo)

**Nota:** os screenshots 1-3 vêm de uma sessão de teste anterior (spot "Carcavelos" com coordenadas por defeito do emulador). O 0 vem de uma instalação limpa subsequente. Antes de usar em produção, considerar recapturar tudo numa única passagem com dados limpos/reais.

Pendente: ecrã de spot/quiver e cartão de partilha (ShareCard) — não foi possível completar nesta sessão por instabilidade de toque no emulador ao navegar formulários (botões "Criar spot"/"Adicionar prancha" não responderam de forma fiável a taps sintéticos via ADB nesta build). Recapturar manualmente ou numa sessão futura.
