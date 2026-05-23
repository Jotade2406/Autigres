-- =============================================================================
-- V001 — Tabla base de usuarios del sistema Autigres
-- =============================================================================

CREATE DATABASE IF NOT EXISTS autigres_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE autigres_db;

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
