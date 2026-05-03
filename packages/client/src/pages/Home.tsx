import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
  const firstName = dbUser?.display_name?.split(' ')[0] ?? 'there';

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
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Your Troupes
          </h3>

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
          </div>
        </section>

        <div className="mt-4">
          <button className="w-full bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 transition-colors">
            + Create a Troupe
          </button>
        </div>
      </main>
    </div>
  );
}
