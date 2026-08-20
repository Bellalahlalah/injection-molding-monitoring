import json
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import OFFLINE_THRESHOLD_SECONDS
from app.db import pool, get_connection
from app.schemas import TelemetryIn, AlarmIn, AlarmClearIn


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(
    title="Injection Molding Monitoring API",
    description="Prototype backend for real-time production monitoring",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def write_ingest_log(cur, endpoint: str, payload: dict, is_valid: bool, error: str | None):
    cur.execute(
        """
        INSERT INTO ingest_log (endpoint, payload, is_valid, error_message)
        VALUES (%s, %s, %s, %s)
        """,
        (endpoint, json.dumps(payload, default=str), is_valid, error),
    )


@app.get("/api/health")
def health_check():
    """Check that the API and the database are both alive."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            cur.fetchone()
    return {"status": "ok"}


@app.get("/api/machines")
def list_machines():
    """Return all active machines. The simulator calls this to know what to simulate."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT machine_id, machine_name, brand, tonnage, ideal_cycle_time_s
                FROM machines
                WHERE is_active = TRUE
                ORDER BY machine_id
                """
            )
            return cur.fetchall()


def get_active_job_id(cur, machine_id: str) -> int | None:
    cur.execute(
        "SELECT id FROM production_jobs WHERE machine_id = %s AND status = 'RUNNING'",
        (machine_id,),
    )
    row = cur.fetchone()
    return row["id"] if row else None


@app.post("/api/telemetry", status_code=201)
def receive_telemetry(data: TelemetryIn):
    """Receive one data point from a machine, store it, and update job counters."""
    payload = data.model_dump()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT machine_id FROM machines WHERE machine_id = %s AND is_active = TRUE",
                (data.machine_id,),
            )
            if cur.fetchone() is None:
                error = f"Unknown or inactive machine: {data.machine_id}"
                write_ingest_log(cur, "/api/telemetry", payload, False, error)
                conn.commit()
                raise HTTPException(status_code=404, detail=error)

            job_id = get_active_job_id(cur, data.machine_id)

            cur.execute(
                """
                INSERT INTO machine_telemetry
                    (machine_id, job_id, recorded_at, status,
                     cycle_time_s, shot_count, injection_bar, barrel_temp_c)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    data.machine_id,
                    job_id,
                    data.recorded_at,
                    data.status,
                    data.cycle_time_s,
                    data.shot_count,
                    data.injection_bar,
                    data.barrel_temp_c,
                ),
            )
            telemetry_id = cur.fetchone()["id"]

            if job_id is not None and (data.good_increment or data.reject_increment):
                cur.execute(
                    """
                    UPDATE production_jobs
                    SET good_qty = good_qty + %s,
                        reject_qty = reject_qty + %s
                    WHERE id = %s
                    """,
                    (data.good_increment, data.reject_increment, job_id),
                )

            write_ingest_log(cur, "/api/telemetry", payload, True, None)
            conn.commit()

    return {
        "telemetry_id": telemetry_id,
        "machine_id": data.machine_id,
        "job_id": job_id,
    }

@app.post("/api/alarms", status_code=201)
def raise_alarm(data: AlarmIn):
    """Record an alarm. Repeating an already-active alarm code is ignored."""
    payload = data.model_dump()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT machine_id FROM machines WHERE machine_id = %s AND is_active = TRUE",
                (data.machine_id,),
            )
            if cur.fetchone() is None:
                error = f"Unknown or inactive machine: {data.machine_id}"
                write_ingest_log(cur, "/api/alarms", payload, False, error)
                conn.commit()
                raise HTTPException(status_code=404, detail=error)

            cur.execute(
                """
                SELECT id FROM alarms
                WHERE machine_id = %s AND alarm_code = %s AND cleared_at IS NULL
                """,
                (data.machine_id, data.alarm_code),
            )
            existing = cur.fetchone()
            if existing is not None:
                write_ingest_log(
                    cur, "/api/alarms", payload, True, "duplicate active alarm ignored"
                )
                conn.commit()
                return {"alarm_id": existing["id"], "duplicate": True}

            job_id = get_active_job_id(cur, data.machine_id)

            cur.execute(
                """
                INSERT INTO alarms
                    (machine_id, job_id, alarm_code, alarm_message, severity, occurred_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    data.machine_id,
                    job_id,
                    data.alarm_code,
                    data.alarm_message,
                    data.severity,
                    data.occurred_at,
                ),
            )
            alarm_id = cur.fetchone()["id"]

            write_ingest_log(cur, "/api/alarms", payload, True, None)
            conn.commit()

    return {"alarm_id": alarm_id, "duplicate": False}


@app.post("/api/alarms/clear")
def clear_alarms(data: AlarmClearIn):
    """Mark active alarms on a machine as cleared."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            if data.alarm_code:
                cur.execute(
                    """
                    UPDATE alarms SET cleared_at = %s
                    WHERE machine_id = %s AND alarm_code = %s AND cleared_at IS NULL
                    RETURNING id
                    """,
                    (data.cleared_at, data.machine_id, data.alarm_code),
                )
            else:
                cur.execute(
                    """
                    UPDATE alarms SET cleared_at = %s
                    WHERE machine_id = %s AND cleared_at IS NULL
                    RETURNING id
                    """,
                    (data.cleared_at, data.machine_id),
                )
            cleared = cur.fetchall()
            conn.commit()

    return {"cleared_count": len(cleared)}


@app.get("/api/machines/live")
def list_live_machines():
    """Return the latest known state of every active machine, for the dashboard."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH latest_telemetry AS (
                    SELECT DISTINCT ON (machine_id)
                        machine_id, recorded_at, received_at, status,
                        cycle_time_s, shot_count, injection_bar, barrel_temp_c
                    FROM machine_telemetry
                    ORDER BY machine_id, recorded_at DESC
                ),
                active_job AS (
                    SELECT DISTINCT ON (pj.machine_id)
                        pj.machine_id, pj.job_number, pj.mold_id, pj.recipe_id,
                        pj.good_qty, pj.reject_qty, pj.product_code
                    FROM production_jobs pj
                    WHERE pj.status = 'RUNNING'
                    ORDER BY pj.machine_id, pj.started_at DESC
                ),
                active_alarm AS (
                    SELECT DISTINCT ON (machine_id)
                        machine_id, alarm_code, alarm_message, occurred_at
                    FROM alarms
                    WHERE cleared_at IS NULL
                    ORDER BY machine_id, occurred_at DESC
                )
                SELECT
                    m.machine_id, m.machine_name, m.brand, m.tonnage, m.ideal_cycle_time_s,
                    lt.status, lt.cycle_time_s, lt.shot_count, lt.injection_bar, lt.barrel_temp_c,
                    lt.recorded_at, lt.received_at,
                    aj.job_number, aj.product_code, aj.mold_id, aj.recipe_id,
                    aj.good_qty, aj.reject_qty,
                    aa.alarm_code AS active_alarm_code,
                    aa.alarm_message AS active_alarm_message,
                    aa.occurred_at AS active_alarm_at
                FROM machines m
                LEFT JOIN latest_telemetry lt ON lt.machine_id = m.machine_id
                LEFT JOIN active_job aj ON aj.machine_id = m.machine_id
                LEFT JOIN active_alarm aa ON aa.machine_id = m.machine_id
                WHERE m.is_active = TRUE
                ORDER BY m.machine_id
                """
            )
            machines = cur.fetchall()

    now = datetime.now(timezone.utc)
    for machine in machines:
        received_at = machine["received_at"]
        if received_at is None:
            machine["seconds_since_update"] = None
            machine["status"] = "OFFLINE"
        else:
            seconds_since_update = (now - received_at).total_seconds()
            machine["seconds_since_update"] = seconds_since_update
            if seconds_since_update > OFFLINE_THRESHOLD_SECONDS:
                machine["status"] = "OFFLINE"

    return machines


