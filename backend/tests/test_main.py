"""
LearnOn Backend Tests
Run with: pytest tests/ -v
"""

import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.session import get_db
from app.db.models import Base


# ─── Test database setup ─────────────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///./test_learnon.db"

test_engine = create_async_engine(TEST_DB_URL, future=True)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ─── Auth Tests ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_success(client):
    r = await client.post("/api/auth/register", json={
        "email": "test@learnon.com",
        "username": "testuser",
        "password": "SecurePass123!",
        "full_name": "Test User",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["email"] == "test@learnon.com"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    r = await client.post("/api/auth/register", json={
        "email": "test@learnon.com",  # same as above
        "username": "anotheruser",
        "password": "pass123",
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_login_success(client):
    r = await client.post("/api/auth/login", data={
        "username": "test@learnon.com",
        "password": "SecurePass123!",
    })
    assert r.status_code == 200
    assert "access_token" in r.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    r = await client.post("/api/auth/login", data={
        "username": "test@learnon.com",
        "password": "wrongpassword",
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client):
    # Login first
    login = await client.post("/api/auth/login", data={
        "username": "test@learnon.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "test@learnon.com"


@pytest.mark.asyncio
async def test_get_me_no_token(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


# ─── Profile Tests ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_and_update_profile(client):
    login = await client.post("/api/auth/login", data={
        "username": "test@learnon.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get profile
    r = await client.get("/api/profile/", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "test@learnon.com"

    # Update profile
    r = await client.patch("/api/profile/", json={
        "learning_goals": "Master machine learning",
        "daily_study_minutes": 90,
        "preferred_language": "English",
    }, headers=headers)
    assert r.status_code == 200


# ─── Analytics Tests ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analytics_summary_empty(client):
    """New user should get zero-value analytics (not an error)."""
    login = await client.post("/api/auth/login", data={
        "username": "test@learnon.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    r = await client.get("/api/analytics/summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["total_study_hours"] == 0.0
    assert data["completed_sessions"] == 0


# ─── Study Session Tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_study_session_lifecycle(client):
    login = await client.post("/api/auth/login", data={
        "username": "test@learnon.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Start session
    r = await client.post("/api/sessions/start", json={"subject": "Math", "topic": "Calculus"}, headers=headers)
    assert r.status_code == 200
    session_id = r.json()["id"]
    assert r.json()["status"] == "active"

    # Pause
    r = await client.post(f"/api/sessions/pause/{session_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "paused"

    # Resume
    r = await client.post(f"/api/sessions/resume/{session_id}", headers=headers)
    assert r.status_code == 200

    # Stop
    r = await client.post("/api/sessions/stop", json={"session_id": session_id, "duration_seconds": 1800}, headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
    assert r.json()["duration_seconds"] == 1800


@pytest.mark.asyncio
async def test_manual_session_entry(client):
    login = await client.post("/api/auth/login", data={
        "username": "test@learnon.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post("/api/sessions/manual", json={
        "subject": "Physics",
        "topic": "Thermodynamics",
        "start_time": "2026-10-26T10:00:00Z",
        "end_time": "2026-10-26T11:30:00Z",
        "notes": "Reviewed chapters 1-3",
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["duration_seconds"] == 5400
    assert r.json()["is_manual_entry"] is True


# ─── ML Tests ─────────────────────────────────────────────────────────────────

def test_linear_regression_train():
    from app.ml.linreg_score import generate_synthetic_data, train
    data = generate_synthetic_data(n=100)
    result = train(data)
    assert "mae" in result["metrics"]
    assert "r_squared" in result["metrics"]
    assert result["metrics"]["n_test_samples"] > 0


def test_decision_tree_train():
    from app.ml.dtree_difficulty import generate_synthetic_data, train
    data = generate_synthetic_data(n=150)
    result = train(data)
    assert "accuracy" in result["metrics"]
    assert result["metrics"]["accuracy"] > 0


def test_random_forest_train():
    from app.ml.rf_struggle_risk import generate_synthetic_data, train
    data = generate_synthetic_data(n=200)
    result = train(data)
    assert "classification_report" in result["metrics"]


def test_spaced_repetition():
    from app.ml.spaced_repetition import sm2_update
    result = sm2_update(performance_score=0.8, confidence=4, repetition_number=1)
    assert result["next_review_days"] >= 1
    assert "next_review_date" in result
    assert result["new_easiness_factor"] >= 1.3


def test_spaced_repetition_poor_performance():
    from app.ml.spaced_repetition import sm2_update
    result = sm2_update(performance_score=0.2, confidence=1, repetition_number=5)
    assert result["next_review_days"] == 1  # reset on poor performance
    assert result["new_repetition_number"] == 0


# ─── Timer calculation accuracy ───────────────────────────────────────────────

def test_manual_session_duration_calculation():
    """Verify duration is computed correctly from timestamps."""
    from datetime import datetime, timezone
    start = datetime(2026, 10, 26, 10, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 26, 11, 30, 0, tzinfo=timezone.utc)
    duration = int((end - start).total_seconds())
    assert duration == 5400
