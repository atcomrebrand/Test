import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { PlacementEntry, summarizePlacements } from "../domain/placement-summary";

export interface PlacementJob {
  jobId: string;
  jobName: string;
  color: string;
  points: PlacementEntry[];
  summary: ReturnType<typeof summarizePlacements>;
}

/**
 * A evolução da colocação, por trabalho.
 *
 * Agrupa por trabalho e não numa série só porque colocação de serviços diferentes não é
 * comparável: ser 3º entre dez não é o mesmo que ser 3º entre duzentos, e uma linha única
 * misturaria os dois num número que não significa nada.
 *
 * O recorte é por **trabalho com dado**, não por `tracksPlacement`: desligar o sistema num
 * trabalho para de perguntar, mas não pode apagar da tela o histórico que já foi registrado.
 */
@Injectable()
export class TrackingPlacementService {
  constructor(private readonly prisma: PrismaService) {}

  async evolution(userId: string): Promise<PlacementJob[]> {
    const sessions = await this.prisma.trackingSession.findMany({
      where: {
        userId,
        status: "COMPLETED",
        // Sessão sem nenhum dos três não é um ponto do gráfico — é um dia comum de trabalho.
        OR: [{ placement: { not: null } }, { satisfactionPercent: { not: null } }, { responseMinutes: { not: null } }],
      },
      select: {
        checkIn: true,
        placement: true,
        satisfactionPercent: true,
        responseMinutes: true,
        job: { select: { id: true, name: true, color: true } },
      },
      orderBy: { checkIn: "asc" },
    });

    const porTrabalho = new Map<string, PlacementJob>();

    for (const s of sessions) {
      const atual = porTrabalho.get(s.job.id) ?? {
        jobId: s.job.id,
        jobName: s.job.name,
        color: s.job.color,
        points: [] as PlacementEntry[],
        summary: summarizePlacements([]),
      };
      atual.points.push({
        // Data local: o check-in é gravado como instante, e ler em UTC jogaria a sessão da noite
        // pro dia seguinte — o mesmo cuidado que o Calendário já toma.
        date: `${s.checkIn.getFullYear()}-${String(s.checkIn.getMonth() + 1).padStart(2, "0")}-${String(s.checkIn.getDate()).padStart(2, "0")}`,
        placement: s.placement,
        satisfactionPercent: s.satisfactionPercent === null ? null : Number(s.satisfactionPercent),
        responseMinutes: s.responseMinutes,
      });
      porTrabalho.set(s.job.id, atual);
    }

    return [...porTrabalho.values()].map((j) => ({ ...j, summary: summarizePlacements(j.points) }));
  }
}
