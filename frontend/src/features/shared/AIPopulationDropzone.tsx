import { useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@ui-kit';
import { useApp } from '../../app/providers';

/**
 * Drag/drop-or-click document upload that pre-fills a form via AI
 * extraction. Mounted at the top of the intake screen and every bespoke gate
 * form, wired to the `extractIntake` / `extractTeamFields` GraphQL mutations
 * (`services::ai_extraction`). Every call goes through a pre-egress PHI/PII
 * gate server-side before anything reaches OpenAI; a blocked document
 * surfaces as a warning here, not a generic error.
 */

export type ExtractionOutcome =
  | { success: true; data: Record<string, unknown> }
  | { success: false; blocked: boolean; reason: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the "data:<mime>;base64," prefix FileReader adds
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AIPopulationDropzone({
  team,
  projectId,
  onExtractionComplete
}: {
  /** Omit for intake (no project exists yet); pass a team key (`epmo`,
   * `bta`, `eac`, `finance`, `pic`) for a gate-form dropzone. */
  team?: 'epmo' | 'bta' | 'eac' | 'finance' | 'pic';
  projectId?: string;
  onExtractionComplete: (data: Record<string, unknown>) => void;
}) {
  const { client } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  async function runExtraction(payload: Record<string, unknown>) {
    setPending(true);
    setBlocked(null);
    setError(null);
    try {
      const result = (team
        ? await client.invoke('extractTeamFields', { projectId, team, payload })
        : await client.invoke('extractIntake', { payload })) as ExtractionOutcome;
      if (result.success) {
        const nonEmpty = Object.fromEntries(
          Object.entries(result.data).filter(([, v]) => v !== '' && v !== null && v !== undefined)
        );
        onExtractionComplete(nonEmpty);
      } else if (result.blocked) {
        setBlocked(result.reason);
      } else {
        setError(result.reason);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setPending(false);
    }
  }

  async function handleFile(file: File) {
    const isTxt = file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isTxt && !isPdf) {
      setError('Only .txt and .pdf are supported right now — use "Paste text instead" below, or upload one of those.');
      return;
    }
    const content_base64 = await fileToBase64(file);
    await runExtraction({ filename: file.name, mime_type: file.type || undefined, content_base64 });
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        disabled={pending}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          border: `2px dashed ${dragOver ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 16,
          padding: 20,
          background: dragOver ? 'rgba(79,70,229,0.08)' : 'rgba(15,23,42,0.3)',
          cursor: pending ? 'wait' : 'pointer',
          textAlign: 'left'
        }}
      >
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.1)',
            color: pending ? '#818CF8' : '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Icon name={pending ? 'hourglass_top' : 'cloud_upload'} size={24} />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>
            {pending ? 'Extracting…' : 'Upload a project document (optional)'}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: '#64748B', marginTop: 4 }}>
            AI pre-fill · PDF, TXT (DOCX not supported yet) — screened for PHI/PII before any AI call
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.pdf,text/plain,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => setPasteOpen((v) => !v)}
        style={{ marginTop: 8, background: 'transparent', border: 'none', color: '#818CF8', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        {pasteOpen ? 'Hide paste-text box' : 'Or paste text instead'}
      </button>
      {pasteOpen && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder="Paste project details here…"
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f8fafc',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              resize: 'vertical'
            }}
          />
          <button
            type="button"
            disabled={pending || !pasteText.trim()}
            onClick={() => void runExtraction({ text: pasteText })}
            style={{
              justifySelf: 'start',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              color: 'white',
              border: 'none',
              cursor: pending || !pasteText.trim() ? 'not-allowed' : 'pointer',
              opacity: pending || !pasteText.trim() ? 0.5 : 1,
              background: 'linear-gradient(135deg,#4F46E5,#7C3AED)'
            }}
          >
            {pending ? 'Extracting…' : 'Extract from text'}
          </button>
        </div>
      )}
      {blocked && (
        <div style={warningBox}>
          <Icon name="shield" size={16} style={{ color: '#FBBF24', flexShrink: 0, marginTop: 1 }} />
          <span>{blocked}</span>
        </div>
      )}
      {error && (
        <div style={{ ...warningBox, borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)' }}>
          <Icon name="error" size={16} style={{ color: '#F87171', flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

const warningBox: CSSProperties = {
  marginTop: 12,
  display: 'flex',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 10,
  fontSize: 12,
  color: '#e2e8f0',
  background: 'rgba(251,191,36,0.08)',
  border: '1px solid rgba(251,191,36,0.25)'
};
