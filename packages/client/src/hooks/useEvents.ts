import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface TroupeEvent {
  id: string;
  name: string;
  eventType: 'show' | 'rehearsal';
  eventAt: string;
  callTime: string | null;
  callTimeOffset: number | null;
  durationMinutes: number | null;
  durationFormatted: string | null;
  location: string;
  details: string | null;
  status: 'scheduled' | 'cancelled';
  createdBy: string;
}

export interface CreateEventData {
  name: string;
  eventType: 'show' | 'rehearsal';
  eventAt: string;
  callTimeOffset?: number | null;
  durationMinutes?: number | null;
  location: string;
  details?: string;
}

export interface UpdateEventData {
  name?: string;
  eventType?: 'show' | 'rehearsal';
  eventAt?: string;
  callTimeOffset?: number | null;
  durationMinutes?: number | null;
  location?: string;
  details?: string | null;
  status?: 'scheduled' | 'cancelled';
}

export function useEvents(troupeId: string, type: 'upcoming' | 'past') {
  const { user } = useAuth();
  const [events, setEvents] = useState<TroupeEvent[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({ loading: false, hasMore: true, nextCursor: null as string | null });

  const fetchPage = useCallback(
    async (cursor?: string, isReset = false) => {
      if (!user || stateRef.current.loading) return;
      stateRef.current.loading = true;
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({ type, limit: '10' });
        if (cursor) params.set('cursor', cursor);
        const res = await fetch(`/api/troupes/${troupeId}/events?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load events');
        const data = (await res.json()) as { events: TroupeEvent[]; nextCursor: string | null };
        if (isReset) {
          setEvents(data.events);
        } else {
          setEvents((prev) => [...prev, ...data.events]);
        }
        stateRef.current.nextCursor = data.nextCursor;
        const more = data.nextCursor !== null;
        setHasMore(more);
        stateRef.current.hasMore = more;
        if (isReset) setError(null);
      } catch {
        setError('Failed to load events');
      } finally {
        stateRef.current.loading = false;
        setLoading(false);
      }
    },
    [user, troupeId, type],
  );

  useEffect(() => {
    setEvents([]);
    setHasMore(true);
    setError(null);
    stateRef.current = { loading: false, hasMore: true, nextCursor: null };
    fetchPage(undefined, true);
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && stateRef.current.hasMore && !stateRef.current.loading) {
          fetchPage(stateRef.current.nextCursor ?? undefined);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage]);

  const createEvent = useCallback(
    async (data: CreateEventData): Promise<TroupeEvent> => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch(`/api/troupes/${troupeId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error: { message: string } };
        throw new Error(body.error?.message ?? 'Failed to create event');
      }
      return res.json() as Promise<TroupeEvent>;
    },
    [user, troupeId],
  );

  const updateEvent = useCallback(
    async (eventId: string, data: UpdateEventData): Promise<TroupeEvent> => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch(`/api/troupes/${troupeId}/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error: { message: string } };
        throw new Error(body.error?.message ?? 'Failed to update event');
      }
      const updated = (await res.json()) as TroupeEvent;
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
      return updated;
    },
    [user, troupeId],
  );

  const deleteEvent = useCallback(
    async (eventId: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch(`/api/troupes/${troupeId}/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error: { message: string } };
        throw new Error(body.error?.message ?? 'Failed to delete event');
      }
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    },
    [user, troupeId],
  );

  const resetAndRefetch = useCallback(() => {
    setEvents([]);
    setHasMore(true);
    setError(null);
    stateRef.current = { loading: false, hasMore: true, nextCursor: null };
    fetchPage(undefined, true);
  }, [fetchPage]);

  return { events, loading, error, hasMore, sentinelRef, createEvent, updateEvent, deleteEvent, resetAndRefetch };
}
