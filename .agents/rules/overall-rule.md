---
trigger: always_on
---

# JalDrishti Workspace Rules

## 1. Source of Truth
Always consult these approved documents before substantial changes:
- `JalDrishti_Exhaustive_PRD_v1.0.docx`: product requirements and scope.
- `JalDrishti_Exhaustive_TRD_v1.0.docx`: architecture and technical constraints.
- Latest approved Project Summary: research, existing systems, gaps, and project objectives.

The PRD defines **what** to build; the TRD defines **how**; the Summary explains **why**. Inspect the repository to establish what actually exists. Never invent document contents. Report conflicts and propose resolutions instead of silently changing requirements.

## 2. Inspect and Preserve
- Inspect the repository, dependencies, architecture, database, and tests before editing.
- Preserve working features and existing user changes.
- Avoid unnecessary rewrites, dependencies, and unrelated refactoring.
- Never delete data, reset databases, or overwrite configuration without justification and safeguards.
- Build incrementally and document significant decisions.

## 3. UI and Design
Follow the Master Vibe-Coding Prompt. Use warm neutral backgrounds, dark readable text, one restrained accent, clear typography, consistent spacing, and accessible responsive layouts.

**Never use these 30 patterns:**
1. Harsh gradients.
2. Rainbow colors.
3. Neon colors.
4. Generic pastel-heavy styling.
5. Purple-and-black themes.
6. Pure-white page backgrounds.
7. Radial orbs.
8. Dot grids.
9. Liquid glass.
10. Decorative colored stripes.
11. Sparkle icons.
12. Emoji interface icons.
13. Decorative animated arrows.
14. Shadows everywhere.
15. Excessively rounded corners.
16. Inter font.
17. Geist font.
18. Space Grotesk font.
19. Lucide icons.
20. Decorative terminal windows.
21. Default three-feature-card layouts.
22. Default bento grids.
23. Decorative checkmark bullets.
24. Three-tier pricing sections.
25. Invented testimonials.
26. Fake customer logos.
27. Unsupported statistics or claims.
28. Simulated assets presented as real.
29. Unnecessary hover animations.
30. Artificial loading delays or distracting motion.

Every visible control must work or clearly indicate that it is unavailable. Respect keyboard navigation, contrast, reduced motion, and normal scrolling.

## 4. Architecture and Code
Follow the TRD and existing stack. Prefer the simplest maintainable solution. Reuse existing libraries and components before adding dependencies.

Separate UI, business logic, data access, geospatial processing, and ML logic. Use clear types, focused components, explicit error handling, versioned migrations, and automated tests.

## 5. Data and Scientific Integrity
Clearly distinguish observed data, satellite products, calculated indicators, predictions, simulated data, and missing data.

Preserve source, timestamps, units, spatial resolution, provenance, quality, and uncertainty where applicable. Never invent observations, coefficients, thresholds, or model results.

GRACE/GRACE-FO does not directly provide precise village-level groundwater depth. Downscaling does not guarantee local accuracy. Do not present the Groundwater Stress Score (GSS) as validated or a days-to-crisis countdown as authoritative without appropriate calibration, independent validation, and uncertainty estimates.

Use baseline comparisons, prevent data leakage, document limitations, and require human review for consequential alerts and intervention recommendations.

Treat research gaps and novelty claims as hypotheses until verified. Acknowledge relevant prior work, including CGWB, ISRO Bhuvan-Bhujal, India-WRIS, Atal Bhujal Yojana, and existing Bundelkhand groundwater research.

## 6. Security and Data Safety
Never commit secrets. Use environment variables, validate inputs, enforce authorization, and apply least-privilege access. Protect personal data and administrative actions.

Inspect schemas before migrations. Preserve referential integrity and existing records. Never perform destructive database operations without explicit justification and safeguards. Do not send real alerts without authorization.

## 7. Testing and Documentation
Run relevant linting, type checks, tests, and integration checks. Inspect desktop and mobile layouts where possible. Check overflow, contrast, map and chart readability, error states, permissions, and all 30 prohibited patterns.

Update setup instructions, architecture, data-source status, migrations, and known limitations. Never claim a test, integration, deployment, or scientific result was verified unless it actually was.

## 8. Workflow and Reporting
For each substantial feature:
1. Identify the relevant PRD requirement and TRD constraint.
2. Inspect existing code.
3. Implement the smallest suitable change.
4. Test and inspect the result.
5. Update documentation where necessary.

Report implemented features, files changed, actual test results, real versus simulated integrations, deviations from approved documents, limitations, and next steps.

**Final principle:** Preserve working functionality. Follow approved documents. Prioritize evidence over claims, correctness over complexity, and working features over decoration. Make material deviations explicit and never hide scientific uncertainty behind attractive visualizations.