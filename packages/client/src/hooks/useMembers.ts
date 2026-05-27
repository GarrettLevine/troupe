import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TroupeRole } from '../lib/constants';

export interface ManagedMember {
  userId: string;
  displayName: string;
  initials: string;
  role: TroupeRole;
  joinedAt: string;
}

interface TransferOwnershipResponse {
  previousOwner: { userId: string; displayName: string; role: 'organizer' };
  newOwner: { userId: string; displayName: string; role: 'owner' };
}

export function useMembers(onOwnershipTransferred?: () => void) {
  const { user } = useAuth();
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(
    async (troupeId: string) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/troupes/${troupeId}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? 'Failed to load members');
        }
        const data = (await res.json()) as { members: ManagedMember[]; totalCount: number };
        setMembers(data.members);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load members');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const changeRole = useCallback(
    async (troupeId: string, targetUserId: string, role: 'organizer' | 'member') => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      const snapshot = members.find((m) => m.userId === targetUserId);
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? { ...m, role } : m)),
      );

      try {
        const res = await fetch(`/api/troupes/${troupeId}/members/${targetUserId}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ role }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? 'Failed to change role');
        }
      } catch (err) {
        if (snapshot) {
          setMembers((prev) =>
            prev.map((m) => (m.userId === targetUserId ? snapshot : m)),
          );
        }
        throw err;
      }
    },
    [user, members],
  );

  const transferOwnership = useCallback(
    async (troupeId: string, targetUserId: string) => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      const res = await fetch(`/api/troupes/${troupeId}/members/${targetUserId}/transfer-ownership`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? 'Failed to transfer ownership');
      }
      const data = (await res.json()) as TransferOwnershipResponse;

      setMembers((prev) =>
        prev.map((m) => {
          if (m.userId === data.previousOwner.userId) return { ...m, role: 'organizer' };
          if (m.userId === data.newOwner.userId) return { ...m, role: 'owner' };
          return m;
        }),
      );

      if (onOwnershipTransferred) onOwnershipTransferred();

      return data;
    },
    [user, onOwnershipTransferred],
  );

  const removeMember = useCallback(
    async (troupeId: string, targetUserId: string) => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      const res = await fetch(`/api/troupes/${troupeId}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? 'Failed to remove member');
      }

      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
    },
    [user],
  );

  return { members, loading, error, fetchMembers, changeRole, transferOwnership, removeMember };
}
