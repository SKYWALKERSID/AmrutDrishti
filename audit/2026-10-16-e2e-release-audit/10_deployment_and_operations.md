# Deployment and operations

Local build viability is confirmed only. No CI workflow, deployed environment, health check, backup/restore exercise, monitoring/log sink, rollback test, rate-limit test, or refresh schedule was independently verified. `.env.local` has configuration names but the service-role credential fails read-only validation. Ingestion/training scripts were not run because they may write remotely.
