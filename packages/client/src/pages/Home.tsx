import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTroupes } from '../hooks/useTroupes';
import { useEventFeed, FeedEvent } from '../hooks/useEventFeed';
import { MAX_TROUPES_PER_USER } from '../lib/constants';
import { TroupeBadge } from '../components/TroupeBadge';
import { TroupeFilterChips } from '../components/TroupeFilterChips';
import { FeedEventCard } from '../components/FeedEventCard';
import { EventModal } from '../components/EventModal';
import { CreateTroupeModal } from '../components/CreateTroupeModal';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Home() {
  const navigate = useNavigate();
  const { dbUser, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFeedEvent, setSelectedFeedEvent] = useState<FeedEvent | null>(null);
  const { troupes, loading: troupesLoading, error: troupesError, fetchTroupes, createTroupe } = useTroupes();
  const {
    events,
    loading: eventsLoading,
    loadingMore,
    error: eventsError,
    activeTroupeId,
    sentinelRef,
    fetchFeed,
    updateEvent,
    deleteEvent,
  } = useEventFeed();
  const firstName = dbUser?.display_name?.split(' ')[0] ?? 'there';
  const atLimit = troupes.length >= MAX_TROUPES_PER_USER;

  useEffect(() => {
    fetchTroupes();
  }, [fetchTroupes]);

  const activeTroupe = troupes.find((t) => t.id === activeTroupeId);

  return (
    <div className="min-h-screen bg-gray-50">
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
      )}

      <header className="bg-white border-b border-gray-200 relative z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <span className="font-semibold text-gray-900">Troupes</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center"
              aria-label="Account menu"
            >
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <span className="text-violet-700 text-xs font-semibold">
                  {getInitials(dbUser?.display_name ?? null)}
                </span>
              </div>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[160px] z-30">
                <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100 truncate">
                  {dbUser?.display_name}
                </div>
                <button
                  onClick={signOut}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
        <h2 className="text-2xl font-bold text-gray-900">Hey, {firstName}!</h2>

        {/* Troupes section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Your Troupes ({troupes.length}/{MAX_TROUPES_PER_USER})
            </h3>
            {troupes.length > 0 && (
              atLimit ? (
                <span className="text-xs text-gray-400 font-medium">Troupe limit reached</span>
              ) : (
                <button
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
                >
                  + Create a Troupe
                </button>
              )
            )}
          </div>

          {troupesLoading ? (
            <div className="flex flex-wrap gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 w-16">
                  <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
                  <div className="w-12 h-3 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : troupesError ? (
            <div className="bg-white rounded-xl border border-red-100 p-4 text-sm text-red-600">
              {troupesError}
            </div>
          ) : troupes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-900 font-medium text-sm mb-1">No troupes yet</p>
              <p className="text-gray-500 text-sm leading-relaxed">
                You're not in any troupes yet —<br />
                create one or ask for an invite link.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 bg-violet-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                + Create a Troupe
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {troupes.map((troupe) => (
                <button
                  key={troupe.id}
                  onClick={() => navigate(`/troupes/${troupe.id}`)}
                  className="flex flex-col items-center gap-1.5 w-16"
                >
                  <TroupeBadge troupe={troupe} size="thumbnail" />
                  <span className="text-xs text-gray-600 font-medium truncate w-full text-center">
                    {troupe.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming events section */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">
              Upcoming Events
            </h3>
            {troupesLoading ? (
              <div className="flex gap-2 py-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
                ))}
              </div>
            ) : (
              <TroupeFilterChips
                troupes={troupes}
                activeTroupeId={activeTroupeId}
                onChange={fetchFeed}
              />
            )}
          </div>

          {eventsLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-4 h-28 animate-pulse"
                >
                  <div className="h-3 bg-gray-100 rounded w-1/3 mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : eventsError ? (
            <div className="bg-white rounded-xl border border-red-100 p-4 text-sm text-red-600">
              {eventsError}
            </div>
          ) : events.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">
                {activeTroupeId
                  ? `No upcoming events for ${activeTroupe?.name ?? 'this troupe'}`
                  : 'No upcoming events across your troupes'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((event) => (
                <FeedEventCard key={event.id} event={event} onClick={() => setSelectedFeedEvent(event)} />
              ))}
            </div>
          )}

          <div ref={sentinelRef} />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </section>
      </main>

      {selectedFeedEvent && (() => {
        const troupe = troupes.find((t) => t.id === selectedFeedEvent.troupe.id);
        const role = troupe?.role ?? 'member';
        return (
          <EventModal
            event={selectedFeedEvent}
            troupeId={selectedFeedEvent.troupe.id}
            currentUserRole={role}
            onClose={() => setSelectedFeedEvent(null)}
            onUpdated={(updated) => setSelectedFeedEvent({ ...updated, troupe: selectedFeedEvent.troupe })}
            onDeleted={() => setSelectedFeedEvent(null)}
            onUpdate={(eventId, data) => updateEvent(selectedFeedEvent.troupe.id, eventId, data).then((e) => ({ ...e, troupe: selectedFeedEvent.troupe }))}
            onDelete={(eventId) => deleteEvent(selectedFeedEvent.troupe.id, eventId)}
          />
        );
      })()}

      <CreateTroupeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchTroupes}
        onCreate={createTroupe}
      />
    </div>
  );
}
