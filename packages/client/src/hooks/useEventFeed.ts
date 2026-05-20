import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface FeedEvent {
  id: string;
  name: string;
  eventType: 'show' | 'rehearsal';
  eventAt: string;
  location: string;
  details: string | null;
  troupe: {
    id: string;
    name: string;
    hasBadge: boolean;
  };
}

export function useEventFeed() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTroupeId, setActiveTroupeId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    loading: false,
    hasMore: false,
    nextCursor: null as string | null,
    activeTroupeId: null as string | null,
  });

  const fetchFeed = useCallback(
    async (troupeId?: string | null) => {
      if (!user) return;
      const id = troupeId ?? null;
      stateRef.current = { loading: true, hasMore: false, nextCursor: null, activeTroupeId: id };
      setActiveTroupeId(id);
      setLoading(true);
      setEvents([]);
      setError(null);
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({ limit: '10' });
        if (id) params.set('troupeId', id);
        const res = await fetch(`/api/events?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load events');
        const data = (await res.json()) as { events: FeedEvent[]; nextCursor: string | null };
        setEvents(data.events);
        stateRef.current.nextCursor = data.nextCursor;
        stateRef.current.hasMore = data.nextCursor !== null;
      } catch {
        setError('Failed to load events');
      } finally {
        stateRef.current.loading = false;
        setLoading(false);
      }
    },
    [user],
  );

  const fetchMore = useCallback(async () => {
    if (!user || stateRef.current.loading || !stateRef.current.hasMore || !stateRef.current.nextCursor) return;
    stateRef.current.loading = true;
    setLoadingMore(true);
    const { nextCursor, activeTroupeId: id } = stateRef.current;
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ limit: '10', cursor: nextCursor });
      if (id) params.set('troupeId', id);
      const res = await fetch(`/api/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load events');
      const data = (await res.json()) as { events: FeedEvent[]; nextCursor: string | null };
      setEvents((prev) => [...prev, ...data.events]);
      stateRef.current.nextCursor = data.nextCursor;
      stateRef.current.hasMore = data.nextCursor !== null;
    } catch {
      setError('Failed to load events');
    } finally {
      stateRef.current.loading = false;
      setLoadingMore(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && stateRef.current.hasMore && !stateRef.current.loading) {
          fetchMore();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchMore]);

  return { events, loading, loadingMore, error, activeTroupeId, sentinelRef, fetchFeed, fetchMore };
}
