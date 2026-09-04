/**
 * Leitura de saúde da VPS: transformar números crus em "está tudo bem?" sem mentir pra nenhum lado.
 *
 * Tudo aqui é função pura — quem chama passa o que leu de `/proc`, do `os` e do Postgres. É o que
 * permite travar em teste os limiares e, principalmente, a armadilha do item seguinte.
 */

export type HealthStatus = "OK" | "ATENCAO" | "CRITICO";

export interface HealthVerdict {
  status: HealthStatus;
  /** Frase curta explicando o porquê — sem ela o status é uma cor sem informação. */
  reason: string;
}

/**
 * Converte o `/proc/meminfo` em bytes.
 *
 * O arquivo vem em kB (sempre, mesmo escrito "kB" minúsculo) e com espaçamento irregular. Devolve
 * um mapa cru pra quem chama escolher os campos; chave ausente é responsabilidade de quem lê.
 */
export function parseMemInfo(raw: string): Record<string, number> {
  const valores: Record<string, number> = {};
  for (const linha of raw.split("\n")) {
    const m = linha.match(/^(\w+):\s+(\d+)(?:\s+kB)?$/);
    if (m) valores[m[1]] = Number(m[2]) * 1024;
  }
  return valores;
}

export interface MemoryReading {
  totalBytes: number;
  /** MemAvailable — ver o comentário de classifyMemory. */
  availableBytes: number;
  swapTotalBytes: number;
  swapFreeBytes: number;
}

/**
 * A armadilha: **cache não é memória usada**.
 *
 * O Linux enche a RAM livre de cache de disco de propósito, e devolve na hora que alguém precisar.
 * Quem calcula `usado = total − MemFree` conclui que uma VPS saudável está com 95% de uso e passa a
 * caçar vazamento que não existe. Quem manda é o `MemAvailable`, que é justamente "quanto dá pra
 * alocar agora sem entrar em swap".
 *
 * Swap em uso é o sinal que importa de verdade num servidor pequeno: quer dizer que a máquina já
 * teve que mandar página pro disco, e disco é ordens de grandeza mais lento que RAM. Por isso ele
 * pesa no veredito mesmo quando ainda sobra memória — é o começo do gargalo, não o fim.
 */
export function classifyMemory(reading: MemoryReading): HealthVerdict {
  const { totalBytes, availableBytes, swapTotalBytes, swapFreeBytes } = reading;
  if (totalBytes <= 0) return { status: "OK", reason: "Sem leitura de memória disponível." };

  const livrePercent = (availableBytes / totalBytes) * 100;
  const swapUsado = Math.max(0, swapTotalBytes - swapFreeBytes);
  const swapPercent = swapTotalBytes > 0 ? (swapUsado / swapTotalBytes) * 100 : 0;

  if (livrePercent < 8) {
    return { status: "CRITICO", reason: `Só ${livrePercent.toFixed(0)}% de memória disponível — risco de o sistema matar processo.` };
  }
  if (swapPercent > 50) {
    return { status: "CRITICO", reason: `Swap ${swapPercent.toFixed(0)}% cheia: a máquina está trocando memória com o disco.` };
  }
  if (livrePercent < 20) {
    return { status: "ATENCAO", reason: `${livrePercent.toFixed(0)}% de memória disponível — apertado, mas ainda respira.` };
  }
  if (swapPercent > 10) {
    return { status: "ATENCAO", reason: `Swap em ${swapPercent.toFixed(0)}%: já houve pressão de memória em algum momento.` };
  }
  return { status: "OK", reason: `${livrePercent.toFixed(0)}% de memória disponível.` };
}

/**
 * Carga por núcleo.
 *
 * `loadavg` do Linux conta processo esperando CPU **e** processo preso em I/O (estado D). Por isso
 * carga alta com CPU baixa não é contradição: é a assinatura de espera por disco ou rede — foi
 * exatamente o que aconteceu quando o provedor de cotação caiu e a API ficou parada em timeout.
 */
export function classifyLoad(load1: number, cores: number): HealthVerdict {
  const porNucleo = cores > 0 ? load1 / cores : load1;
  if (porNucleo >= 2) return { status: "CRITICO", reason: `Carga ${porNucleo.toFixed(2)}× o número de núcleos — tem fila.` };
  if (porNucleo >= 1) return { status: "ATENCAO", reason: `Carga ${porNucleo.toFixed(2)}× por núcleo: no limite do que a máquina dá conta.` };
  return { status: "OK", reason: `Carga ${porNucleo.toFixed(2)}× por núcleo.` };
}

/**
 * Disco. Limiar mais folgado que o de memória de propósito: encher o disco não degrada, **quebra** —
 * e nesta VPS quem enche é o build do frontend, que precisa de espaço de uma vez só.
 */
export function classifyDisk(usedPercent: number): HealthVerdict {
  if (usedPercent >= 90) return { status: "CRITICO", reason: `Disco ${usedPercent.toFixed(0)}% cheio — o build do frontend não vai passar.` };
  if (usedPercent >= 75) return { status: "ATENCAO", reason: `Disco ${usedPercent.toFixed(0)}% cheio.` };
  return { status: "OK", reason: `Disco ${usedPercent.toFixed(0)}% cheio.` };
}

/** Conexões do Postgres: estourar o `max_connections` derruba requisição com erro, não com lentidão. */
export function classifyConnections(used: number, max: number): HealthVerdict {
  if (max <= 0) return { status: "OK", reason: `${used} conexão(ões) aberta(s).` };
  const percent = (used / max) * 100;
  if (percent >= 85) return { status: "CRITICO", reason: `${used} de ${max} conexões — perto do limite do Postgres.` };
  if (percent >= 60) return { status: "ATENCAO", reason: `${used} de ${max} conexões.` };
  return { status: "OK", reason: `${used} de ${max} conexões.` };
}

/** O pior dos vereditos manda: a tela tem que mostrar o problema, não a média deles. */
export function worstStatus(verdicts: HealthVerdict[]): HealthStatus {
  if (verdicts.some((v) => v.status === "CRITICO")) return "CRITICO";
  if (verdicts.some((v) => v.status === "ATENCAO")) return "ATENCAO";
  return "OK";
}
