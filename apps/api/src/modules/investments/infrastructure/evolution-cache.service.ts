import { Injectable } from "@nestjs/common";

/**
 * O cache da curva da carteira, num serviço próprio só pra poder ser esvaziado de fora.
 *
 * A janela inteira é cara de montar (as séries de preço são requisições HTTP com timeout próprio),
 * então o resultado fica guardado por alguns minutos. Só que quem cadastra uma aplicação agora
 * espera vê-la no gráfico agora — e o serviço que grava não pode injetar o que calcula a curva, que
 * já depende dele (ciclo). Um cache que não depende de nada resolve os dois lados: quem calcula
 * escreve, quem grava dado apaga.
 *
 * Em memória de propósito: é derivado, e um processo novo simplesmente recalcula.
 */
@Injectable()
export class EvolutionCacheService {
  private readonly entries = new Map<string, { value: unknown; at: number }>();

  get<T>(key: string, ttlMs: number): T | null {
    const hit = this.entries.get(key);
    if (!hit || Date.now() - hit.at >= ttlMs) return null;
    return hit.value as T;
  }

  set(key: string, value: unknown): void {
    this.entries.set(key, { value, at: Date.now() });
  }

  /** Apaga tudo do usuário — todas as janelas e todas as carteiras. Descobrir quais recortes um
   *  lançamento afeta custaria mais do que recalcular. */
  invalidateUser(userId: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(`${userId}:`)) this.entries.delete(key);
    }
  }
}
