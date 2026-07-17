// Semanas consecutivas com pelo menos uma sessão, até hoje.
//
// A semana é ISO (segunda a domingo) e em hora LOCAL — a semana do surfista é
// a do relógio dele, não UTC. (O resto da app guarda tudo em UTC; aqui a
// conversão é deliberada e é da camada de apresentação, que é o que isto é.)

// Segunda-feira 00:00 local da semana que contém `d`. É a chave de agrupamento.
function mondayOf(d: Date): number {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = (m.getDay() + 6) % 7; // getDay: 0=domingo → 0=segunda
  m.setDate(m.getDate() - dayOfWeek);
  return m.getTime();
}

// Segunda-feira anterior, por CALENDÁRIO — não por 7*24h. A semana da mudança
// WET/WEST tem 167 ou 169 horas reais; setDate(-7) respeita isso, subtração
// bruta de milissegundos não (aterra fora da meia-noite local, streak parte).
function previousMonday(mondayMs: number): number {
  const d = new Date(mondayMs);
  d.setDate(d.getDate() - 7);
  return d.getTime();
}

export function weekStreak(startedAtAll: number[], now: Date): number {
  if (startedAtAll.length === 0) {
    return 0;
  }

  const weeks = new Set(startedAtAll.map((s) => mondayOf(new Date(s * 1000))));
  const currentWeek = mondayOf(now);

  // A semana atual NÃO conta como buraco enquanto não acabar: sem isto, uma
  // streak de 8 semanas mostrava 0 à segunda de manhã — falso e desmoralizante.
  // Começamos na semana atual se houve sessão, senão na anterior.
  let cursor = weeks.has(currentWeek) ? currentWeek : previousMonday(currentWeek);

  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = previousMonday(cursor);
  }
  return streak;
}
