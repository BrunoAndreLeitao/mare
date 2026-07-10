const two = (n: number) => String(n).padStart(2, '0');

// Hora local SÓ na apresentação (CLAUDE.md) — a BD guarda epoch UTC.
export function fmtLocal(d: Date): string {
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
