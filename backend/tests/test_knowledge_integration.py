"""知识库 API 集成测试（需 PostgreSQL；不调用向量/嵌入）。"""

import uuid

import pytest


@pytest.mark.integration
def test_create_list_get_kb(client, auth_headers):
    name = f"kb_{uuid.uuid4().hex[:8]}"
    r = client.post(
        "/api/knowledge",
        json={"name": name, "description": "test"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    kb_id = data["id"]
    assert data["name"] == name

    listed = client.get("/api/knowledge", headers=auth_headers)
    assert listed.status_code == 200
    ids = {x["id"] for x in listed.json()["knowledge_bases"]}
    assert kb_id in ids

    one = client.get(f"/api/knowledge/{kb_id}", headers=auth_headers)
    assert one.status_code == 200
    assert one.json()["id"] == kb_id


@pytest.mark.integration
def test_knowledge_requires_auth(client):
    r = client.get("/api/knowledge")
    assert r.status_code == 401


@pytest.mark.integration
def test_knowledge_requires_api_key_when_configured(client, auth_headers, monkeypatch):
    monkeypatch.setenv("API_KEY", "integration-test-key")
    r = client.get("/api/knowledge", headers=auth_headers)
    assert r.status_code == 401

    r2 = client.get(
        "/api/knowledge",
        headers={**auth_headers, "X-API-Key": "integration-test-key"},
    )
    assert r2.status_code == 200
