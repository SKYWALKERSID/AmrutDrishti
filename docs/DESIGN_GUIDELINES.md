# MASTER VIBE-CODING PROMPT
## JalDrishti: Satellite-Assisted Groundwater Intelligence and Governance Platform

Act as a senior full-stack engineer, geospatial data engineer, applied machine-learning engineer, product designer, and technical architect.

Your task is to build **JalDrishti**, a polished, technically credible, satellite-assisted groundwater intelligence and decision-support platform for water-stressed regions of India.

Do not merely create a landing page or a dashboard filled with decorative charts. Build a functional, extensible product that integrates environmental evidence, communicates uncertainty, supports groundwater-risk monitoring, and helps authorized users evaluate potential interventions.

Treat the existing Product Requirements Document (PRD), Technical Requirements Document (TRD), project repository, and supplied source files as the primary project context. Inspect all relevant materials before making architectural decisions. If an existing implementation conflicts with this brief, identify the conflict and preserve working features unless a justified change is necessary.

# SOURCE OF TRUTH AND PROJECT GOVERNANCE

## 1. Authoritative Project Documents

The following three documents are the official sources of truth for JalDrishti. Locate and read their complete contents before making implementation decisions.

**Priority 1: Product Requirements Document (PRD)**

File: `JalDrishti_Exhaustive_PRD_v1.0.docx`

Purpose:
- Defines the product vision, objectives, scope, users, user journeys, and functional requirements.
- Establishes product boundaries, acceptance criteria, priorities, non-functional requirements, and expected outcomes.
- Defines what JalDrishti must accomplish and what is outside its intended scope.

**Priority 2: Technical Requirements Document (TRD)**

File: `JalDrishti_Exhaustive_TRD_v1.0.docx`

Purpose:
- Defines the proposed technical architecture, technology choices, data models, processing pipelines, APIs, security requirements, testing strategy, deployment approach, and operational safeguards.
- Establishes technical constraints, integration requirements, model-validation requirements, and implementation guidance.
- Defines how JalDrishti should be engineered and operated.

**Priority 3: Project Summary**

File: `JalDrishti_Project_Summary.md` or the latest approved JalDrishti project-summary document.

Purpose:
- Provides the consolidated project vision, problem statement, proposed solution, earlier research and existing systems, candidate research gaps, intended differentiation, expected impact, and implementation priorities.
- Explains the broader context in which the product and technical requirements should be interpreted.
- Helps preserve consistency across the user interface, documentation, research narrative, and implementation.

If the filenames differ in the repository, locate the corresponding approved documents by their contents. Do not assume a file exists merely because its expected filename is listed here.

## 2. Order of Authority

Use the following rules when interpreting project information:

1. **PRD governs product requirements.** Do not independently change the intended users, scope, workflows, priorities, or acceptance criteria.
2. **TRD governs technical requirements.** Follow its architecture, data contracts, security constraints, validation gates, and technical decisions unless an approved change is necessary.
3. **Project Summary governs the consolidated narrative.** Use it to understand the project's purpose, research background, candidate research gaps, and intended contribution.
4. **Existing repository governs implementation reality.** Inspect the actual code before assuming that a feature, integration, database table, or service has been implemented.
5. **This master prompt governs visual design and coding workflow.** Apply its design constraints and implementation practices wherever they are compatible with the approved project documents.

The documents have different responsibilities. Do not treat the Project Summary as a replacement for detailed requirements in the PRD or TRD.

If the documents conflict, identify the exact conflict and its consequences. Do not silently choose whichever interpretation is easiest to code. Record the conflict, explain the recommended resolution, and seek approval when it materially changes product scope, architecture, scientific methodology, security, or acceptance criteria.

Minor implementation decisions that do not alter approved requirements may be made using sound engineering judgment. Document consequential decisions.

## 3. Source-First Development Protocol

Before implementing a feature:

1. Locate its relevant PRD requirement and acceptance criteria.
2. Locate the corresponding TRD architecture, data contract, or technical constraint.
3. Review the Project Summary for relevant research context, existing systems, and intended differentiation.
4. Inspect the repository for existing implementations, reusable components, tests, and dependencies.
5. Map the proposed change to the relevant requirement and existing code.
6. Implement the smallest maintainable change that satisfies the requirement.
7. Test the behavior against the documented acceptance criteria.
8. Update implementation documentation when actual behavior, architecture, or integration status changes.

