// Shared display helpers for Project rows — kept in one place so the "My Requests"
// list and the Executive Dashboard compute progress/budget identically instead of
// drifting into two slightly different formulas.

const STAGE_ORDER: { [key: string]: number } = {
  'EPMO Review': 1,
  'BTA Review': 2,
  'Finance Review': 3,
  'Prepare for EAC': 4,
  'EAC Committee Review': 5,
  'EAC Review': 5,
  'EAC Meeting': 5,
  'Prepare for PIC': 6,
  'PIC Meeting': 7,
  'TRC Vetting & Gate Review': 8,
};
const TOTAL_STAGES = 8;

/** Stage-based progress proxy (0-100). There is no real SLA/duration tracking in
 *  the data model, so this reflects "how far through the governance pipeline",
 *  not a time-based risk score. */
export function calculateProjectProgress(currentStage: string | undefined, status: string | undefined): number {
  const isDone = ['completed', 'in_delivery'].includes((status || '').toLowerCase());
  if (isDone) return 100;
  const order = STAGE_ORDER[currentStage || 'EPMO Review'] || 1;
  return Math.round((order / TOTAL_STAGES) * 100);
}

export function formatBudget(amount: number | null | undefined): string {
  if (!amount) return 'N/A';
  return amount >= 1000000
    ? `$${(amount / 1000000).toFixed(1)}M`
    : `$${Math.round(amount / 1000)}K`;
}
