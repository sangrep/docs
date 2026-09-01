---
title: Recover a separate workspace copy
description:
  Preserve the source workspace while exercising the verified recovery flow in an unreleased macOS
  build.
status: Unreleased
platforms:
  - macOS
version: Development build
limitations:
  Recovery applies only when the development build offers a verified recovery source; it is not a
  general repair or backup guarantee.
privacy:
  Recovery remains local and sends no document content to Sangrep, a model provider, or cloud
  synchronization.
recovery:
  If recovery fails, keep the source closed and retry with the retained recovered-workspace name
  only after the local service is available.
contentType: task
expectedResult:
  Sangrep creates a separately named encrypted workspace and leaves the damaged source unchanged and
  closed.
draft: true
pagefind: false
sidebar:
  badge:
    text: Unreleased
    variant: caution
---

Recovery never overwrites the damaged source. Continue only when Sangrep has inspected the selected
bundle and offers **Recovery available**.

## Create the recovered copy

1. Keep the original workspace closed.
2. Review the recovery source Sangrep has verified.
3. Enter a new workspace name.
4. Choose a writable local APFS parent folder for the recovered copy.
5. Start recovery and wait for Sangrep to confirm the separate encrypted workspace.
6. Confirm that the original remains closed and unchanged before opening the recovered copy.

If recovery fails, the entered name remains available for retry. Do not alter the source bundle or
repeat an uncertain operation outside the offered flow.

For storage and credential prerequisites, read
[Choose local workspace storage](/configuration/local-workspace-storage/).
