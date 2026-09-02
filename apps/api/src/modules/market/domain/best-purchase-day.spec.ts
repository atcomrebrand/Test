import { DayPriceObservation, bestPurchaseDay } from "./best-purchase-day";

// 2026-08-17 é uma segunda-feira; 18 terça, 22 sábado, 23 domingo.
const SEGUNDA = "2026-08-17";
const TERCA = "2026-08-18";
const SABADO = "2026-08-22";

function obs(productId: string, purchaseDate: string, unitPrice: number, quantity = 1, storeName = "Mercado A"): DayPriceObservation {
  return { productId, purchaseDate, storeName, unitPrice, quantity, totalPrice: unitPrice * quantity };
}

/** Atalhos: os casos existentes foram escritos pro recorte de semana. */
const semana = (o: DayPriceObservation[]) => bestPurchaseDay(o, "WEEKDAY");
const doMes = (o: DayPriceObservation[]) => bestPurchaseDay(o, "DAY_OF_MONTH");

describe("bestPurchaseDay — dia da semana", () => {
  it("aponta o dia em que os MESMOS produtos saem mais baratos", () => {
    const r = semana([
      obs("arroz", SEGUNDA, 20),
      obs("arroz", SABADO, 30),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", SABADO, 15),
    ]);

    expect(r.best!.day).toBe(1); // segunda
    expect(r.best!.index).toBeLessThan(100);
    expect(r.days.map((w) => w.day)).toEqual([1, 6]);
    expect(r.reason).toBeNull();
  });

  it("NÃO confunde carrinho cheio com dia caro", () => {
    // O sábado é o rancho: dez unidades do mesmo produto, pelo MESMO preço unitário da segunda.
    // Medindo gasto por ida, o sábado seria dez vezes mais "caro"; medindo preço, os dois empatam.
    const r = semana([
      obs("arroz", SEGUNDA, 20, 1),
      obs("arroz", SABADO, 20, 10),
      obs("cafe", SEGUNDA, 10, 1),
      obs("cafe", SABADO, 10, 10),
    ]);

    expect(r.days.map((w) => w.index)).toEqual([100, 100]);
  });

  it("produto caro comprado só num dia não torna esse dia caro", () => {
    // O churrasco de sábado (produto caríssimo, comprado uma vez) não entra: ele só sabe informar o
    // próprio preço, e somá-lo puxaria o sábado pra cima por causa do que foi comprado, não do preço.
    const r = semana([
      obs("arroz", SEGUNDA, 20),
      obs("arroz", SABADO, 20),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", SABADO, 10),
      obs("picanha", SABADO, 400),
    ]);

    expect(r.comparableProducts).toBe(2);
    expect(r.days.every((w) => w.index === 100)).toBe(true);
  });

  it("três unidades do mesmo produto na mesma nota são UMA observação", () => {
    // Mesma regra do gráfico de preço: uma ida ao mercado, não uma linha de nota.
    const r = semana([
      obs("arroz", SEGUNDA, 20),
      obs("arroz", SEGUNDA, 20),
      obs("arroz", SEGUNDA, 20),
      obs("arroz", SABADO, 30),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", SABADO, 15),
    ]);

    expect(r.days.find((w) => w.day === 1)!.observations).toBe(2);
    expect(r.observations).toBe(4);
  });

  it("mesmo produto no mesmo dia em lojas diferentes são DUAS observações", () => {
    const r = semana([
      obs("arroz", SEGUNDA, 20, 1, "Mercado A"),
      obs("arroz", SEGUNDA, 24, 1, "Mercado B"),
      obs("arroz", SABADO, 30),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", SABADO, 15),
    ]);

    expect(r.days.find((w) => w.day === 1)!.observations).toBe(3);
  });

  it("o preço da ocasião é ponderado pela quantidade", () => {
    // 4kg a 10 + 1kg a 20 = 60/5 = 12, e não a média simples de 15.
    const r = semana([
      obs("arroz", SEGUNDA, 10, 4),
      obs("arroz", SEGUNDA, 20, 1),
      obs("arroz", SABADO, 12, 5),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", SABADO, 10),
    ]);

    // Os dois preços do arroz ficam iguais (12), então nenhum dia se destaca por ele.
    expect(r.days.every((w) => w.index === 100)).toBe(true);
  });

  it("sem nenhuma compra devolve o motivo, não um dia qualquer", () => {
    expect(semana([])).toEqual({ best: null, days: [], comparableProducts: 0, observations: 0, reason: "SEM_COMPRAS" });
  });

  it("sem produto repetido entre dias diferentes não inventa resposta", () => {
    const r = semana([obs("arroz", SEGUNDA, 20), obs("cafe", SABADO, 10)]);
    expect(r.best).toBeNull();
    expect(r.reason).toBe("SEM_PRODUTO_REPETIDO");
  });

  it("produto comprado duas vezes no MESMO dia da semana não qualifica", () => {
    // Duas segundas seguidas não dizem nada sobre segunda vs. sábado.
    const r = semana([obs("arroz", SEGUNDA, 20), obs("arroz", "2026-08-24", 30)]);
    expect(r.reason).toBe("SEM_PRODUTO_REPETIDO");
  });

  it("dia com uma observação só é descartado — anedota não é padrão", () => {
    const r = semana([
      obs("arroz", SEGUNDA, 20),
      obs("arroz", SABADO, 30),
      obs("cafe", SEGUNDA, 10),
    ]);

    // Só o arroz qualifica (o café foi comprado num dia só), e ele deixa uma observação em cada
    // dia — nenhuma chega ao mínimo, então não sobra dia nenhum pra comparar.
    expect(r.comparableProducts).toBe(1);
    expect(r.days).toEqual([]);
    expect(r.best).toBeNull();
    expect(r.reason).toBe("POUCA_AMOSTRA");
  });

  it("sobrando UM dia com amostra, ainda assim não há comparação", () => {
    const r = semana([
      obs("arroz", SEGUNDA, 20),
      obs("arroz", SABADO, 30),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", TERCA, 12),
      obs("cafe", "2026-08-24", 11),
    ]);

    // A segunda junta duas observações; sábado e terça ficam com uma cada e caem fora.
    expect(r.days.map((w) => w.day)).toEqual([1]);
    expect(r.best).toBeNull();
    expect(r.reason).toBe("POUCA_AMOSTRA");
  });

  it("conta produtos distintos por dia — um produto só não é padrão", () => {
    const r = semana([
      obs("arroz", SEGUNDA, 20),
      obs("arroz", TERCA, 30),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", TERCA, 15),
    ]);

    expect(r.days.every((w) => w.products === 2)).toBe(true);
  });

  it("empate no índice resolve pelo dia com mais amostra", () => {
    const r = semana([
      obs("arroz", SEGUNDA, 20),
      obs("arroz", "2026-08-24", 20),
      obs("arroz", SABADO, 20),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", SABADO, 10),
    ]);

    expect(r.days[0].day).toBe(1);
    expect(r.days[0].observations).toBe(3);
  });

  it("lê a data como calendário local — segunda não pode virar domingo", () => {
    // `new Date("2026-08-17")` é meia-noite UTC, que no Brasil ainda é domingo dia 16.
    const r = semana([
      obs("arroz", SEGUNDA, 20),
      obs("arroz", SABADO, 30),
      obs("cafe", SEGUNDA, 10),
      obs("cafe", SABADO, 15),
    ]);

    expect(r.days.map((w) => w.day).sort()).toEqual([1, 6]);
  });
});

