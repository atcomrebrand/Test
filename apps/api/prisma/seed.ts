import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { generateInstallments } from "../src/modules/purchases/domain/installment-generator";
import { DEFAULT_CATEGORIES } from "../src/modules/categories/default-categories";

const prisma = new PrismaClient();

const DEMO_EMAIL = "mauroo.galvaoo@gmail.com";
const DEMO_PASSWORD = "demo1234";

async function main() {
  console.log("Seeding database...");

  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.card.deleteMany();
  await prisma.category.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      name: "Mauro Galvão",
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      settings: { create: {} },
      categories: { create: DEFAULT_CATEGORIES.map((c) => ({ ...c, isDefault: true })) },
    },
  });

  const categories = await prisma.category.findMany({ where: { userId: user.id } });
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;

  const nubank = await prisma.card.create({
    data: {
      userId: user.id,
      name: "Nubank Ultravioleta",
      bank: "Nubank",
      brand: "MASTERCARD",
      color: "#820AD1",
      limitAmount: 15000,
      lastDigits: "4821",
      closingDay: 5,
      dueDay: 12,
      active: true,
    },
  });

  const itau = await prisma.card.create({
    data: {
      userId: user.id,
      name: "Itaú Click",
      bank: "Itaú",
      brand: "VISA",
      color: "#EC7000",
      limitAmount: 8000,
      lastDigits: "9034",
      closingDay: 20,
      dueDay: 27,
      active: true,
    },
  });

  const c6 = await prisma.card.create({
    data: {
      userId: user.id,
      name: "C6 Carbon",
      bank: "C6 Bank",
      brand: "MASTERCARD",
      color: "#1B1B1B",
      limitAmount: 6000,
      lastDigits: "1150",
      closingDay: 10,
      dueDay: 17,
      active: true,
    },
  });

  await prisma.card.create({
    data: {
      userId: user.id,
      name: "Inter Gold",
      bank: "Banco Inter",
      brand: "VISA",
      color: "#FF7A00",
      limitAmount: 4000,
      lastDigits: "5567",
      closingDay: 15,
      dueDay: 22,
      active: false,
    },
  });

  const today = new Date();

  async function createPurchase(opts: {
    name: string;
    merchant?: string;
    categoryName: string;
    card: { id: string; closingDay: number; dueDay: number };
    totalAmount: number;
    purchaseDate: Date;
    installmentsCount?: number;
    kind?: "INSTALLMENT" | "CASH" | "RECURRING";
    tags?: string[];
    isFavorite?: boolean;
  }) {
    const installmentsCount = opts.installmentsCount ?? 1;
    const kind = opts.kind ?? (installmentsCount > 1 ? "INSTALLMENT" : "CASH");
    const installmentAmount = Math.round((opts.totalAmount / installmentsCount) * 100) / 100;
    const totalAmount = Math.round(installmentAmount * installmentsCount * 100) / 100;

    const generated = generateInstallments({
      purchaseDate: opts.purchaseDate,
      closingDay: opts.card.closingDay,
      dueDay: opts.card.dueDay,
      installmentAmount,
      installmentsCount,
    });

    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        cardId: opts.card.id,
        categoryId: cat(opts.categoryName),
        name: opts.name,
        merchant: opts.merchant,
        totalAmount,
        purchaseDate: opts.purchaseDate,
        kind,
        installmentsCount,
        isRecurring: kind === "RECURRING",
        tags: opts.tags ?? [],
        isFavorite: opts.isFavorite ?? false,
      },
    });

    for (const inst of generated) {
      const isPast = inst.dueDate < today;
      let status: "PENDING" | "PAID" | "LATE" = "PENDING";
      if (isPast) {
        status = Math.random() < 0.82 ? "PAID" : "LATE";
      }

      const installment = await prisma.installment.create({
        data: {
          userId: user.id,
          purchaseId: purchase.id,
          cardId: opts.card.id,
          number: inst.number,
          amount: inst.amount,
          referenceMonth: inst.referenceMonth,
          referenceYear: inst.referenceYear,
          dueDate: inst.dueDate,
          status,
        },
      });

      if (status === "PAID") {
        await prisma.payment.create({
          data: { userId: user.id, installmentId: installment.id, amountPaid: inst.amount, paidAt: inst.dueDate },
        });
      }
    }

    return purchase;
  }

  function monthsAgo(n: number, day = 10) {
    return new Date(today.getFullYear(), today.getMonth() - n, day);
  }

  // Compras parceladas de maior porte
  await createPurchase({
    name: "Notebook Dell XPS",
    merchant: "Fast Shop",
    categoryName: "Eletrônicos",
    card: nubank,
    totalAmount: 4800,
    purchaseDate: monthsAgo(4, 8),
    installmentsCount: 12,
    isFavorite: true,
  });

  await createPurchase({
    name: "iPhone 16 Pro",
    merchant: "Apple Store",
    categoryName: "Eletrônicos",
    card: itau,
    totalAmount: 8999,
    purchaseDate: monthsAgo(2, 15),
    installmentsCount: 10,
    isFavorite: true,
  });

  await createPurchase({
    name: "Geladeira Frost Free",
    merchant: "Magazine Luiza",
    categoryName: "Casa",
    card: c6,
    totalAmount: 3200,
    purchaseDate: monthsAgo(3, 2),
    installmentsCount: 8,
  });

  await createPurchase({
    name: "Curso de Inglês",
    merchant: "Wizard",
    categoryName: "Educação",
    card: nubank,
    totalAmount: 1200,
    purchaseDate: monthsAgo(5, 20),
    installmentsCount: 6,
  });

  await createPurchase({
    name: "Pacote de Viagem - Nordeste",
    merchant: "CVC",
    categoryName: "Viagem",
    card: itau,
    totalAmount: 5000,
    purchaseDate: monthsAgo(1, 5),
    installmentsCount: 5,
  });

  await createPurchase({
    name: "Sofá 3 Lugares",
    merchant: "Tok&Stok",
    categoryName: "Casa",
    card: c6,
    totalAmount: 2400,
    purchaseDate: monthsAgo(0, 3),
    installmentsCount: 4,
  });

  // Compras à vista recorrentes (mercado, alimentação)
  for (let m = 5; m >= 0; m--) {
    await createPurchase({
      name: "Compras do mês",
      merchant: "Carrefour",
      categoryName: "Mercado",
      card: nubank,
      totalAmount: 380 + Math.round(Math.random() * 200),
      purchaseDate: monthsAgo(m, 3),
      kind: "CASH",
    });
    await createPurchase({
      name: "Restaurante",
      merchant: "iFood",
      categoryName: "Alimentação",
      card: nubank,
      totalAmount: 60 + Math.round(Math.random() * 90),
      purchaseDate: monthsAgo(m, 18),
      kind: "CASH",
    });
  }

  // Assinaturas recorrentes (passado + futuro)
  for (let m = -3; m <= 5; m++) {
    await createPurchase({
      name: "Netflix",
      merchant: "Netflix.com",
      categoryName: "Assinaturas",
      card: nubank,
      totalAmount: 44.9,
      purchaseDate: monthsAgo(-m, 1),
      kind: "RECURRING",
      tags: ["assinatura", "streaming"],
    });
    await createPurchase({
      name: "Spotify Premium",
      merchant: "Spotify",
      categoryName: "Assinaturas",
      card: nubank,
      totalAmount: 21.9,
      purchaseDate: monthsAgo(-m, 2),
      kind: "RECURRING",
      tags: ["assinatura", "música"],
    });
  }

  // Compra recém-lançada com poucos dias, para demonstrar a lógica de fechamento
  await createPurchase({
    name: "Fone Bluetooth",
    merchant: "Amazon",
    categoryName: "Eletrônicos",
    card: c6,
    totalAmount: 349,
    purchaseDate: new Date(),
    installmentsCount: 3,
  });

  console.log("Seed concluído!");
  console.log(`Login demo: ${DEMO_EMAIL} / senha: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
