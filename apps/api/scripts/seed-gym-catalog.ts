/**
 * Semeia o catálogo global de exercícios da Academia.
 *
 * Idempotente pelo `slug`: rodar de novo insere só o que falta e atualiza o texto do que mudou,
 * sem duplicar nada e sem tocar em exercício criado pela pessoa (esses têm `userId` e `slug` nulo).
 * É isso que permite crescer o catálogo depois — acrescenta no `exercise-catalog.ts` e roda de novo,
 * sem migration.
 *
 *   pnpm run seed:gym          # aplica
 *   pnpm run seed:gym -- --dry # só mostra o que faria
 */
import { PrismaClient } from "@prisma/client";
import { EXERCISE_CATALOG } from "../src/modules/gym/infrastructure/exercise-catalog";

const prisma = new PrismaClient();

async function main() {
  const dry = process.argv.includes("--dry");

  const existentes = await prisma.gymExercise.findMany({
    where: { userId: null },
    select: { slug: true },
  });
  const jaTem = new Set(existentes.map((e) => e.slug));

  const novos = EXERCISE_CATALOG.filter((e) => !jaTem.has(e.slug));
  console.log(`Catálogo: ${EXERCISE_CATALOG.length} exercícios · no banco: ${jaTem.size} · a inserir: ${novos.length}`);

  if (dry) {
    novos.slice(0, 10).forEach((e) => console.log(`  + ${e.name} (${e.primaryMuscle})`));
    if (novos.length > 10) console.log(`  ... e mais ${novos.length - 10}`);
    console.log("\nSimulação — nada foi gravado. Rode sem --dry pra aplicar.");
    return;
  }

  let inseridos = 0;
  let atualizados = 0;
  for (const e of EXERCISE_CATALOG) {
    const dados = {
      name: e.name,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: e.secondaryMuscles,
      equipment: e.equipment,
      instructions: e.instructions,
      tips: e.tips,
      commonMistakes: e.commonMistakes,
    };
    // `upsert` pelo slug: o texto do catálogo é nosso, então atualizar é seguro. O que nunca é
    // tocado é o que pertence à pessoa — favorito, histórico e treino apontam por id, e o id não
    // muda aqui.
    const antes = jaTem.has(e.slug);
    await prisma.gymExercise.upsert({
      where: { slug: e.slug },
      create: { slug: e.slug, userId: null, ...dados },
      update: dados,
    });
    if (antes) atualizados++;
    else inseridos++;
  }

  console.log(`\nPronto: ${inseridos} inserido(s), ${atualizados} atualizado(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
