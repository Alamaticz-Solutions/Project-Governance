import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@ui-kit';
import { useApp } from '../../app/providers';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DirectoryUser = { id: string; name: string; email: string };
type SearchDirectoryResult = { configured: boolean; users: DirectoryUser[] };

/**
 * Attendee entry: chips + a typeahead. Ported from origin/Dev's
 * `AttendeePicker.tsx` (org directory via Graph `User.Read.All`) — searches
 * the real Microsoft 365 directory live via `User.searchDirectory`
 * (`services::directory`, `ReadOperation::SearchDirectoryUsers`), not this
 * app's own seeded `User` table, so results match the org's actual people
 * rather than whichever accounts happen to be seeded locally. Any other
 * address can still be free-added as an external attendee by typing it and
 * pressing Enter/comma.
 */
export function AttendeePicker({ value, onChange }: { value: string[]; onChange: (emails: string[]) => void }) {
  const { client } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const has = (email: string) => value.some((v) => v.toLowerCase() === email.trim().toLowerCase());

  const add = (email: string) => {
    const e = email.trim();
    if (!e || has(e)) return;
    onChange([...value, e]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };
  const remove = (email: string) => onChange(value.filter((v) => v !== email));

  // debounced live directory search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await client.invoke<SearchDirectoryResult>('searchDirectory', { query: q }, 'query');
        setConfigured(res.configured);
        setResults(res.users.filter((u) => !has(u.email)));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && query.trim()) {
      e.preventDefault();
      if (results[0] && !EMAIL_RE.test(query.trim())) add(results[0].email);
      else if (EMAIL_RE.test(query.trim())) add(query);
    } else if (e.key === 'Backspace' && !query && value.length) {
      remove(value[value.length - 1]);
    }
  }

  const rawIsEmail = EMAIL_RE.test(query.trim());

  return (
    <div ref={boxRef} style={{ position: 'relative', marginTop: 6 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          background: '#0f172a',
          padding: '8px 10px'
        }}
      >
        {value.map((email) => (
          <span
            key={email}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              borderRadius: 999,
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#e2e8f0'
            }}
          >
            {email}
            <button
              type="button"
              onClick={() => remove(email)}
              aria-label={`Remove ${email}`}
              style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', padding: 0 }}
            >
              <Icon name="close" size={13} />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder={value.length ? '' : 'Type a name to search, or an email address'}
          style={{ flex: 1, minWidth: '12ch', background: 'transparent', border: 'none', color: 'white', fontSize: 13, outline: 'none' }}
        />
      </div>

      {open && (results.length > 0 || loading || rawIsEmail) && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            marginTop: 4,
            width: '100%',
            overflow: 'hidden',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: '#1e293b',
            boxShadow: '0 12px 24px rgba(0,0,0,0.4)'
          }}
        >
          {loading && <div style={{ padding: '8px 12px', fontSize: 12, color: '#64748B' }}>Searching…</div>}
          {!loading && !configured && (
            <div style={{ padding: '8px 12px', fontSize: 11, color: '#94A3B8' }}>
              Directory search isn't configured — add an email address directly instead.
            </div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => add(u.email)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 13, color: 'white' }}>{u.name}</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{u.email}</span>
            </button>
          ))}
          {rawIsEmail && !has(query.trim()) && (
            <button
              type="button"
              onClick={() => add(query)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <Icon name="add" size={15} style={{ color: '#60A5FA' }} />
              <span style={{ fontSize: 13, color: '#e2e8f0' }}>
                Add external attendee <span style={{ color: '#94A3B8' }}>{query.trim()}</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
