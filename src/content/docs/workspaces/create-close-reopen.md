---
title: Create, close, and reopen a local workspace
description:
  Exercise the verified encrypted-workspace lifecycle in an unreleased macOS development build.
status: Unreleased
platforms:
  - macOS
version: Development build
limitations:
  This guide does not establish a public installer, Windows acceptance, document import, a complete
  review journey, provider execution, or support.
privacy:
  Workspace lifecycle operations keep workspace and document content on this device and make no
  model-provider or cloud-synchronization request.
recovery:
  Never overwrite a damaged source; use the reviewed flow to create a separate recovered workspace
  from verified recovery material.
contentType: task
expectedResult:
  Workspace Home shows the closed workspace with its latest validated checkpoint, and a later
  Continue action opens that exact workspace.
technicalReference: https://github.com/sangrep/contracts/tree/master/docs
draft: true
pagefind: false
sidebar:
  badge:
    text: Unreleased
    variant: caution
---

Sangrep keeps each workspace authoritative on this device. In the verified development flow, you can
create an encrypted workspace, close it with a checkpoint, reopen it from **Workspace Home**, or
choose an existing `.sangrep` bundle through the system folder picker.

## Before you begin

- Wait for the local review engine to start and **Workspace Home** to appear.
- Choose a writable local APFS folder.
- Keep the operating system credential store available and unlocked.
- Sign-in is not required for this unreleased lifecycle.

## Create a workspace

1. On **Workspace Home**, choose **New workspace**.
2. Enter a name. Sangrep adds the `.sangrep` suffix when needed.
3. Choose **Choose location and create**, then select the parent folder in the system picker.
4. Wait for the workspace screen to show **Encrypted local workspace** and its latest **Created
   checkpoint**.

The system picker keeps the selected path outside the renderer. If you cancel or creation fails, the
entered name remains available for a safe retry.

If Sangrep cannot prove whether the new bundle was published, it does not repeat the create. Use
**Open existing** to inspect that exact target before trying to create it again.

## Close before leaving

1. Choose **Close workspace**.
2. Wait while the local service saves a **Close checkpoint** and releases the writable session.
3. Confirm that Sangrep returns to **Workspace Home** and shows the latest safe checkpoint.

If the checkpoint was not saved, the workspace remains open. If the checkpoint was saved but the
handle and lock were not both confirmed closed, quit before reopening that workspace.

## Continue after relaunch

1. Quit and reopen the development build.
2. Wait for Workspace Home to read the private recent-workspace index; no workspace opens during
   that step.
3. Choose **Continue _workspace name_** for the exact recent workspace.
4. Use **Open existing** if the workspace is absent from Recents or its folder moved.

The selected bundle is inspected before Sangrep offers an ordinary open, a reviewed migration, or a
separate recovery action.

For storage prerequisites, see
[Choose local workspace storage](/configuration/local-workspace-storage/). For recovery, see
[Recover a separate workspace copy](/recovery/recover-workspace-copy/). For startup failures, see
[Recover from a local-engine problem](/troubleshooting/local-engine/).

Technical schema and interoperability details belong in the
[canonical contracts reference](https://github.com/sangrep/contracts/tree/master/docs); this product
guide does not restate them.
