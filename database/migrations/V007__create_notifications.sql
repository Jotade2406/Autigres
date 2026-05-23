-- =============================================================================
-- V007 — Notificaciones del sistema
-- =============================================================================

USE autigres_db;

CREATE TABLE IF NOT EXISTS notifications (
    id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id    INT UNSIGNED  NOT NULL,
    type       VARCHAR(50)   NOT NULL
               COMMENT 'ej: trip_matched, driver_arrived, payment_processed',
    title      VARCHAR(200)  NOT NULL,
    body       TEXT          NOT NULL,
    data_json  JSON,
    is_read    BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_notifications_user_is_read (user_id, is_read),
    KEY idx_notifications_created_at (created_at),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
