import { DATA_SOURCES } from "@/lib/data/dataSources";

export default function DataSourcesPage() {
  const healthy = DATA_SOURCES.filter((source) => source.status === "healthy").length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Data provenance &amp; limitations
        </p>
        <h1 className="mt-2 text-2xl font-bold">Data Sources &amp; Evidence Registry</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Review the declared providers, spatial resolution, observation cadence,
          provenance notes and limitations for JalDrishti's configured evidence sources.
        </p>
        <p className="mt-3 text-xs text-amber-700">
          Demonstration metadata: displayed status and ingestion timestamps are
          configured records, not proof of a live connection or successful real-time ingestion.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">Configured sources</p>
          <p className="mt-2 text-3xl font-bold">{DATA_SOURCES.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">Marked healthy in configuration</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{healthy}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">Live connectivity verified here</p>
          <p className="mt-2 text-3xl font-bold">Not verified</p>
        </div>
      </section>

      <section className="space-y-4">
        {DATA_SOURCES.map((source) => (
          <article key={source.id} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{source.name}</h2>
                <p className="mt-1 text-sm text-text-muted">{source.provider}</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                Configured status: {source.status}
              </span>
            </div>

            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-text-muted">Spatial resolution</dt>
                <dd className="mt-1 font-medium">{source.spatialResolution}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Temporal cadence</dt>
                <dd className="mt-1 font-medium">{source.temporalCadence}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Latest observation date (configured)</dt>
                <dd className="mt-1 font-medium">{source.latestObservationDate}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Last successful ingestion (configured)</dt>
                <dd className="mt-1 font-medium">{source.lastSuccessfulIngestion}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Missing data rate (configured)</dt>
                <dd className="mt-1 font-medium">{source.missingDataRatePct}%</dd>
              </div>
              <div>
                <dt className="text-text-muted">License / terms</dt>
                <dd className="mt-1 font-medium">{source.licenseTerms}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-md bg-subtle p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide">Provenance and limitations</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">{source.provenanceDetails}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
