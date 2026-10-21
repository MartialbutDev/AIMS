
-- ============================================================
-- AIMS DOCUMENT REVIEW HISTORY
-- PostgreSQL migration
-- ============================================================
-- Run once before enabling the new review endpoints.
-- This migration does not modify existing documents.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS document_reviews (

    id VARCHAR(36) PRIMARY KEY,

    document_id VARCHAR(36) NOT NULL,

    reviewer_id VARCHAR(36) NOT NULL,

    previous_status VARCHAR(20) NOT NULL,

    decision VARCHAR(20) NOT NULL,

    notes TEXT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT document_reviews_decision_check
        CHECK (
            decision IN (
                'verified',
                'rejected'
            )
        )
);

CREATE INDEX IF NOT EXISTS
    ix_document_reviews_document_id
ON document_reviews (
    document_id
);

CREATE INDEX IF NOT EXISTS
    ix_document_reviews_document_created
ON document_reviews (
    document_id,
    created_at
);

COMMIT;
