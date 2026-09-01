---
title: Understand local workspace custody
description:
  See which workspace lifecycle information stays on the device in an unreleased macOS development
  build.
status: Unreleased
platforms:
  - macOS
version: Development build
limitations:
  This page covers workspace lifecycle only, not document import, provider execution, account
  services, diagnostics, or a complete review journey.
privacy:
  Creating, opening, closing, migrating, recovering, and relaunching a workspace sends no document
  content to Sangrep, a model provider, or cloud synchronization.
recovery:
  Keep the original workspace closed when migration or recovery is offered, and follow the
  separate-copy recovery action.
contentType: reference
draft: true
pagefind: false
sidebar:
  badge:
    text: Unreleased
    variant: caution
---

The verified development lifecycle keeps workspace authority on the device.

## What the local workflow stores

- The `.sangrep` bundle contains a small manifest and an encrypted workspace database.
- The matching root secret stays in the operating system credential store, outside the bundle and
  renderer.
- Recent-workspace and checkpoint metadata stays in private application data on the device.
- The system folder picker keeps selected paths outside the renderer.

## What this lifecycle does not send

Creating, opening, closing, migrating, recovering, and relaunching does not send document content to
Sangrep, a model provider, or cloud synchronization. Provider execution, account services,
diagnostics, and document import are outside this guide and receive no implied behavior from it.

## Preserve custody during errors

Do not create plaintext replacement secrets, force open a locked workspace, or overwrite a damaged
source. Use [Recover a separate workspace copy](/recovery/recover-workspace-copy/) when the verified
flow offers recovery.
