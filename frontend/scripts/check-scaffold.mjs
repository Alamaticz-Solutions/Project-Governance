import fs from 'node:fs';

const displayName = 'Project Governance';
const allowedProductIdentity = [
  'governance',
  'Project Governance',
  'governance',
  'Governance'
].map((value) => value.toLowerCase()).filter(Boolean);
const uniqueAllowedProductIdentity = [...new Set(allowedProductIdentity)];
const required = [
  '.appfw-ui/ownership.json',
  '.appfw-ui/scaffold-manifest.json',
  'src/generated/appfw-ui-contract.ts',
  'src/main.tsx',
  'src/styles.css',
  'vite.config.ts',
  'tsconfig.json'
];

const residueScanFiles = [
  'README.md',
  'package.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  '.appfw-ui/ownership.json',
  '.appfw-ui/scaffold-manifest.json',
  'src/generated/appfw-ui-contract.ts',
  'src/main.tsx',
  'src/styles.css'
];

const residueWords = new Set([
  'crm',
  'account',
  'accounts',
  'activity',
  'activities',
  'contact',
  'contacts',
  'lead',
  'leads',
  'opportunity',
  'opportunities',
  'pipeline',
  'pipelines',
  'quote',
  'quotes'
]);
const residuePhrases = ['customer relationship management'];
const ignoredTechnicalFragments = [
  'atlassian/pipelines/agent/build',
  'atlassian\\pipelines\\agent\\build'
];

function scaffoldUrl(relativePath) {
  return new URL(`../${relativePath}`, import.meta.url);
}

function normalizeResidueLine(line) {
  let normalized = line.toLowerCase();
  normalized = removePathLikeResidueFragments(normalized);
  for (const allowed of uniqueAllowedProductIdentity) {
    normalized = normalized.split(allowed).join(' ');
  }
  for (const fragment of ignoredTechnicalFragments) {
    normalized = normalized.split(fragment).join(' ');
  }
  return normalized;
}

function removePathLikeResidueFragments(line) {
  return line
    .split(/\s+/)
    .map((token) => {
      const trimmed = token.replace(/^[\\"'([{]+|[\\\\"')},;]+$/g, '');
      if (
        trimmed.includes('../') ||
        trimmed.includes('..\\\\') ||
        trimmed.startsWith('/') ||
        trimmed.includes('/private/') ||
        trimmed.includes('/users/') ||
        trimmed.includes('appfw_ui/pds_health') ||
        trimmed.includes('@appfw/pds-health-components')
      ) {
        return ' ';
      }
      return token;
    })
    .join(' ');
}

function residueMatches(relativePath, text) {
  const matches = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const normalized = normalizeResidueLine(line);
    const words = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));
    for (const term of residueWords) {
      if (words.has(term)) {
        matches.push({
          path: relativePath,
          line: index + 1,
          term,
          excerpt: line.trim().slice(0, 160)
        });
      }
    }
    for (const phrase of residuePhrases) {
      if (normalized.includes(phrase)) {
        matches.push({
          path: relativePath,
          line: index + 1,
          term: phrase,
          excerpt: line.trim().slice(0, 160)
        });
      }
    }
  });
  return matches;
}

const missing = required.filter((path) => !fs.existsSync(scaffoldUrl(path)));
// Checks that the product's own UI kit (src/ui/kit.tsx, no client-owned
// design-system dependency) is actually wired up, in place of the original
// app_gen-generated checks that asserted the vendor @appfw/pds-health-components
// package was wired up.
const pdsChecks = [
  {
    id: 'ui-kit-component-import',
    path: 'src/main.tsx',
    pattern: "from '@ui-kit'"
  },
  {
    id: 'ui-kit-command-palette',
    path: 'src/main.tsx',
    pattern: 'CommandPalette'
  },
  {
    id: 'ui-kit-app-shell',
    path: 'src/main.tsx',
    pattern: 'AppShell'
  },
  {
    id: 'ui-kit-overlay-example',
    path: 'src/main.tsx',
    pattern: 'Dialog'
  },
  {
    id: 'ui-kit-analytics-example',
    path: 'src/main.tsx',
    pattern: 'KpiTile'
  },
  {
    id: 'ui-kit-data-grid-example',
    path: 'src/main.tsx',
    pattern: 'DataGridShell'
  },
  {
    id: 'ui-kit-generated-form-example',
    path: 'src/main.tsx',
    pattern: 'FormLayout'
  },
  {
    id: 'ui-kit-style-import',
    path: 'src/styles.css',
    pattern: './ui/kit.css'
  },
  {
    id: 'ui-kit-tsconfig-alias',
    path: 'tsconfig.json',
    pattern: '@ui-kit'
  },
  {
    id: 'ui-kit-vite-alias',
    path: 'vite.config.ts',
    pattern: '@ui-kit'
  },
  {
    id: 'no-client-owned-design-system',
    path: '.appfw-ui/scaffold-manifest.json',
    pattern: 'self-owned'
  }
];
const missingPdsChecks = pdsChecks.filter((check) => {
  const url = scaffoldUrl(check.path);
  return !fs.existsSync(url) || !fs.readFileSync(url, 'utf8').includes(check.pattern);
});
const residue = [];
for (const relativePath of residueScanFiles) {
  const url = scaffoldUrl(relativePath);
  if (!fs.existsSync(url)) {
    continue;
  }
  residue.push(...residueMatches(relativePath, fs.readFileSync(url, 'utf8')));
}

const artifactUrl = new URL('../target/appfw/frontend-scaffold-check.json', import.meta.url);
fs.mkdirSync(new URL('../target/appfw/', import.meta.url), { recursive: true });

const report = {
  command: 'appfw:check',
  ok: missing.length === 0 && missingPdsChecks.length === 0 && residue.length === 0,
  generated_at_utc: new Date().toISOString(),
  display_name: displayName,
  required_files: required,
  missing_files: missing,
  design_system: {
    ok: missingPdsChecks.length === 0,
    checks: pdsChecks,
    missing: missingPdsChecks
  },
  residue_check: {
    ok: residue.length === 0,
    scan_files: residueScanFiles,
    terms: [...residueWords, ...residuePhrases],
    allowed_product_identity: uniqueAllowedProductIdentity,
    matches: residue
  },
  artifact: 'target/appfw/frontend-scaffold-check.json'
};

fs.writeFileSync(artifactUrl, `${JSON.stringify(report, null, 2)}\n`);

if (!report.ok) {
  if (missing.length > 0) {
    console.error(`Missing frontend scaffold files: ${missing.join(', ')}`);
  }
  if (residue.length > 0) {
    console.error(`Frontend scaffold contains sample residue; see ${artifactUrl.pathname}`);
  }
  if (missingPdsChecks.length > 0) {
    console.error(`Frontend scaffold is missing UI kit wiring; see ${artifactUrl.pathname}`);
  }
  process.exit(1);
}

console.log(`${displayName} frontend scaffold OK`);
console.log(`Evidence: ${artifactUrl.pathname}`);
