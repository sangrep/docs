from __future__ import annotations

import importlib.util
import sys
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
AUDIT_PATH = REPOSITORY_ROOT / "scripts" / "audit-public-hosted-metadata"
sys.path.insert(0, str(REPOSITORY_ROOT / "scripts"))
SPEC = importlib.util.spec_from_loader(
    "hosted_audit_test_module",
    SourceFileLoader("hosted_audit_test_module", str(AUDIT_PATH)),
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("unable to load hosted audit")
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


def scan_review_comment(record: dict[str, object]):
    inventory = {"surfaces": {"pullReviewComments": [record]}}
    return AUDIT.scan_inventory(inventory, [])


class HostedReviewCommentTests(unittest.TestCase):
    def test_policy_diff_hunk_uses_repository_source_boundary(self) -> None:
        runner_root = "/" + "home/runner/work/docs/docs"
        findings = scan_review_comment(
            {
                "path": "scripts/public_boundary_policy.py",
                "body": "Public-safe review comment",
                "diff_hunk": f'+ root = "{runner_root}"',
            }
        )

        self.assertEqual(findings, [])

    def test_review_comment_body_still_rejects_a_local_path(self) -> None:
        developer_path = "/" + "Users/example/private/input.txt"
        findings = scan_review_comment(
            {
                "path": "scripts/public_boundary_policy.py",
                "body": f"Unsafe comment body: {developer_path}",
                "diff_hunk": "+ safe policy context",
            }
        )

        self.assertEqual([finding.category for finding in findings], ["local-absolute-path"])

    def test_non_policy_diff_hunk_still_rejects_a_local_path(self) -> None:
        runner_root = "/" + "home/runner/work/docs/docs"
        findings = scan_review_comment(
            {
                "path": "src/example.py",
                "body": "Public-safe review comment",
                "diff_hunk": f'+ workspace = "{runner_root}"',
            }
        )

        self.assertEqual([finding.category for finding in findings], ["local-absolute-path"])

    def test_policy_diff_hunk_still_rejects_a_secret(self) -> None:
        token = "ghp_" + ("A" * 24)
        findings = scan_review_comment(
            {
                "path": "scripts/public_boundary_policy.py",
                "body": "Public-safe review comment",
                "diff_hunk": f'+ token = "{token}"',
            }
        )

        self.assertEqual([finding.category for finding in findings], ["github-token"])


if __name__ == "__main__":
    unittest.main()
