from __future__ import annotations

import gzip
import tempfile
import unittest
from pathlib import Path

from scripts.public_boundary_policy import (
    generated_output_paths,
    scan_bytes,
    scan_github_actions_log_bytes,
    scan_path,
)


class PagefindBoundaryTests(unittest.TestCase):
    def test_accepts_valid_compressed_pagefind_fragment(self) -> None:
        payload = gzip.compress(
            b'pagefind_dcd{"url":"/","content":"Released guidance"}',
            mtime=0,
        )

        self.assertEqual(
            scan_bytes(payload, source="generated", suffix=".pf_fragment"),
            [],
        )

    def test_scans_decompressed_pagefind_text_for_secrets(self) -> None:
        token = b"ghp_" + (b"A" * 24)
        payload = gzip.compress(b'pagefind_dcd{"content":"' + token + b'"}', mtime=0)

        findings = scan_bytes(payload, source="generated", suffix=".pf_fragment")

        self.assertEqual([finding.category for finding in findings], ["github-token"])

    def test_rejects_invalid_pagefind_compression_or_signature(self) -> None:
        invalid_gzip = scan_bytes(b"not gzip", source="generated", suffix=".pf_index")
        invalid_signature = scan_bytes(
            gzip.compress(b"not-pagefind", mtime=0),
            source="generated",
            suffix=".pf_meta",
        )

        self.assertEqual(
            [finding.category for finding in invalid_gzip],
            ["invalid-generated-search"],
        )
        self.assertEqual(
            [finding.category for finding in invalid_signature],
            ["invalid-generated-search"],
        )

    def test_accepts_pagefind_wasm_only_with_wasm_signature(self) -> None:
        valid = gzip.compress(b"pagefind_dcd\x00asm\x01\x00\x00\x00", mtime=0)
        invalid = gzip.compress(b"pagefind_dcdnot-wasm", mtime=0)

        self.assertEqual(scan_bytes(valid, source="generated", suffix=".pagefind"), [])
        self.assertEqual(
            [
                finding.category
                for finding in scan_bytes(
                    invalid,
                    source="generated",
                    suffix=".pagefind",
                )
            ],
            ["invalid-generated-search"],
        )

    def test_allows_only_public_runner_rust_paths_in_pagefind_wasm(self) -> None:
        public_runner_path = (
            b"/"
            b"Users/runner/.cargo/registry/src/"
            b"index.crates.io-1949cf8c6b5b557f/minicbor-2.2.1/src/decode/decoder.rs"
        )
        private_path = b"/" + b"Users/example/private-workspace/source.rs"
        public_payload = gzip.compress(
            b"pagefind_dcd\x00asm\x01\x00\x00\x00" + public_runner_path,
            mtime=0,
        )
        private_payload = gzip.compress(
            b"pagefind_dcd\x00asm\x01\x00\x00\x00" + private_path,
            mtime=0,
        )

        self.assertEqual(
            scan_bytes(public_payload, source="generated", suffix=".pagefind"),
            [],
        )
        self.assertEqual(
            [
                finding.category
                for finding in scan_bytes(
                    private_payload,
                    source="generated",
                    suffix=".pagefind",
                )
            ],
            ["local-absolute-path"],
        )


class GitHubActionsLogBoundaryTests(unittest.TestCase):
    def test_normalizes_only_public_runner_roots_for_this_repository(self) -> None:
        runner_home = b"/" + b"home/runner"
        payload = b"\n".join(
            (
                runner_home + b"/work/docs/docs/src/content/docs/index.mdx",
                b"Checking files in " + runner_home + b"/work/docs/docs...",
                runner_home + b"/work/_temp/runner-script.sh",
                runner_home + b"/.npm/_logs/install.log",
            )
        )

        self.assertEqual(
            scan_github_actions_log_bytes(
                payload,
                source="workflow-log",
                repository_name="docs",
            ),
            [],
        )

    def test_rejects_other_runner_and_developer_paths(self) -> None:
        runner_home = b"/" + b"home/runner"
        payloads = (
            runner_home + b"/private-workspace/input.txt",
            runner_home + b"/work/other/other/input.txt",
            runner_home + b"/work/docs/docs.../private/input.txt",
            b"/" + b"Users/example/private-workspace/input.txt",
        )

        for payload in payloads:
            with self.subTest(payload=payload):
                findings = scan_github_actions_log_bytes(
                    payload,
                    source="workflow-log",
                    repository_name="docs",
                )
                self.assertEqual(
                    [finding.category for finding in findings],
                    ["local-absolute-path"],
                )

    def test_preserves_secret_scanning_after_runner_root_normalization(self) -> None:
        token = b"ghp_" + (b"A" * 24)
        runner_workspace = b"/" + b"home/runner/work/docs/docs/"
        findings = scan_github_actions_log_bytes(
            runner_workspace + token,
            source="workflow-log",
            repository_name="docs",
        )

        self.assertEqual([finding.category for finding in findings], ["github-token"])

    def test_rejects_an_invalid_repository_name(self) -> None:
        findings = scan_github_actions_log_bytes(
            b"safe log",
            source="workflow-log",
            repository_name="../docs",
        )

        self.assertEqual([finding.category for finding in findings], ["invalid-repository-name"])


class GeneratedOutputBoundaryTests(unittest.TestCase):
    def test_scans_private_paths_in_ignored_wrangler_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            private_path = "/" + "Users/example/private/input.txt"
            expected_paths = (
                ".wrangler/state/metadata.txt",
                "output/wrangler-preview/metadata.txt",
            )
            for relative_path in expected_paths:
                candidate = root / relative_path
                candidate.parent.mkdir(parents=True, exist_ok=True)
                candidate.write_text(private_path, encoding="utf-8")

            inventoried = generated_output_paths(root)

            self.assertEqual(inventoried, expected_paths)
            for relative_path in inventoried:
                findings = scan_path(root / relative_path, source=f"generated:{relative_path}")
                self.assertEqual(
                    [finding.category for finding in findings],
                    ["local-absolute-path"],
                )


if __name__ == "__main__":
    unittest.main()
