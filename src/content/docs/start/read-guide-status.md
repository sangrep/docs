---
title: How to read guide status
description: Check availability metadata before relying on a Sangrep Workbench guide.
status: Released
platforms:
  - Web
version: Documentation foundation
limitations:
  These labels describe documentation eligibility and do not make a product build available.
privacy: Reading status metadata does not send workspace or document content.
recovery:
  If the status, version, or platform does not match your build, return to the documentation
  overview.
contentType: task
expectedResult:
  You can tell whether a guide is eligible for public use without inferring a product release.
draft: false
pagefind: true
---

## Check whether a guide applies

1. Read **Status** first.
2. Confirm **Platform** names the operating system or web surface you are using.
3. Confirm **Version** matches the build or documentation release available to you.
4. Review **Privacy**, **Limitations**, and **Recovery** before following any task steps.
5. Stop when any field does not match. Use only an explicitly Released guide for public product
   behavior.

## Understand the three statuses

| Status     | Meaning                                                                                                   | Public navigation and search |
| ---------- | --------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Released   | The documented behavior passed the acceptance required for the named version and platforms.               | Included                     |
| Preview    | The experience is incomplete or still under design and does not describe behavior in a public build.      | Excluded                     |
| Unreleased | The complete behavior was verified in a development build but has not passed packaged-release acceptance. | Excluded                     |

Preview and Unreleased source remains reviewable by maintainers. Production builds omit the pages,
their routes, and their search entries.

## Avoid accidental claims

A design, synthetic fixture, screenshot, development build, or successful test is evidence about
that exact artifact only. It is not evidence of a public installer, supported platform, supported
format, or product release.
