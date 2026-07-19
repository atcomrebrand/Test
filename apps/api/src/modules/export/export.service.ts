import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async installmentsCsv(userId: string): Promise<string> {
    const installments = await this.prisma.installment.findMany({
      where: { userId },
      include: { purchase: { include: { category: true } }, card: true },
      orderBy: [{ referenceYear: "asc" }, { referenceMonth: "asc" }],
    });

    const header = [
      "Compra",
      "Estabelecimento",
      "Categoria",
      "Cartão",
      "Parcela",
      "Valor",
      "Mês Referência",
      "Ano Referência",
      "Vencimento",
      "Status",
    ];

    const rows = installments.map((i) => [
      csvEscape(i.purchase.name),
      csvEscape(i.purchase.merchant ?? ""),
      csvEscape(i.purchase.category?.name ?? ""),
      csvEscape(i.card.name),
      `${i.number}/${i.purchase.installmentsCount}`,
      Number(i.amount).toFixed(2),
      String(i.referenceMonth),
      String(i.referenceYear),
      i.dueDate.toISOString().slice(0, 10),
      i.status,
    ]);

    return [header, ...rows].map((r) => r.join(";")).join("\n");
  }
}

function csvEscape(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
