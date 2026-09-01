---
title: Recover from a local-engine problem
description:
  Choose a safe next action when the unreleased macOS development build cannot start or stop its
  local review engine.
status: Unreleased
platforms:
  - macOS
version: Development build
limitations:
  These actions cover the local shell and workspace lifecycle only and do not establish public
  support or packaged-build recovery.
privacy: Restarting the local engine does not send document content to Sangrep or a model provider.
recovery:
  Retry only when offered; after an uncertain stop, quit once the engine has closed before reopening
  any workspace.
contentType: task
expectedResult:
  The window either returns to Workspace Home or preserves a specific failure state without claiming
  an unverified workspace change.
draft: true
pagefind: false
sidebar:
  badge:
    text: Unreleased
    variant: caution
---

Use the exact state shown in the window. Do not infer that a workspace changed while the local
engine was unavailable.

## Respond to startup or crash states

1. If Sangrep shows **Could not start**, read the stated cause and use **Try again** only when it is
   offered.
2. If Sangrep shows **Stopped unexpectedly**, use the safe restart action when available.
3. If the engine is still stopping or could not stop safely, wait for it to close, quit, and reopen
   the development build.
4. Return to **Workspace Home** before opening a workspace.

## Respond to workspace-specific states

| State                     | Safe next action                                                                 |
| ------------------------- | -------------------------------------------------------------------------------- |
| Workspace already open    | Close the other writable session, then retry.                                    |
| Workspace key unavailable | Unlock or restore the matching device credential; do not create a plaintext key. |
| Upgrade required          | Review the stated migration before choosing **Back up and upgrade**.             |
| Recovery available        | Create a separately named recovered workspace and keep the source closed.        |
| Service unavailable       | Retry when offered or restart after the local service is available.              |

If a system selection expired or changed, choose the folder again. For a verified recovery offer,
follow [Recover a separate workspace copy](/recovery/recover-workspace-copy/).
