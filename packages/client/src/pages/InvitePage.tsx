import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInvite } from '../hooks/useInvite';
import { useAuth } from '../contexts/AuthContext';
import { TroupeBadge } from '../components/TroupeBadge';

function formatExpiry(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoDate));
}

export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, dbUser, loading: authLoading } = useAuth();
  const { invite, inviteError, inviteLoading, redeemLoading, redeemError, fetchInvite, redeemInvite } =
    useInvite();

  const isAuthenticated = !authLoading && user && dbUser?.display_name;

  useEffect(() => {
    if (code) fetchInvite(code);
  }, [code, fetchInvite]);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/invite/${code}`);
      return;
    }
    if (!code) return;
    const result = await redeemInvite(code);
    if (result) {
      navigate(`/troupes/${result.troupe.id}`);
    }
  };

  // Loading skeleton
  if (inviteLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-4 animate-pulse">
          <div className="w-32 h-32 rounded-full bg-gray-200" />
          <div className="h-5 bg-gray-200 rounded w-40" />
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-10 bg-gray-200 rounded-xl w-full mt-2" />
        </div>
      </div>
    );
  }

  // Invalid / expired invite
  if (inviteError) {
    const message =
      inviteError.type === 'not_found'
        ? 'This invite link is invalid.'
        : inviteError.type === 'gone'
          ? 'This invite link has expired or has already been used.'
          : 'Something went wrong loading this invite.';

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
            🚫
          </div>
          <p className="text-gray-900 font-medium">{message}</p>
          <Link
            to="/"
            className="mt-2 bg-violet-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Go to Troupes
          </Link>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  // Already-member or troupe-full states after redeem attempt
  if (redeemError?.type === 'already_member') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-4 text-center">
          <TroupeBadge troupe={invite.troupe} size="large" />
          <p className="text-gray-900 font-medium">You're already in this troupe</p>
          <Link
            to={`/troupes/${invite.troupe.id}`}
            className="mt-2 bg-violet-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            View Troupe
          </Link>
        </div>
      </div>
    );
  }

  if (redeemError?.type === 'troupe_full') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-4 text-center">
          <TroupeBadge troupe={invite.troupe} size="large" />
          <p className="text-gray-900 font-medium">This troupe is full</p>
          <Link
            to="/"
            className="mt-2 text-sm text-violet-600 hover:text-violet-700 transition-colors"
          >
            Go to Troupes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-4">
        <TroupeBadge troupe={invite.troupe} size="large" />

        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">{invite.troupe.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {invite.troupe.memberCount} {invite.troupe.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>

        <p className="text-xs text-gray-400 text-center">
          This invite expires on {formatExpiry(invite.expiresAt)}
        </p>

        {redeemError && redeemError.type === 'unknown' && (
          <p className="text-sm text-red-600 text-center">{redeemError.message}</p>
        )}

        <button
          onClick={handleJoin}
          disabled={redeemLoading}
          className="w-full bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
        >
          {redeemLoading ? 'Joining…' : `Join ${invite.troupe.name}`}
        </button>

        {!isAuthenticated && (
          <p className="text-xs text-gray-400 text-center">
            You'll be asked to sign in before joining
          </p>
        )}
      </div>
    </div>
  );
}
