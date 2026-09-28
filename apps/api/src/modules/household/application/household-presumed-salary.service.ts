import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxService } from "../../tracking/application/tracking-fx.service";
import { UpsertHouseholdPresumedSalaryDto } from "./dto/household-presumed-salary.dto";

export interface PresumedSalaryEstimate {
  amount: number;
  isForeignCurrency: boolean;
  rateUsed: number | null;
}

/** "Salário presumido" — a baseline the Dashboard falls back to when no HouseholdIncome has been
 *  lançada yet for the month (the salary just hasn't landed). Never persisted as income itself, so
 *  estimateBrl() always converts at today's rate for a foreign-currency baseline instead of
 *  whatever the rate was when the setting was saved. */
@Injectable()
export class HouseholdPresumedSalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: TrackingFxService,
  ) {}

  get(userId: string) {
    return this.prisma.householdPresumedSalary.findUnique({ where: { userId } });
  }

  upsert(userId: string, dto: UpsertHouseholdPresumedSalaryDto) {
    const amountBRL = dto.isForeignCurrency ? null : dto.amountBRL;
    const amountUsd = dto.isForeignCurrency ? dto.amountUsd : null;
    return this.prisma.householdPresumedSalary.upsert({
      where: { userId },
      create: { userId, isForeignCurrency: dto.isForeignCurrency, amountBRL, amountUsd },
      update: { isForeignCurrency: dto.isForeignCurrency, amountBRL, amountUsd },
    });
  }

  async estimateBrl(userId: string): Promise<PresumedSalaryEstimate | null> {
    const config = await this.get(userId);
    if (!config) return null;

    if (!config.isForeignCurrency) {
      return config.amountBRL ? { amount: Number(config.amountBRL), isForeignCurrency: false, rateUsed: null } : null;
    }

    if (!config.amountUsd) return null;
    const rate = await this.fx.getUsdToBrlRate();
    if (!rate) return null;
    return { amount: Math.round(Number(config.amountUsd) * rate * 100) / 100, isForeignCurrency: true, rateUsed: rate };
  }
}
