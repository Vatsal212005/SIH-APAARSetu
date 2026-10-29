# APAARSetu government-style design system

Implemented in the existing Next.js application, 29 October 2026. This is an original SIH26263 prototype identity, not an official government portal. No State Emblem, AICTE seal or official APAAR card is used.

## Identity and references

The original geometric SVG combines an open academic record, linked leaves and a verification check. A white masthead carries the system title and current workspace; the navy service navigation, grouped sidebar and restrained teal highlights organize institutional tasks. A visible prototype/synthetic-data/non-official notice appears on public and authenticated pages.

The official [UX4G foundations](https://www.ux4g.gov.in/foundations), [components](https://www.ux4g.gov.in/components), [accessibility guidance](https://www.ux4g.gov.in/foundations/accessibility) and [GIGW guidelines](https://guidelines.india.gov.in/guidelines/) informed the token, form, navigation, contrast and responsive design. These are design targets, not certification claims. The [AICTE approval handbook](https://aicte.gov.in/sites/default/files/APH%20Final.pdf) and [official PIB account of its release](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1983013&lang=2&reg=48) supplied accessible institutional/regulatory context. The requested AICTE homepages timed out or returned 403; APAAR home/about requests also returned 403. No successful visual inspection of those unavailable pages is claimed. Available [APAAR FAQs](https://apaar.education.gov.in/faqs) and privacy/resource search results supplied consent and identity terminology; the user's specified palette supplied the APAAR-inspired colour direction.

## Central tokens

All shared styling is in frontend/app/globals.css.

| Token | Value | Purpose |
|---|---|---|
| --navy-900 | #123B63 | Primary navigation, headings and actions |
| --navy-950 | #0D2F50 | Primary hover |
| --teal-600 | #14786E | Active workspace and academic record accent |
| --teal-dark | #0F615A | Text on pale teal |
| --teal-light | #E8F4F0 | Active navigation and identity surfaces |
| --saffron | #F2A64A | Restrained information-section border |
| --background | #F3F6F8 | Page canvas |
| --surface | #FFFFFF | Main panels |
| --muted-surface | #F8FAFC | Secondary surfaces |
| --slate-900 | #203247 | Primary text |
| --slate-500 | #536778 | Secondary text |
| --slate-200 | #DCE4EA | Structural borders |
| --slate-300 | #8195A5 | Input/control boundaries |
| --success / --warning / --danger | #187347 / #99520C / #B42318 | Text-labelled outcomes |
| --focus | #B65F00 | Visible keyboard outline |

The spacing system uses 4px increments. Shared surfaces generally have 4–6px corners, single-pixel borders and no decorative shadows or gradients. Charts use navy/teal with labelled series and textual value summaries. Status is never conveyed by colour alone.

## Typography and responsiveness

Noto Sans Variable and Noto Sans Devanagari Variable are served locally through Fontsource packages. Sensitive records are never sent to a translation API, and the interface does not require a remote font service at runtime. Page headings are approximately 27–30px, section headings 20px, card headings 17px, body text 14–16px, table cells 13px and metadata generally 12px. Sizes use rem units; utility text-size controls persist the user's selection.

The desktop sidebar is 256px and can be collapsed. At 900px and below it becomes an expandable workspace menu, operable with Enter and dismissible with Escape. Responsive panels stack and wide administrative tables remain deliberate horizontal scroll regions. Reduced-motion and print styles are provided. Public/login/guidance/verification pages support English and Hindi; protected administrative/student workspaces currently use English and do not advertise an ineffective language selector.

## Reusable architecture

- portal.tsx: GovernmentUtilityBar, PortalMasthead, PrototypeBanner, PublicShell, PortalFooter, PageHeader, EvidencePanel and UploadStepper.
- app-shell.tsx: role-based grouped navigation, desktop/mobile sidebar state, breadcrumbs and session controls. Direct access to a workspace outside the role's navigation displays a restriction; backend authorization remains authoritative.
- data-table.tsx and record-table.tsx: semantic captions, column scope, native sorting buttons, aria-sort, optional local pagination and keyboard-focusable scroll regions.
- academic-year-selector.tsx: real academic years from the existing API.
- metric-card.tsx: database counts and supported drill-down links.
- ui/: shared labelled inputs, buttons, cards, status badges and live feedback.
- features/: work queue, institutional forms, report catalogue, academic record card, credential tools, verifier entry and bilingual guidance.
- lib/locale.tsx: local English/Hindi dictionary and text-size preferences. lib/utils.ts preserves the UTC meaning of SQLite timestamps before browser localization.

The existing TanStack Query client, API client, cookie authentication and CSRF mechanism are retained. Additive /workspace read models provide scoped projections, pagination and case-file context. The only additional domain mutation is an authorized, audited assignment of a finding to the reviewing officer. No academic tables, identifier secrets, issuer keys, credential payloads or import contracts were reset or replaced.
