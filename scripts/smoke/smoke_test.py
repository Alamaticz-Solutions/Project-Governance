#!/usr/bin/env python3
"""
Live smoke test for governance-appfw backend and PostgreSQL audit hash chain.

Verifies:
1. GraphQL endpoint accessibility (createComment mutation).
2. Direct PostgreSQL query to governance.comments_audit verifying audit row creation.
3. GraphQL updateComment mutation.
4. Cryptographic audit hash chain continuity (updateComment.prev_hash == createComment.event_hash).
"""

import json
import subprocess
import sys
import urllib.request

URL = "http://127.0.0.1:8080/governance"


def run_psql(sql):
    cmd = [
        "docker",
        "exec",
        "governance-postgres",
        "psql",
        "-U",
        "governance_svc",
        "-d",
        "governance",
        "-t",
        "-A",
        "-F",
        "|",
        "-c",
        sql,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return [
        line.strip().split("|")
        for line in result.stdout.strip().split("\n")
        if line.strip()
    ]


def post_graphql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        URL, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode("utf-8"))
        return body


def main():
    print("=== Step 1: createComment mutation ===")
    create_mutation = """
    mutation {
      createComment(input: {
        project_id: "a0000000-0000-4000-8000-000000000001",
        author_id: "b0000000-0000-4000-8000-000000000001",
        content: "Live smoke test comment content"
      }) {
        id
        content
        project_id
        author_id
      }
    }
    """

    res1 = post_graphql(create_mutation)
    print("GraphQL createComment response:", json.dumps(res1, indent=2))
    if "errors" in res1 and res1["errors"]:
        print("FAILED: createComment returned errors", res1["errors"])
        sys.exit(1)

    comment_data = res1["data"]["createComment"]
    comment_id = comment_data["id"]
    print(f"Created comment ID: {comment_id}")

    print("\n=== Step 2: Query audit row for create ===")
    rows1 = run_psql(
        f"SELECT audit_id, action, record_id, prev_hash, event_hash "
        f"FROM governance.comments_audit WHERE record_id = '{comment_id}' ORDER BY occurred_at ASC"
    )
    print("Audit rows after create:", rows1)
    assert len(rows1) == 1, f"Expected 1 audit row, got {len(rows1)}"
    (
        create_audit_id,
        create_action,
        create_record_id,
        create_prev_hash,
        create_event_hash,
    ) = rows1[0]
    print(
        f"Create audit: id={create_audit_id}, action={create_action}, "
        f"prev_hash='{create_prev_hash}', event_hash='{create_event_hash}'"
    )
    assert create_event_hash, "event_hash must not be empty"

    print("\n=== Step 3: updateComment mutation ===")
    update_mutation = """
    mutation($input: InputComment!) {
      updateComment(input: $input) {
        id
        content
      }
    }
    """
    update_vars = {
        "input": {
            "id": comment_id,
            "project_id": "a0000000-0000-4000-8000-000000000001",
            "author_id": "b0000000-0000-4000-8000-000000000001",
            "content": "Updated live smoke test comment content",
        }
    }

    res2 = post_graphql(update_mutation, update_vars)
    print("GraphQL updateComment response:", json.dumps(res2, indent=2))
    if "errors" in res2 and res2["errors"]:
        print("FAILED: updateComment returned errors", res2["errors"])
        sys.exit(1)

    print("\n=== Step 4: Verify audit hash chain in comments_audit ===")
    rows2 = run_psql(
        f"SELECT audit_id, action, record_id, prev_hash, event_hash "
        f"FROM governance.comments_audit WHERE record_id = '{comment_id}' ORDER BY occurred_at ASC"
    )
    print(f"Audit rows count: {len(rows2)}")
    for i, r in enumerate(rows2):
        print(f"  Row {i+1}: action={r[1]}, prev_hash='{r[3]}', event_hash='{r[4]}'")

    assert len(rows2) == 2, f"Expected 2 audit rows, got {len(rows2)}"
    (
        update_audit_id,
        update_action,
        update_record_id,
        update_prev_hash,
        update_event_hash,
    ) = rows2[1]

    print("\n--- HASH CHAIN VERIFICATION ---")
    print(f"First row (create) event_hash: {create_event_hash}")
    print(f"Second row (update) prev_hash: {update_prev_hash}")
    assert (
        update_prev_hash == create_event_hash
    ), f"CHAIN BROKEN: update.prev_hash ({update_prev_hash}) != create.event_hash ({create_event_hash})"
    assert update_event_hash, "update event_hash must not be empty"
    assert (
        update_event_hash != create_event_hash
    ), "update event_hash must be distinct from create event_hash"

    print("\n>>> AUDIT HASH CHAIN CONTRACT VERIFIED END-TO-END! <<<")


if __name__ == "__main__":
    main()
