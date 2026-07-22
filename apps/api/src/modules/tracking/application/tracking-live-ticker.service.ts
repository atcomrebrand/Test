import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TrackingSessionRepository } from "../domain/tracking-session.repository";
import { computeSessionTime } from "../domain/session-time-calculator";
import { PushService } from "../../push/push.service";

/** Fixed tag so each update replaces the previous push in place instead of stacking a new
 *  notification every minute — the "live score ticker" effect the user asked for. */
const LIVE_TICKER_TAG = "tracking-live-session";

function formatHM(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

/**
 * Every minute, pushes an updated "trabalho em andamento" notification for every RUNNING/PAUSED
 * session across all users — same idea as a live sports score card. Deliberately cron-only (no
 * hook into start/pause/resume/finish) to keep TrackingSessionsService untouched: a session started
 * mid-minute shows up on the very next tick, which is close enough to "live" for this use case.
 */
@Injectable()
export class TrackingLiveTickerService {
  private readonly logger = new Logger(TrackingLiveTickerService.name);

  constructor(
    private readonly sessions: TrackingSessionRepository,
    private readonly push: PushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const active = await this.sessions.findAllActive();
    for (const session of active) {
      try {
        await this.pushUpdate(session);
      } catch (err) {
        this.logger.warn(`Falha ao enviar ticker ao vivo da sessão ${session.id}: ${(err as Error).message}`);
      }
    }
  }

  private async pushUpdate(session: Awaited<ReturnType<TrackingSessionRepository["findAllActive"]>>[number]) {
    const time = computeSessionTime({
      checkIn: session.checkIn,
      checkOut: null,
      pauses: session.pauses.map((p) => ({ pausedAt: p.pausedAt, resumedAt: p.resumedAt })),
    });

    const statusLabel = session.status === "RUNNING" ? "Trabalhando" : "Pausado";

    await this.push.notifyUser(session.userId, {
      title: `${statusLabel} · ${session.job.company}`,
      body: `${formatHM(time.netSeconds)} registradas`,
      url: "/horas",
      tag: LIVE_TICKER_TAG,
    });
  }
}