describe("bestPurchaseDay — dia do mês", () => {
  it("aponta o dia do mês em que os mesmos produtos saem mais baratos", () => {
    // Dia 5 de dois meses diferentes contra dia 25 de dois meses diferentes.
    const r = doMes([
      obs("arroz", "2026-06-05", 20),
      obs("arroz", "2026-07-05", 20),
      obs("arroz", "2026-06-25", 30),
      obs("arroz", "2026-07-25", 30),
    ]);

    expect(r.best!.day).toBe(5);
    expect(r.best!.index).toBe(80);
    expect(r.days.map((d) => d.day)).toEqual([5, 25]);
  });

  it("o mesmo dia do mês em meses diferentes se acumula — é o que faz o recorte encher", () => {
    const r = doMes([
      obs("arroz", "2026-05-10", 10),
      obs("arroz", "2026-06-10", 10),
      obs("arroz", "2026-07-10", 10),
      obs("arroz", "2026-05-20", 20),
      obs("arroz", "2026-06-20", 20),
    ]);

    expect(r.days.find((d) => d.day === 10)!.observations).toBe(3);
    expect(r.days.find((d) => d.day === 20)!.observations).toBe(2);
  });

  it("o mesmo dado responde diferente nos dois recortes", () => {
    // 2026-06-05 é sexta e 2026-07-05 é domingo: mesmo dia do MÊS, dias da SEMANA diferentes.
    // No recorte de mês os dois se juntam no dia 5; no de semana ficam separados e nenhum
    // alcança o mínimo, então lá não dá pra afirmar nada.
    const dados = [
      obs("arroz", "2026-06-05", 20),
      obs("arroz", "2026-07-05", 20),
      obs("arroz", "2026-06-25", 30),
      obs("arroz", "2026-07-25", 30),
    ];

    expect(doMes(dados).best!.day).toBe(5);
    expect(semana(dados).best).toBeNull();
  });

  it("dia 31 é um dia como outro qualquer, só com menos meses onde existir", () => {
    const r = doMes([
      obs("arroz", "2026-05-31", 10),
      obs("arroz", "2026-07-31", 10),
      obs("arroz", "2026-06-15", 20),
      obs("arroz", "2026-07-15", 20),
    ]);

    expect(r.best!.day).toBe(31);
  });

  it("dia do mês também lê a data como calendário local", () => {
    // `new Date("2026-08-01")` é meia-noite UTC — no Brasil ainda é 31 de julho. Ler assim jogaria
    // toda compra do dia 1 pro dia 31 do mês anterior.
    const r = doMes([
      obs("arroz", "2026-06-01", 10),
      obs("arroz", "2026-07-01", 10),
      obs("arroz", "2026-06-20", 20),
      obs("arroz", "2026-07-20", 20),
    ]);

    expect(r.days.map((d) => d.day)).toEqual([1, 20]);
  });

  it("produto comprado sempre no mesmo dia do mês não qualifica", () => {
    const r = doMes([obs("arroz", "2026-06-10", 20), obs("arroz", "2026-07-10", 30)]);
    expect(r.reason).toBe("SEM_PRODUTO_REPETIDO");
  });

  it("carrinho grande não torna o dia caro, igual no recorte de semana", () => {
    const r = doMes([
      obs("arroz", "2026-06-05", 20, 1),
      obs("arroz", "2026-06-25", 20, 10),
      obs("cafe", "2026-06-05", 10, 1),
      obs("cafe", "2026-06-25", 10, 10),
    ]);

    expect(r.days.map((d) => d.index)).toEqual([100, 100]);
  });
});
