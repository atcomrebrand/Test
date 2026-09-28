import {
  classifyConnections,
  classifyDisk,
  classifyLoad,
  classifyMemory,
  MemoryReading,
  parseMemInfo,
  worstStatus,
} from "./system-health";

const GB = 1024 ** 3;

function memoria(over: Partial<MemoryReading> = {}): MemoryReading {
  return { totalBytes: GB, availableBytes: GB * 0.5, swapTotalBytes: 0, swapFreeBytes: 0, ...over };
}

describe("parseMemInfo", () => {
  it("lê o formato do /proc/meminfo e devolve bytes", () => {
    const valores = parseMemInfo(["MemTotal:       16461084 kB", "MemAvailable:   14741368 kB", "SwapTotal:             0 kB"].join("\n"));
    expect(valores.MemTotal).toBe(16461084 * 1024);
    expect(valores.MemAvailable).toBe(14741368 * 1024);
    expect(valores.SwapTotal).toBe(0);
  });

  it("ignora linha que não é par chave/valor em kB", () => {
    const valores = parseMemInfo(["HugePages_Total:       0", "lixo", "", "MemFree:        123 kB"].join("\n"));
    expect(valores.MemFree).toBe(123 * 1024);
    expect(valores.lixo).toBeUndefined();
  });
});

describe("classifyMemory", () => {
  it("cache não é memória usada — o que manda é o disponível", () => {
    // Numa VPS saudável o Linux enche a RAM livre de cache: MemFree fica quase zerado e
    // MemAvailable continua alto. Medir pelo primeiro faria a tela gritar sem motivo.
    expect(classifyMemory(memoria({ availableBytes: GB * 0.55 })).status).toBe("OK");
  });

  it("pouca memória disponível é atenção, muito pouca é crítico", () => {
    expect(classifyMemory(memoria({ availableBytes: GB * 0.15 })).status).toBe("ATENCAO");
    expect(classifyMemory(memoria({ availableBytes: GB * 0.05 })).status).toBe("CRITICO");
  });

  it("swap em uso pesa mesmo sobrando memória — é o começo do gargalo", () => {
    const comSwap = classifyMemory(memoria({ swapTotalBytes: GB, swapFreeBytes: GB * 0.8 }));
    expect(comSwap.status).toBe("ATENCAO");
    expect(comSwap.reason).toMatch(/swap/i);
  });

  it("swap mais da metade cheia é crítico, mesmo com memória sobrando", () => {
    expect(classifyMemory(memoria({ availableBytes: GB * 0.6, swapTotalBytes: GB, swapFreeBytes: GB * 0.2 })).status).toBe("CRITICO");
  });

  it("máquina sem swap configurada não é penalizada por isso", () => {
    expect(classifyMemory(memoria({ swapTotalBytes: 0, swapFreeBytes: 0 })).status).toBe("OK");
  });

  it("sem leitura não inventa diagnóstico", () => {
    expect(classifyMemory(memoria({ totalBytes: 0 })).status).toBe("OK");
  });
});

describe("classifyLoad", () => {
  it("mede por núcleo, não em absoluto", () => {
    // Carga 2 em 4 núcleos é folga; a mesma carga 2 em 1 núcleo é fila.
    expect(classifyLoad(2, 4).status).toBe("OK");
    expect(classifyLoad(2, 1).status).toBe("CRITICO");
  });

  it("um por núcleo já é o limite", () => {
    expect(classifyLoad(1, 1).status).toBe("ATENCAO");
    expect(classifyLoad(0.9, 1).status).toBe("OK");
  });

  it("máquina sem contagem de núcleos usa a carga crua em vez de dividir por zero", () => {
    expect(classifyLoad(0.5, 0).status).toBe("OK");
    expect(classifyLoad(3, 0).status).toBe("CRITICO");
  });
});

describe("classifyDisk", () => {
  it("avisa antes de encher, porque encher quebra o build em vez de deixar lento", () => {
    expect(classifyDisk(50).status).toBe("OK");
    expect(classifyDisk(80).status).toBe("ATENCAO");
    expect(classifyDisk(95).status).toBe("CRITICO");
  });
});

describe("classifyConnections", () => {
  it("mede contra o limite do Postgres, não contra um número fixo", () => {
    expect(classifyConnections(5, 100).status).toBe("OK");
    expect(classifyConnections(70, 100).status).toBe("ATENCAO");
    expect(classifyConnections(90, 100).status).toBe("CRITICO");
  });

  it("sem saber o limite, não classifica como problema", () => {
    expect(classifyConnections(9, 0).status).toBe("OK");
  });
});

describe("worstStatus", () => {
  it("o pior manda — a tela tem que mostrar o problema, não a média", () => {
    expect(worstStatus([{ status: "OK", reason: "" }, { status: "CRITICO", reason: "" }, { status: "ATENCAO", reason: "" }])).toBe("CRITICO");
    expect(worstStatus([{ status: "OK", reason: "" }, { status: "ATENCAO", reason: "" }])).toBe("ATENCAO");
    expect(worstStatus([{ status: "OK", reason: "" }])).toBe("OK");
    expect(worstStatus([])).toBe("OK");
  });
});
