import { nextOccurrenceOfDay } from "../../../common/date/day-of-month";

export class CardEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public name: string,
    public bank: string,
    public brand: string,
    public color: string,
    public limitAmount: number,
    public lastDigits: string,
    public closingDay: number,
    public dueDay: number,
    public active: boolean,
  ) {}

  static validateDays(closingDay: number, dueDay: number) {
    if (closingDay < 1 || closingDay > 31) {
      throw new Error("Dia de fechamento deve estar entre 1 e 31.");
    }
    if (dueDay < 1 || dueDay > 31) {
      throw new Error("Dia de vencimento deve estar entre 1 e 31.");
    }
  }

  static validateLimit(limitAmount: number) {
    if (limitAmount <= 0) {
      throw new Error("Limite do cartão deve ser maior que zero.");
    }
  }

  /** Next closing date strictly after `from`, clamped to shorter months (e.g. day 31 -> Feb 28/29). */
  nextClosingDate(from = new Date()): Date {
    return nextOccurrenceOfDay(from, this.closingDay);
  }

  /** Next due date strictly after `from`, clamped to shorter months. */
  nextDueDate(from = new Date()): Date {
    return nextOccurrenceOfDay(from, this.dueDay);
  }
}
