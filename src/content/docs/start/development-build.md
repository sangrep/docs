---
title: Open the development desktop build
description:
  Recognize the local application shell and review-engine states in an unreleased macOS build.
status: Unreleased
platforms:
  - macOS
version: Development build
limitations:
  This unsigned or development-signed build is not a public installer or a complete review product.
privacy:
  Starting and stopping the local shell does not read a source document or send document content to
  Sangrep or a model provider.
recovery:
  Use Try again only when offered; otherwise quit after the local review engine has stopped and
  reopen the build.
contentType: task
expectedResult:
  The development window reaches Workspace Home or shows a specific local-engine failure with a safe
  next action.
draft: true
pagefind: false
sidebar:
  badge:
    text: Unreleased
    variant: caution
---

This guide is reviewable for development verification. It is excluded from public navigation,
routes, and search.

## Start the local shell

1. Open the macOS development build.
2. Wait while Sangrep prepares the local review engine on the same device.
3. Continue only when **Workspace Home** appears or the window gives a specific failure state.
4. If **Try again** is available, use it once the local engine can safely restart.

## Recognize the visible states

| State                | What it means                                                                          |
| -------------------- | -------------------------------------------------------------------------------------- |
| Starting             | The local review engine is preparing. No file-change claim is made.                    |
| Ready                | Workspace Home can read the private local recent-workspace index.                      |
| Could not start      | Startup failed and the screen explains whether retrying is safe.                       |
| Stopped unexpectedly | The engine ended after startup and the screen distinguishes that from startup failure. |

Closing the window or quitting asks the local engine to shut down before the application exits. If
Sangrep cannot confirm a safe stop, follow the on-screen action instead of assuming a clean
shutdown.

For workspace creation and reopening in this same development boundary, use
[Create, close, and reopen a local workspace](/workspaces/create-close-reopen/).
