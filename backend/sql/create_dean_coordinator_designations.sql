
-- Run once against your backed-up DEVELOPMENT database.

CREATE TABLE IF NOT EXISTS dean_coordinator_designations (
    id VARCHAR(36) PRIMARY KEY,

    coordinator_id VARCHAR(36) NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    academic_year VARCHAR(9) NOT NULL,

    semester VARCHAR(1) NOT NULL,

    assigned_by_dean_id VARCHAR(36) NOT NULL
        REFERENCES users(id),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_dean_designation_coordinator_term
        UNIQUE (coordinator_id, academic_year, semester),

    CONSTRAINT ck_dean_designation_semester
        CHECK (semester IN ('1', '2'))
);

CREATE INDEX IF NOT EXISTS ix_dean_designation_year
    ON dean_coordinator_designations(academic_year);

CREATE INDEX IF NOT EXISTS ix_dean_designation_semester
    ON dean_coordinator_designations(semester);

CREATE INDEX IF NOT EXISTS ix_dean_designation_coordinator
    ON dean_coordinator_designations(coordinator_id);
