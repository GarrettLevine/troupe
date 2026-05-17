import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface TroupeBadges {
  thumbnail: string;
  standard: string;
  large: string;
}

export interface TroupeSummary {
  id: string;
  name: string;
  role: 'owner' | 'organizer' | 'member';
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  hasBadge: boolean;
  badges: TroupeBadges | null;
}

export function useTroupes() {
  const { user } = useAuth();
  const [troupes, setTroupes] = useState<TroupeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTroupes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/troupes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load troupes');
      const data = (await res.json()) as { troupes: TroupeSummary[] };
      setTroupes(data.troupes);
    } catch {
      setError('Failed to load troupes');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTroupe = useCallback(
    async (name: string): Promise<TroupeSummary> => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch('/api/troupes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: { message: string } };
        throw new Error(data.error?.message ?? 'Failed to create troupe');
      }
      const created = (await res.json()) as TroupeSummary;
      setTroupes((prev) => [created, ...prev]);
      return created;
    },
    [user],
  );

  const updateTroupeName = useCallback(
    async (troupeId: string, name: string): Promise<TroupeSummary> => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch(`/api/troupes/${troupeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: { message: string } };
        throw new Error(data.error?.message ?? 'Failed to update troupe');
      }
      const updated = (await res.json()) as TroupeSummary;
      setTroupes((prev) => prev.map((t) => (t.id === troupeId ? updated : t)));
      return updated;
    },
    [user],
  );

  const uploadTroupeBadge = useCallback(
    async (troupeId: string, file: File): Promise<{ id: string; name: string; hasBadge: boolean; updatedAt: string; badges: TroupeBadges }> => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/troupes/${troupeId}/badge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: { message: string } };
        throw new Error(data.error?.message ?? 'Failed to upload badge');
      }
      const data = (await res.json()) as { id: string; name: string; hasBadge: boolean; updatedAt: string; badges: TroupeBadges };
      setTroupes((prev) =>
        prev.map((t) => (t.id === troupeId ? { ...t, hasBadge: data.hasBadge, updatedAt: data.updatedAt, badges: data.badges } : t)),
      );
      return data;
    },
    [user],
  );

  return { troupes, loading, error, fetchTroupes, createTroupe, updateTroupeName, uploadTroupeBadge };
}
