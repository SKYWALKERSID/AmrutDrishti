export default function AdminPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Governance workspace
        </p>
        <h1 className="mt-2 text-2xl font-bold">Administration</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Administrative overview for the JalDrishti demonstration environment.
          Production identity management, server-enforced authorization and durable
          audit storage are not provided by this page.
        </p>
        <span className="mt-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          Prototype — administrative actions are not enabled
        </span>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Role selector</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            The navigation role selector provides demonstration context only.
            It is not authentication and does not enforce permissions.
          </p>
          <p className="mt-3 text-sm font-medium">Status: Client-side demonstration</p>
        </article>

        <article className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Audit records</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Connect a server-side audit service and persistent database before
            relying on administrative changes or review history.
          </p>
          <p className="mt-3 text-sm font-medium">Status: Persistence not verified</p>
        </article>

        <article className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Data ingestion</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Inspect the Data Sources registry for configured providers and their
            declared cadence, resolution and provenance notes.
          </p>
          <a href="/data-sources" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            Open Data Sources →
          </a>
        </article>

        <article className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Operational safeguards</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Risk scores and advisories remain decision-support indicators.
            Field verification and authorized human review are required before
            operational or financial decisions.
          </p>
        </article>
      </section>
    </div>
  );
}