Maintain traceability between requirements and implementation. Where practical, use identifiers such as `FR-001`, `NFR-001`, or the actual requirement IDs present in the PRD and TRD. Never invent requirement IDs when the documents already define them.

For every substantial feature, be able to explain:
- Why the feature exists.
- Which approved requirement it satisfies.
- How it is implemented.
- What data it depends on.
- How it is tested.
- What limitations remain.

## 4. Missing or Inaccessible Documents

If any authoritative document cannot be located or read:

- Do not pretend to have reviewed it.
- Continue inspecting the available repository and documents.
- Identify which source is missing.
- Avoid making irreversible architectural or product decisions that depend on the missing information.
- Use clearly labelled provisional assumptions only where progress is safe.
- Request the missing document or clarification when it materially affects implementation.

Do not replace missing project-specific requirements with generic product assumptions.

## 5. Change-Control Rules

The PRD and TRD may evolve as JalDrishti develops, but changes must remain explicit and traceable.

When a new feature, technical limitation, research finding, or stakeholder requirement suggests changing an approved decision:

1. Identify the existing requirement or design decision.
2. Explain the reason for the proposed change.
3. Describe the impact on scope, architecture, data, security, scientific validity, testing, and implementation effort.
4. Recommend the smallest justified change.
5. Record the decision and update the affected documentation after approval.

Do not modify the PRD or TRD automatically merely to make an implementation appear compliant.

Do not remove safeguards, validation requirements, or limitations because they make the product more difficult to build.

## 6. Scientific and Research Authority

For groundwater science, environmental indicators, predictive models, and research claims:

- Treat the PRD and TRD as the approved product and engineering requirements, not as proof that a scientific assumption is valid.
- Treat the Project Summary's research gaps and proposed differentiators as hypotheses to investigate until supported by adequate evidence.
- Preserve distinctions between observed measurements, satellite-derived products, calculated indicators, simulated demonstration data, and model predictions.
- Do not claim novelty, accuracy, real-time monitoring, operational readiness, or research validation without supporting evidence.
- Verify relevant scientific methods and source documentation before implementing consequential calculations.
- Record unresolved scientific questions instead of silently inventing formulas, weights, coefficients, thresholds, or model outputs.
- Do not introduce an authoritative Groundwater Stress Score or days-to-crisis prediction unless its required validation gates have been satisfied.

Scientific evidence may justify proposing a change to a project requirement, but it does not authorize silently changing the approved product scope.

## 7. Implementation Traceability Report

At the end of each significant development milestone, report:

- **PRD alignment:** Requirements implemented, partially implemented, or not implemented.
- **TRD alignment:** Technical decisions followed, adapted, or blocked.
- **Summary alignment:** Whether the implementation preserves the stated project objectives and research positioning.
- **Repository status:** Existing features preserved, modified, or removed, with reasons.
- **Data status:** Real integrations, pending integrations, simulated sources, and access restrictions.
- **Validation status:** Tests actually run, results obtained, and checks still outstanding.
- **Deviations:** Every material departure from an approved document and its justification.
- **Documentation updates:** Files that need to be updated to reflect the actual implementation.

Keep this report concise, factual, and linked to actual code or test results wherever possible.

## Final Authority Rule

**The approved PRD defines what to build. The approved TRD defines the technical constraints for building it. The Project Summary explains why it matters and how it should be positioned. The repository shows what actually exists. This master prompt governs how the coding agent works and how the interface should look.**

Read the sources first, preserve their intent, and make all material deviations explicit.
---

# 1. PRODUCT DEFINITION

**Product name:** JalDrishti

**Category:** Geospatial intelligence, groundwater monitoring, environmental risk analytics, and governance decision support.

**Proposed pilot geography:** Bundelkhand, Madhya Pradesh, India.

**Primary users:**
- District and block-level administrators.
- Groundwater and water-resource officials.
- Environmental analysts and researchers.
- Rural development and water-conservation planners.
- Authorized field personnel and programme coordinators.

**Core problem:**

Groundwater observations, rainfall records, satellite-derived environmental indicators, agricultural conditions, and government intervention information are distributed across different sources. Decision-makers need a more coherent way to examine environmental trends, identify potential areas of concern, assess evidence quality, and prioritize further investigation or intervention.

