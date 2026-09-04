import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  readSessionAuthContext,
  writeSessionAuthorization,
  writeSessionIdentity,
  type GovernanceAuthContext,
  type GovernanceIdentity
} from '../lib/authContext';
import {
  readSessionTenantContext,
  writeSessionTenantId,
  type GovernanceTenantContext
} from '../lib/tenantContext';
import { createAppfwClient, AppfwClientError, type AppfwClient } from '../lib/appfwClient';

type AppContextValue = {
  auth: GovernanceAuthContext;
  tenant: GovernanceTenantContext;
  client: AppfwClient;
  setAuthorization: (authorization: string | null) => void;
  setIdentity: (identity: GovernanceIdentity | null) => void;
  setTenantId: (tenantId: string | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<GovernanceAuthContext>(() => readSessionAuthContext());
  const [tenant, setTenant] = useState<GovernanceTenantContext>(() =>
    readSessionTenantContext()
  );

  const client = useMemo(
    () =>
      createAppfwClient({
        baseUrl: import.meta.env.VITE_BACKEND_URL || undefined,
        auth,
        tenant
      }),
    [auth, tenant]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      auth,
      tenant,
      client,
      setAuthorization: (authorization) => {
        writeSessionAuthorization(authorization);
        setAuth(readSessionAuthContext());
      },
      setIdentity: (identity) => {
        writeSessionIdentity(identity);
        setAuth(readSessionAuthContext());
      },
      setTenantId: (tenantId) => {
        writeSessionTenantId(tenantId);
        setTenant(readSessionTenantContext());
      }
    }),
    [auth, tenant, client]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within <AppProviders>');
  return value;
}

export function useAppfwClient(): AppfwClient {
  return useApp().client;
}

// --- data fetching --------------------------------------------------------

export type AsyncState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data?: T;
  error?: AppfwClientError;
  reload: () => void;
};

/**
 * Run an async loader whenever `deps` change. Errors are captured as
 * `AppfwClientError` so screens can branch on `error.details.category` and
 * fail closed. `client` is always in scope; pass it through `deps` if a screen
 * swaps it.
 */
export function useAsync<T>(
  loader: (client: AppfwClient) => Promise<T>,
  deps: readonly unknown[]
): AsyncState<T> {
  const client = useAppfwClient();
  const [state, setState] = useState<Omit<AsyncState<T>, 'reload'>>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loaderRef
      .current(client)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          error:
            error instanceof AppfwClientError
              ? error
              : new AppfwClientError({
                  message: error instanceof Error ? error.message : 'Unexpected error',
                  category: 'unknown'
                })
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/** Imperative action runner with pending / error state for mutations. */
export function useAction<TArgs extends unknown[], TResult>(
  action: (client: AppfwClient, ...args: TArgs) => Promise<TResult>
) {
  const client = useAppfwClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AppfwClientError | undefined>();

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setPending(true);
      setError(undefined);
      try {
        return await action(client, ...args);
      } catch (caught: unknown) {
        setError(
          caught instanceof AppfwClientError
            ? caught
            : new AppfwClientError({
                message: caught instanceof Error ? caught.message : 'Action failed',
                category: 'unknown'
              })
        );
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [client, action]
  );

  return { run, pending, error, clearError: () => setError(undefined) };
}
