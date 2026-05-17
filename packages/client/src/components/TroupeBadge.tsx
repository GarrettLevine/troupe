import { getBadgeUrls } from '../lib/badgeUrl';
import { BRAND_COLORS } from '../lib/constants';

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % BRAND_COLORS.length;
  }
  return BRAND_COLORS[hash];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const SIZE_CLASSES = {
  thumbnail: 'w-16 h-16 text-base',
  standard: 'w-32 h-32 text-2xl',
  large: 'w-64 h-64 text-5xl',
};

interface TroupeBadgeProps {
  troupe: { id: string; name: string; hasBadge: boolean; updatedAt?: string };
  size: 'thumbnail' | 'standard' | 'large';
  className?: string;
}

export function TroupeBadge({ troupe, size, className = '' }: TroupeBadgeProps) {
  const sizeClass = SIZE_CLASSES[size];
  const base = `rounded-full shrink-0 ${sizeClass} ${className}`;

  if (troupe.hasBadge) {
    const urls = getBadgeUrls(troupe.id, troupe.updatedAt);
    return (
      <img
        src={urls[size]}
        alt={`${troupe.name} badge`}
        loading="lazy"
        className={`${base} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${base} ${hashColor(troupe.id)} flex items-center justify-center text-white font-semibold`}
    >
      {getInitials(troupe.name)}
    </div>
  );
}
