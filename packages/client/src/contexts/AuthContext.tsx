import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface DbUser {
  id: string;
  display_name: string | null;
  firebase_uid: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  user: User | null;
  dbUser: DbUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshDbUser: (displayName?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncUser(user: User, displayName?: string): Promise<DbUser> {
  const token = await user.getIdToken();
  const res = await fetch('/api/auth/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) throw new Error('Failed to sync user');
  return res.json() as Promise<DbUser>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const synced = await syncUser(firebaseUser);
          setDbUser(synced);
        } catch {
          setDbUser(null);
        }
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setDbUser(null);
  };

  const refreshDbUser = async (displayName?: string) => {
    if (!user) return;
    const synced = await syncUser(user, displayName);
    setDbUser(synced);
  };

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, signOut, refreshDbUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
