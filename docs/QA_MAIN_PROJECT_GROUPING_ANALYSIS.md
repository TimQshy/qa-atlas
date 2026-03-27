# QA Main Project Grouping Analysis

## Scope Analyzed

Primary product sources used for analysis:

- `/home/timur/eq-monorepo`
- `/home/timur/enrollment_angular`
- `/home/timur/enrollment_node`

This document summarizes a QA-oriented grouping structure designed for practical usage in QA Atlas.

---

## Objectives

- Build a domain-first QA structure (not UI-only).
- Map business flows across UI and API.
- Support fast test case navigation and scalable regression packs.
- Highlight risk-heavy and ambiguous areas.

---

## Canonical Business Domains

1. Admissions / Applications
2. Students & Families CRM
3. Events / Bookings / Check-in
4. Communications / Notifications
5. Analytics / Insights
6. Zone Catcher / Geospatial
7. Auth / Roles / Access
8. Admin Configuration (School / Org / System)
9. Integrations / Async Platform

---

## Final QA Grouping Tree (Template)

```text
Enrollment Platform
├── 01_Admissions_Applications
│   ├── Form_Design_Configuration
│   ├── Public_Submission_Flow
│   ├── Contact_Portal_Signature
│   ├── Application_Operations
│   └── Payments
├── 02_Students_Families_CRM
│   ├── Student_Profile_Lifecycle
│   ├── Contacts_Relationships
│   ├── Family_Fields
│   ├── Bulk_Transfer_Import_Export
│   └── Lead_Score_Criteria
├── 03_Events_Bookings_Checkin
│   ├── Event_Management
│   ├── Bookings
│   └── Representative_Checkin
├── 04_Communications_Notifications
│   ├── Campaign_Management
│   ├── Templates_Signatures
│   ├── Unsubscribe_Consent
│   └── Reminders_Tasks
├── 05_Analytics_Insights
│   ├── School_Analytics
│   ├── Geographic_Analytics
│   ├── Org_Analytics
│   └── Feature_Flag_Analytics
├── 06_Zone_Catcher_Geospatial
│   ├── Map_Layer_Management
│   ├── Catchment_Computation
│   └── Downstream_Propagation
├── 07_Auth_Roles_Access
│   ├── WorkOS_SSO
│   ├── Legacy_NoAuth_Access
│   ├── Role_Based_Access
│   └── Route_Guards_Feature_Flags
├── 08_Admin_Configuration
│   ├── School_Admin_Config
│   ├── Org_Admin
│   └── System_Admin
└── 09_Integrations_Async_Platform
    ├── External_Integrations
    ├── Queues_Workers_Schedulers
    ├── Events_PubSub
    └── Data_Migrations_Operational
```

---

## Cross-Layer Mapping (UI -> API -> Business Outcome)

- `enrollment_angular /applications/*` -> `enrollment_node /applications, /submissions, /application-webform*` -> admission lifecycle.
- `enrollment_angular /students, /enquiries/*` -> `enrollment_node /student, /students, /contacts*` -> CRM lifecycle.
- `enrollment_angular /events/*, /representative/checkin` -> `enrollment_node /events, /bookings, /personal-tour*` -> event operations.
- `enrollment_angular /communications/*` -> `enrollment_node /communications, /email-template*` -> outbound messaging.
- `enrollment_angular /analytics/*` -> analytics/filter endpoints in `enrollment_node` -> reporting outcomes.
- map layer and zone features -> `enrollment_node /map-layers*` + async compute pipeline -> geospatial status propagation.
- auth/callback/guards + portal routes -> login/token middleware + portal endpoints -> access and session security.

---

## QA Mapping by Domain (What to Test)

- **Admissions / Applications**
  - Template setup, submission, signature, payment, status transitions.
  - Risk: hidden field leakage, payment mismatch, signature route regressions.

- **Students & Families CRM**
  - Student/contact CRUD, family fields, merge, import/export consistency.
  - Risk: propagation gaps for new fields, data loss on merge.

- **Events / Bookings / Check-in**
  - Event lifecycle, booking updates, representative access.
  - Risk: route/guard errors, duplicate/edit regressions.

- **Communications / Notifications**
  - Campaign compose/schedule/send, templates/signatures, unsubscribe/reminders.
  - Risk: provider timeouts, delivery drift, compliance gaps.

- **Analytics / Insights**
  - Filter correctness and metric consistency by role/view mode.
  - Risk: inconsistent aggregation and slow/high-load queries.

- **Zone Catcher / Geospatial**
  - KML upload/assignment, recompute, stale cleanup, propagation into lead score/analytics.
  - Risk: async lag and stale status behavior.

- **Auth / Roles / Access**
  - SSO callback, token refresh, noAuth/public contract, role restrictions.
  - Risk: refresh loops, unauthorized route leakage.

- **Admin Configuration**
  - School/org/system settings and taxonomy effects on downstream modules.
  - Risk: permission boundaries, tenant data visibility.

- **Integrations / Async Platform**
  - Queue/pubsub jobs, retries/idempotency, external dependency resilience.
  - Risk: partial success and eventual consistency failures.

---

## QA Tool Navigation Recommendations

- Use 4 levels max: `Domain -> Feature -> Flow -> TestSuite`.
- Add mandatory tags: `domain`, `role`, `viewMode`, `risk`, `integration`, `featureFlag`.
- Keep dedicated packs:
  - `R0_Smoke`
  - `R1_HighRisk`
  - `R2_FullRegression`
  - `R3_IntegrationResilience`
- Split by context where needed:
  - `school-view` vs `org-view`
  - `public/noAuth` vs authenticated
  - `flag_on` vs `flag_off`

---

## Naming Convention (Recommended)

- Folder: `NN_Domain_Feature`
- Flow: `FLOW_<Actor>_<Action>_<Outcome>`
- Case: `TC_<Domain>_<Feature>_<Intent>_<Priority>`

Examples:

- `FLOW_Parent_SubmitApplication_Success`
- `TC_Admissions_Payment_SubmitWithoutIntentBlocked_P1`

---

## Known Ambiguities and Cleanup Rules

- Multiple "forms" concepts (admin forms vs application forms vs public webforms):
  - Keep separate QA groups for builder vs execution paths.
- `noAuth` namespace may still include token-scoped behavior:
  - Separate test suites for fully public vs token-required flows.
- School and org views overlap but differ in permissions and outcomes:
  - Duplicate key tests by view mode instead of sharing one suite.
- Feature flags change visible route surface:
  - Maintain paired suites for flag on/off coverage.
- Docs vs code route drift risk:
  - Treat runtime code routes as source of truth for test grouping.

---

## Implementation Note

A template based on this structure was seeded into QA Atlas release `v1` as domain/feature folders and linked as release impact scope.
