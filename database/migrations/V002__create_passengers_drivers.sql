-- =============================================================================
-- V002 — Perfiles extendidos: passengers y drivers (Autigres)
-- =============================================================================

USE autigres_db;

CREATE TABLE IF NOT EXISTS passengers (
    id                       INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    user_id                  INT UNSIGNED     NOT NULL,
    rating_average           DECIMAL(3,2)     NOT NULL DEFAULT 5.00,
    total_trips              INT UNSIGNED     NOT NULL DEFAULT 0,
    preferred_payment_method ENUM('cash','card','wallet') NOT NULL DEFAULT 'cash',

    PRIMARY KEY (id),
    UNIQUE KEY uq_passengers_user_id (user_id),
    CONSTRAINT fk_passengers_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drivers (
    id                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    user_id              INT UNSIGNED     NOT NULL,
    license_number       VARCHAR(50)      NOT NULL,
    license_expiry       DATE             NOT NULL,
    rating_average       DECIMAL(3,2)     NOT NULL DEFAULT 5.00,
    total_trips          INT UNSIGNED     NOT NULL DEFAULT 0,
    is_available         BOOLEAN          NOT NULL DEFAULT FALSE,
    is_online            BOOLEAN          NOT NULL DEFAULT FALSE,
    current_lat          DECIMAL(10,8),
    current_lng          DECIMAL(11,8),
    last_location_update TIMESTAMP,
    verified_at          TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_drivers_user_id       (user_id),
    UNIQUE KEY uq_drivers_license_number (license_number),
    CONSTRAINT fk_drivers_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
