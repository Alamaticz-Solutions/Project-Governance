import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { authApi } from "../lib/api";
import { clearAuth, getStoredUser, storeAuth } from "../lib/authStorage";
import type { User, UserRole } from "../lib/types";

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
        const tokens = await authApi.login(email, password);
        storeAuth(tokens);
        setUser(tokens.user);
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
