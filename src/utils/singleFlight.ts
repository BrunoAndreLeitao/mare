// Guarda de reentrância: um trigger concorrente JUNTA-SE à corrida em curso
// (recebe a mesma Promise) em vez de enfileirar uma segunda; terminada
// (resolve ou reject), a chamada seguinte executa de novo. Sem fila trailing:
// os triggers do worker (foco, pull, netinfo) apanham o que ficar para trás.
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight === null) {
      inFlight = fn().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
