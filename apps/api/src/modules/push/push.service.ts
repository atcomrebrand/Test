import { Injectable, Logger } from "@nestjs/common";
import * as webpush from "web-push";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscribeDto } from "./dto/push.dto";

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path to open when the notification is tapped, e.g. "/notificacoes". */
  url?: string;
  /** When set, the OS replaces any existing notification with the same tag instead of stacking a
   *  new one — used by the Horas live ticker so the session's elapsed time updates in place. */
  tag?: string;
}

/**
 * Sends real OS-level push notifications (works on iPhone too, but only once the site is added
 * to the Home Screen — iOS only allows Web Push for installed PWAs, never for a plain Safari tab).
 * Never throws to its callers: a dead subscription or a down push service must never break the
 * action that triggered the notification (same best-effort convention as DividendAutoSyncService).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    this.configured = Boolean(publicKey && privateKey);
    if (this.configured) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:no-reply@example.com", publicKey!, privateKey!);
    } else {
      this.logger.warn("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas — push notifications desativadas.");
    }
  }

  /** null when the server has no VAPID keys configured — the frontend uses this to hide the
   *  "ativar notificações" option instead of offering something that would fail silently. */
  getPublicKey(): string | null {
    return this.configured ? process.env.VAPID_PUBLIC_KEY! : null;
  }

  async subscribe(userId: string, dto: SubscribeDto) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent: dto.userAgent },
      update: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent: dto.userAgent },
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { subscribed: false };
  }

  async isSubscribed(userId: string): Promise<boolean> {
    const count = await this.prisma.pushSubscription.count({ where: { userId } });
    return count > 0;
  }

  /** Fans a notification out to every device the user has subscribed (phone, desktop browser,
   *  etc). Best-effort per-device: one dead/expired subscription (410 Gone) is pruned and never
   *  stops the others from being sent to, and any failure here is swallowed rather than thrown. */
  async notifyUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.configured) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        } catch (err) {
          const statusCode = (err as webpush.WebPushError).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          } else {
            this.logger.warn(`Falha ao enviar push para inscrição ${sub.id}: ${(err as Error).message}`);
          }
        }
      }),
    );
  }
}