**Product objective:**

Create a transparent geospatial decision-support system that connects:

Environmental data → Quality-controlled indicators → Groundwater-stress assessment → Evidence-backed prioritization → Human-reviewed action → Outcome monitoring.

**Primary user action:**

Identify an area of concern, inspect the supporting evidence, understand the limitations, and create a reviewable assessment or intervention recommendation.

**Core product principle:**

Every important assessment must explain what data supports it, when that data was updated, how the result was produced, and what uncertainty remains.

Do not claim that JalDrishti has already prevented drought, saved water, improved agricultural yields, or outperformed existing systems. Such claims require measured evidence.

---

# 2. MANDATORY FIRST STEP: INSPECT THE EXISTING PROJECT

Before writing or modifying code:

1. Inspect the repository structure, package manifests, lockfiles, environment configuration, source code, database migrations, API routes, existing components, tests, documentation, and available assets.
2. Identify the existing framework, language, routing system, design system, authentication mechanism, data model, and deployment configuration.
3. Read the available JalDrishti PRD and TRD if present in the repository or supplied workspace.
4. Identify implemented features, incomplete features, broken features, duplicated code, security risks, mock data, and architectural inconsistencies.
5. Run the existing application using the documented commands when the environment permits.
6. Record a concise baseline assessment before making changes.
7. Preserve working functionality and existing user data.
8. Do not replace the application with a new scaffold merely because it is easier.
9. Do not overwrite environment files, remove migrations, reset databases, or perform destructive cleanup without an explicit justification and safe migration strategy.
10. If a required credential, data source, or service is unavailable, implement an honest development fallback and document the limitation.

Produce a short implementation plan containing:
- Existing architecture.
- Current working functionality.
- Critical defects and risks.
- Proposed changes.
- Data-source feasibility.
- First milestone and acceptance criteria.

Then begin implementation. Do not stop after writing a plan.

---

# 3. DESIGN DIRECTION: REFINED, RESTRAINED, DISTINCTIVE

Act as a senior web designer and frontend engineer. Create a clean, polished interface with the restraint, typography, hierarchy, and product focus associated with Apple's marketing pages, while establishing a distinct visual identity for JalDrishti.

The product should feel like a serious geospatial intelligence platform designed for professional use in India.

## 3.1 Visual identity

Use:
- A warm off-white or neutral background rather than pure white.
- Dark, readable text.
- One restrained primary accent inspired by water, terrain, or environmental monitoring.
- A small, consistent set of design tokens for color, spacing, typography, borders, and radii.
- Strong typography and carefully controlled information density.
- Generous space around major headings and important information.
- Fine dividers, restrained borders, and selective use of surface contrast.
- Clear geographic hierarchy, meaningful legends, and readable map overlays.
- Consistent alignment and deliberate composition.
- A readable system font stack or a suitable licensed alternative.

The brand should have its own visual character. Do not imitate Apple's exact branding, layouts, proprietary assets, or wordmark.

## 3.2 Strictly prohibited UI patterns

Treat every exclusion below as a hard design constraint.

1. No harsh gradients.
2. No rainbow-colored interfaces.
3. No neon colors.
4. No generic pastel-heavy styling.
5. No purple-and-black theme.
6. No pure-white page background.
7. No radial decorative orbs.
8. No decorative dot grids.
9. No liquid-glass effects.
10. No decorative colored stripes.
11. No sparkle icons.
12. No emojis used as interface icons.
13. No animated arrows for decoration.
14. No shadows on every component.
15. No soft, excessively rounded corners throughout the interface.
16. No Inter font.
17. No Geist font.
18. No Space Grotesk font.
19. No Lucide icon library.
20. No decorative terminal windows.
21. No default three-feature-card layouts.
22. No default bento-grid layouts.
23. No decorative checkmark bullets.
24. No three-tier pricing section.
25. No invented testimonials.
26. No fabricated customer logos.
27. No fabricated statistics or impact claims.
28. No unsupported product screenshots or simulated imagery presented as real.
29. No unnecessary hover animations or animated elements everywhere.
30. No artificial loading delays, distracting motion, or forced scrolling behavior.

Do not recreate these patterns under different names. If a prohibited element seems visually convenient, choose a more restrained alternative.

