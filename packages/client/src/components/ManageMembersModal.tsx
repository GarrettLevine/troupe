import { useEffect, useState, useRef } from 'react';
import { useMembers, ManagedMember } from '../hooks/useMembers';
import { ConfirmRemoveDialog } from './ConfirmRemoveDialog';
import { ConfirmTransferDialog } from './ConfirmTransferDialog';
import { hashColor, ROLE_STYLES } from '../lib/constants';
import { formatMonthYear } from '../lib/utils';

interface Props {
  troupeId: string;
  currentUserId: string;
  onClose: () => void;
  onOwnershipTransferred: () => void;
}

type ActionMenu = { userId: string; open: boolean };
type PendingRemove = ManagedMember | null;
type PendingTransfer = ManagedMember | null;

export function ManageMembersModal({ troupeId, currentUserId, onClose, onOwnershipTransferred }: Props) {
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<ActionMenu>({ userId: '', open: false });
  const [pendingRemove, setPendingRemove] = useState<PendingRemove>(null);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const transferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { members, loading, error, fetchMembers, changeRole, transferOwnership, removeMember } =
    useMembers();

  useEffect(() => {
    fetchMembers(troupeId);
  }, [troupeId, fetchMembers]);

  useEffect(() => {
    return () => {
      if (transferTimeoutRef.current) clearTimeout(transferTimeoutRef.current);
    };
  }, []);

  const handleChangeRole = async (member: ManagedMember, newRole: 'organizer' | 'member') => {
    setActionMenu({ userId: '', open: false });
    setActionError(null);
    setActionLoadingId(member.userId);
    try {
      await changeRole(troupeId, member.userId, newRole);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!pendingRemove) return;
    setRemoveLoading(true);
    try {
      await removeMember(troupeId, pendingRemove.userId);
      setPendingRemove(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
      setPendingRemove(null);
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleTransferConfirm = async () => {
    if (!pendingTransfer) return;
    setTransferLoading(true);
    try {
      await transferOwnership(troupeId, pendingTransfer.userId);
      setPendingTransfer(null);
      setSuccessBanner(`Ownership transferred to ${pendingTransfer.displayName}. You are now an organizer.`);
      transferTimeoutRef.current = setTimeout(() => {
        onOwnershipTransferred();
        onClose();
      }, 2000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to transfer ownership');
      setPendingTransfer(null);
    } finally {
      setTransferLoading(false);
    }
  };

  const owners = members.filter((m) => m.role === 'owner');
  const organizers = members.filter((m) => m.role === 'organizer');
  const regularMembers = members.filter((m) => m.role === 'member');

  const renderSkeletons = () =>
    [0, 1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
        <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="h-3.5 bg-gray-200 rounded w-32" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
      </div>
    ));

  const renderMemberRow = (member: ManagedMember) => {
    const isCurrentUser = member.userId === currentUserId;
    const isOwner = member.role === 'owner';
    const showMenu = !isCurrentUser && !isOwner;
    const isMenuOpen = actionMenu.open && actionMenu.userId === member.userId;
    const isActionLoading = actionLoadingId === member.userId;

    return (
      <div key={member.userId} className="flex items-center gap-3 py-3">
        <div
          className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold ${hashColor(member.userId)}`}
          title={member.displayName}
        >
          {member.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{member.displayName}</span>
            <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${ROLE_STYLES[member.role]}`}>
              {member.role}
            </span>
          </div>
          <p className="text-xs text-gray-400">Joined {formatMonthYear(member.joinedAt)}</p>
        </div>
        {showMenu && (
          <div className="relative shrink-0">
            <button
              onClick={() =>
                setActionMenu((prev) =>
                  prev.open && prev.userId === member.userId
                    ? { userId: '', open: false }
                    : { userId: member.userId, open: true },
                )
              }
              disabled={isActionLoading}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              aria-label="Member actions"
            >
              {isActionLoading ? (
                <span className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-lg leading-none">⋯</span>
              )}
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActionMenu({ userId: '', open: false })} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
                  {member.role === 'organizer' ? (
                    <button
                      onClick={() => handleChangeRole(member, 'member')}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Change to Member
                    </button>
                  ) : (
                    <button
                      onClick={() => handleChangeRole(member, 'organizer')}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Change to Organizer
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActionMenu({ userId: '', open: false });
                      setPendingRemove(member);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Remove from Troupe
                  </button>
                  <button
                    onClick={() => {
                      setActionMenu({ userId: '', open: false });
                      setPendingTransfer(member);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Transfer Ownership
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (title: string, group: ManagedMember[]) => {
    if (group.length === 0) return null;
    return (
      <div key={title}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-4 pb-1 sticky top-0 bg-white">
          {title} ({group.length})
        </p>
        <div className="divide-y divide-gray-100">
          {group.map(renderMemberRow)}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col shadow-xl max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Manage Members</h2>
              {!loading && (
                <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {successBanner && (
            <div className="mx-6 mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 shrink-0">
              {successBanner}
            </div>
          )}

          {actionError && (
            <div className="mx-6 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 shrink-0">
              {actionError}
            </div>
          )}

          {/* Scrollable member list */}
          <div className="overflow-y-auto px-6 pb-36 flex-1">
            {loading ? (
              renderSkeletons()
            ) : error ? (
              <p className="text-sm text-red-600 py-4">{error}</p>
            ) : (
              <>
                {renderGroup('Owner', owners)}
                {renderGroup('Organizers', organizers)}
                {renderGroup('Members', regularMembers)}
              </>
            )}
          </div>
        </div>
      </div>

      {pendingRemove && (
        <ConfirmRemoveDialog
          member={pendingRemove}
          onConfirm={handleRemoveConfirm}
          onCancel={() => setPendingRemove(null)}
          loading={removeLoading}
        />
      )}

      {pendingTransfer && (
        <ConfirmTransferDialog
          member={pendingTransfer}
          onConfirm={handleTransferConfirm}
          onCancel={() => setPendingTransfer(null)}
          loading={transferLoading}
        />
      )}
    </>
  );
}
