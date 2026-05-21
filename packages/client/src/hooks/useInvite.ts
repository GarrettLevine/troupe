import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface InvitePreview {
  code: string;
  troupe: {
    id: string;
    name: string;
    memberCount: number;
    hasBadge: boolean;
  };
  expiresAt: string;
}

export interface InviteResponse {
  code: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface RedeemResult {
  troupe: {
    id: string;
    name: string;
    hasBadge: boolean;
    role: 'member';
    memberCount: number;
  };
}

type InviteError =
  | { type: 'not_found' }
  | { type: 'gone' }
  | { type: 'already_member' }
  | { type: 'troupe_full' }
  | { type: 'unknown'; message: string };

export function useInvite() {
  const { user } = useAuth();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState<InviteError | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<InviteError | null>(null);

  const fetchInvite = useCallback(async (code: string) => {
    setInviteLoading(true);
    setInviteError(null);
    setInvite(null);
    try {
      const res = await fetch(`/api/invites/${code}`);
      if (res.status === 404) {
        setInviteError({ type: 'not_found' });
        return;
      }
      if (res.status === 410) {
        setInviteError({ type: 'gone' });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setInviteError({ type: 'unknown', message: body.error?.message ?? 'Failed to load invite' });
        return;
      }
      const data = await res.json() as InvitePreview;
      setInvite(data);
    } catch {
      setInviteError({ type: 'unknown', message: 'Failed to load invite' });
    } finally {
      setInviteLoading(false);
    }
  }, []);

  const redeemInvite = useCallback(async (code: string): Promise<RedeemResult | null> => {
    if (!user) return null;
    setRedeemLoading(true);
    setRedeemError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/invites/${code}/redeem`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 409) {
        const body = await res.json() as { error?: { code?: string } };
        const code_ = body.error?.code;
        if (code_ === 'troupe_full') {
          setRedeemError({ type: 'troupe_full' });
        } else {
          setRedeemError({ type: 'already_member' });
        }
        return null;
      }
      if (res.status === 410) {
        setRedeemError({ type: 'gone' });
        return null;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setRedeemError({ type: 'unknown', message: body.error?.message ?? 'Failed to redeem invite' });
        return null;
      }
      return await res.json() as RedeemResult;
    } catch {
      setRedeemError({ type: 'unknown', message: 'Failed to redeem invite' });
      return null;
    } finally {
      setRedeemLoading(false);
    }
  }, [user]);

  return {
    invite,
    inviteError,
    inviteLoading,
    redeemLoading,
    redeemError,
    fetchInvite,
    redeemInvite,
  };
}
