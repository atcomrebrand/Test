/**
 * Dados demonstrativos da Academia, pro ambiente de desenvolvimento (§57).
 *
 * Cria fichas ABC, três meses de histórico com progressão de carga, medidas, metas e — como
 * consequência do histórico, não como dado inventado — os recordes que o próprio app detecta.
 *
 * **Não roda sozinho em produção**: exige `--user=<id>` ou usa o único usuário do banco, e recusa
 * se o usuário já tiver treinos. Semear por cima de dado real seria pior que não semear.
 *
 *   pnpm run seed:gym-demo -- --user=<id>
 */
import { PrismaClient } from "@prisma/client";
import { EXERCISE_CATALOG } from "../src/modules/gym/infrastructure/exercise-catalog";

const prisma = new PrismaClient();

const FICHAS = [
  {
    name: "Treino A",
    description: "Peito + Tríceps",
    exercicios: [
      { slug: "supino-reto-barra", sets: 4, min: 8, max: 10, peso: 70, rest: 90 },
      { slug: "supino-inclinado-halteres", sets: 4, min: 8, max: 12, peso: 26, rest: 90 },
      { slug: "crossover-polia-alta", sets: 3, min: 12, max: 15, peso: 18, rest: 60 },
      { slug: "voador-peck-deck", sets: 3, min: 10, max: 12, peso: 45, rest: 60 },
      { slug: "triceps-pulley-corda", sets: 4, min: 10, max: 12, peso: 30, rest: 45 },
      { slug: "triceps-testa-barra", sets: 3, min: 10, max: 12, peso: 25, rest: 45 },
    ],
  },
  {
    name: "Treino B",
    description: "Costas + Bíceps",
    exercicios: [
      { slug: "barra-fixa-pronada", sets: 4, min: 6, max: 10, peso: 0, rest: 120 },
      { slug: "remada-curvada-barra", sets: 4, min: 8, max: 10, peso: 60, rest: 90 },
      { slug: "puxada-frente-aberta", sets: 3, min: 10, max: 12, peso: 55, rest: 75 },
      { slug: "remada-baixa-cabo", sets: 3, min: 10, max: 12, peso: 50, rest: 75 },
      { slug: "rosca-direta-barra", sets: 4, min: 8, max: 12, peso: 30, rest: 60 },
      { slug: "rosca-martelo", sets: 3, min: 10, max: 12, peso: 14, rest: 45 },
    ],
  },
  {
    name: "Treino C",
    description: "Pernas",
    exercicios: [
      { slug: "agachamento-livre", sets: 4, min: 6, max: 10, peso: 90, rest: 150 },
      { slug: "leg-press-45", sets: 4, min: 10, max: 12, peso: 180, rest: 120 },
      { slug: "cadeira-extensora", sets: 3, min: 12, max: 15, peso: 55, rest: 60 },
      { slug: "mesa-flexora", sets: 4, min: 10, max: 12, peso: 45, rest: 60 },
      { slug: "stiff-barra", sets: 3, min: 10, max: 12, peso: 60, rest: 90 },
      { slug: "panturrilha-em-pe-maquina", sets: 4, min: 15, max: 20, peso: 80, rest: 45 },
    ],
  },
  {
    name: "Treino D",
    description: "Ombros + Abdômen",
    exercicios: [
      { slug: "desenvolvimento-halteres", sets: 4, min: 8, max: 10, peso: 22, rest: 90 },
      { slug: "elevacao-lateral-halteres", sets: 4, min: 12, max: 15, peso: 10, rest: 45 },
      { slug: "crucifixo-inverso-maquina", sets: 3, min: 12, max: 15, peso: 35, rest: 45 },
      { slug: "encolhimento-halteres", sets: 3, min: 12, max: 15, peso: 30, rest: 60 },
      { slug: "prancha", sets: 3, min: 30, max: 60, peso: 0, rest: 45 },
      { slug: "abdominal-na-polia", sets: 3, min: 15, max: 20, peso: 25, rest: 45 },
    ],
  },
];

