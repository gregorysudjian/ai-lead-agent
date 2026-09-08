import { LeadsBrowser } from "@/components/leads-browser";
import { ErrorPanel, PageHeader } from "@/components/ui/primitives";
import { loadLeads } from "@/server/leads-page-data";
import { requireSession } from "@/server/auth";

/** Full lead browsing. Server Component; filtering happens client-side. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  // The authorization boundary for this page. Proxy already redirected a
  // visitor with no cookie; this is the check that actually verifies one.
  await requireSession();
  const { leads, loadFailed } = await loadLeads("leads");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle={
          loadFailed
            ? "Stored leads could not be loaded."
            : `${leads.length} stored ${leads.length === 1 ? "lead" : "leads"}, ranked by lead priority.`
        }
      />

      {loadFailed ? (
        <ErrorPanel
          title="Could not load stored leads."
          detail="The lead store did not respond. Check the server logs for details."
        />
      ) : (
        <LeadsBrowser leads={leads} />
      )}
    </div>
  );
}
