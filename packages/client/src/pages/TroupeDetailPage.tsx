import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTroupeDetail } from '../hooks/useTroupeDetail';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/EventCard';
import { AddEventModal } from '../components/AddEventModal';
import { EditTroupeModal } from '../components/EditTroupeModal';
import { InviteShareModal } from '../components/InviteShareModal';
import { TroupeActionsMenu } from '../components/TroupeActionsMenu';
import { TroupeBadge } from '../components/TroupeBadge';
import { ROLE_STYLES } from '../lib/constants';

type TabType = 'upcoming' | 'past';

export function TroupeDetailPage() {
  const { troupeId } = useParams<{ troupeId: string }>();
  const navigate = useNavigate();
  const { detail, loading: detailLoading, error: detailError, fetchTroupeDetail, updateDetail, deleteTroupe } =
    useTroupeDetail();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { events, loading: eventsLoading, error: eventsError, sentinelRef, createEvent, resetAndRefetch } =
    useEvents(troupeId!, activeTab);

  useEffect(() => {
    if (troupeId) fetchTroupeDetail(troupeId);
  }, [troupeId, fetchTroupeDetail]);

  const canCreateEvents =
    detail?.currentUserRole === 'owner' || detail?.currentUserRole === 'organizer';
  const canManage =
    detail?.currentUserRole === 'owner' || detail?.currentUserRole === 'organizer';

  const handleDelete = async () => {
    if (!troupeId) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteTroupe(troupeId);
      navigate('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete troupe');
    } finally {
      setDeleting(false);
    }
  };

  const handleEventCreated = () => {
    if (activeTab === 'upcoming') {
      resetAndRefetch();
    } else {
      setActiveTab('upcoming');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            ← Back
          </button>
          <span className="font-semibold text-gray-900 truncate">
            {detailLoading ? '…' : (detail?.name ?? 'Troupe')}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Troupe header */}
        {!detailLoading && detail && (
          <section className="flex items-center gap-4">
            <TroupeBadge troupe={detail} size="large" />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 truncate">{detail.name}</h1>
            </div>
            {canManage && (
              <TroupeActionsMenu
                role={detail.currentUserRole}
                onInvite={() => setInviteOpen(true)}
                onEdit={() => setEditOpen(true)}
                onDelete={() => { setDeleteError(''); setDeleteConfirmOpen(true); }}
              />
            )}
          </section>
        )}

        {/* Members */}
        <section>
          {detailLoading ? (
            <div className="animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-7 bg-gray-200 rounded-full w-28" />
                ))}
              </div>
            </div>
          ) : detailError ? (
            <p className="text-sm text-red-600">{detailError}</p>
          ) : detail ? (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {detail.memberCount} {detail.memberCount === 1 ? 'member' : 'members'}
              </p>
              <div className="flex flex-wrap gap-2">
                {detail.members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1"
                  >
                    <span className="text-sm text-gray-900">{m.displayName}</span>
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${ROLE_STYLES[m.role]}`}
                    >
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        {/* Events */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {(['upcoming', 'past'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'upcoming' ? 'Upcoming' : 'Past'}
                </button>
              ))}
            </div>
            {canCreateEvents && (
              <button
                onClick={() => setAddEventOpen(true)}
                className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
              >
                + Add Event
              </button>
            )}
          </div>

          {eventsLoading && events.length === 0 ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-4 h-20 animate-pulse"
                >
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : eventsError ? (
            <div className="bg-white rounded-xl border border-red-100 p-4 text-sm text-red-600">
              {eventsError}
            </div>
          ) : events.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">No {activeTab} events</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

          <div ref={sentinelRef} />

          {eventsLoading && events.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </section>
      </main>

      {canCreateEvents && (
        <AddEventModal
          open={addEventOpen}
          onClose={() => setAddEventOpen(false)}
          onCreated={handleEventCreated}
          onCreate={createEvent}
        />
      )}

      {detail?.currentUserRole === 'owner' && (
        <EditTroupeModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          troupeId={troupeId!}
          currentName={detail.name}
          hasBadge={detail.hasBadge}
          updatedAt={detail.updatedAt}
          onNameUpdated={(name, updatedAt) => updateDetail({ name, updatedAt })}
          onBadgeUploaded={(updatedAt) => updateDetail({ hasBadge: true, updatedAt })}
        />
      )}

      {canManage && detail && (
        <InviteShareModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          troupeId={troupeId!}
          troupeName={detail.name}
        />
      )}

      {deleteConfirmOpen && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setDeleteConfirmOpen(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">Delete {detail.name}?</h2>
            <p className="text-sm text-gray-500">
              This will permanently delete the troupe, all its events, and remove all members. This cannot be undone.
            </p>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
