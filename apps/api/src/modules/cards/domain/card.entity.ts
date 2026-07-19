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
    if (closingDay < 1 || closingDay > 28) {
      throw new Error("Dia de fechamento deve estar entre 1 e 28.");
    }
    if (dueDay < 1 || dueDay > 28) {
      throw new Error("Dia de vencimento deve estar entre 1 e 28.");
    }
  }

  static validateLimit(limitAmount: number) {
    if (limitAmount <= 0) {
      throw new Error("Limite do cartão deve ser maior que zero.");
    }
  }

  /** Next closing date strictly after `from`. */
  nextClosingDate(from = new Date()): Date {
    return nextOccurrenceOfDay(from, this.closingDay);
  }

  /** Next due date strictly after `from`. */
  nextDueDate(from = new Date()): Date {
    return nextOccurrenceOfDay(from, this.dueDay);
  }
}

function nextOccurrenceOfDay(from: Date, day: number): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), day, 12, 0, 0);
  if (candidate <= from) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
}
