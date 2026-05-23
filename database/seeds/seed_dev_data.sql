-- =============================================================================
-- seed_dev_data.sql — Datos de desarrollo para Autigres
-- Insertar SOLO en entorno local/dev, nunca en producción.
--
-- Contenido:
--   · 1 admin
--   · 3 drivers con vehículos
--   · 5 passengers
--   · 10 graph_nodes (grilla simple, Santa Cruz de la Sierra)
--   · 15 graph_edges conectando esos nodos
--
-- ADVERTENCIA: password_hash es bcrypt de "Dev1234!" — cambiar en staging.
-- =============================================================================

USE autigres_db;

-- Deshabilitar FK checks para inserción limpia
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- USERS (1 admin + 3 drivers + 5 passengers = 9 usuarios)
-- ---------------------------------------------------------------------------
INSERT INTO users (uuid, email, phone, password_hash, first_name, last_name, role, status)
VALUES
    -- Admin
    ('00000000-0000-0000-0000-000000000001',
     'admin@autigres.com',        '+59171000001',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Carlos',   'Mendoza',  'admin',     'active'),

    -- Drivers
    ('00000000-0000-0000-0000-000000000002',
     'driver1@autigres.com',      '+59171000002',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Miguel',   'Torres',   'driver',    'active'),
    ('00000000-0000-0000-0000-000000000003',
     'driver2@autigres.com',      '+59171000003',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Roberto',  'Vaca',     'driver',    'active'),
    ('00000000-0000-0000-0000-000000000004',
     'driver3@autigres.com',      '+59171000004',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Luis',     'Suárez',   'driver',    'active'),

    -- Passengers
    ('00000000-0000-0000-0000-000000000005',
     'passenger1@autigres.com',   '+59171000005',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Ana',      'Gutiérrez','passenger', 'active'),
    ('00000000-0000-0000-0000-000000000006',
     'passenger2@autigres.com',   '+59171000006',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Sofía',    'Rojas',    'passenger', 'active'),
    ('00000000-0000-0000-0000-000000000007',
     'passenger3@autigres.com',   '+59171000007',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Diego',    'Flores',   'passenger', 'active'),
    ('00000000-0000-0000-0000-000000000008',
     'passenger4@autigres.com',   '+59171000008',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Valentina','Ríos',     'passenger', 'active'),
    ('00000000-0000-0000-0000-000000000009',
     'passenger5@autigres.com',   '+59171000009',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Mateo',    'Quispe',   'passenger', 'active');

-- ---------------------------------------------------------------------------
-- PASSENGERS (user_id 5–9)
-- ---------------------------------------------------------------------------
INSERT INTO passengers (user_id, rating_average, total_trips, preferred_payment_method)
VALUES
    (5, 4.80, 12, 'card'),
    (6, 4.95,  8, 'wallet'),
    (7, 4.70, 25, 'cash'),
    (8, 5.00,  3, 'card'),
    (9, 4.60, 47, 'cash');

-- ---------------------------------------------------------------------------
-- DRIVERS (user_id 2–4)
-- ---------------------------------------------------------------------------
INSERT INTO drivers (
    user_id, license_number, license_expiry,
    rating_average, total_trips,
    is_available, is_online,
    current_lat, current_lng, last_location_update,
    verified_at
)
VALUES
    (2, 'SC-2021-001', '2027-06-30', 4.85, 320,
     TRUE,  TRUE,  -17.78395000, -63.18205000, NOW(), '2024-01-15 10:00:00'),
    (3, 'SC-2019-047', '2026-12-31', 4.92, 580,
     FALSE, FALSE, -17.78500000, -63.18000000, NOW(), '2024-02-20 09:00:00'),
    (4, 'SC-2022-113', '2028-03-31', 4.78, 210,
     TRUE,  TRUE,  -17.78650000, -63.18350000, NOW(), '2024-03-10 11:00:00');

-- ---------------------------------------------------------------------------
-- VEHICLES (driver_id 1–3)
-- ---------------------------------------------------------------------------
INSERT INTO vehicles (driver_id, plate_number, brand, model, year, color, capacity, is_active)
VALUES
    (1, '3456-ABC', 'Toyota',  'Corolla',  2020, 'Blanco',  4, TRUE),
    (2, '7891-XYZ', 'Suzuki',  'Swift',    2019, 'Plateado',4, TRUE),
    (3, '2233-DEF', 'Hyundai', 'Accent',   2022, 'Negro',   4, TRUE);

-- ---------------------------------------------------------------------------
-- GRAPH NODES — grilla 3×4 centrada en Santa Cruz de la Sierra
-- Coordenadas aproximadas del casco viejo / zona central
--
--  N1 --- N2 --- N3
--  |      |      |
--  N4 --- N5 --- N6
--  |      |      |
--  N7 --- N8 --- N9
--  |      |
--  N10----+
-- ---------------------------------------------------------------------------
INSERT INTO graph_nodes (node_key, lat, lng, city, address_reference)
VALUES
    ('SCZ-N01', -17.78200000, -63.18200000, 'Santa Cruz de la Sierra', 'Plaza 24 de Septiembre - Norte'),
    ('SCZ-N02', -17.78200000, -63.18000000, 'Santa Cruz de la Sierra', 'Calle Junín esq. 24 de Septiembre'),
    ('SCZ-N03', -17.78200000, -63.17800000, 'Santa Cruz de la Sierra', 'Av. Monseñor Rivero - Norte'),
    ('SCZ-N04', -17.78400000, -63.18200000, 'Santa Cruz de la Sierra', 'Plaza 24 de Septiembre - Centro'),
    ('SCZ-N05', -17.78400000, -63.18000000, 'Santa Cruz de la Sierra', 'Calle Junín - Centro'),
    ('SCZ-N06', -17.78400000, -63.17800000, 'Santa Cruz de la Sierra', 'Av. Monseñor Rivero - Centro'),
    ('SCZ-N07', -17.78600000, -63.18200000, 'Santa Cruz de la Sierra', 'Plaza 24 de Septiembre - Sur'),
    ('SCZ-N08', -17.78600000, -63.18000000, 'Santa Cruz de la Sierra', 'Calle Junín - Sur'),
    ('SCZ-N09', -17.78600000, -63.17800000, 'Santa Cruz de la Sierra', 'Av. Monseñor Rivero - Sur'),
    ('SCZ-N10', -17.78800000, -63.18200000, 'Santa Cruz de la Sierra', 'Av. Cañoto - Extremo sur');

-- ---------------------------------------------------------------------------
-- GRAPH EDGES — 15 conexiones (is_bidirectional=TRUE → se recorren en ambos sentidos)
-- Distancia ≈ 200 m entre nodos adyacentes horizontales/verticales
-- Tiempo promedio ≈ 60 s (30 km/h en zona urbana)
-- ---------------------------------------------------------------------------
INSERT INTO graph_edges (from_node_id, to_node_id, distance_meters, time_seconds_avg, road_name, is_bidirectional)
VALUES
    -- Fila superior (N1-N2-N3)
    (1, 2, 190.00, 55,  'Calle 24 de Septiembre',  TRUE),
    (2, 3, 190.00, 55,  'Calle 24 de Septiembre',  TRUE),
    -- Fila media (N4-N5-N6)
    (4, 5, 190.00, 55,  'Calle Junín',              TRUE),
    (5, 6, 190.00, 55,  'Calle Junín',              TRUE),
    -- Fila inferior (N7-N8-N9)
    (7, 8, 190.00, 55,  'Av. Cañoto',               TRUE),
    (8, 9, 190.00, 55,  'Av. Cañoto',               TRUE),
    -- Columna izquierda (N1-N4-N7-N10)
    (1, 4, 222.00, 65,  'Av. Monseñor Rivero',      TRUE),
    (4, 7, 222.00, 65,  'Av. Monseñor Rivero',      TRUE),
    (7,10, 222.00, 65,  'Av. Monseñor Rivero',      TRUE),
    -- Columna central (N2-N5-N8)
    (2, 5, 222.00, 65,  'Calle Potosí',             TRUE),
    (5, 8, 222.00, 65,  'Calle Potosí',             TRUE),
    -- Columna derecha (N3-N6-N9)
    (3, 6, 222.00, 65,  'Calle Ballivián',          TRUE),
    (6, 9, 222.00, 65,  'Calle Ballivián',          TRUE),
    -- Diagonales / atajos (sentido único para simular calle de un solo sentido)
    (1, 5, 302.00, 85,  'Atajo NW-Centro',          FALSE),
    (5, 9, 302.00, 85,  'Atajo Centro-SE',          FALSE);

SET FOREIGN_KEY_CHECKS = 1;


SELECT COUNT(*) as nodos FROM graph_nodes;
SELECT COUNT(*) as aristas FROM graph_edges;
SELECT email, role, status FROM users;

SELECT node_key, lat, lng FROM graph_nodes LIMIT 5;


USE autigres_db;

ALTER TABLE trips
  MODIFY driver_id INT UNSIGNED NULL,
  MODIFY vehicle_id INT UNSIGNED NULL;


SELECT id, status, estimated_fare FROM trip_requests;
SELECT id, uuid, status, total_distance_km FROM trips;
SELECT trip_id, passenger_id, pickup_order, fare_amount FROM trip_passengers;

SOURCE D:/Proyectos/work/Autigres/database/seeds/seed_demo_data.sql;