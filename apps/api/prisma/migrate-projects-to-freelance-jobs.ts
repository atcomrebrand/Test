/**
 * One-off data migration: TrackingProject (projetos extras, com horas manuais e sem cronômetro)
 * vira um TrackingJob(type=FREELANCE) + uma única TrackingSession retroativa reproduzindo as horas
 * e o valor que já estavam registrados — pra "Projetos Extras" e "Trabalhos Fixos" ficarem
 * unificados em Trabalhos, sem perder o histórico. Rode uma vez, ANTES de aplicar a migration que
 * dropa tracking_projects (20260721210000_drop_tracking_projects) — por isso usa SQL cru em vez do
 * Prisma Client, já que o model TrackingProject não existe mais no schema:
 *   pnpm exec ts-node prisma/migrate-projects-to-freelance-jobs.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TrackingProjectRow {
  id: string;
  userId: string;
  name: string;
  client: string | null;
  amountReceived: string;
  date: Date;
  hoursSpent: string;
  status: "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";
  notes: string | null;
  deletedAt: Date | null;
}

async function main() {
  const projects = await prisma.$queryRaw<TrackingProjectRow[]>`SELECT * FROM tracking_projects`;
  console.log(`Migrando ${projects.length} projeto(s) extra(s) para trabalhos freelance...`);

  for (const project of projects) {
    const company = project.client || "Freelance";
    const active = project.status === "EM_ANDAMENTO";
    const notes = project.status === "CANCELADO" ? [project.notes, "[projeto cancelado]"].filter(Boolean).join(" ") : project.notes;

    const checkIn = new Date(project.date);
    checkIn.setHours(9, 0, 0, 0);
    const checkOut = new Date(checkIn.getTime() + Number(project.hoursSpent) * 3600 * 1000);

    const job = await prisma.trackingJob.create({
      data: {
        userId: project.userId,
        type: "FREELANCE",
        name: project.name,
        company,
        client: project.client,
        totalAgreedValue: project.amountReceived,
        currency: "BRL",
        startDate: checkIn,
        notes,
        active,
        deletedAt: project.deletedAt,
      },
    });

    await prisma.trackingSession.create({
      data: {
        userId: project.userId,
        jobId: job.id,
        checkIn,
        checkOut,
        status: "COMPLETED",
        notes: project.notes,
      },
    });

    console.log(`  ✓ "${project.name}" (${project.hoursSpent}h, R$ ${project.amountReceived}) -> trabalho ${job.id}`);
  }

  console.log("Migração concluída.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
