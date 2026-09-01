import { Card, PageHeader, StateView } from "../../components/ui";

/** A handful of screens in the original app (Analytics, AI Risk, Knowledge
 * Base, Meeting Center) had no real backend behind them — they were static
 * mockups. Rather than invent backend logic that doesn't exist yet, they're
 * kept as lightweight placeholders here so the nav/routes are complete
 * without pretending these are functional. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card>
        <StateView label={description} />
      </Card>
    </div>
  );
}
