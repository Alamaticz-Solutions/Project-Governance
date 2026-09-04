#!/usr/bin/env node
// Frontend PHI/PII source lint (M12). The rulebook (file 12 §5) expects a
// governance tool to guard against real patient / personal data being committed
// into frontend source or fixtures. There is no CI here, so this is run by hand:
//
//   node scripts/check-phi-lint.mjs [--json]
//
// It scans src/** (excluding src/generated/**) for string / template literals
// that LOOK like real PHI/PII values — not for field names, which are expected.
// Exit 1 on any finding.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(ROOT, 'src');
const SKIP_DIRS = new Set(['generated', 'node_modules']);
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css)$/;

// Each rule matches a *literal value*, with enough shape to be a real datum
// rather than a placeholder. Placeholders (example.com, 000-00-0000, John Doe,
// 555 numbers, all-zero / all-x) are allowed on purpose.
const RULES = [
  {
    id: 'us-ssn',
    label: 'US SSN-shaped literal',
    re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g
  },
  {
    id: 'mrn',
    label: 'possible medical record number (MRN: NNNNNNN)',
    re: /\bMRN[:#]?\s*\d{6,10}\b/gi
  },
  {
    id: 'dob',
    label: 'date-of-birth literal (DOB: …)',
    re: /\bDOB[:#]?\s*\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b/gi
  },
  {
    id: 'us-phone',
    label: 'US phone-number literal',
    re: /(?<!\d)(?!555)(\(\d{3}\)\s?|\d{3}[-.\s])\d{3}[-.\s]\d{4}(?!\d)/g
  },
  {
    id: 'real-email',
    label: 'e-mail literal that is not an example/test domain',
    re: /[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|net)|test\.|localhost|pdsconnect\.com|pds\.health)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
  },
  {
    id: 'credit-card',
    label: 'credit-card-shaped 13–16 digit run',
    re: /\b(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})\b/g
  }
];

// Value-level allow list: obvious fakes that can still match the shape rules.
const ALLOW = [
  /123-45-6789/,
  /987-65-4321/,
  /4111\s?1111\s?1111\s?1111/,
  /4242\s?4242\s?4242\s?4242/,
  /john\.doe@/i,
  /jane\.doe@/i
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (EXT.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const findings = [];
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        const value = m[0];
        if (ALLOW.some((a) => a.test(value))) continue;
        findings.push({
          rule: rule.id,
          label: rule.label,
          file: relative(ROOT, file),
          line: i + 1,
          match: value
        });
      }
    }
  });
}

const json = process.argv.includes('--json');
if (json) {
  process.stdout.write(
    JSON.stringify({ command: 'phi-lint', ok: findings.length === 0, findings }, null, 2) + '\n'
  );
} else if (findings.length === 0) {
  console.log('PHI/PII source lint: OK — no PHI/PII-shaped literals in src/** (excl. generated)');
} else {
  console.error(`PHI/PII source lint: ${findings.length} finding(s)`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.rule}] ${f.label} → ${f.match}`);
  }
}

process.exit(findings.length === 0 ? 0 : 1);