Use icons only when they communicate a meaningful action or status. Prefer a suitable non-Lucide icon set already installed, simple CSS-drawn indicators, or a small set of accessible inline SVG icons.

Avoid the common formula of three identical feature cards. Use varied layouts that match the information being communicated.

## 3.3 Motion and accessibility

- Keep motion subtle and purposeful.
- Respect `prefers-reduced-motion`.
- Preserve normal scrolling and browser navigation.
- Provide visible keyboard focus.
- Maintain readable contrast.
- Use semantic HTML and accessible labels.
- Do not rely on color alone to communicate risk.
- Ensure the application remains usable on narrow screens.

---

# 4. BUILD A REAL APPLICATION, NOT A STATIC CONCEPT

The central visual element should be the actual product interface.

Create realistic application content based on verified datasets, implemented calculations, or explicitly labeled demonstration data.

Do not fill the interface with arbitrary charts, invented numbers, fictional villages, or unsupported groundwater predictions simply to make it look complete.

If authentic datasets cannot yet be connected, provide a controlled demonstration mode that is clearly labeled:

"Demonstration data. Not for operational decision-making."

Keep demonstration data separate from production data at the application and database levels.

Where appropriate, display:
- Data source.
- Observation period.
- Last successful update.
- Spatial resolution.
- Data coverage.
- Quality status.
- Processing status.
- Confidence or uncertainty.
- Methodology reference.
- Whether the value is observed, derived, simulated, or predicted.

The interface must never imply that a real-time feed exists when the system is using static or historical data.

---

# 5. REQUIRED APPLICATION MODULES

Build the following modules in a coherent application. Reuse existing implementations when they are functional.

## 5.1 Overview dashboard

Create an operational dashboard showing:
- Pilot-area selection.
- Geographic overview.
- Available groundwater observations.
- Rainfall trends.
- Relevant environmental indicators.
- Potential groundwater-stress areas.
- Data freshness and quality.
- Recent assessments and their review status.
- Data-source availability.
- Pending review tasks.

Do not invent live KPI values.

If a metric cannot be calculated from available data, show an informative empty state explaining what is missing.

Avoid an overwhelming wall of cards. Use a map-led composition, a small number of useful summary metrics, and expandable evidence panels.

## 5.2 Geospatial intelligence explorer

Create an interactive map and associated evidence panel.

Required capabilities:
- Select a supported district, block, or other verified administrative geography.
- Display available groundwater observations and environmental indicators.
- Toggle supported layers.
- Inspect geographic features.
- Show legends and units.
- Display the date and source of the selected observation.
- Distinguish observed data from derived indicators and model outputs.
- Show missing-data areas.
- Show source resolution and limitations.
- Provide a clear reset and layer-selection mechanism.
- Allow users to inspect the underlying evidence for an assessment.

Do not assign regional satellite observations to individual villages as if they were direct village measurements.

Use verified administrative boundaries and stable geographic identifiers wherever available.

If a boundary dataset is unavailable, do not draw fictional boundaries and label them as official.

## 5.3 Groundwater-stress monitoring

Create a monitoring workspace that helps users examine:
- Historical groundwater-level observations.
- Seasonal and long-term changes.
- Rainfall patterns.
- Soil-moisture indicators.
- Evapotranspiration or vegetation indicators when available and relevant.
- Satellite-derived storage anomalies at their appropriate spatial scale.
- Data gaps and conflicting signals.

Users should be able to choose an area, inspect a time range, compare supported indicators, and view the evidence underlying the assessment.

Never treat a satellite-derived storage anomaly as an exact groundwater depth or directly measured village-level reserve.

## 5.4 Risk assessment and forecasting

Implement a transparent risk-assessment pipeline.

The proposed Groundwater Stress Score (GSS), with a range of 0 to 100, is a research concept and must not be treated as scientifically validated by default.

Before implementing a production GSS:
1. Define the target condition and intended spatial scale.
2. Define each input indicator and its units.
3. Document normalization, weights, missing-data handling, and temporal aggregation.
4. Establish a baseline methodology.
5. Calibrate against appropriate ground observations.
6. Validate on held-out time periods and, where possible, geographically independent locations.
7. Quantify uncertainty and calibration.
8. Record the model and methodology version.
9. Compare results against simple baselines.
10. Document known limitations and failure cases.

