# Accessibility verification — 29 October 2026

The final live Brave run completed **33 named page/state scans with zero automated violations** using axe-core 4.14.0 and WCAG 2 A/AA and WCAG 2.1 A/AA tags. Machine evidence, including checks requiring human review, is in ui-accessibility.json. This is not formal WCAG or GIGW certification.

Coverage includes public/home/sign-in/Hindi sign-in, all administrative modules, institutional case sections, intake cohort evidence, cross-institution comparison, student records and wallet, consent preferences, institution uploads, the native credential-revocation dialog, mobile navigation, public guidance, denied verification/Hindi verification and student case files under central and auditor accounts.

Keyboard checks exercised native sorting buttons, password visibility, text-size controls, menu expansion with Enter, Escape dismissal with focus restoration, the native revocation dialog, native disclosure sections and deliberate table scrolling. Text-size controls change the actual root font size and persist locally. UTC timestamps returned without offsets by SQLite retain their UTC meaning before browser localization.

Screenshots were captured at 1440, 1280, 768 and 375 CSS pixels. Every administrative module was checked for page overflow at 375px. Wide tables scroll inside their own labelled regions. A 640px CSS viewport checks the reflow equivalent of 200% zoom on a 1280px display; this does not constitute manual testing of native browser zoom controls. Reduced-motion and print styles are implemented.

Representative computed contrast ratios: primary text/white 13.05:1; secondary text/white 5.87:1; navy/white 11.47:1; dark teal/pale teal 6.47:1; success, warning, error and information badges 5.35–6.08:1; input boundaries/white 3.10:1; focus outline/white 4.54:1. Dark navigation uses a brighter saffron focus outline. See ui-contrast-checks.json.

The first checks found visible-label/accessibility-name mismatches, a language-label association problem, a missing favicon and a chart legend overflowing during viewport changes. These were repaired. Route-readiness assertions were corrected so screenshots and scans examine the intended destination rather than the preceding page. No failing tests were deleted and no E2E API responses were intercepted.

Remaining assessment boundaries: axe flags some short-label and SVG/overlaid-link colour checks as incomplete rather than automatically verifiable. Their details remain in the JSON evidence. Representative colours and actual screens were reviewed; comprehensive screen-reader testing and formal independent accessibility assessment remain outstanding. Hindi is implemented on public, sign-in, guidance and verification routes. Administrative/student workspaces, technical evidence and server error details remain English; protected routes do not display a nonfunctional language selector.
