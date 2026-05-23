-- =============================================================================
-- V005 — Pagos y calificaciones
-- =============================================================================

USE autigres_db;

-- ---------------------------------------------------------------------------
-- Pagos individuales por pasajero por viaje
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    uuid              CHAR(36)        NOT NULL DEFAULT (UUID()),
    trip_passenger_id INT UNSIGNED    NOT NULL,
    amount            DECIMAL(10,2)   NOT NULL,
    currency          CHAR(3)         NOT NULL DEFAULT 'BOB',
    method            ENUM('cash','card','wallet') NOT NULL DEFAULT 'cash',
    status            ENUM('pending','completed','failed','refunded')
                                      NOT NULL DEFAULT 'pending',
    transaction_id    VARCHAR(255),
    processed_at      TIMESTAMP,
    created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_uuid           (uuid),
    UNIQUE KEY uq_payments_transaction_id (transaction_id),
    KEY idx_payments_trip_passenger_id    (trip_passenger_id),
    KEY idx_payments_status               (status),
    CONSTRAINT fk_payments_trip_passenger
        FOREIGN KEY (trip_passenger_id) REFERENCES trip_passengers (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Calificaciones bidireccionales (pasajero→conductor y conductor→pasajero)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    trip_id       INT UNSIGNED  NOT NULL,
    rater_user_id INT UNSIGNED  NOT NULL,
    rated_user_id INT UNSIGNED  NOT NULL,
    score         TINYINT UNSIGNED NOT NULL,
    comment       TEXT,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_ratings_trip_rater_rated (trip_id, rater_user_id, rated_user_id),
    KEY idx_ratings_rated_user_id (rated_user_id),
    CONSTRAINT fk_ratings_trip
        FOREIGN KEY (trip_id) REFERENCES trips (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_ratings_rater
        FOREIGN KEY (rater_user_id) REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_ratings_rated
        FOREIGN KEY (rated_user_id) REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_ratings_score
        CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
