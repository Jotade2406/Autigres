-- =============================================================================
-- V006 — Grafo vial: graph_nodes y graph_edges
-- Persistencia del grafo de la ciudad. En runtime se carga en memoria
-- en el backend C# para ejecutar algoritmos de ruteo (Dijkstra / A*).
-- =============================================================================

USE autigres_db;

-- ---------------------------------------------------------------------------
-- Nodos del mapa (intersecciones / puntos de interés)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Aristas del grafo (calles / segmentos viales)
-- ---------------------------------------------------------------------------
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
