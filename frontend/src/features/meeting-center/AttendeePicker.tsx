import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { teamsPocApi, type DirectoryUser } from "../../lib/teamsPocApi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  value: string[];
  onChange: (emails: string[]) => void;
}

/**
 * Attendee entry: chips + a typeahead. Internal names resolve against the org
 * directory (Graph `User.Read.All`); any other address can be free-added as an
 * external attendee by typing it and pressing Enter.
 */
export function AttendeePicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const has = (email: string) =>
    value.some((v) => v.toLowerCase() === email.trim().toLowerCase());

  const add = (email: string) => {
    const e = email.trim();
    if (!e || has(e)) return;
    onChange([...value, e]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const remove = (email: string) => onChange(value.filter((v) => v !== email));

  // debounced directory search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await teamsPocApi.searchDirectory(q);
        setResults(users.filter((u) => !has(u.email)));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // close dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && query.trim()) {
      e.preventDefault();
      if (results[0] && !EMAIL_RE.test(query.trim())) add(results[0].email);
      else if (EMAIL_RE.test(query.trim())) add(query);
    } else if (e.key === "Backspace" && !query && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const rawIsEmail = EMAIL_RE.test(query.trim());

  return (
    <div ref={boxRef} className="relative mt-1">
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-2 py-2">
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-full bg-slate-800 border border-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-200"
          >
            {email}
            <button
              type="button"
              onClick={() => remove(email)}
              className="text-slate-500 hover:text-rose-400"
              aria-label={`Remove ${email}`}
            >
              <span className="material-icons text-[13px] leading-none">close</span>
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder={value.length ? "" : "Type a name to search, or an email address"}
          className="flex-1 min-w-[12ch] bg-transparent text-sm text-white outline-none"
        />
      </div>

      {open && (results.length > 0 || loading || rawIsEmail) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-800 shadow-xl">
          {loading && <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => add(u.email)}
              className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-slate-700/60"
            >
              <span className="text-sm text-white">{u.name}</span>
              <span className="text-[11px] text-slate-400">{u.email}</span>
            </button>
          ))}
          {rawIsEmail && !has(query.trim()) && (
            <button
              type="button"
              onClick={() => add(query)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-700/60"
            >
              <span className="material-icons text-[15px] text-blue-400">add</span>
              <span className="text-sm text-slate-200">
                Add external attendee <span className="text-slate-400">{query.trim()}</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
