export function getBadgeUrls(troupeId: string, updatedAt?: string) {
  const base = import.meta.env.VITE_R2_PUBLIC_URL as string;
  const v = updatedAt ? `?v=${Math.floor(new Date(updatedAt).getTime() / 1000)}` : '';
  return {
    thumbnail: `${base}/badges/${troupeId}/thumbnail.webp${v}`,
    standard: `${base}/badges/${troupeId}/standard.webp${v}`,
    large: `${base}/badges/${troupeId}/large.webp${v}`,
  };
}
