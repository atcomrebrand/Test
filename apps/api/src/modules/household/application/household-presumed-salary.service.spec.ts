import { HouseholdPresumedSalaryService } from "./household-presumed-salary.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxService } from "../../tracking/application/tracking-fx.service";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    householdPresumedSalary: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      ...(overrides.householdPresumedSalary as object),
    },
  } as unknown as PrismaService;
}

function makeFx(rate: number | null = 5.2): TrackingFxService {
  return { getUsdToBrlRate: jest.fn().mockResolvedValue(rate) } as unknown as TrackingFxService;
}

describe("HouseholdPresumedSalaryService.estimateBrl", () => {
  it("returns null when nothing is configured", async () => {
    const service = new HouseholdPresumedSalaryService(makePrisma(), makeFx());

    const result = await service.estimateBrl("user-1");

    expect(result).toBeNull();
  });

  it("returns the BRL amount directly when not foreign currency, without touching FX", async () => {
    const prisma = makePrisma({
      householdPresumedSalary: { findUnique: jest.fn().mockResolvedValue({ isForeignCurrency: false, amountBRL: "5000", amountUsd: null }) },
    });
    const fx = makeFx();
    const service = new HouseholdPresumedSalaryService(prisma, fx);

    const result = await service.estimateBrl("user-1");

    expect(result).toEqual({ amount: 5000, isForeignCurrency: false, rateUsed: null });
    expect(fx.getUsdToBrlRate).not.toHaveBeenCalled();
  });

  it("converts a foreign-currency presumed salary at today's live rate", async () => {
    const prisma = makePrisma({
      householdPresumedSalary: { findUnique: jest.fn().mockResolvedValue({ isForeignCurrency: true, amountBRL: null, amountUsd: "1000" }) },
    });
    const service = new HouseholdPresumedSalaryService(prisma, makeFx(5.3));

    const result = await service.estimateBrl("user-1");

    expect(result).toEqual({ amount: 5300, isForeignCurrency: true, rateUsed: 5.3 });
  });

  it("returns null when foreign currency but the live rate is unavailable", async () => {
    const prisma = makePrisma({
      householdPresumedSalary: { findUnique: jest.fn().mockResolvedValue({ isForeignCurrency: true, amountBRL: null, amountUsd: "1000" }) },
    });
    const service = new HouseholdPresumedSalaryService(prisma, makeFx(null));

    const result = await service.estimateBrl("user-1");

    expect(result).toBeNull();
  });
});

describe("HouseholdPresumedSalaryService.upsert", () => {
  it("clears amountUsd when switching to BRL, and amountBRL when switching to foreign currency", async () => {
    const upsert = jest.fn();
    const prisma = makePrisma({ householdPresumedSalary: { upsert } });
    const service = new HouseholdPresumedSalaryService(prisma, makeFx());

    await service.upsert("user-1", { isForeignCurrency: true, amountUsd: 1200 });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: "user-1", isForeignCurrency: true, amountBRL: null, amountUsd: 1200 },
        update: { isForeignCurrency: true, amountBRL: null, amountUsd: 1200 },
      }),
    );
  });
});
