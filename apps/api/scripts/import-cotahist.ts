/**
 * One-off backfill: downloads B3's public COTAHIST "Séries Históricas" files (one per year,
 * https://www.b3.com.br/.../cotacoes-historicas/) and loads the regular spot-market closing
 * price of every stock/FII/ETF/BDR into the `historical_prices` table, so charts can go back
 * further than BRAPI/Yahoo's free-tier history windows. Not part of the running app — run this
 * by hand, once, then never again (see the README-style instructions in `pnpm run
 * import:cotahist -- --help` output below).
 *
 * Streams everything (download -> disk, disk -> unzip -> line-by-line parse -> batched insert)
 * instead of buffering a whole year's file in memory — a full year's uncompressed COTAHIST file
 * can be 100-300MB, and this is meant to run comfortably on a small VPS.
 *
 * Defaults to starting at 1995 (the first full year after the Plano Real currency stabilization,
 * July 1994) — B3's data technically goes back to 1986, but everything before mid-1994 is
 * denominated in extinct currencies (Cruzeiro/Cruzado/Cruzado Novo/Cruzeiro Real) that this
 * script does NOT convert, so mixing it in would silently corrupt the price series. Pass
 * --start-year to go further back only if you're prepared to handle that yourself.
 *
 * Usage:
 *   pnpm run import:cotahist                        # dry run — see below
 *   pnpm run import:cotahist -- --write              # the real import, 1995..this year
 *   pnpm run import:cotahist -- --write --start-year=2015 --end-year=2020
 */

import { createWriteStream, existsSync } from "fs";
import { mkdir, rm } from "fs/promises";
import { createInterface } from "readline";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import { PrismaClient } from "@prisma/client";
import yauzl from "yauzl";
import { isSpotMarketQuote, parseCotahistLine } from "../src/modules/investments/domain/cotahist-parser";

const DEFAULT_START_YEAR = 1995;
const BATCH_SIZE = 5_000;
const DOWNLOAD_RETRIES = 3;
const PROGRESS_EVERY = 500_000;

interface Options {
  write: boolean;
  startYear: number;
  endYear: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(`--${name}`);
  const value = (name: string, fallback: number) => {
    const match = args.find((a) => a.startsWith(`--${name}=`));
    return match ? Number.parseInt(match.split("=")[1], 10) : fallback;
  };

  const currentYear = new Date().getFullYear();
  return {
    write: flag("write"),
    startYear: value("start-year", DEFAULT_START_YEAR),
    endYear: value("end-year", currentYear),
  };
}

function downloadUrl(year: number): string {
  return `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A${year}.ZIP`;
}

/** Downloads straight to disk (streamed) — never holds the ZIP in memory. Retries a few times
 *  since a 40-year loop hitting a single flaky network blip shouldn't abort the whole run. */
async function downloadYearZip(year: number, destPath: string): Promise<boolean> {
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt++) {
    try {
      const res = await fetch(downloadUrl(year));
      if (!res.ok || !res.body) {
        console.warn(`  [${year}] download respondeu ${res.status} — pulando esse ano.`);
        return false;
      }
      await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(destPath));
      return true;
    } catch (err) {
      console.warn(`  [${year}] tentativa ${attempt}/${DOWNLOAD_RETRIES} falhou: ${(err as Error).message}`);
      if (attempt === DOWNLOAD_RETRIES) return false;
    }
  }
  return false;
}

/** Opens the (single-entry) ZIP and streams its lines one at a time via readline — the ZIP file
 *  itself sits on disk, and at most one line + the current insert batch are ever in memory. */
async function forEachLine(zipPath: string, onLine: (line: string) => void): Promise<void> {
  const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zf) => (err || !zf ? reject(err) : resolve(zf)));
  });

  await new Promise<void>((resolve, reject) => {
    zipfile.on("error", reject);
    zipfile.readEntry();
    zipfile.on("entry", (entry) => {
      if (/\/$/.test(entry.fileName)) {
        zipfile.readEntry();
        return;
      }
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) return reject(err);
        const rl = createInterface({ input: readStream, crlfDelay: Infinity });
        rl.on("line", onLine);
        rl.on("close", () => {
          zipfile.close();
          resolve();
        });
        rl.on("error", reject);
      });
    });
  });
}

