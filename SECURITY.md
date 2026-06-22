# Security Policy

The Twilio Voice React Native Reference Components project takes security
seriously. We appreciate the work of security researchers and the broader
community in helping keep this project and its users safe.

This repository contains **reference/sample code** intended to demonstrate how
to build Twilio Voice use cases. It is meant to be run locally during
development and is not a hardened, production-ready service out-of-the-box. See
[Scope](#scope) for what does and does not belong in a report here.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
pull requests, or discussions.** Public disclosure before a fix is available
puts users at risk.

Twilio operates a coordinated Vulnerability Disclosure Program (VDP). Report
any suspected vulnerability (in this repository or in any Twilio product or
service) through Twilio's official channel:

https://www.twilio.com/en-us/security/vulnerability-disclosure-program

Reporting through this channel ensures your submission reaches Twilio's
Product Security team and is triaged through an established process.

### What to include

To help us validate and resolve the issue quickly, please include as much of
the following as you can:

- The type of issue and the component or file affected.
- Step-by-step instructions to reproduce the issue.
- A proof of concept or exploit code, where possible.
- The potential impact, including how an attacker might exploit it.
- Any relevant configuration, versions, or environment details.

Clear, detailed reports allow us to reproduce and address issues faster.

## What to expect

After you submit a report through Twilio's VDP, Twilio will:

1. Acknowledge receipt of your report.
2. Investigate and validate the issue, working with you for any additional
   detail needed.
3. Determine severity and the appropriate remediation, and address the issue
   in accordance with security priorities.
4. Keep your report confidential and treat your contribution with respect.

Specific response and remediation timelines are governed by Twilio's
Vulnerability Disclosure Program rather than this repository.

## Coordinated disclosure

We follow a coordinated (responsible) disclosure model. We ask that you:

- Give us a reasonable amount of time to investigate and remediate an issue
  before any public disclosure.
- Do not publicly disclose a vulnerability until Twilio has confirmed it is
  resolved.
- Make a good-faith effort to avoid privacy violations, data destruction, and
  interruption or degradation of any service during your research.
- Only test against your own resources. Do not access, modify, or exfiltrate
  data that does not belong to you.

In return, Twilio commits to handling your report confidentially and
professionally, and to recognizing your contribution.

## Scope

Because this is sample code, the following help set expectations for what is
useful to report here:

- **In scope:** vulnerabilities in the reference component code in this
  repository, for example flaws in the example server (`server.ts`),
  request/signature validation, the reference components under
  `reference-components/`, or insecure patterns the samples might lead a
  developer to copy into production.
- **Out of scope / by design:** this project is intended to run locally and be
  exposed through an HTTPS tunnel (for example, ngrok) for development only. It
  is not configured for production deployment. Secrets, API keys, and tokens
  are supplied by you via local configuration (see `secrets.example.env`) and
  are never committed to this repository.
- **Twilio products and services:** vulnerabilities in Twilio's own products,
  APIs, or infrastructure (rather than in this sample code) should also be
  reported through the Vulnerability Disclosure Program.

When in doubt, report it. Twilio's Product Security team will triage and route
it appropriately.

## Conduct

Security research and disclosure under this policy is also governed by our
[Code of Conduct](./CODE_OF_CONDUCT.md). Please conduct your testing
respectfully and lawfully.
