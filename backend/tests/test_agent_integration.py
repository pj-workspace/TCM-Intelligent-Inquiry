"""Agent API 集成测试（需 PostgreSQL）。"""

import pytest


@pytest.mark.integration
def test_agent_patch(client, auth_headers):
    r = client.post(
        "/api/agents",
        json={
            "name": "patch_me",
            "description": "d",
            "system_prompt": "p",
            "tool_names": [],
        },
        headers=auth_headers,
    )
    assert r.status_code == 200
    aid = r.json()["id"]

    ru = client.patch(
        f"/api/agents/{aid}",
        json={"name": "patched_name"},
        headers=auth_headers,
    )
    assert ru.status_code == 200
    assert ru.json()["name"] == "patched_name"

    empty = client.patch(f"/api/agents/{aid}", json={}, headers=auth_headers)
    assert empty.status_code == 422


@pytest.mark.integration
def test_agent_requires_auth(client):
    r = client.get("/api/agents")
    assert r.status_code == 401