If these conditions have not been met, implement an exploratory indicator dashboard instead of an authoritative score.

Do not present a "days-to-crisis" countdown as a fact. Such a prediction may be introduced only after its target definition, forecast horizon, error metrics, uncertainty, and independent validation have been established.

Do not implement an LSTM merely because it was mentioned in a proposal. Select the simplest model that performs reliably against a documented baseline.

## 5.5 Intervention-planning workspace

Create a workflow to help authorized officials:
- Inspect the evidence for an area.
- Record a potential concern.
- Compare candidate interventions.
- Record supporting observations.
- Identify missing evidence.
- Assign a review owner.
- Add comments and attachments when supported.
- Approve, reject, or request further investigation.
- Track status and outcomes.

Potential programme references may include Jal Jeevan Mission, Atal Bhujal Yojana, MGNREGA-related water-conservation works, and Amrit Sarovar where relevant and applicable.

Do not invent eligibility criteria, budgets, scheme availability, sanction status, or government approval.

Any scheme mapping must be based on verified current guidance and clearly distinguish general relevance from confirmed eligibility.

A model must not independently authorize expenditure, sanctions, or operational intervention.

## 5.6 Alerts and communication

Build the notification workflow with:
- Configurable alert rules.
- Human approval where required.
- Severity and confidence labels.
- Message preview.
- Hindi and English templates.
- Recipient and delivery status.
- Retry and failure handling.
- Audit history.
- Duplicate-alert prevention.
- Clear data timestamp and geographical coverage.

SMS and WhatsApp integrations must use a real, authorized provider and documented credentials.

If credentials are unavailable, implement a notification adapter with a local preview or mock provider. Clearly identify the integration as simulated.

Do not send real alerts to communities during development without explicit authorization.

## 5.7 Data-source and pipeline health

Create a page for administrators and analysts to inspect:
- Configured sources.
- Source status.
- Last successful ingestion.
- Latest observation date.
- Processing failures.
- Missing-data rates.
- Validation errors.
- Spatial coverage.
- Dataset version or provenance.
- Retry status.
- Source documentation.

Distinguish between a source that is configured, reachable, successfully ingested, and scientifically suitable. These are different states.

## 5.8 Administration and auditability

Provide appropriate controls for:
- User roles.
- Access permissions.
- Pilot geography configuration.
- Data-source configuration.
- Model and methodology versions.
- Alert thresholds.
- Review assignments.
- Audit logs.

Do not create insecure placeholder authentication and present it as production-ready.

---

# 6. DATA SOURCES AND SCIENTIFIC INTEGRATION

Investigate the feasibility of using the following sources.

## GRACE and GRACE-FO
Use satellite-derived terrestrial water-storage anomalies only at their appropriate spatial and temporal scales. Document the limitations of separating groundwater from other components of total water storage.

## India Meteorological Department
Investigate suitable rainfall observations and historical datasets. Document availability, licensing, update frequency, spatial resolution, and permitted use.

## Sentinel-2
Use suitable optical imagery for supported land-surface, vegetation, and agricultural indicators. Handle clouds, missing observations, and acquisition dates.

## MODIS
Investigate appropriate evapotranspiration and land-surface products. Preserve the original product resolution and processing assumptions.

## SMAP
Investigate soil-moisture products and their appropriate spatial and temporal scales. Do not equate surface soil moisture with groundwater depth.

## Central Ground Water Board and state groundwater observations
Investigate groundwater-level observations and associated metadata for calibration and independent validation.

## ISRO Bhuvan and related government resources
Investigate relevant groundwater-prospect maps, administrative layers, and data access conditions. Do not assume that all layers or APIs are publicly accessible.

For every source:
- Confirm actual availability.
- Review current terms and licensing.
- Record spatial resolution and temporal frequency.
- Record the source timestamp and ingestion timestamp.
- Validate coordinate reference systems.
- Validate units and missing-value conventions.
- Preserve provenance.
- Avoid silent interpolation or unsupported downscaling.
- Provide a source-specific adapter so providers can be replaced without rewriting the application.

Do not scrape restricted resources or bypass access controls.

If a source cannot be accessed, create a documented interface and mark its integration as pending.

---

# 7. TECHNICAL ARCHITECTURE

First inspect the existing stack. Retain it where practical.

If the repository is empty or the existing implementation provides no suitable foundation, use the following proposed architecture.

