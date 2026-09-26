"""Kiểm thử liveness/readiness bằng hạ tầng cô lập, không kết nối dịch vụ thật."""


def test_health_reports_service_identity(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"]


def test_readiness_checks_database_and_storage(client, db, monkeypatch, tmp_path):
    from app.shared.database import engine as database
    from app.shared.config import settings

    # Readiness import engine tại thời điểm xử lý request; thay bằng SQLite fixture
    # để kiểm tra đúng contract mà không chạm SQL Server thật.
    monkeypatch.setattr(database, "engine", db.get_bind())
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
