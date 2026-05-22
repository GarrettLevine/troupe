import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type AttendanceStatus = 'attending' | 'not_attending' | 'maybe' | 'late';

export interface AttendeeChip {
  userId: string;
  displayName: string;
  initials: string;
}

export interface AttendanceSummary {
  attending: AttendeeChip[];
  notAttending: AttendeeChip[];
  maybe: AttendeeChip[];
  late: AttendeeChip[];
  noResponse: AttendeeChip[];
  counts: {
    attending: number;
    notAttending: number;
    maybe: number;
    late: number;
    noResponse: number;
    total: number;
  };
}

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
  attendance: AttendanceSummary;
  currentUserAttendance: AttendanceStatus | null;
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

  const updateAttendance = useCallback(
    async (eventId: string, status: AttendanceStatus | null): Promise<TroupeEvent> => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      let snapshot: TroupeEvent | undefined;
      setEvents((prev) => {
        snapshot = prev.find((e) => e.id === eventId);
        if (!snapshot) return prev;
        return prev.map((e) => (e.id === eventId ? { ...e, currentUserAttendance: status } : e));
      });

      if (!snapshot) throw new Error('Event not found');
      const saved = snapshot;

      try {
        const res = await fetch(`/api/troupes/${troupeId}/events/${eventId}/attendance`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error: { message: string } };
          throw new Error(body.error?.message ?? 'Failed to update attendance');
        }
        const { attendance, currentUserAttendance } = (await res.json()) as {
          attendance: AttendanceSummary;
          currentUserAttendance: AttendanceStatus | null;
        };
        const updated: TroupeEvent = { ...saved, attendance, currentUserAttendance };
        setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
        return updated;
      } catch (err) {
        setEvents((prev) => prev.map((e) => (e.id === eventId ? saved : e)));
        throw err;
      }
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

  return { events, loading, error, hasMore, sentinelRef, createEvent, updateEvent, deleteEvent, updateAttendance, resetAndRefetch };
}
