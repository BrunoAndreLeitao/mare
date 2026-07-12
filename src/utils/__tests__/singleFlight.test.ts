import { singleFlight } from '../singleFlight';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('singleFlight', () => {
  test('(a) arranque + netinfo no mesmo instante: fn executa UMA vez, ambos recebem o mesmo resultado', async () => {
    const d = deferred<number>();
    let calls = 0;
    const guarded = singleFlight(() => {
      calls++;
      return d.promise;
    });

    const arranque = guarded();
    const netinfo = guarded();
    expect(calls).toBe(1);
    expect(netinfo).toBe(arranque); // a MESMA Promise — junção, não fila

    d.resolve(42);
    expect(await arranque).toBe(42);
    expect(await netinfo).toBe(42);
  });

  test('(b) após a resolução, a chamada seguinte executa de novo', async () => {
    let calls = 0;
    const guarded = singleFlight(async () => ++calls);

    expect(await guarded()).toBe(1);
    expect(await guarded()).toBe(2); // corrida nova, não resultado cacheado
  });

  test('(c) rejeição limpa a guarda: a corrida seguinte não fica envenenada', async () => {
    const d = deferred<number>();
    let calls = 0;
    const guarded = singleFlight(() => {
      calls++;
      return calls === 1 ? d.promise : Promise.resolve(99);
    });

    const first = guarded();
    d.reject(new Error('rede caiu'));
    await expect(first).rejects.toThrow('rede caiu');

    expect(await guarded()).toBe(99);
    expect(calls).toBe(2);
  });

  test('(d) pós-create + arranque simultâneos: primeira sessão do dia com a app acabada de abrir → worker corre UMA vez', async () => {
    const d = deferred<string>();
    let workerRuns = 0;
    const runPendingQueue = singleFlight(() => {
      workerRuns++;
      return d.promise;
    });

    // O arranque dispara; o utilizador regista a sessão antes de a corrida acabar.
    const trigArranque = runPendingQueue();
    const trigPosCreate = runPendingQueue();

    d.resolve('done');
    await Promise.all([trigArranque, trigPosCreate]);
    expect(workerRuns).toBe(1);
  });
});
