"""MCP API 集成测试（需 PostgreSQL；远端 MCP 用 mock）。"""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.integration
def test_mcp_register_list_delete_roundtrip(client, auth_headers):
    # 使用公网可解析主机名，避免 SSRF 策略拦截；实际连接由 discover_tools mock
    with patch(
        "app.mcp.service.discover_tools",
        new_callable=AsyncMock,
        return_value=["tool_a"],
    ):
        r = client.post(
            "/api/mcp",
            json={
                "name": "mock_srv",
                "url": "http://example.com:59999/mcp",
                "description": "",
                "enabled": True,
            },
            headers=auth_headers,
        )
    assert r.status_code == 200
    body = r.json()
    sid = body["id"]
    assert body["tool_names"] == ["tool_a"]

    listed = client.get("/api/mcp", headers=auth_headers)
    assert listed.status_code == 200
    ids = {x["id"] for x in listed.json()["servers"]}
    assert sid in ids

    r2 = client.delete(f"/api/mcp/{sid}", headers=auth_headers)
    assert r2.status_code == 204

    r3 = client.get(f"/api/mcp/{sid}", headers=auth_headers)
    assert r3.status_code == 404


@pytest.mark.integration
def test_mcp_private_url_rejected(client, auth_headers):
    with patch(
        "app.mcp.service.discover_tools",
        new_callable=AsyncMock,
        return_value=["tool_a"],
    ):
        r = client.post(
            "/api/mcp",
            json={
                "name": "bad",
                "url": "http://127.0.0.1:59999/mcp",
                "description": "",
                "enabled": True,
            },
            headers=auth_headers,
        )
    assert r.status_code == 422


@pytest.mark.integration
def test_mcp_requires_auth(client):
    r = client.get("/api/mcp")
    assert r.status_code == 401
