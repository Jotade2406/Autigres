-- =============================================================================
-- V004 — Solicitudes, viajes y pooling: trip_requests, trips,
--         trip_passengers, route_waypoints
-- =============================================================================

USE autigres_db;

-- ---------------------------------------------------------------------------
-- Solicitudes de viaje (estado pre-asignación)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip_requests (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()),
    passenger_id        INT UNSIGNED    NOT NULL,
    origin_lat          DECIMAL(10,8)   NOT NULL,
    origin_lng          DECIMAL(11,8)   NOT NULL,
    origin_address      VARCHAR(500)    NOT NULL,
    destination_lat     DECIMAL(10,8)   NOT NULL,
    destination_lng     DECIMAL(11,8)   NOT NULL,
    destination_address VARCHAR(500)    NOT NULL,
    status              ENUM('pending','matching','matched','assigned',
                             'cancelled','expired')
                                        NOT NULL DEFAULT 'pending',
    estimated_fare      DECIMAL(10,2),
    max_detour_seconds  INT UNSIGNED    NOT NULL DEFAULT 300
                        COMMENT 'Umbral de desvío aceptable en segundos',
    expires_at          TIMESTAMP       NOT NULL,
    cancelled_at        TIMESTAMP,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                 ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_trip_requests_uuid (uuid),
    KEY idx_trip_requests_passenger_id (passenger_id),
    KEY idx_trip_requests_status       (status),
    CONSTRAINT fk_trip_requests_passenger
        FOREIGN KEY (passenger_id) REFERENCES passengers (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Viajes reales — agrupan uno o más pasajeros (pooling)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()),
    driver_id           INT UNSIGNED    NOT NULL,
    vehicle_id          INT UNSIGNED    NOT NULL,
    status              ENUM('scheduled','driver_assigned','in_progress',
                             'completed','cancelled')
                                        NOT NULL DEFAULT 'scheduled',
    origin_lat          DECIMAL(10,8)   NOT NULL,
    origin_lng          DECIMAL(11,8)   NOT NULL,
    origin_address      VARCHAR(500)    NOT NULL,
    destination_lat     DECIMAL(10,8)   NOT NULL,
    destination_lng     DECIMAL(11,8)   NOT NULL,
    destination_address VARCHAR(500)    NOT NULL,
    total_distance_km   DECIMAL(8,3),
    base_fare           DECIMAL(10,2),
    started_at          TIMESTAMP,
    completed_at        TIMESTAMP,
    cancelled_at        TIMESTAMP,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                 ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_trips_uuid   (uuid),
    KEY idx_trips_driver_id    (driver_id),
    KEY idx_trips_vehicle_id   (vehicle_id),
    KEY idx_trips_status       (status),
    CONSTRAINT fk_trips_driver
        FOREIGN KEY (driver_id) REFERENCES drivers (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_trips_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Tabla pivote del pooling — un trip puede tener múltiples pasajeros
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip_passengers (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    trip_id             INT UNSIGNED    NOT NULL,
    passenger_id        INT UNSIGNED    NOT NULL,
    request_id          INT UNSIGNED    NOT NULL,
    pickup_lat          DECIMAL(10,8)   NOT NULL,
    pickup_lng          DECIMAL(11,8)   NOT NULL,
    pickup_address      VARCHAR(500)    NOT NULL,
    dropoff_lat         DECIMAL(10,8)   NOT NULL,
    dropoff_lng         DECIMAL(11,8)   NOT NULL,
    dropoff_address     VARCHAR(500)    NOT NULL,
    pickup_order        TINYINT UNSIGNED NOT NULL
                        COMMENT 'Secuencia de recogida dentro del viaje',
    dropoff_order       TINYINT UNSIGNED NOT NULL
                        COMMENT 'Secuencia de bajada dentro del viaje',
    fare_amount         DECIMAL(10,2),
    status              ENUM('waiting','picked_up','dropped_off',
                             'cancelled','no_show')
                                        NOT NULL DEFAULT 'waiting',
    added_detour_seconds INT UNSIGNED   NOT NULL DEFAULT 0
                        COMMENT 'Segundos de desvío que este pasajero agrega',
    picked_up_at        TIMESTAMP,
    dropped_off_at      TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_trip_passengers_trip_passenger (trip_id, passenger_id),
    KEY idx_trip_passengers_passenger_id (passenger_id),
    KEY idx_trip_passengers_request_id   (request_id),
    CONSTRAINT fk_tp_trip
        FOREIGN KEY (trip_id) REFERENCES trips (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_tp_passenger
        FOREIGN KEY (passenger_id) REFERENCES passengers (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_tp_request
        FOREIGN KEY (request_id) REFERENCES trip_requests (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Puntos GPS del recorrido real
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_waypoints (
    id             INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    trip_id        INT UNSIGNED      NOT NULL,
    sequence_order SMALLINT UNSIGNED NOT NULL,
    lat            DECIMAL(10,8)     NOT NULL,
    lng            DECIMAL(11,8)     NOT NULL,
    node_ref       VARCHAR(50)
                   COMMENT 'Referencia al nodo del grafo vial',
    waypoint_type  ENUM('route','pickup','dropoff') NOT NULL DEFAULT 'route',
    arrived_at     TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_route_waypoints_trip_id (trip_id),
    CONSTRAINT fk_route_waypoints_trip
        FOREIGN KEY (trip_id) REFERENCES trips (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