## Frontend
- Next.js with TypeScript.
- App Router.
- Tailwind CSS.
- Accessible, reusable UI components.
- A suitable map library selected according to licensing, rendering needs, and browser support.
- Charting only where it helps users understand evidence or trends.

## Backend
- Python-based services for geospatial processing and model workflows.
- Typed, documented APIs.
- Clear validation and error handling.
- Separation between business logic, data access, geospatial processing, and model inference.

## Database
- PostgreSQL.
- PostGIS for spatial operations.
- Versioned migrations.
- Explicit foreign keys and constraints.
- Indexes for common spatial, temporal, and administrative queries.
- Appropriate row-level and role-based access controls where supported by the chosen architecture.

## Geospatial processing
- Google Earth Engine where appropriate and authorized.
- Reproducible processing scripts.
- Explicit projection, resolution, resampling, masking, and aggregation rules.
- Native-resolution-first processing.
- Documented derived-product generation.

## Machine learning
- Python.
- scikit-learn for suitable baseline models.
- PyTorch only where justified by evidence and data requirements.
- Versioned datasets, features, training runs, evaluation reports, and model artifacts.
- Reproducible training and inference.

## Background jobs
Use Celery and Redis only if the existing architecture or demonstrated workload requires them.

## Initial demonstration
A lightweight Streamlit prototype may be retained if already useful, but do not introduce a separate application unnecessarily when the main product is already implemented in Next.js.

## Deployment
- Separate development, staging, and production configuration.
- Environment variables and secrets management.
- CI checks and automated tests.
- Structured logs and application health checks.
- Database backup and restoration procedures.
- Documented deployment and rollback steps.

Do not install every proposed technology automatically. Prefer the smallest maintainable architecture that satisfies the requirements.

---

# 8. DATA MODEL AND TRACEABILITY

Inspect the existing schema before creating new tables.

Design or adapt entities for:
- Users and roles.
- Administrative geographies.
- Groundwater observations.
- Environmental observations.
- Source datasets and ingestion runs.
- Processing jobs.
- Derived indicators.
- Risk assessments.
- Model versions and evaluation runs.
- Intervention recommendations.
- Review and approval records.
- Alerts and delivery attempts.
- Audit events.

Use stable identifiers, timestamps, units, provenance, and validation status.

For every derived indicator, preserve enough information to reproduce its calculation.

For every model-generated assessment, record:
- Model version.
- Input dataset references.
- Prediction timestamp.
- Geographic unit.
- Observation period.
- Output value and unit.
- Uncertainty or confidence information.
- Data-quality status.
- Methodology version.
- Known limitations.

Do not store invented values as genuine observations.

Use database migrations rather than destructive schema changes. Add appropriate indexes, constraints, and tests.

---

# 9. USER EXPERIENCE AND PAGE STRUCTURE

Build a cohesive product with a clear information architecture.

Suggested navigation:

1. Overview
2. Map Explorer
3. Groundwater Monitoring
4. Risk Assessments
5. Intervention Planning
6. Alerts and Reports
7. Data Sources
8. Administration

Adapt the structure if the existing repository already has a stronger organization.

## Public landing page

If a public-facing page is required, it should communicate:
- What JalDrishti does.
- Who it serves.
- How its evidence-based workflow operates.
- What the platform currently supports.
- What remains under research or validation.
- A clear entry point to the demonstration or application.

Use a restrained hero section and an actual product screenshot or working application view.

Do not create fictional partner logos, invented impact statistics, fabricated endorsements, unsupported claims, or meaningless feature sections.

## Application shell

Create:
- Clear navigation.
- Contextual page titles.
- A consistent geographic and temporal context.
- Useful breadcrumbs where appropriate.
- Accessible forms.
- Meaningful loading, error, empty, and success states.
- Responsive tables and map panels.
- Clear source and methodology details.
- Predictable navigation and browser behavior.

Do not force every page into the same layout. The map explorer, data-source manager, and intervention workflow have different information needs.

---

# 10. FUNCTIONAL QUALITY REQUIREMENTS

Every visible control must have a meaningful behavior.

