# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this repository, please do **not** open a public issue. Instead, please report it privately to the repository maintainer.

**Contact:** alert@lcvmail.com

Please include:
- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (if you have one)

We will acknowledge your report within 24 hours and work to resolve the issue promptly.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅ |
| Previous releases | ⚠️ Security updates only |

## Security Measures

This repository employs:
- **Code Scanning (CodeQL)**: Automated static analysis on all commits
- **Dependency Scanning (Dependabot)**: Automated dependency vulnerability detection
- **Secret Scanning**: Detection and remediation of exposed secrets
- **Branch Protection**: Required status checks before merge to main

## Best Practices

- Keep dependencies up-to-date
- Use strong authentication (SSH keys, personal access tokens)
- Review pull requests carefully before merge
- Report any suspicious activity immediately

## Architectural Decision — Content Protection: Attribution over Blocking

The frontend (`mainsite-frontend`) **does not** install hostile content-protection layers (no `contextmenu`/`selectstart` blocking, no Ctrl+C/Ctrl+S/F12/PrintScreen interceptors, no DevTools detection, no `window.blur` screen blur, no `user-select: none` global CSS, no `@media print` block).

Earlier versions (v03.06.01, v03.06.02) had these hostile layers; they were **deliberately removed** in subsequent releases (CHANGELOG entries for `v03.13.x` and surrounding) for two reasons:
1. They did not actually prevent capture (PrintScreen happens at OS level before JS sees it; DevTools detection is bypassable; copy-blockers break legitimate flows like share-by-email).
2. They degraded accessibility — screen readers, keyboard navigation, and assistive tech were impacted by `user-select: none` and synthetic key interception.

The replacement layer is **attribution-based**: a single document-level `copy` listener in `App.tsx` rewrites the clipboard payload to append the canonical source URL, so any text quoted elsewhere carries provenance.

**Operational rule:** any future PR that proposes reintroducing hostile blocking layers should be rejected unless it provides empirical evidence that the layer actually blocks capture without compromising accessibility — a bar the previous attempts did not clear. Audit findings flagging the layer as "missing" should be resolved by pointing at this section, not by reintroducing the layer.
