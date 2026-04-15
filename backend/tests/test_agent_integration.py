"""Agent API 集成测试（需 PostgreSQL）。"""

import pytest


@pytest.mark.integration
def test_agent_patch(client):
    r = client.post(
        "/api/agents",
        json={
            "name": "patch_me",
            "description": "d",
            "system_prompt": "p",
            "tool_names": [],
        },
    )
    assert r.status_code == 200
    aid = r.json()["id"]

    ru = client.patch(f"/api/agents/{aid}", json={"name": "patched_name"})
    assert ru.status_code == 200
    assert ru.json()["name"] == "patched_name"

    empty = client.patch(f"/api/agents/{aid}", json={})
    assert empty.status_code == 422
