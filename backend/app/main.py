import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.db import pool, get_connection
from app.schemas import TelemetryIn


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


@app.post("/api/telemetry", status_code=201)
def receive_telemetry(data: TelemetryIn):
    """Receive one data point from a machine and store it."""
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

            job_id = None
            if data.job_number:
                cur.execute(
                    "SELECT id FROM production_jobs WHERE job_number = %s",
                    (data.job_number,),
                )
                row = cur.fetchone()
                job_id = row["id"] if row else None

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

            write_ingest_log(cur, "/api/telemetry", payload, True, None)
            conn.commit()

    return {"telemetry_id": telemetry_id, "machine_id": data.machine_id}