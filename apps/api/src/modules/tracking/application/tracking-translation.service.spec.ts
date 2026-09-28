import { TrackingTranslationService } from "./tracking-translation.service";

/** Prisma e cliente Anthropic falsos: o que está sob teste é o cache e a leitura da resposta, não a
 *  rede nem o banco. */
function makeService(opts: { guardados?: { sourceHash: string; text: string }[]; responder?: (texts: string[]) => string } = {}) {
  const criados: unknown[] = [];
  const prisma = {
    trackingNoteTranslation: {
      findMany: jest.fn().mockResolvedValue(opts.guardados ?? []),
      createMany: jest.fn().mockImplementation(({ data }: { data: unknown[] }) => {
        criados.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
  };

  const create = jest.fn().mockImplementation(({ messages }: { messages: { content: string }[] }) => {
    const texts = messages[0].content.split("\n").map((l: string) => l.replace(/^\d+\.\s*/, ""));
    if (!opts.responder) throw new Error("sem resposta configurada");
    return Promise.resolve({ content: [{ type: "text", text: opts.responder(texts) }] });
  });

  const service = new TrackingTranslationService(prisma as never);
  // O cliente é criado no campo a partir da env; aqui ele é trocado pelo falso.
  (service as unknown as { client: unknown }).client = { messages: { create } };
  return { service, prisma, create, criados };
}

const hashDe = (texto: string) => require("node:crypto").createHash("sha256").update(texto).digest("hex");

describe("TrackingTranslationService.translateMany", () => {
  it("traduz e guarda o que ainda não estava no cache", async () => {
    const { service, criados } = makeService({
      responder: (t) => JSON.stringify({ translations: t.map((_, i) => ({ n: i + 1, text: `EN${i + 1}` })) }),
    });

    const r = await service.translateMany("u1", ["Dia cheio", "Sistema caiu"], "EN");

    expect(r.get("Dia cheio")).toBe("EN1");
    expect(r.get("Sistema caiu")).toBe("EN2");
    expect(criados).toHaveLength(2);
    expect(criados[0]).toMatchObject({ userId: "u1", lang: "EN", sourceHash: hashDe("Dia cheio") });
  });

  it("o que já está guardado não vai à rede", async () => {
    const { service, create } = makeService({ guardados: [{ sourceHash: hashDe("Dia cheio"), text: "Busy day" }] });

    const r = await service.translateMany("u1", ["Dia cheio"], "EN");

    expect(r.get("Dia cheio")).toBe("Busy day");
    expect(create).not.toHaveBeenCalled();
  });

  it("chama a rede só pelo que falta, mesmo com parte em cache", async () => {
    const { service, create } = makeService({
      guardados: [{ sourceHash: hashDe("Dia cheio"), text: "Busy day" }],
      responder: (t) => {
        // Só o texto que faltava pode ter sido enviado.
        expect(t).toEqual(["Sistema caiu"]);
        return JSON.stringify({ translations: [{ n: 1, text: "System went down" }] });
      },
    });

    const r = await service.translateMany("u1", ["Dia cheio", "Sistema caiu"], "EN");

    expect(r.get("Dia cheio")).toBe("Busy day");
    expect(r.get("Sistema caiu")).toBe("System went down");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("texto repetido é traduzido UMA vez", async () => {
    // Num controle de ponto a mesma frase se repete muito ("reunião de alinhamento").
    const { service, create } = makeService({
      responder: (t) => {
        expect(t).toHaveLength(1);
        return JSON.stringify({ translations: [{ n: 1, text: "Alignment meeting" }] });
      },
    });

    const r = await service.translateMany("u1", ["Reunião", "Reunião", "Reunião"], "EN");

    expect(r.size).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("ignora texto vazio e só espaços", async () => {
    const { service, create } = makeService();
    const r = await service.translateMany("u1", ["", "   "], "EN");
    expect(r.size).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("aceita a resposta embrulhada em bloco de código", async () => {
    const { service } = makeService({
      responder: () => '```json\n{"translations":[{"n":1,"text":"Busy day"}]}\n```',
    });
    const r = await service.translateMany("u1", ["Dia cheio"], "EN");
    expect(r.get("Dia cheio")).toBe("Busy day");
  });

  it("resposta com índice fora da lista não casa texto com a sessão errada", async () => {
    // Casar errado seria pior que não traduzir: a observação de um dia apareceria em outro.
    const { service } = makeService({
      responder: () => JSON.stringify({ translations: [{ n: 7, text: "Solto" }, { n: 1, text: "Busy day" }] }),
    });

    const r = await service.translateMany("u1", ["Dia cheio"], "EN");

    expect(r.get("Dia cheio")).toBe("Busy day");
    expect(r.size).toBe(1);
  });

  it("resposta sem JSON não derruba o extrato — devolve o que tinha", async () => {
    const { service } = makeService({ responder: () => "desculpe, não consegui" });
    const r = await service.translateMany("u1", ["Dia cheio"], "EN");
    expect(r.size).toBe(0);
  });

  it("erro na chamada não derruba o extrato", async () => {
    const { service } = makeService();
    const r = await service.translateMany("u1", ["Dia cheio"], "EN");
    expect(r.size).toBe(0);
  });

  it("sem chave configurada devolve o cache e nada mais, sem quebrar", async () => {
    const { service } = makeService({ guardados: [{ sourceHash: hashDe("Dia cheio"), text: "Busy day" }] });
    (service as unknown as { client: unknown }).client = null;

    const r = await service.translateMany("u1", ["Dia cheio", "Sistema caiu"], "EN");

    expect(r.get("Dia cheio")).toBe("Busy day");
    expect(r.has("Sistema caiu")).toBe(false);
  });
});
