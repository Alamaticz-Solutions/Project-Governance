import { describe, expect, it } from 'vitest';
import {
  hasAnyRole,
  hasRole,
  readSessionAuthContext,
  type GovernanceIdentity
} from './authContext';

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v)
  };
}

const identity = (roles: string[]): GovernanceIdentity => ({ roles });

describe('role helpers', () => {
  it('hasRole is case-insensitive', () => {
    expect(hasRole(identity(['epmo']), 'EPMO')).toBe(true);
    expect(hasRole(identity(['epmo']), 'finance')).toBe(false);
  });

  it('hasAnyRole matches any listed role', () => {
    expect(hasAnyRole(identity(['viewer']), ['admin', 'viewer'])).toBe(true);
    expect(hasAnyRole(identity(['viewer']), ['admin', 'epmo'])).toBe(false);
  });
});

describe('readSessionAuthContext', () => {
  it('is anonymous with no stored token', () => {
    const ctx = readSessionAuthContext(fakeStorage());
    expect(ctx.source).toBe('anonymous');
    expect(ctx.authorization).toBeUndefined();
    expect(ctx.roles).toEqual([]);
  });

  it('is a session when a token is stored, and normalizes roles', () => {
    const ctx = readSessionAuthContext(
      fakeStorage({
        'governance.frontend.authorization': 'tok',
        'governance.frontend.identity': JSON.stringify({
          userName: 'user@example.com',
          roles: ['EPMO', 'epmo', ' Finance ']
        })
      })
    );
    expect(ctx.source).toBe('session');
    expect(ctx.authorization).toBe('tok');
    expect(ctx.roles).toEqual(['epmo', 'finance']);
  });
});
