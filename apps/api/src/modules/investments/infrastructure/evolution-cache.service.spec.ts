import { EvolutionCacheService } from "./evolution-cache.service";

describe("EvolutionCacheService", () => {
  it("expires by TTL", () => {
    const cache = new EvolutionCacheService();
    cache.set("u1:principal:2026-01-01:2026-06-01", { valor: 10 });

    expect(cache.get("u1:principal:2026-01-01:2026-06-01", 60_000)).toEqual({ valor: 10 });
    // TTL zero = já venceu: nada de contar com timer no teste.
    expect(cache.get("u1:principal:2026-01-01:2026-06-01", 0)).toBeNull();
  });

  it("só apaga o usuário pedido — e não o vizinho cujo id começa igual", () => {
    const cache = new EvolutionCacheService();
    cache.set("u1:principal:a:b", 1);
    cache.set("u1:carteira-da-filha:a:b", 2);
    cache.set("u10:principal:a:b", 3);

    cache.invalidateUser("u1");

    expect(cache.get("u1:principal:a:b", 60_000)).toBeNull();
    expect(cache.get("u1:carteira-da-filha:a:b", 60_000)).toBeNull();
    // `u10` não é `u1`: sem o separador na comparação, um id prefixo do outro derrubaria o cache
    // de outra conta a cada lançamento.
    expect(cache.get("u10:principal:a:b", 60_000)).toBe(3);
  });
});
