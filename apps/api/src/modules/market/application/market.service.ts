import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MarketRepository } from "../domain/market.repository";
import { groupByCanonical, resolveCanonicalId, suggestProductMerges } from "../domain/product-merge";
import { groupPurchaseOccasions, ProductPricePoint, summarizeProductPrices } from "../domain/product-price-history";
import { summarizeSpending } from "../domain/spending-summary";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class MarketService {
  constructor(private readonly market: MarketRepository) {}

  async listPurchases(userId: string, from?: string, to?: string) {
    const purchases = await this.market.listPurchases(userId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    return purchases.map((purchase) => ({
      id: purchase.id,
      storeName: purchase.storeName,
      purchaseDate: purchase.purchaseDate,
      totalAmount: Number(purchase.totalAmount),
      taxAmount: purchase.taxAmount === null ? null : Number(purchase.taxAmount),
      itemCount: purchase.items.length,
      accessKey: purchase.accessKey,
    }));
  }

  /** How much went to the supermarket over a period, and how much of that was tax — the answer to
   *  "quanto eu paguei de imposto". Same window as listPurchases, so the screen showing the list
   *  can show its totals without a second notion of what's in range. */
  async getSpendingSummary(userId: string, from?: string, to?: string) {
    const purchases = await this.market.listPurchases(userId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    return summarizeSpending(
      purchases.map((purchase) => ({
        purchaseDate: isoDate(purchase.purchaseDate),
        totalAmount: Number(purchase.totalAmount),
        taxAmount: purchase.taxAmount === null ? null : Number(purchase.taxAmount),
      })),
    );
  }

  async getPurchase(userId: string, id: string) {
    const purchase = await this.market.findPurchaseById(id);
    if (!purchase) throw new NotFoundException("Compra não encontrada.");
    if (purchase.userId !== userId) throw new ForbiddenException();
    return {
      ...purchase,
      totalAmount: Number(purchase.totalAmount),
      taxAmount: purchase.taxAmount === null ? null : Number(purchase.taxAmount),
      items: purchase.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
    };
  }

  async removePurchase(userId: string, id: string) {
    const purchase = await this.market.findPurchaseById(id);
    if (!purchase) throw new NotFoundException("Compra não encontrada.");
    if (purchase.userId !== userId) throw new ForbiddenException();
    await this.market.softDeletePurchase(id);
    return { id };
  }

  /** Every product ever bought, each with its price summary — the list the "meus produtos" screen
   *  and the "o que subiu de preço" ranking are both built from.
   *
   *  Produtos unidos aparecem como um só: a agregação é feita **na leitura**, somando as compras do
   *  grupo, e não reescrevendo o `productId` das linhas na hora de unir. É o que mantém rastreável
   *  o nome que cada mercado deu e faz desfazer a união custar um UPDATE de um campo. */
  async listProducts(userId: string) {
    const products = await this.market.listProducts(userId);

    return [...groupByCanonical(products)]
      .map(([canonicalId, grupo]) => {
        const canonico = grupo.find((p) => p.id === canonicalId) ?? grupo[0];
        const absorvidos = grupo.filter((p) => p.id !== canonico.id);
        return {
          id: canonico.id,
          name: canonico.name,
          unit: canonico.unit,
          gtin: canonico.gtin,
          mergedCount: absorvidos.length,
          summary: summarizeProductPrices(grupo.flatMap((p) => p.items).map(toPricePoint)),
        };
      })
      .filter((product) => product.summary !== null)
      .sort((a, b) => b.summary!.totalSpent - a.summary!.totalSpent);
  }

  async getProduct(userId: string, id: string) {
    const products = await this.market.listProducts(userId);
    const alvo = products.find((p) => p.id === id);
    if (!alvo) throw new NotFoundException("Produto não encontrado.");

    // Abrir um produto absorvido leva ao canônico: é lá que está o histórico, e um link antigo não
    // pode acabar numa tela vazia.
    const canonicalId = resolveCanonicalId(id, new Map(products.map((p) => [p.id, p.canonicalId])));
    const grupo = groupByCanonical(products).get(canonicalId) ?? [alvo];
    const canonico = grupo.find((p) => p.id === canonicalId) ?? alvo;

    const points = grupo
      .flatMap((p) => p.items)
      .map(toPricePoint)
      .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));

    return {
      id: canonico.id,
      name: canonico.name,
      unit: canonico.unit,
      gtin: canonico.gtin,
      summary: summarizeProductPrices(points),
      /** O extrato: uma entrada por linha de nota, do jeito que o mercado imprimiu. */
      history: points,
      /** O que o gráfico desenha: uma entrada por ida ao mercado. Três unidades compradas juntas
       *  são um ponto, não três bolinhas empilhadas no mesmo dia. Vai separado de `history` porque
       *  a lista embaixo do gráfico tem que continuar mostrando cada linha da nota. */
      priceSeries: groupPurchaseOccasions(points),
      /** Os nomes que os mercados deram e que foram unidos aqui — é o que a tela mostra pra você
       *  poder conferir a união e desfazer se estiver errada. */
      mergedFrom: grupo.filter((p) => p.id !== canonico.id).map((p) => ({ id: p.id, name: p.name })),
    };
  }

  /** Pares que parecem o mesmo produto. Só sugere — quem une é a pessoa. */
  async suggestMerges(userId: string, minScore?: number) {
    const products = await this.market.listProducts(userId);
    // Produto já unido sai da lista: sugerir de novo o que a pessoa acabou de resolver é a forma
    // mais rápida de fazer ela parar de ler as sugestões.
    const soltos = products.filter((p) => p.canonicalId === null);

    return suggestProductMerges(
      soltos.map((p) => ({ id: p.id, name: p.name, normalizedKey: p.normalizedKey })),
      minScore,
    );
  }

  /**
   * Une produtos sob um canônico. O escolhido é quem dá nome e id ao conjunto; os outros viram
   * ponteiro pra ele e param de aparecer sozinhos na lista.
   */
  async mergeProducts(userId: string, canonicalId: string, ids: string[]) {
    const absorvidos = ids.filter((id) => id !== canonicalId);
    if (absorvidos.length === 0) throw new BadRequestException("Escolha ao menos um produto pra unir.");

    const encontrados = await this.market.findProductsByIds(userId, [canonicalId, ...absorvidos]);
    if (encontrados.length !== absorvidos.length + 1) throw new NotFoundException("Produto não encontrado.");

    const canonico = encontrados.find((p) => p.id === canonicalId)!;
    // Unir a um produto que já foi absorvido criaria corrente (A→B→C). A resolução aguenta, mas o
    // dado fica mais difícil de ler do que precisa: aponta direto pro fim da corrente.
    if (canonico.canonicalId) {
      throw new BadRequestException("Esse produto já faz parte de outro — una ao produto principal.");
    }

    await this.market.setProductsCanonical(userId, absorvidos, canonicalId);

    // Quem apontava pros absorvidos passa a apontar pro novo canônico, pelo mesmo motivo.
    const todos = await this.market.listProducts(userId);
    const netos = todos.filter((p) => absorvidos.includes(p.canonicalId ?? "")).map((p) => p.id);
    if (netos.length > 0) await this.market.setProductsCanonical(userId, netos, canonicalId);

    return { canonicalId, merged: absorvidos.length + netos.length };
  }

  /** Desfaz a união de um produto: ele volta a ter histórico próprio. Nada foi apagado, então é só
   *  limpar o ponteiro. */
  async unmergeProduct(userId: string, id: string) {
    const [product] = await this.market.findProductsByIds(userId, [id]);
    if (!product) throw new NotFoundException("Produto não encontrado.");
    if (!product.canonicalId) throw new BadRequestException("Esse produto não está unido a nenhum outro.");

    await this.market.setProductsCanonical(userId, [id], null);
    return { id };
  }
}

function toPricePoint(item: { quantity: unknown; unitPrice: unknown; totalPrice: unknown; purchase: { purchaseDate: Date; storeName: string } }): ProductPricePoint {
  return {
    purchaseDate: isoDate(item.purchase.purchaseDate),
    storeName: item.purchase.storeName,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
  };
}