@app.get("/api/machines/{machine_id}/history")
def get_machine_history(
    machine_id: str,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    limit: int = Query(500, ge=1, le=5000),
):
    """Return telemetry readings for one machine within a time range (default: last 24h)."""
    to_time = to_time or datetime.now(timezone.utc)
    from_time = from_time or (to_time - timedelta(hours=24))

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT recorded_at, status, cycle_time_s, shot_count, injection_bar, barrel_temp_c
                FROM machine_telemetry
                WHERE machine_id = %s AND recorded_at >= %s AND recorded_at <= %s
                ORDER BY recorded_at ASC
                LIMIT %s
                """,
                (machine_id, from_time, to_time, limit),
            )
            return cur.fetchall()


@app.get("/api/machines/{machine_id}/alarms")
def get_machine_alarms(
    machine_id: str,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    limit: int = Query(200, ge=1),
):
    """Return alarm history for one machine, including each alarm's duration."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    alarm_code, alarm_message, severity, occurred_at, cleared_at,
                    EXTRACT(EPOCH FROM (COALESCE(cleared_at, NOW()) - occurred_at)) AS duration_seconds
                FROM alarms
                WHERE machine_id = %s
                    AND (%s::timestamptz IS NULL OR occurred_at >= %s)
                    AND (%s::timestamptz IS NULL OR occurred_at <= %s)
                ORDER BY occurred_at DESC
                LIMIT %s
                """,
                (machine_id, from_time, from_time, to_time, to_time, limit),
            )
            return cur.fetchall()


@app.get("/api/jobs/search")
def search_jobs(job_number: str):
    """Search production jobs by partial, case-insensitive job number match."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    pj.id, pj.job_number, pj.machine_id, m.machine_name,
                    pj.product_code, p.product_name,
                    pj.mold_id, pj.recipe_id, pj.planned_qty,
                    pj.good_qty, pj.reject_qty, pj.status,
                    pj.started_at, pj.ended_at
                FROM production_jobs pj
                LEFT JOIN machines m ON m.machine_id = pj.machine_id
                LEFT JOIN products p ON p.product_code = pj.product_code
                WHERE pj.job_number ILIKE %s
                ORDER BY pj.started_at DESC
                """,
                (f"%{job_number}%",),
            )
            jobs = cur.fetchall()

            if not jobs:
                return []

            job_ids = [job["id"] for job in jobs]
            cur.execute(
                """
                SELECT job_id, alarm_code, alarm_message, severity, occurred_at, cleared_at
                FROM alarms
                WHERE job_id = ANY(%s)
                ORDER BY occurred_at ASC
                """,
                (job_ids,),
            )
            alarms_by_job: dict[int, list] = {}
            for alarm in cur.fetchall():
                job_id = alarm.pop("job_id")
                alarms_by_job.setdefault(job_id, []).append(alarm)

            for job in jobs:
                job["alarms"] = alarms_by_job.get(job.pop("id"), [])

    return jobs


@app.get("/api/alarms/active")
def list_active_alarms():
    """Return all currently active (uncleared) alarms across every machine."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.machine_id, m.machine_name, a.alarm_code, a.alarm_message,
                       a.severity, a.occurred_at
                FROM alarms a
                LEFT JOIN machines m ON m.machine_id = a.machine_id
                WHERE a.cleared_at IS NULL
                ORDER BY a.occurred_at DESC
                """
            )
            return cur.fetchall()