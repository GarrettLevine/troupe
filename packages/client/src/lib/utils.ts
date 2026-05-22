export function formatEventDate(eventAt: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(eventAt));
}

export function formatCompactDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoString));
}

export function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoString));
}