Verify that:
- Navigation links open the correct pages.
- Filters update the displayed results.
- Map layers can be enabled and disabled.
- Geography selectors affect the selected area.
- Date filters change the relevant queries.
- Charts represent actual data from their documented source.
- Forms validate input.
- Form submissions produce visible results or useful errors.
- Review and approval actions persist appropriately.
- Notifications update their delivery status.
- Data-source failures are observable.
- Loading states appear only when actual asynchronous work is occurring.
- Empty states explain how the user can proceed.
- Keyboard users can operate core workflows.
- Users cannot perform unauthorized actions.
- Refreshing the page does not silently discard persisted work.

Do not use dead buttons, fake dropdowns, decorative toggles, or hard-coded success notifications.

If a feature depends on an unavailable external service, implement a clear disabled state or a labelled simulation rather than pretending it works.

---

# 11. SECURITY, PRIVACY, AND RESPONSIBLE OPERATION

Implement security appropriate to the selected architecture.

Requirements:
- Secure authentication and session handling.
- Role-based authorization.
- Server-side validation of sensitive operations.
- Least-privilege database access.
- Secure handling of API keys and secrets.
- No secrets committed to source control.
- Audit logs for consequential actions.
- Protection against common web vulnerabilities.
- Input validation and output encoding.
- Rate limiting for sensitive or expensive endpoints where appropriate.
- Documented retention and deletion behavior.
- Minimal collection of personal information.
- No exposure of private recipient information in public dashboards.

Draft Privacy Policy and Terms of Service pages using only known product facts. Mark unresolved legal, organizational, and data-governance details for review. Do not invent legal commitments or claim compliance certifications that have not been established.

Treat water-risk classifications as decision-support information. Keep uncertainty visible and require appropriate human review before operational action.

---

# 12. RESEARCH AND VALIDATION REQUIREMENTS

JalDrishti must explicitly account for prior work in:
- GRACE-based terrestrial water-storage and groundwater research.
- Groundwater modelling in Bundelkhand.
- ISRO Bhuvan-Bhujal and groundwater-prospect mapping.
- CGWB groundwater monitoring and India-WRIS.
- Atal Bhujal Yojana and community-led water-security planning.
- Machine-learning-based downscaling and environmental risk assessment.

Do not claim that satellite-based groundwater monitoring or machine-learning prediction is an entirely new idea.

Potential research contributions to investigate include:
- More reproducible multi-source integration.
- Better local validation at a defensible spatial scale.
- Explicit propagation of uncertainty into risk decisions.
- Useful warning horizons supported by appropriate observations.
- Transparent mapping from evidence to intervention planning.
- Prospective evaluation against existing workflows and simple baselines.

For any predictive model:
1. Define the prediction target.
2. Establish a simple baseline.
3. Separate training, validation, and test periods correctly.
4. Prevent data leakage.
5. Use independent observations where feasible.
6. Report suitable error and calibration metrics.
7. Evaluate false positives and false negatives.
8. Document performance by geography and season where data permits.
9. Record uncertainty and failure modes.
10. Prevent unvalidated outputs from being used as authoritative operational alerts.

Do not manufacture research results or model performance.

---

# 13. PERFORMANCE AND RELIABILITY

Use measurable acceptance criteria.

Initial targets should be treated as engineering objectives and adjusted after benchmarking:
- Primary application views should aim for a good user-perceived loading experience under the agreed test environment.
- Common API requests should have a documented latency target.
- Large geospatial processing tasks should run asynchronously where appropriate.
- Map interactions should remain responsive for the supported geographic extent.
- Data ingestion should be idempotent where practical.
- Failed jobs should expose actionable error information.
- Retries must not create duplicate records or duplicate alerts.
- Database migrations and backups must be testable.
- The application should degrade gracefully when a source is unavailable.

Measure actual performance before reporting that a target has been achieved.

Avoid premature optimization and unnecessary infrastructure.

---

# 14. IMPLEMENTATION WORKFLOW

Follow this workflow throughout development.

## Phase A: Repository audit
Inspect the codebase, understand the architecture, identify existing features, and establish a runnable baseline.

## Phase B: Design system and representative section
Define reusable design tokens, typography, spacing, buttons, forms, navigation, map treatments, and data-status patterns.

Build one representative application section using real available content. Inspect it at desktop and mobile widths before expanding the design.

## Phase C: Functional foundation
Implement the application shell, routing, data model, authentication if required, API contracts, and empty/loading/error states.

