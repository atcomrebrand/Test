import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { computeSessionTime } from "../domain/session-time-calculator";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";

function csvEscape(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
}

/** Hand-rolled CSV, no library, mirroring apps/api/src/modules/export/export.service.ts's pattern. */
@Injectable()
export class TrackingExportService {
  constructor(private readonly prisma: PrismaService) {}

  async sessionsCsv(userId: string): Promise<string> {
    const sessions = await this.prisma.trackingSession.findMany({
      where: { userId, status: "COMPLETED" },
      include: { pauses: true, job: true },
      orderBy: { checkIn: "asc" },
    });

    const header = [
      "Trabalho",
      "Empresa",
      "Cliente",
      "Data",
      "Check-in",
      "Check-out",
      "Tempo bruto",
      "Tempo de pausa",
      "Tempo líquido",
      "Valor/hora",
      "Valor equivalente",
      "Observações",
    ];

    const rows = sessions.map((s) => {
      const time = computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses });
      const hourlyRate = estimateJobHourlyRate({
        monthlyValue: Number(s.job.monthlyValue),
        expectedHoursPerDay: s.job.expectedHoursPerDay,
        weekdays: s.job.weekdays,
      });
      const value = (time.netSeconds / 3600) * hourlyRate;

      return [
        csvEscape(s.job.name),
        csvEscape(s.job.company),
        csvEscape(s.job.client ?? ""),
        s.checkIn.toISOString().slice(0, 10),
        s.checkIn.toISOString().slice(11, 19),
        s.checkOut ? s.checkOut.toISOString().slice(11, 19) : "",
        formatHMS(time.grossSeconds),
        formatHMS(time.pauseSeconds),
        formatHMS(time.netSeconds),
        hourlyRate.toFixed(2),
        value.toFixed(2),
        csvEscape(s.notes ?? ""),
      ];
    });

    return [header, ...rows].map((r) => r.join(";")).join("\n");
  }
}
