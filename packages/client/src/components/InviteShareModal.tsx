import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  troupeId: string;
  troupeName: string;
}

interface InviteData {
  code: string;
  inviteUrl: string;
  expiresAt: string;
}

function formatExpiry(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoDate));
}

export function InviteShareModal({ open, onClose, troupeId, troupeName }: Props) {
  const { user } = useAuth();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showNewLinkWarning, setShowNewLinkWarning] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInvite = async (force = false) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const url = `/api/troupes/${troupeId}/invites${force ? '?force=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Failed to generate invite link');
        return;
      }
      const data = await res.json() as InviteData;
      setInvite(data);
      setShowNewLinkWarning(false);
    } catch {
      setError('Failed to generate invite link');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setInvite(null);
      setError('');
      setShowNewLinkWarning(false);
      fetchInvite();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!invite) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${troupeName} on Troupes`, url: invite.inviteUrl });
      } else {
        await navigator.clipboard.writeText(invite.inviteUrl);
        setCopied(true);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled share or clipboard failed — silently ignore
    }
  };

  const handleGenerateNew = () => {
    if (!showNewLinkWarning) {
      setShowNewLinkWarning(true);
      return;
    }
    fetchInvite(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Invite Members</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-10 bg-gray-100 rounded-lg" />
            <div className="h-4 bg-gray-100 rounded w-48" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : invite ? (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={invite.inviteUrl}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50 focus:outline-none truncate"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <p className="text-xs text-gray-400">
              This link expires on {formatExpiry(invite.expiresAt)}
            </p>

            {showNewLinkWarning ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-amber-600 font-medium">
                  This will invalidate the current link. Continue?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchInvite(true)}
                    disabled={loading}
                    className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {loading ? 'Generating…' : 'Yes, generate new link'}
                  </button>
                  <button
                    onClick={() => setShowNewLinkWarning(false)}
                    className="flex-1 bg-gray-100 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateNew}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors self-start"
              >
                Generate new link
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
