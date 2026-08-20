-- Injection Molding Production Monitoring - Database Schema
-- PostgreSQL 15+

-- ========== Master Data ==========

CREATE TABLE machines (
    machine_id          TEXT PRIMARY KEY,
    machine_name        TEXT NOT NULL,
    brand               TEXT,
    tonnage             INTEGER,
    ideal_cycle_time_s  NUMERIC(6,2) NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    product_code        TEXT PRIMARY KEY,
    product_name        TEXT NOT NULL,
    material            TEXT
);

CREATE TABLE molds (
    mold_id             TEXT PRIMARY KEY,
    mold_name           TEXT NOT NULL,
    product_code        TEXT REFERENCES products(product_code),
    cavity_count        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE recipes (
    recipe_id               TEXT PRIMARY KEY,
    recipe_name             TEXT NOT NULL,
    mold_id                 TEXT REFERENCES molds(mold_id),
    target_barrel_temp_c    NUMERIC(6,2),
    target_injection_bar    NUMERIC(8,2),
    target_cycle_time_s     NUMERIC(6,2)
);

-- ========== Transaction Data ==========

CREATE TABLE production_jobs (
    id              BIGSERIAL PRIMARY KEY,
    job_number      TEXT UNIQUE NOT NULL,
    machine_id      TEXT NOT NULL REFERENCES machines(machine_id),
    product_code    TEXT REFERENCES products(product_code),
    mold_id         TEXT REFERENCES molds(mold_id),
    recipe_id       TEXT REFERENCES recipes(recipe_id),
    planned_qty     INTEGER,
    good_qty        INTEGER NOT NULL DEFAULT 0,
    reject_qty      INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'RUNNING',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

CREATE TABLE machine_telemetry (
    id                  BIGSERIAL PRIMARY KEY,
    machine_id          TEXT NOT NULL REFERENCES machines(machine_id),
    job_id              BIGINT REFERENCES production_jobs(id),
    recorded_at         TIMESTAMPTZ NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT NOT NULL,
    cycle_time_s        NUMERIC(6,2),
    shot_count          INTEGER,
    injection_bar       NUMERIC(8,2),
    barrel_temp_c       NUMERIC(6,2),
    CONSTRAINT chk_status CHECK (status IN ('RUN','STOP','ALARM'))
);

CREATE TABLE alarms (
    id              BIGSERIAL PRIMARY KEY,
    machine_id      TEXT NOT NULL REFERENCES machines(machine_id),
    job_id          BIGINT REFERENCES production_jobs(id),
    alarm_code      TEXT NOT NULL,
    alarm_message   TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'WARNING',
    occurred_at     TIMESTAMPTZ NOT NULL,
    cleared_at      TIMESTAMPTZ
);

CREATE TABLE ingest_log (
    id              BIGSERIAL PRIMARY KEY,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    endpoint        TEXT NOT NULL,
    payload         JSONB,
    is_valid        BOOLEAN NOT NULL,
    error_message   TEXT
);

-- ========== Indexes ==========

CREATE INDEX idx_telemetry_machine_time ON machine_telemetry (machine_id, recorded_at DESC);
CREATE INDEX idx_alarms_machine_time    ON alarms (machine_id, occurred_at DESC);
CREATE INDEX idx_alarms_active          ON alarms (machine_id) WHERE cleared_at IS NULL;
CREATE INDEX idx_jobs_machine           ON production_jobs (machine_id, started_at DESC);

-- ========== Seed Data ==========

INSERT INTO products (product_code, product_name, material) VALUES
('PVC-PIPE-20', 'PVC Pipe 20mm',    'PVC'),
('PVC-JNT-20',  'PVC Joint 20mm',   'PVC'),
('PVC-CAP-25',  'PVC End Cap 25mm', 'PVC');

INSERT INTO molds (mold_id, mold_name, product_code, cavity_count) VALUES
('MD-1001', 'Pipe Mold 20mm',  'PVC-PIPE-20', 2),
('MD-1002', 'Joint Mold 20mm', 'PVC-JNT-20',  4),
('MD-1003', 'Cap Mold 25mm',   'PVC-CAP-25',  8);

INSERT INTO recipes (recipe_id, recipe_name, mold_id, target_barrel_temp_c, target_injection_bar, target_cycle_time_s) VALUES
('RC-A01', 'Pipe Standard',  'MD-1001', 190.0, 850.0, 22.0),
('RC-B01', 'Joint Standard', 'MD-1002', 195.0, 900.0, 18.0),
('RC-C01', 'Cap Fast Cycle', 'MD-1003', 185.0, 780.0, 12.0);

INSERT INTO machines (machine_id, machine_name, brand, tonnage, ideal_cycle_time_s) VALUES
('INJ-01', 'Injection Line 1', 'Haitian',  150, 22.0),
('INJ-02', 'Injection Line 2', 'Sumitomo', 250, 18.0),
('INJ-03', 'Injection Line 3', 'Engel',    100, 12.0);

INSERT INTO production_jobs
    (job_number, machine_id, product_code, mold_id, recipe_id, planned_qty, status, started_at)
VALUES
('JOB-260820-01', 'INJ-01', 'PVC-PIPE-20', 'MD-1001', 'RC-A01',  5000, 'RUNNING', NOW() - INTERVAL '3 hours'),
('JOB-260820-02', 'INJ-02', 'PVC-JNT-20',  'MD-1002', 'RC-B01',  8000, 'RUNNING', NOW() - INTERVAL '2 hours'),
('JOB-260820-03', 'INJ-03', 'PVC-CAP-25',  'MD-1003', 'RC-C01', 12000, 'RUNNING', NOW() - INTERVAL '4 hours');