async function main() {
  const argUser = process.argv.find((a) => a.startsWith("--user="))?.split("=")[1];

  let userId = argUser;
  if (!userId) {
    const usuarios = await prisma.user.findMany({ select: { id: true, email: true }, take: 2 });
    if (usuarios.length !== 1) {
      console.error(`Há ${usuarios.length} usuários no banco. Informe --user=<id> pra escolher.`);
      process.exitCode = 1;
      return;
    }
    userId = usuarios[0].id;
    console.log(`Usuário: ${usuarios[0].email}`);
  }

  const jaTem = await prisma.gymWorkout.count({ where: { userId } });
  if (jaTem > 0) {
    console.error(`Esse usuário já tem ${jaTem} treino(s). O seed demo não escreve por cima de dado real.`);
    process.exitCode = 1;
    return;
  }

  const catalogo = await prisma.gymExercise.findMany({ where: { userId: null }, select: { id: true, slug: true } });
  const porSlug = new Map(catalogo.map((e) => [e.slug!, e.id]));
  if (porSlug.size === 0) {
    console.error("Catálogo vazio. Rode `pnpm run seed:gym` antes.");
    process.exitCode = 1;
    return;
  }

  await prisma.gymProfile.upsert({
    where: { userId },
    create: { userId, objective: "HIPERTROFIA", level: "INTERMEDIARIO", heightCm: 178, weeklyTarget: 4, sessionMinutes: 60, defaultRestSeconds: 90, onboardedAt: new Date() },
    update: { onboardedAt: new Date() },
  });

  const fichas = [];
  for (const [i, f] of FICHAS.entries()) {
    const criada = await prisma.gymWorkout.create({
      data: {
        userId,
        name: f.name,
        description: f.description,
        order: i,
        exercises: {
          create: f.exercicios.map((e, ordem) => ({
            exerciseId: porSlug.get(e.slug)!,
            order: ordem,
            sets: e.sets,
            targetRepsMin: e.min,
            targetRepsMax: e.max,
            targetWeight: e.peso,
            restSeconds: e.rest,
          })),
        },
      },
      include: { exercises: true },
    });
    fichas.push({ ficha: criada, plano: f });
  }

  // 12 semanas, 4 treinos por semana, com a carga subindo devagar — é isso que faz o gráfico de
  // evolução, os recordes e o "última vez" terem o que mostrar.
  const hoje = new Date();
  let sessoes = 0;
  let recordes = 0;

  for (let semana = 11; semana >= 0; semana--) {
    for (const [dia, { ficha, plano }] of fichas.entries()) {
      const quando = new Date(hoje);
      quando.setDate(quando.getDate() - semana * 7 - (3 - dia));
      quando.setHours(19, 0, 0, 0);
      if (quando > hoje) continue;

      const progressao = (11 - semana) * 0.02; // ~2% por semana
      const duracao = 45 + Math.round(Math.random() * 20);
      const fim = new Date(quando.getTime() + duracao * 60000);

      const sets: any[] = [];
      let volume = 0;
      for (const [ordem, planejado] of plano.exercicios.entries()) {
        const exerciseId = ficha.exercises.find((e) => e.exerciseId === porSlug.get(planejado.slug))!.exerciseId;
        const base = planejado.peso * (1 + progressao);
        // Arredonda pra 2,5 kg, que é o incremento real de anilha.
        const peso = planejado.peso === 0 ? 0 : Math.max(planejado.peso, Math.round((base * 2) / 5) * 2.5);
        for (let n = 1; n <= planejado.sets; n++) {
          const reps = Math.max(planejado.min, planejado.max - Math.floor((n - 1) / 2));
          sets.push({
            exerciseId,
            exerciseOrder: ordem,
            setNumber: n,
            weight: peso,
            reps,
            completed: true,
            restSeconds: planejado.rest,
            restActualSeconds: planejado.rest + Math.round(Math.random() * 20 - 5),
            restStartedAt: quando,
            restEndedAt: quando,
            completedAt: quando,
          });
          volume += peso * reps;
        }
      }

      const sessao = await prisma.gymSession.create({
        data: {
          userId,
          clientId: `demo-${ficha.id}-${semana}`,
          workoutId: ficha.id,
          name: ficha.name,
          startedAt: quando,
          finishedAt: fim,
          durationSeconds: duracao * 60,
          totalVolume: Math.round(volume * 100) / 100,
          sets: { create: sets },
        },
      });
      sessoes++;

      // Recordes: só nos treinos em que a carga de fato subiu — a mesma regra do app, aplicada
      // aqui pra o histórico ficar coerente com o que o app teria detectado na hora.
      if (semana < 11 && semana % 3 === 0) {
        const principal = plano.exercicios[0];
        if (principal.peso > 0) {
          const peso = Math.round((principal.peso * (1 + progressao) * 2) / 5) * 2.5;
          await prisma.gymPersonalRecord.create({
            data: {
              userId,
              exerciseId: porSlug.get(principal.slug)!,
              sessionId: sessao.id,
              kind: "PESO_MAXIMO",
              weight: peso,
              reps: principal.min,
              estimatedOneRm: Math.round(peso * (1 + principal.min / 30) * 100) / 100,
              improvement: 2.5,
              achievedAt: quando,
            },
          });
          recordes++;
        }
      }
    }
  }

  // Medidas quinzenais, com o peso subindo de leve.
  for (let i = 0; i < 6; i++) {
    const quando = new Date(hoje);
    quando.setDate(quando.getDate() - i * 15);
    quando.setHours(7, 0, 0, 0);
    await prisma.gymMeasurement.create({
      data: {
        userId,
        date: quando,
        weightKg: Math.round((78 - i * 0.4) * 10) / 10,
        chest: 102 - i * 0.3,
        waist: 82 + i * 0.2,
        armRight: 38 - i * 0.2,
        armLeft: 37.5 - i * 0.2,
        thighRight: 58 - i * 0.2,
        thighLeft: 57.8 - i * 0.2,
      },
    });
  }

  await prisma.gymTarget.createMany({
    data: [
      { userId, kind: "CARGA", exerciseId: porSlug.get("supino-reto-barra")!, label: "Supino 100 kg", targetValue: 100, startValue: 70 },
      { userId, kind: "FREQUENCIA_SEMANAL", label: "Treinar 5x por semana", targetValue: 5, startValue: 3 },
      { userId, kind: "PESO_CORPORAL", label: "Chegar a 80 kg", targetValue: 80, startValue: 78 },
    ],
  });

  console.log(`Pronto: ${fichas.length} fichas, ${sessoes} sessões, ${recordes} recordes, 6 medições e 3 metas.`);
  console.log(`Catálogo: ${EXERCISE_CATALOG.length} exercícios.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
