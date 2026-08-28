import { Injectable } from "@nestjs/common";
import { GymProfile } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { UpdateGymProfileDto } from "./dto/gym.dto";

/**
 * Perfil e configurações do praticante.
 *
 * A linha só nasce quando a pessoa passa pelo onboarding — quem nunca abriu a Academia não tem
 * registro nenhum aqui, e é assim que o módulo não cobra nada de quem não usa. As telas leem
 * `ensure()`, que devolve os padrões sem gravar: é o que permite mostrar a tela já preenchida
 * enquanto o onboarding ainda não terminou.
 */
@Injectable()
export class GymProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: string): Promise<GymProfile | null> {
    return this.prisma.gymProfile.findUnique({ where: { userId } });
  }

  /** O perfil com os padrões preenchidos, sem gravar. `onboardedAt` nulo = onboarding pendente. */
  async ensure(userId: string) {
    const perfil = await this.find(userId);
    if (perfil) return perfil;
    return {
      id: "",
      userId,
      objective: "HIPERTROFIA",
      level: "INICIANTE",
      heightCm: null,
      birthDate: null,
      weeklyTarget: 4,
      sessionMinutes: 60,
      defaultRestSeconds: 90,
      weightUnit: "KG",
      oneRmFormula: "EPLEY",
      soundEnabled: true,
      vibrationEnabled: true,
      onboardedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as GymProfile;
  }

  async update(userId: string, dto: UpdateGymProfileDto): Promise<GymProfile> {
    const { onboarded, birthDate, ...resto } = dto;
    const dados = {
      ...resto,
      ...(birthDate !== undefined ? { birthDate: new Date(birthDate) } : {}),
      // Concluir o onboarding é um instante, não um booleano: guardar QUANDO permite saber há
      // quanto tempo a pessoa usa o módulo sem uma coluna a mais.
      ...(onboarded === true ? { onboardedAt: new Date() } : {}),
    };

    return this.prisma.gymProfile.upsert({
      where: { userId },
      create: { userId, ...dados },
      update: dados,
    });
  }
}
