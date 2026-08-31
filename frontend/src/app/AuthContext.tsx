import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { authApi } from "../lib/api";
import { clearAuth, getStoredUser, storeAuth } from "../lib/authStorage";
import type { User, UserRole } from "../lib/types";
import { auth } from "../lib/firebase";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login: async (email, password) => {
        // Temporarily use Firebase to authenticate
        await signInWithEmailAndPassword(auth, email, password);
        
        // MOCK BACKEND: Because the backend is currently down compiling, we bypass it.
        const mockTokens = {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          token_type: "bearer",
          user: {
            id: "1",
            email: email,
            username: "testuser",
            full_name: "Firebase User",
            role: "admin" as UserRole,
            is_active: true,
            is_verified: true,
            created_at: new Date().toISOString()
          }
        };
        storeAuth(mockTokens);
        setUser(mockTokens.user);
      },
      logout: () => {
        clearAuth();
        setUser(null);
      },
      hasRole: (roles) => (user ? roles.includes(user.role) : false),
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
