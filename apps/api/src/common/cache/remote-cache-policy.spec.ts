import { decideRemoteFetch } from "./remote-cache-policy";

const NOW = new Date("2026-08-10T18:00:00.000Z");
const TTL = 5 * 60 * 1000;

function state(overrides: Partial<Parameters<typeof decideRemoteFetch>[0]> = {}) {
  return decideRemoteFetch({ cachedAt: null, backoffUntil: null, forceRefresh: false, ttlMs: TTL, now: NOW, ...overrides });
}

const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 1000);
const minutesAhead = (n: number) => new Date(NOW.getTime() + n * 60 * 1000);

describe("decideRemoteFetch", () => {
  it("cache dentro do TTL não toca na rede", () => {
    expect(state({ cachedAt: minutesAgo(2) })).toBe("SERVE_FRESH");
  });

  /**
   * O caso que deixava o app lento: com a BRAPI fora, cada símbolo esperava 8s pra no fim servir
   * este mesmo valor. Devolver já e atualizar por fora tira a rede do caminho da tela.
   */
  it("cache velho é servido na hora, com atualização em segundo plano", () => {
    expect(state({ cachedAt: minutesAgo(30) })).toBe("SERVE_STALE_REFRESH_IN_BACKGROUND");
  });

  it("sem nada em cache, aí sim vale esperar o provedor", () => {
    expect(state({ cachedAt: null })).toBe("FETCH_BLOCKING");
  });

  /** Sem quarentena, cada requisição recomeçaria a fila inteira contra um provedor morto. */
  it("sem cache e com falha recente, desiste na hora em vez de pagar o timeout", () => {
    expect(state({ cachedAt: null, backoffUntil: minutesAhead(1) })).toBe("GIVE_UP");
  });

  it("em quarentena com valor guardado, serve o guardado sem agendar nada", () => {
    expect(state({ cachedAt: minutesAgo(30), backoffUntil: minutesAhead(1) })).toBe("SERVE_FRESH");
  });

  it("quarentena vencida volta a permitir a atualização", () => {
    expect(state({ cachedAt: minutesAgo(30), backoffUntil: minutesAgo(1) })).toBe("SERVE_STALE_REFRESH_IN_BACKGROUND");
  });

  describe("forceRefresh (usuário clicou em atualizar)", () => {
    it("fura o TTL e espera o provedor", () => {
      expect(state({ cachedAt: minutesAgo(1), forceRefresh: true })).toBe("FETCH_BLOCKING");
    });

    /**
     * Mas não fura a quarentena: insistir num provedor que acabou de estourar o timeout só entrega
     * o mesmo timeout, agora com o usuário parado olhando pra tela.
     */
    it("respeita a quarentena, servindo o que tem", () => {
      expect(state({ cachedAt: minutesAgo(30), forceRefresh: true, backoffUntil: minutesAhead(1) })).toBe("SERVE_FRESH");
    });

    it("em quarentena e sem cache, desiste na hora", () => {
      expect(state({ cachedAt: null, forceRefresh: true, backoffUntil: minutesAhead(1) })).toBe("GIVE_UP");
    });
  });

  it("cache exatamente no limite do TTL já conta como velho", () => {
    expect(state({ cachedAt: new Date(NOW.getTime() - TTL) })).toBe("SERVE_STALE_REFRESH_IN_BACKGROUND");
  });
});
