/**
 * Backfill de uso único: carimba o código de barras nos produtos de mercado que já estavam no banco
 * antes do app saber ler GTIN.
 *
 * O "Código:" que a NFC-e imprime sempre foi guardado em `market_purchase_items.storeCode` — o que
 * faltava era saber que, na maior parte do varejo, esse código **é o EAN do produto**. Então o dado
 * já está aqui: não precisa rebuscar nota nenhuma no SEFAZ (o que nem seria confiável, já que só a
 * chave de acesso é guardada, sem o payload assinado do QR).
 *
 * O que ele faz, nesta ordem:
 *
 *   1. Lê o `storeCode` de cada linha de compra e valida com `parseGtin` (dígito verificador GS1).
 *      Código de balança e numeração própria de mercado caem fora sozinhos.
 *   2. Grava esse GTIN na própria linha (`market_purchase_items.gtin`), que é só registrar o que a
 *      nota trazia.
 *   3. **Carimba o GTIN no produto** que ainda não tem um — a mesma "adoção" que a importação faz
 *      hoje, só que aplicada de uma vez no histórico inteiro. Nada é recriado nem re-chaveado: é um
 *      UPDATE de uma coluna que estava nula.
 *   4. Onde dois produtos do mesmo usuário acabarem com o mesmo GTIN, une um no outro — aí não é
 *      chute, é o mesmo código de barras. A união é ponteiro (`canonicalId`), continua visível na
 *      tela de detalhe e é desfeita com um clique.
 *
 * Nada é apagado e nada que já esteja preenchido é sobrescrito. Produto cujas linhas carregam
 * **códigos diferentes** não é tocado: isso quer dizer que a chave normalizada agrupou coisas que
 * não são a mesma, e carimbar um dos dois faria o passo 4 unir errado depois. Esses casos são
 * listados no fim pra você olhar à mão.
 *
 * Uso:
 *   pnpm run backfill:market-gtin                      # simulação: mostra tudo, não grava nada
 *   pnpm run backfill:market-gtin -- --write           # aplica
 *   pnpm run backfill:market-gtin -- --user=<userId>   # limita a um usuário (bom pro primeiro teste)
 */

import { PrismaClient } from "@prisma/client";
import { parseGtin } from "../src/modules/market/domain/gtin";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const USER = args.find((a) => a.startsWith("--user="))?.slice("--user=".length);

function log(...partes: unknown[]) {
  console.log(...partes);
}

interface ProdutoResumo {
  id: string;
  userId: string;
  name: string;
  gtin: string | null;
  canonicalId: string | null;
  compras: number;
  createdAt: Date;
}

