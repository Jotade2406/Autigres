-- =============================================================================
-- schema.sql — Schema completo de Autigres (generado desde migrations)
-- Motor: MySQL 8.0+  |  Charset: utf8mb4  |  Collation: utf8mb4_unicode_ci
--
-- Este archivo es la concatenación en orden de V001…V007.
-- Úsalo para crear la base de datos completa desde cero en un solo paso.
-- Para migraciones incrementales usa los archivos en migrations/ individualmente.
-- =============================================================================

-- =============================================================================
-- SECCIÓN 1 — Base de datos
-- =============================================================================

CREATE DATABASE IF NOT EXISTS autigres_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE autigres_db;

-- =============================================================================
-- SECCIÓN 2 — Usuarios (V001)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    uuid          CHAR(36)         NOT NULL DEFAULT (UUID()),
    email         VARCHAR(255)     NOT NULL,
    phone         VARCHAR(20)      NOT NULL,
    password_hash VARCHAR(255)     NOT NULL,
    first_name    VARCHAR(100)     NOT NULL,
    last_name     VARCHAR(100)     NOT NULL,
    profile_picture_url VARCHAR(500),
    role          ENUM('passenger','driver','admin') NOT NULL DEFAULT 'passenger',
    status        ENUM('active','suspended','banned','pending_verification')
                                   NOT NULL DEFAULT 'pending_verification',
    created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_uuid  (uuid),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECCIÓN 3 — Perfiles extendidos (V002)
-- =============================================================================

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
    UNIQUE KEY uq_drivers_user_id        (user_id),
    UNIQUE KEY uq_drivers_license_number (license_number),
    CONSTRAINT fk_drivers_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECCIÓN 4 — Vehículos (V003)
-- =============================================================================

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

-- =============================================================================
-- SECCIÓN 5 — Solicitudes, viajes y pooling (V004)
-- =============================================================================

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

-- =============================================================================
-- SECCIÓN 6 — Pagos y calificaciones (V005)
-- =============================================================================

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

-- =============================================================================
-- SECCIÓN 7 — Grafo vial (V006)
-- =============================================================================

CREATE TABLE IF NOT EXISTS graph_nodes (
    id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    node_key          VARCHAR(50)     NOT NULL
                      COMMENT 'ID único, p.ej. OSM node id o "lat_lng"',
    lat               DECIMAL(10,8)   NOT NULL,
    lng               DECIMAL(11,8)   NOT NULL,
    city              VARCHAR(100)    NOT NULL DEFAULT 'Santa Cruz de la Sierra',
    address_reference VARCHAR(500),

    PRIMARY KEY (id),
    UNIQUE KEY uq_graph_nodes_node_key (node_key),
    INDEX idx_graph_nodes_lat_lng (lat, lng)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS graph_edges (
    id               INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    from_node_id     INT UNSIGNED      NOT NULL,
    to_node_id       INT UNSIGNED      NOT NULL,
    distance_meters  DECIMAL(10,2)     NOT NULL,
    time_seconds_avg SMALLINT UNSIGNED NOT NULL,
    road_name        VARCHAR(200),
    is_bidirectional BOOLEAN           NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_graph_edges_from_to (from_node_id, to_node_id),
    KEY idx_graph_edges_to_node_id (to_node_id),
    CONSTRAINT fk_graph_edges_from_node
        FOREIGN KEY (from_node_id) REFERENCES graph_nodes (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_graph_edges_to_node
        FOREIGN KEY (to_node_id) REFERENCES graph_nodes (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECCIÓN 8 — Notificaciones (V007)
-- =============================================================================

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
