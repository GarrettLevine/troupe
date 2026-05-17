export function getBadgeUrls(troupeId: string, updatedAt?: Date) {
  const base = process.env.R2_PUBLIC_URL;
  const v = updatedAt ? `?v=${Math.floor(updatedAt.getTime() / 1000)}` : '';
  return {
    thumbnail: `${base}/badges/${troupeId}/thumbnail.webp${v}`,
    standard: `${base}/badges/${troupeId}/standard.webp${v}`,
    large: `${base}/badges/${troupeId}/large.webp${v}`,
  };
}