async function main() {
  log(WRITE ? "== APLICANDO ==" : "== SIMULAÇÃO (nada será gravado; use --write pra aplicar) ==");
  if (USER) log(`Limitado ao usuário ${USER}`);

  // Só as linhas que ainda não têm gtin e que têm algum código pra examinar. Campos selecionados a
  // dedo: a tabela de itens é a maior do módulo e a VPS tem 1GB.
  const itens = await prisma.marketPurchaseItem.findMany({
    where: { gtin: null, storeCode: { not: null }, ...(USER ? { userId: USER } : {}) },
    select: { id: true, userId: true, productId: true, storeCode: true },
  });
  log(`Linhas de compra com código pra examinar: ${itens.length}`);

  const gtinPorItem = new Map<string, string>();
  const gtinsPorProduto = new Map<string, Set<string>>();

  for (const item of itens) {
    const gtin = parseGtin(item.storeCode);
    if (!gtin) continue;
    gtinPorItem.set(item.id, gtin);
    const conjunto = gtinsPorProduto.get(item.productId) ?? new Set<string>();
    conjunto.add(gtin);
    gtinsPorProduto.set(item.productId, conjunto);
  }

  log(`Linhas cujo código é um GTIN válido: ${gtinPorItem.size}`);
  log(`Linhas com código que não é GTIN (balança, numeração da loja): ${itens.length - gtinPorItem.size}`);

  const produtos = await prisma.marketProduct.findMany({
    where: { id: { in: [...gtinsPorProduto.keys()] } },
    select: {
      id: true,
      userId: true,
      name: true,
      gtin: true,
      canonicalId: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  const porId = new Map<string, ProdutoResumo>(
    produtos.map((p) => [
      p.id,
      { id: p.id, userId: p.userId, name: p.name, gtin: p.gtin, canonicalId: p.canonicalId, compras: p._count.items, createdAt: p.createdAt },
    ]),
  );

  const paraCarimbar: { produto: ProdutoResumo; gtin: string }[] = [];
  const conflitos: { produto: ProdutoResumo; gtins: string[] }[] = [];

  for (const [productId, conjunto] of gtinsPorProduto) {
    const produto = porId.get(productId);
    if (!produto) continue;

    const gtins = [...conjunto];
    if (gtins.length > 1) {
      conflitos.push({ produto, gtins });
      continue;
    }
    if (produto.gtin === null) paraCarimbar.push({ produto, gtin: gtins[0] });
    else if (produto.gtin !== gtins[0]) conflitos.push({ produto, gtins: [produto.gtin, gtins[0]] });
  }

  log(`\nProdutos que vão receber o código: ${paraCarimbar.length}`);
  for (const { produto, gtin } of paraCarimbar.slice(0, 30)) {
    log(`  ${gtin.replace(/^0+/, "").padStart(13)}  ${produto.name} (${produto.compras} linha(s))`);
  }
  if (paraCarimbar.length > 30) log(`  … e mais ${paraCarimbar.length - 30}`);

  // Uniões: dois produtos do mesmo usuário com o mesmo código são o mesmo produto, ponto.
  const depoisDoCarimbo = new Map(porId);
  for (const { produto, gtin } of paraCarimbar) depoisDoCarimbo.set(produto.id, { ...produto, gtin });

  const porUsuarioEGtin = new Map<string, ProdutoResumo[]>();
  for (const produto of depoisDoCarimbo.values()) {
    if (!produto.gtin) continue;
    const chave = `${produto.userId}|${produto.gtin}`;
    porUsuarioEGtin.set(chave, [...(porUsuarioEGtin.get(chave) ?? []), produto]);
  }

  const unioes: { canonico: ProdutoResumo; absorvido: ProdutoResumo }[] = [];
  for (const grupo of porUsuarioEGtin.values()) {
    // Produto já unido a outro fica fora: a decisão dele já foi tomada, aqui ou à mão.
    const livres = grupo.filter((p) => p.canonicalId === null);
    if (livres.length < 2) continue;

    // Quem fica com o nome: o que tem mais histórico, e no empate o mais antigo. Critério estável,
    // e de qualquer forma reversível na tela — "Separar" desfaz.
    const [canonico, ...resto] = [...livres].sort(
      (a, b) => b.compras - a.compras || a.createdAt.getTime() - b.createdAt.getTime(),
    );
    for (const absorvido of resto) unioes.push({ canonico, absorvido });
  }

  log(`\nUniões que o código de barras prova: ${unioes.length}`);
  for (const { canonico, absorvido } of unioes.slice(0, 30)) {
    log(`  "${absorvido.name}"  ->  "${canonico.name}"`);
  }
  if (unioes.length > 30) log(`  … e mais ${unioes.length - 30}`);

  if (conflitos.length > 0) {
    log(`\n⚠ Produtos NÃO tocados — as linhas deles carregam códigos diferentes entre si.`);
    log(`  Provavelmente a chave do nome agrupou itens que não são o mesmo produto. Olhe à mão:`);
    for (const { produto, gtins } of conflitos) {
      log(`  ${produto.name}: ${gtins.map((g) => g.replace(/^0+/, "")).join(", ")}`);
    }
  }

  if (!WRITE) {
    log(`\nNada foi gravado. Rode de novo com --write pra aplicar.`);
    return;
  }

  log(`\nGravando…`);

  // Em lotes: um UPDATE por linha de compra numa base grande é a diferença entre segundos e
  // minutos, e agrupar por gtin transforma milhares de statements em dezenas.
  const itensPorGtin = new Map<string, string[]>();
  for (const [itemId, gtin] of gtinPorItem) itensPorGtin.set(gtin, [...(itensPorGtin.get(gtin) ?? []), itemId]);

  let linhas = 0;
  for (const [gtin, ids] of itensPorGtin) {
    const { count } = await prisma.marketPurchaseItem.updateMany({ where: { id: { in: ids } }, data: { gtin } });
    linhas += count;
  }
  log(`  ${linhas} linha(s) de compra com o código gravado`);

  let carimbados = 0;
  for (const { produto, gtin } of paraCarimbar) {
    // `gtin: null` no where: se outra coisa preencheu no meio do caminho, essa vence e o backfill
    // não sobrescreve.
    const { count } = await prisma.marketProduct.updateMany({ where: { id: produto.id, gtin: null }, data: { gtin } });
    carimbados += count;
  }
  log(`  ${carimbados} produto(s) com o código carimbado`);

  let unidos = 0;
  for (const { canonico, absorvido } of unioes) {
    const { count } = await prisma.marketProduct.updateMany({
      where: { id: absorvido.id, canonicalId: null },
      data: { canonicalId: canonico.id },
    });
    unidos += count;
  }
  log(`  ${unidos} produto(s) unido(s) pelo código de barras`);

  log(`\nPronto. As uniões aparecem na tela de detalhe do produto e o botão "Separar" desfaz qualquer uma.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
