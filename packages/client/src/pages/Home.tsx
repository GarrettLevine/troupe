import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTroupes } from '../hooks/useTroupes';
import { MAX_TROUPES_PER_USER } from '../lib/constants';
import { TroupeCard } from '../components/TroupeCard';
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
  const { dbUser, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { troupes, loading, error, fetchTroupes, createTroupe } = useTroupes();
  const firstName = dbUser?.display_name?.split(' ')[0] ?? 'there';
  const atLimit = troupes.length >= MAX_TROUPES_PER_USER;

  useEffect(() => {
    fetchTroupes();
  }, [fetchTroupes]);

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
            <span className="font-semibold text-gray-900">Troupe</span>
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

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Hey, {firstName}!</h2>

        <section>
          <div className="flex items-center justify-between mb-3">
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

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-4 h-28 animate-pulse"
                >
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl border border-red-100 p-4 text-sm text-red-600">
              {error}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {troupes.map((troupe) => (
                <TroupeCard key={troupe.id} troupe={troupe} />
              ))}
            </div>
          )}
        </section>


      </main>

      <CreateTroupeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchTroupes}
        onCreate={createTroupe}
      />
    </div>
  );
}