## Phase D: Core monitoring
Implement data-source adapters, ingestion, quality checks, geographic selection, the map explorer, and historical indicator views.

## Phase E: Assessment and governance
Implement evidence-backed assessments, review workflows, intervention planning, auditability, and approved notification workflows.

## Phase F: Validation
Test the data pipeline, spatial calculations, permissions, model safeguards, responsive interface, and important user journeys.

## Phase G: Documentation and handoff
Update architecture documentation, setup instructions, environment-variable examples, data-source status, limitations, deployment instructions, and a truthful implementation report.

At the end of each phase:
- Summarize what changed.
- List the files and components affected.
- Run the relevant tests.
- Identify failures.
- Record unfinished items.
- State the next implementation step.

Continue through the planned phases unless blocked by a missing decision, credential, dependency, or source that materially prevents safe progress.

---

# 15. REQUIRED TESTING

Test the complete application, not only the landing page.

## Desktop
Inspect at approximately 1440px and 1280px viewport widths.

## Mobile
Inspect at approximately 390px and 360px viewport widths.

## Functional tests
Verify navigation, geography selection, filters, forms, data states, review workflows, and the main user action.

## Data tests
Verify units, timestamps, coordinate systems, missing-data handling, duplicate ingestion, invalid geometries, source provenance, and data freshness.

## Scientific tests
Verify scale limitations, calculation reproducibility, baseline comparisons, validation separation, uncertainty handling, and prevention of unsupported operational predictions.

## Security tests
Verify permissions, protected routes, input validation, secret handling, and unauthorized actions.

## Accessibility checks
Verify keyboard navigation, focus visibility, labels, contrast, semantic structure, reduced motion, and error announcements where appropriate.

## Visual checks
Look for:
- Horizontal overflow.
- Broken wrapping.
- Cropped charts and maps.
- Unreadable labels.
- Inconsistent spacing.
- Excessive rounded corners.
- Unnecessary shadows.
- Prohibited visual patterns.
- Misleading legends.
- Empty areas with no explanation.
- Controls that look functional but do nothing.

Fix the problems you observe. Do not claim a test passed unless it was actually executed.

If browser automation or a live preview is unavailable, state that limitation explicitly.

---

# 16. DEFINITION OF DONE

The implementation is complete for a milestone only when:

1. The application starts using documented commands.
2. Existing working functionality remains intact.
3. The implemented features match the agreed acceptance criteria.
4. Every visible control has a working behavior or an explicit unavailable state.
5. Data is labelled as observed, derived, simulated, or predicted.
6. External source availability is accurately represented.
7. Scientific limitations are visible where they affect interpretation.
8. No unvalidated groundwater countdown is presented as authoritative.
9. The interface respects the 30 prohibited design patterns.
10. Desktop and mobile layouts have been inspected.
11. Relevant automated tests have been run.
12. Security-sensitive operations are protected.
13. Known defects and incomplete integrations are documented.
14. Setup, configuration, and deployment instructions are current.

---

# 17. FINAL RESPONSE REQUIRED FROM THE CODING AGENT

When reporting progress or completion, provide:

**A. Implementation summary**
What was actually built.

**B. Architecture**
The technologies and design decisions actually used.

**C. Functional status**
Which features work, which are simulated, and which remain incomplete.

**D. Data-source status**
Which sources are integrated, which were tested, which require credentials or approvals, and which are still pending.

**E. Validation status**
Tests executed, test results, viewport sizes inspected, and any checks that could not be performed.

**F. Scientific limitations**
Current model maturity, data coverage, known uncertainty, and any unvalidated assessments.

**G. Files changed**
A concise list of significant changes.

**H. Next steps**
The highest-priority unfinished work and any decisions or access requirements blocking progress.

Be specific and honest. Do not claim deployment, source connectivity, scientific validity, or successful testing unless verified.

---

# FINAL DIRECTIVE

Build JalDrishti as a credible, restrained, evidence-driven geospatial product.

Prioritize scientific integrity, usable workflows, transparent data provenance, maintainable engineering, and a distinctive visual identity.

The interface must be polished, but the underlying data and workflows must be real wherever the product claims they are real.

Inspect first. Build incrementally. Validate continuously. Preserve working features. Never hide uncertainty behind attractive visualizations.

Start by auditing the existing repository and supplied project documents, then implement the first complete, testable milestone.