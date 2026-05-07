import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface TroupeSummary {
  id: string;
  name: string;
  role: 'owner' | 'organizer' | 'member';
  memberCount: number;
  createdAt: string;
}

export const MAX_TROUPES_PER_USER = 5;

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
      return res.json() as Promise<TroupeSummary>;
    },
    [user],
  );

  return { troupes, loading, error, fetchTroupes, createTroupe };
}
