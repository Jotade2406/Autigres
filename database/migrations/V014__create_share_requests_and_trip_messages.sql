CREATE TABLE IF NOT EXISTS share_requests (
  id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  uuid                 CHAR(36)      NOT NULL,
  requester_request_id INT UNSIGNED  NOT NULL,
  target_request_id    INT UNSIGNED  NOT NULL,
  status               INT           NOT NULL DEFAULT 0,
  combined_trip_id     INT UNSIGNED  DEFAULT NULL,
  created_at           DATETIME(6)   NOT NULL,
  expires_at           DATETIME(6)   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY IX_ShareRequests_Uuid (uuid),
  KEY FK_ShareRequests_RequesterRequest (requester_request_id),
  KEY FK_ShareRequests_TargetRequest (target_request_id),
  KEY FK_ShareRequests_CombinedTrip (combined_trip_id),
  CONSTRAINT FK_ShareRequests_CombinedTrip     FOREIGN KEY (combined_trip_id)     REFERENCES trips (id) ON DELETE SET NULL,
  CONSTRAINT FK_ShareRequests_RequesterRequest FOREIGN KEY (requester_request_id) REFERENCES trip_requests (id),
  CONSTRAINT FK_ShareRequests_TargetRequest    FOREIGN KEY (target_request_id)    REFERENCES trip_requests (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trip_messages (
  id          INT UNSIGNED                       NOT NULL AUTO_INCREMENT,
  uuid        CHAR(36)                           NOT NULL,
  trip_id     INT UNSIGNED                       NOT NULL,
  sender_uuid CHAR(36)                           NOT NULL,
  sender_name VARCHAR(100)                       NOT NULL,
  sender_role ENUM('driver','passenger')         NOT NULL,
  content     TEXT                               NOT NULL,
  created_at  DATETIME                           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trip_messages_uuid (uuid),
  KEY idx_trip_messages_trip_id (trip_id),
  CONSTRAINT fk_trip_messages_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
