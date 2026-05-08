import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface TroupeMember {
  userId: string;
  displayName: string;
  role: 'owner' | 'organizer' | 'member';
}

export interface TroupeDetail {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  members: TroupeMember[];
  currentUserRole: 'owner' | 'organizer' | 'member';
}

export function useTroupeDetail() {
  const { user } = useAuth();
  const [detail, setDetail] = useState<TroupeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTroupeDetail = useCallback(
    async (troupeId: string) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/troupes/${troupeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 403) throw new Error('You are not a member of this troupe');
        if (res.status === 404) throw new Error('Troupe not found');
        if (!res.ok) throw new Error('Failed to load troupe');
        const data = (await res.json()) as TroupeDetail;
        setDetail(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load troupe');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { detail, loading, error, fetchTroupeDetail };
}
