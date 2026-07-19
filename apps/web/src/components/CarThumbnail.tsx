interface Props {
  className?: string;
}

/**
 * Original stylized sedan illustration (not a photo or brand asset) used as a
 * "miniatura" for financings recognized as a Mitsubishi Lancer. More models
 * can get their own thumbnail here later the same way.
 */
export function MitsubishiLancerThumbnail({ className }: Props) {
  return (
    <svg
      viewBox="0 0 160 90"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ilustração de um Mitsubishi Lancer"
    >
      <ellipse cx="80" cy="78" rx="62" ry="6" fill="currentColor" opacity="0.08" />
      <rect x="8" y="42" width="144" height="28" rx="14" fill="#C8102E" />
      <path d="M42 42 L54 16 H108 L122 42 Z" fill="#C8102E" />
      <path d="M50 38 L59 22 H80 V38 Z" fill="#1A1A1A" opacity="0.85" />
      <path d="M84 38 V22 H103 L112 38 Z" fill="#1A1A1A" opacity="0.85" />
      <line x1="82" y1="42" x2="82" y2="70" stroke="#8F0C1F" strokeWidth="2" />
      <rect x="10" y="48" width="10" height="6" rx="3" fill="#FFD54A" />
      <rect x="140" y="48" width="10" height="6" rx="3" fill="#7A0000" />
      <circle cx="42" cy="72" r="14" fill="#1A1A1A" />
      <circle cx="42" cy="72" r="6" fill="#D9D9D9" />
      <circle cx="118" cy="72" r="14" fill="#1A1A1A" />
      <circle cx="118" cy="72" r="6" fill="#D9D9D9" />
    </svg>
  );
}
