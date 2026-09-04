import { IconType } from "react-icons";
import {
  SiNetflix,
  SiSpotify,
  SiHbomax,
  SiApplemusic,
  SiAppletv,
  SiGoogleplay,
  SiDeezer,
  SiTwitch,
  SiPlaystation,
  SiParamountplus,
  SiCrunchyroll,
  SiTidal,
  SiIcloud,
  SiStarz,
  SiYoutube,
  SiNubank,
  SiPicpay,
} from "react-icons/si";

export interface IconMatch {
  Icon: IconType;
  color: string;
}

/**
 * Recognized subscriptions/streaming services with a legitimately available
 * open-source brand icon. Brands without one here (Disney+, Amazon Prime
 * Video, Xbox Game Pass...) were removed from Simple Icons after trademark
 * takedown requests, so we deliberately don't fake a logo for them — callers
 * fall back to a generic icon instead.
 */
const SERVICE_ICONS: { pattern: RegExp; icon: IconType; color: string }[] = [
  { pattern: /netflix/i, icon: SiNetflix, color: "#E50914" },
  { pattern: /spotify/i, icon: SiSpotify, color: "#1DB954" },
  { pattern: /\bhbo\b|\bmax\b/i, icon: SiHbomax, color: "#5822B4" },
  { pattern: /apple\s*music/i, icon: SiApplemusic, color: "#FA243C" },
  { pattern: /apple\s*tv/i, icon: SiAppletv, color: "#000000" },
  { pattern: /google\s*play|play\s*store/i, icon: SiGoogleplay, color: "#00C853" },
  { pattern: /deezer/i, icon: SiDeezer, color: "#FEAA2D" },
  { pattern: /twitch/i, icon: SiTwitch, color: "#9146FF" },
  { pattern: /playstation|\bpsn\b|ps\s*plus/i, icon: SiPlaystation, color: "#003791" },
  { pattern: /paramount/i, icon: SiParamountplus, color: "#0064FF" },
  { pattern: /crunchyroll/i, icon: SiCrunchyroll, color: "#F47521" },
  { pattern: /tidal/i, icon: SiTidal, color: "#000000" },
  { pattern: /icloud/i, icon: SiIcloud, color: "#3693F3" },
  { pattern: /starz/i, icon: SiStarz, color: "#000000" },
  { pattern: /youtube/i, icon: SiYoutube, color: "#FF0000" },
  { pattern: /picpay/i, icon: SiPicpay, color: "#21C25E" },
];

export function matchServiceIcon(name: string): IconMatch | null {
  for (const s of SERVICE_ICONS) {
    if (s.pattern.test(name)) return { Icon: s.icon, color: s.color };
  }
  return null;
}

/** Banks with a legitimately available open-source brand icon (see note above). */
const BANK_ICONS: { pattern: RegExp; icon: IconType; color: string }[] = [
  { pattern: /nubank/i, icon: SiNubank, color: "#820AD1" },
];

export function matchBankIcon(bankName: string): IconMatch | null {
  for (const b of BANK_ICONS) {
    if (b.pattern.test(bankName)) return { Icon: b.icon, color: b.color };
  }
  return null;
}
