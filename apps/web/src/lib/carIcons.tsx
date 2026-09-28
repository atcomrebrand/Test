import { IconType } from "react-icons";
import { SiMitsubishi } from "react-icons/si";
import { MitsubishiLancerThumbnail } from "@/components/CarThumbnail";

export interface AutomakerMatch {
  Icon: IconType;
  color: string;
}

/**
 * Automaker logos with a legitimately available open-source brand icon (see
 * the note in src/lib/serviceIcons.tsx about brands pulled from Simple Icons
 * after trademark takedowns). Only Mitsubishi is wired up for now — add more
 * `SiXxx` entries here as they're needed.
 */
const AUTOMAKER_ICONS: { pattern: RegExp; icon: IconType; color: string }[] = [
  { pattern: /mitsubishi/i, icon: SiMitsubishi, color: "#E60012" },
];

export function matchAutomakerIcon(name: string): AutomakerMatch | null {
  for (const a of AUTOMAKER_ICONS) {
    if (a.pattern.test(name)) return { Icon: a.icon, color: a.color };
  }
  return null;
}

export interface CarThumbnailMatch {
  Thumbnail: (props: { className?: string }) => JSX.Element;
  label: string;
}

/** Illustrated car-model thumbnails (original vector art). Only the Lancer for now. */
const CAR_THUMBNAILS: { pattern: RegExp; Thumbnail: CarThumbnailMatch["Thumbnail"]; label: string }[] = [
  { pattern: /lancer/i, Thumbnail: MitsubishiLancerThumbnail, label: "Mitsubishi Lancer" },
];

export function matchCarThumbnail(name: string): CarThumbnailMatch | null {
  for (const c of CAR_THUMBNAILS) {
    if (c.pattern.test(name)) return { Thumbnail: c.Thumbnail, label: c.label };
  }
  return null;
}
