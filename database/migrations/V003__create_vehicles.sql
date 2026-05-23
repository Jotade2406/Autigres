-- =============================================================================
-- V003 — Vehículos de los conductores
-- =============================================================================

USE autigres_db;

CREATE TABLE IF NOT EXISTS vehicles (
    id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    driver_id    INT UNSIGNED  NOT NULL,
    plate_number VARCHAR(20)   NOT NULL,
    brand        VARCHAR(100)  NOT NULL,
    model        VARCHAR(100)  NOT NULL,
    year         YEAR          NOT NULL,
    color        VARCHAR(50)   NOT NULL,
    capacity     TINYINT UNSIGNED NOT NULL DEFAULT 4
                 COMMENT 'Número máximo de pasajeros para pooling',
    is_active    BOOLEAN       NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_vehicles_plate_number (plate_number),
    KEY idx_vehicles_driver_id (driver_id),
    CONSTRAINT fk_vehicles_driver
        FOREIGN KEY (driver_id) REFERENCES drivers (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
