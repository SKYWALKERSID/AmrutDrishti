# JalDrishti
### Satellite-Assisted Groundwater Intelligence for Climate Resilience

**JalDrishti** is a proposed geospatial intelligence and decision-support platform that combines Earth observation, environmental data, groundwater measurements, and machine learning to help identify emerging water stress and support evidence-based intervention planning.

The initial proposed pilot focuses on **Bundelkhand, Madhya Pradesh, India**, a drought-prone region where groundwater sustainability, agricultural resilience, and rural water security are important planning priorities.

> **Project status:** Under development. Data integrations, predictive models, and operational capabilities must be independently verified before being treated as production-ready.

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Proposed Solution](#proposed-solution)
- [Objectives](#objectives)
- [Core Modules](#core-modules)
- [Research Background and Existing Systems](#research-background-and-existing-systems)
- [Research Gaps and Potential Contributions](#research-gaps-and-potential-contributions)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Data Sources](#data-sources)
- [Scientific Methodology](#scientific-methodology)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Security and Privacy](#security-and-privacy)
- [Limitations](#limitations)
- [License](#license)

---

## Overview

Groundwater management requires reliable information about water availability, environmental conditions, local observations, and changing demand. However, relevant information is distributed across satellite products, monitoring networks, government portals, research datasets, and local planning systems.

JalDrishti proposes to bring these sources into a unified platform where users can examine environmental indicators, explore geographic patterns, assess potential groundwater stress, and review possible interventions.

The platform is designed around five principles:

1. **Evidence first:** Assessments must be traceable to their underlying data.
2. **Scientific transparency:** Spatial resolution, uncertainty, missing observations, and model limitations must remain visible.
3. **Actionable intelligence:** Information should support practical monitoring and planning workflows.
4. **Responsible automation:** Consequential alerts and intervention recommendations require appropriate human oversight.
5. **Incremental validation:** Build reliable monitoring capabilities before introducing unvalidated predictive features.

## Problem Statement

Groundwater-related decisions are challenging for several reasons:

- Environmental observations are distributed across multiple sources.
- Satellite products and ground measurements operate at different spatial and temporal scales.
- Groundwater stress may develop before its effects become obvious to communities and administrators.
- Local risk assessments can be unreliable when ground observations are sparse or inconsistent.
- Technical analysis does not always translate into transparent intervention planning.
- Decision-makers need to understand not only the estimated risk, but also the evidence and uncertainty behind it.

JalDrishti aims to improve the integration, interpretation, and practical use of this information.

## Proposed Solution

JalDrishti will investigate whether combining satellite-derived environmental indicators, rainfall information, groundwater observations, geospatial analytics, and validated predictive methods can improve local groundwater-risk monitoring.

The proposed workflow is:

**Environmental Data → Quality Control → Geospatial Analysis → Risk Assessment → Human Review → Intervention Planning → Outcome Monitoring**

The platform is intended to support decision-making rather than autonomously declare groundwater emergencies or authorize government expenditure.

## Objectives

- Integrate suitable satellite, rainfall, soil-moisture, and groundwater datasets.
- Build a reproducible geospatial data-processing pipeline.
- Visualize environmental conditions and historical trends.
- Identify areas requiring further groundwater investigation.
- Evaluate the reliability of local risk indicators against ground observations.
- Investigate predictive models only when sufficient suitable data is available.
- Support transparent, reviewable intervention-planning workflows.
- Provide understandable information for technical users and public administrators.
- Evaluate the system through measurable technical and operational criteria.

---

## Core Modules

The following modules define the intended product scope. Their implementation status must be confirmed against the actual codebase.

### 1. Geospatial Intelligence Explorer

A map-led interface for examining available environmental and groundwater information.

Planned capabilities:
- Geographic selection at supported administrative levels.
- Interactive map layers.
- Groundwater observation locations.
- Rainfall and environmental indicator visualization.
- Time-based comparisons.
- Data-source attribution and observation dates.
- Spatial coverage and missing-data indicators.

### 2. Groundwater Monitoring

A monitoring workspace for examining groundwater observations and related environmental trends.

Potential indicators include:
- Observed groundwater levels.
- Rainfall patterns.
- Soil-moisture indicators.
- Evapotranspiration and vegetation indicators.
- Satellite-derived terrestrial water-storage anomalies.

Indicators will be presented according to their actual measurement meaning, resolution, and limitations.

### 3. Groundwater Risk Assessment

A transparent framework for combining suitable indicators into an interpretable assessment.

The proposed Groundwater Stress Score (GSS), ranging from 0 to 100, remains a methodology to be defined, calibrated, and validated.

A score must not be presented as scientifically validated until its inputs, calculation, target condition, calibration, uncertainty, and independent performance have been established.

### 4. Predictive Analytics

A research and development module for evaluating whether historical observations and environmental indicators can support useful groundwater-risk forecasts.

Candidate approaches may include statistical baselines, Random Forest, gradient-boosting methods, or other models justified by the available data.

Model complexity will be selected according to measured performance, not novelty.

A days-to-crisis prediction is not an established capability and must not be treated as an authoritative countdown without independent validation.

### 5. Intervention Planning

A workspace for reviewing areas of concern and recording possible water-conservation or rural-development interventions.

Potential programme references include:
- Jal Jeevan Mission.
- Atal Bhujal Yojana.
- MGNREGA-related water-conservation works.
- Amrit Sarovar, where applicable.

Programme relevance, eligibility, funding, and implementation status must be verified using authoritative information.

### 6. Alerts and Communication

A proposed notification workflow for communicating reviewed risk assessments.

Potential capabilities:
- Configurable alert thresholds.
- Hindi and English message templates.
- Geographic targeting.
- Human approval.
- Delivery-status tracking.
- Failure handling and audit history.

External SMS and WhatsApp delivery requires an authorized provider and verified integration. Simulated notifications must be labelled accordingly.

### 7. Data Source and Pipeline Monitoring

An administrative workspace for inspecting:
- Configured datasets.
- Ingestion status.
- Last successful update.
- Data freshness.
- Processing failures.
- Missing-value rates.
- Geographic coverage.
- Source provenance.

A configured data source must not automatically be described as connected, current, or operational.

---

## Research Background and Existing Systems

JalDrishti builds on established areas of research and public infrastructure. Its potential contribution must be evaluated against existing work rather than assuming that satellite-based groundwater monitoring is new.

Relevant areas include:

| Existing work or system | Relevance |
|---|---|
| GRACE and GRACE-FO research | Regional terrestrial water-storage monitoring and groundwater-related analysis |
| Bundelkhand groundwater modelling research | Directly relevant prior work in the proposed pilot region |
| ISRO Bhuvan-Bhujal | Groundwater-prospect mapping and geospatial information |
| Central Ground Water Board (CGWB) | Groundwater monitoring and related observations |
| India-WRIS | Water-resource information and visualization |
| Atal Bhujal Yojana | Community-led groundwater monitoring and water-security planning |
| Machine-learning research | Environmental modelling, forecasting, and potential spatial estimation |

These systems and research areas may provide complementary information or existing capabilities. Their availability, data-access terms, geographic coverage, and technical interoperability must be investigated before implementation.

### Further reading

- [GRACE and groundwater depletion research](https://www.nature.com/articles/srep24398)
- [Bundelkhand groundwater assessment study](https://www.sciencedirect.com/science/article/pii/S2950263225001036)
- [ISRO Bhuvan-Bhujal](https://bhuvan-app1.nrsc.gov.in/gwis/)
- [Central Ground Water Board](https://cgwb.gov.in/)
- [India-WRIS](https://indiawris.gov.in/)
- [Atal Bhujal Yojana](https://ataljal.mowr.gov.in/)

These references are starting points for research, not proof that every dataset or service is available for direct integration.

---

## Research Gaps and Potential Contributions

The following are candidate research questions, not claims that no existing system addresses them.

### 1. Local validation of groundwater-risk estimates

Can satellite-derived indicators and ground observations support reliable assessments at block or village level?

### 2. Uncertainty-aware risk assessment

How do source resolution, missing data, seasonal variability, and measurement uncertainty affect the final risk classification?

### 3. Integration of fragmented evidence

Can a reproducible pipeline make environmental indicators and groundwater observations easier to inspect and compare?

### 4. Useful early-warning horizons

Can available observations support forecasts that provide meaningful lead time without overstating precision?

### 5. Evidence-linked intervention planning

Can transparent environmental evidence improve the consistency and traceability of local intervention prioritization?

### 6. Prospective operational evaluation

Does the proposed workflow improve decision usefulness when evaluated on unseen periods and against existing procedures?

### Potential contribution

JalDrishti will investigate the integration of validated environmental evidence, uncertainty reporting, and human-reviewed planning workflows into a practical geospatial decision-support system.

Novelty and effectiveness must be demonstrated through literature review, comparison with existing systems, independent validation, and pilot evaluation.

---

## System Architecture

The architecture below is conceptual. The implementation must follow the approved Technical Requirements Document and actual repository state.

```text
Environmental and Groundwater Data
                |
                v
      Data Source Adapters
                |
                v
      Ingestion and Quality Control
                |
                v
     Geospatial Processing Pipeline
                |
                v
      PostgreSQL + PostGIS
                |
                v
       Analytics and Validation
                |
                v
         Backend APIs
                |
                v
       JalDrishti Web Application
                |
                v
    Evidence Review and Planning
                |
                v
       Approved Notifications
```

### Architectural principles

- Modular and maintainable components.
- Reproducible data-processing workflows.
- Clear separation between observed data and model-derived outputs.
- Versioned database migrations.
- Traceable model inputs and outputs.
- Role-based access where required.
- Documented API contracts.
- Environment-specific configuration.
- Observable ingestion and processing failures.
- Human review for consequential decisions.

---

## Technology Stack

The following technologies are proposed, not necessarily implemented.

| Component | Proposed technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| UI styling | Tailwind CSS and reusable accessible components |
| Backend and processing | Python |
| Geospatial database | PostgreSQL, PostGIS |
| Earth observation processing | Google Earth Engine, subject to access and suitability |
| Machine learning | scikit-learn and/or PyTorch, as justified |
| Visualization | Suitable mapping and charting libraries |
| Background jobs | Celery and Redis, if required |
| Deployment | GitHub-connected hosting appropriate to each component |

The existing repository takes precedence over this proposed stack. Do not introduce additional infrastructure without a demonstrated need.

---

## Data Sources

JalDrishti will investigate the following sources.

| Source | Potential use | Important limitation |
|---|---|---|
| GRACE / GRACE-FO | Terrestrial water-storage anomalies | Coarse spatial support; not direct village-level groundwater depth |
| India Meteorological Department | Rainfall observations and historical patterns | Access, licensing, resolution, and update frequency require verification |
| Sentinel-2 | Vegetation and land-surface indicators | Optical observations are affected by clouds and acquisition frequency |
| MODIS | Evapotranspiration and other land-surface products | Product-specific spatial resolution and uncertainty |
| SMAP | Soil-moisture observations | Surface soil moisture is not groundwater depth |
| CGWB | Groundwater-level observations | Coverage, frequency, and accessibility must be assessed |
| ISRO Bhuvan | Groundwater-prospect and geospatial information | Access and reuse conditions vary by dataset |

For every integrated dataset, document its source, units, spatial resolution, observation period, ingestion timestamp, licensing conditions, and quality checks.

Never assume access to an API, unrestricted reuse, real-time availability, or complete coverage.

---

## Scientific Methodology

Scientific validation is a core engineering requirement.

### Groundwater Stress Score

Before an operational GSS is implemented, establish:

1. A precise target condition.
2. Defined input indicators and units.
3. Documented normalization and aggregation methods.
4. A defensible missing-data policy.
5. Calibration against suitable ground observations.
6. Independent temporal and, where feasible, spatial validation.
7. Uncertainty reporting and performance criteria.
8. Comparison with simpler baseline approaches.

Until these conditions are satisfied, use exploratory indicators rather than an authoritative composite risk score.

### Model validation

Predictive models should:
- Use reproducible training datasets.
- Avoid temporal and spatial data leakage.
- Be compared against appropriate baselines.
- Report suitable error and calibration metrics.
- Evaluate false positives and false negatives.
- Document geographical and seasonal limitations.
- Record model versions and input provenance.

Historical model fit alone does not establish operational forecasting capability.

### Human oversight

No model-generated result should independently authorize expenditure, approve government schemes, or trigger consequential interventions.

---

## Repository Structure

Adapt this structure to the existing project rather than forcing a rewrite.

```text
JalDrishti/
├── AGENTS.md
├── README.md
├── docs/
│   ├── PRD.docx
│   ├── TRD.docx
│   ├── PROJECT_SUMMARY.md
│   ├── ARCHITECTURE.md
│   ├── DATA_SOURCES.md
│   └── MODEL_VALIDATION.md
├── frontend/
├── backend/
├── data/
├── scripts/
├── tests/
├── .env.example
└── .gitignore
```

Not every directory must exist immediately. Create directories as implementation requires them.

Do not commit credentials, private datasets, generated build outputs, or large model artifacts without an explicit versioning strategy.

---

## Getting Started

### Prerequisites

Install the tools required by the actual project:

- Git.
- Node.js and the package manager specified by the frontend.
- Python and the supported Python version, if backend processing is present.
- PostgreSQL with PostGIS, if required.
- Appropriate external-service accounts and credentials only when their integrations are implemented.

### 1. Clone the repository

Replace the placeholder with the actual GitHub repository URL.

```bash
git clone https://github.com/SKYWALKERSID/JalDrishti.git
cd JalDrishti
```

### 2. Inspect the project

Review the README, `AGENTS.md`, package manifests, environment examples, and project documentation before running commands.

### 3. Configure environment variables

Copy the relevant example configuration file and fill in only the credentials required by the implemented services.

```bash
cp .env.example .env
```

On Windows, you can copy the file using File Explorer or PowerShell.

Never commit `.env` or real credentials.

### 4. Install dependencies

Run the installation commands appropriate to the existing repository. For example, if it contains a Node.js frontend:

```bash
npm install
```

If it contains a Python backend, use the dependency manager specified by the project and an isolated virtual environment.

Do not assume both commands are applicable until the repository has been inspected.

### 5. Start the application

Use the scripts defined in the existing package manifest or project documentation.

For a conventional Next.js project, the development command may be:

```bash
npm run dev
```

The application will typically be available at `http://localhost:3000`.

These commands are examples. Confirm the actual scripts and ports before running them.

---

## Configuration

Use environment variables for credentials and environment-specific settings.

Potential configuration categories include:

| Category | Examples |
|---|---|
| Application | Runtime environment and application URL |
| Database | Connection URL and migration configuration |
| Authentication | Provider configuration and callback URLs |
| Earth observation | Authorized service configuration |
| External data | Provider endpoints and access credentials |
| Notifications | Authorized SMS or WhatsApp provider settings |
| Observability | Error-reporting and logging configuration |

Only add variables required by implemented features. Maintain `.env.example` with placeholder values and document each variable's purpose.

Do not place real credentials in the README.

---


## Security and Privacy

JalDrishti must:
- Keep credentials out of source control.
- Validate sensitive operations on the server.
- Enforce appropriate access controls.
- Protect personal and operational data.
- Avoid exposing sensitive information in logs.
- Maintain auditability for consequential actions.
- Use authorized access to external data services.
- Document relevant data retention and deletion practices.

Terms of Service and Privacy Policy content must reflect actual product practices. Legal and organizational details require review before public operational use.


---

## Limitations

JalDrishti's effectiveness depends on the availability, suitability, quality, and coverage of its underlying datasets.

Important limitations include:

- Satellite products have different spatial and temporal resolutions.
- Regional water-storage anomalies cannot independently establish precise local groundwater depth.
- Downscaled products may introduce substantial uncertainty.
- Ground observations may be sparse, delayed, or difficult to access.
- Data access and licensing must be confirmed for each provider.
- Historical correlations do not establish reliable future forecasts.
- A risk classification does not independently establish which intervention is appropriate.
- Scheme eligibility and administrative decisions require authoritative verification.

These limitations must be reflected in the application and its documentation.

---
## License

JalDrishti is licensed under the [MIT License](LICENSE).

You are free to use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software, subject to the conditions of the MIT License.

The software is provided "AS IS", without warranty of any kind, express or implied. See the [`LICENSE`](LICENSE) file for the full license terms.

---