interface YearStats {
  linesRead: number;
  quoteRecords: number;
  spotMarketRecords: number;
  inserted: number;
}

async function importYear(year: number, prisma: PrismaClient | null): Promise<YearStats> {
  const zipPath = join(tmpdir(), `cotahist_${year}.zip`);
  const stats: YearStats = { linesRead: 0, quoteRecords: 0, spotMarketRecords: 0, inserted: 0 };

  console.log(`[${year}] baixando...`);
  const ok = await downloadYearZip(year, zipPath);
  if (!ok) return stats;

  console.log(`[${year}] processando...`);
  // Collected in full and flushed in chunks after the stream ends (below), not mid-stream —
  // readline's "line" event is synchronous, so an awaited DB write per batch would need manual
  // stream pausing to stay correct. A whole year's spot-market rows (a few hundred thousand at
  // most) is only tens of MB, so holding just that filtered subset in memory is fine even on a
  // small VPS — it's the raw multi-hundred-MB unfiltered file that forEachLine() never buffers.
  const batch: { ticker: string; date: Date; close: number }[] = [];

  await forEachLine(zipPath, (line) => {
    stats.linesRead++;
    if (stats.linesRead % PROGRESS_EVERY === 0) {
      console.log(`  [${year}] ${stats.linesRead.toLocaleString("pt-BR")} linhas lidas...`);
    }

    const record = parseCotahistLine(line);
    if (!record) return;
    stats.quoteRecords++;
    if (!isSpotMarketQuote(record)) return;
    stats.spotMarketRecords++;

    batch.push({ ticker: record.ticker, date: new Date(record.tradeDate), close: record.closePrice });
  });

  // Batches are flushed synchronously inside forEachLine's callback is not possible (it's not
  // async-aware), so flush happens here in fixed-size chunks post-hoc instead — still bounded
  // memory, just flushed after collecting the whole year's spot-market rows (a few hundred
  // thousand at most, comfortably small) rather than mid-stream.
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    if (prisma) {
      const result = await prisma.historicalPrice.createMany({
        data: chunk.map((r) => ({ ticker: r.ticker, date: r.date, close: r.close })),
        skipDuplicates: true,
      });
      stats.inserted += result.count;
    }
  }

  await rm(zipPath, { force: true });
  return stats;
}

async function dryRun(options: Options) {
  const year = options.endYear;
  console.log(`\n=== TESTE (nada será gravado no banco) — ano ${year} ===\n`);
  const stats = await importYear(year, null);
  console.log(`\nLinhas lidas: ${stats.linesRead.toLocaleString("pt-BR")}`);
  console.log(`Registros de cotação (tipo 01): ${stats.quoteRecords.toLocaleString("pt-BR")}`);
  console.log(`Só mercado à vista (o que de fato importamos): ${stats.spotMarketRecords.toLocaleString("pt-BR")}`);
  console.log(`\nSe os números acima fazem sentido (não são zero), roda de novo com --write pra valer.`);
  console.log(`Exemplo: pnpm run import:cotahist -- --write --start-year=${options.startYear} --end-year=${options.endYear}\n`);
}

async function main() {
  if (!existsSync(tmpdir())) {
    // Extremely unlikely, but mkdir -p the tmp dir just in case a minimal container image lacks it.
    await mkdir(tmpdir(), { recursive: true });
  }

  const options = parseArgs();

  if (options.startYear < DEFAULT_START_YEAR) {
    console.warn(
      `Aviso: --start-year=${options.startYear} é anterior a 1995 — antes do Plano Real os preços estão em moedas extintas ` +
        `(Cruzeiro/Cruzado/Cruzado Novo/Cruzeiro Real) e este script NÃO converte isso. Só use se você mesmo for tratar essa conversão.`,
    );
  }

  if (!options.write) {
    await dryRun(options);
    return;
  }

  const prisma = new PrismaClient();
  try {
    console.log(`Importando ${options.startYear}..${options.endYear} — isso pode demorar bastante, é normal.\n`);
    for (let year = options.startYear; year <= options.endYear; year++) {
      const stats = await importYear(year, prisma);
      console.log(
        `[${year}] concluído — ${stats.spotMarketRecords.toLocaleString("pt-BR")} cotações encontradas, ` +
          `${stats.inserted.toLocaleString("pt-BR")} novas gravadas no banco.\n`,
      );
    }
    console.log("Importação concluída.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
