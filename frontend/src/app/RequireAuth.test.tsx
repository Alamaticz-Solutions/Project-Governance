import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AppProviders } from './providers';
import { RequireAuth } from './RequireAuth';
import { AUTH_STORAGE_KEY, IDENTITY_STORAGE_KEY } from '../lib/authContext';

function mount(initialPath: string, guard: ReactNode) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/sign-in" element={<div>sign in page</div>} />
          <Route path="/protected" element={guard} />
        </Routes>
      </MemoryRouter>
    </AppProviders>
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('redirects an unauthenticated visitor to /sign-in', () => {
    mount('/protected', <RequireAuth>secret</RequireAuth>);
    expect(screen.getByText('sign in page')).toBeInTheDocument();
  });

  it('renders a denied state when the session lacks the required role', () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, 'tok');
    window.sessionStorage.setItem(
      IDENTITY_STORAGE_KEY,
      JSON.stringify({ userName: 'viewer@example.com', roles: ['viewer'] })
    );
    mount(
      '/protected',
      <RequireAuth roles={['admin', 'epmo']}>secret</RequireAuth>
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(
      screen.getByText(/don't have access to this screen/i)
    ).toBeInTheDocument();
  });

  it('renders children when the session has a required role', () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, 'tok');
    window.sessionStorage.setItem(
      IDENTITY_STORAGE_KEY,
      JSON.stringify({ userName: 'epmo@example.com', roles: ['epmo'] })
    );
    mount(
      '/protected',
      <RequireAuth roles={['admin', 'epmo']}>secret</RequireAuth>
    );
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
