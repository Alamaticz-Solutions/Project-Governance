export const appUiContract = {
  appName: 'governance',
  displayName: 'Project Governance',
  schema: 'governance',
  schemaLabel: 'Governance',
  provider: 'PostgreSQL',
  modelStatus: 'intake'
} as const;

export type AppUiContract = typeof appUiContract;
