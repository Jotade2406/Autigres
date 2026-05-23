-- =============================================================================
-- seed_demo_data.sql — Datos demo para la feria / presentación de Autigres
--
-- Contenido:
--   · 2 pasajeros demo (Ana Flores, Luis Mercado)
--   · 1 conductor demo (Carlos Autigres) con Toyota Corolla 2022
--   · Actualización de address_reference de los 10 nodos del grafo con
--     nombres de calles reales de Santa Cruz de la Sierra (zona Equipetrol)
--
-- CONTRASEÑA de todas las cuentas demo: Dev1234!
--   Hash BCrypt cost-12 pre-computado. Para usar "Demo1234!" ejecutar:
--     dotnet run --project tools/HashGen -- "Demo1234!"
--   o en la REPL de C#: BCrypt.Net.BCrypt.HashPassword("Demo1234!", 12)
--   y reemplazar la constante DEMO_HASH abajo.
-- =============================================================================

USE autigres_db;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Limpiar datos demo anteriores si existen (idempotente)
-- ---------------------------------------------------------------------------
DELETE FROM vehicles  WHERE plate_number IN ('7722-AUT');
DELETE FROM drivers   WHERE license_number = 'SC-12345';
DELETE FROM passengers WHERE user_id IN (SELECT id FROM users WHERE email IN ('ana@demo.com','luis@demo.com'));
DELETE FROM users WHERE email IN ('ana@demo.com','luis@demo.com','driver@demo.com');

-- ---------------------------------------------------------------------------
-- USERS
-- hash = BCrypt.HashPassword("Dev1234!", 12)  ← cambiar antes de la feria
-- ---------------------------------------------------------------------------
INSERT INTO users (uuid, email, phone, password_hash, first_name, last_name, role, status) VALUES
    -- Conductor demo
    ('D0000000-0000-0000-0000-000000000001',
     'driver@demo.com', '+59170001001',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Carlos', 'Autigres', 'driver', 'active'),

    -- Pasajera 1
    ('D0000000-0000-0000-0000-000000000002',
     'ana@demo.com', '+59170001002',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Ana', 'Flores', 'passenger', 'active'),

    -- Pasajero 2
    ('D0000000-0000-0000-0000-000000000003',
     'luis@demo.com', '+59170001003',
     '$2a$12$XJr1yZz0YKJnNZvFH3OQWeHf9WBTw7yNpP0DFkFuJFjd2ZqVpW5Fy',
     'Luis', 'Mercado', 'passenger', 'active');

-- ---------------------------------------------------------------------------
-- DRIVER
-- ---------------------------------------------------------------------------
INSERT INTO drivers (
    user_id, license_number, license_expiry,
    rating_average, total_trips,
    is_available, is_online,
    current_lat, current_lng, last_location_update,
    verified_at
)
SELECT
    id, 'SC-12345', '2027-12-31',
    5.00, 0,
    TRUE, FALSE,
    -17.78400000, -63.18100000, NOW(),
    NOW()
FROM users WHERE email = 'driver@demo.com';

-- ---------------------------------------------------------------------------
-- VEHICLE (Toyota Corolla 2022, Blanco, capacidad 3)
-- ---------------------------------------------------------------------------
INSERT INTO vehicles (driver_id, plate_number, brand, model, year, color, capacity, is_active)
SELECT
    d.id, '7722-AUT', 'Toyota', 'Corolla', 2022, 'Blanco', 3, TRUE
FROM drivers d
JOIN users u ON u.id = d.user_id
WHERE u.email = 'driver@demo.com';

-- ---------------------------------------------------------------------------
-- PASSENGERS
-- ---------------------------------------------------------------------------
INSERT INTO passengers (user_id, rating_average, total_trips, preferred_payment_method)
SELECT id, 5.00, 0, 'cash' FROM users WHERE email = 'ana@demo.com';

INSERT INTO passengers (user_id, rating_average, total_trips, preferred_payment_method)
SELECT id, 5.00, 0, 'cash' FROM users WHERE email = 'luis@demo.com';

-- ---------------------------------------------------------------------------
-- GRAPH NODES — actualizar address_reference con nombres reales de Santa Cruz
-- Zona: Equipetrol Norte / Av. Monseñor Rivero / Av. San Martín
-- Los nodos ya existen desde V006 + seed_dev_data; sólo actualizamos la
-- referencia de dirección para que los logs del backend sean legibles.
-- ---------------------------------------------------------------------------
UPDATE graph_nodes SET address_reference = 'Av. Monseñor Rivero y Av. Cristo Redentor'
WHERE node_key = 'SCZ-N01';

UPDATE graph_nodes SET address_reference = 'Av. Monseñor Rivero y Av. Roca y Coronado'
WHERE node_key = 'SCZ-N02';

UPDATE graph_nodes SET address_reference = 'Av. Monseñor Rivero y Radial 27'
WHERE node_key = 'SCZ-N03';

UPDATE graph_nodes SET address_reference = 'Equipetrol Norte y Av. Cristo Redentor'
WHERE node_key = 'SCZ-N04';

UPDATE graph_nodes SET address_reference = 'Equipetrol Norte y Av. Roca y Coronado'
WHERE node_key = 'SCZ-N05';

UPDATE graph_nodes SET address_reference = 'Equipetrol Norte y Radial 27'
WHERE node_key = 'SCZ-N06';

UPDATE graph_nodes SET address_reference = 'Av. San Martín y Av. Cristo Redentor'
WHERE node_key = 'SCZ-N07';

UPDATE graph_nodes SET address_reference = 'Av. San Martín y Av. Roca y Coronado'
WHERE node_key = 'SCZ-N08';

UPDATE graph_nodes SET address_reference = 'Av. San Martín y Radial 27'
WHERE node_key = 'SCZ-N09';

UPDATE graph_nodes SET address_reference = 'Av. Santos Dumont y Av. Cristo Redentor'
WHERE node_key = 'SCZ-N10';

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Verificación rápida
-- ---------------------------------------------------------------------------
SELECT email, first_name, last_name, role FROM users
WHERE email IN ('ana@demo.com','luis@demo.com','driver@demo.com');

SELECT u.email, v.brand, v.model, v.year, v.color, v.plate_number, v.capacity
FROM vehicles v JOIN drivers d ON d.id = v.driver_id JOIN users u ON u.id = d.user_id
WHERE u.email = 'driver@demo.com';

SELECT node_key, address_reference FROM graph_nodes ORDER BY id;


UPDATE users
SET password_hash = '$2a$11$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'driver@demo.com';

USE autigres_db;
UPDATE drivers
SET license_number = CONCAT('TMP-', id)
WHERE license_number = '';

SELECT password_hash FROM users WHERE email = 'test@autigres.com';

USE autigres_db;

USE autigres_db;

-- Obtener el user_id de carlos
SET @user_id = (SELECT id FROM users WHERE email = 'carlos@autigres.com');

-- Insertar perfil conductor
INSERT INTO drivers (user_id, license_number, license_expiry, is_available, is_online, verified_at)
VALUES (@user_id, 'SC-99999', '2027-12-31', TRUE, FALSE, NOW());

-- Insertar vehículo
INSERT INTO vehicles (driver_id, plate_number, brand, model, year, color, capacity, is_active)
VALUES (LAST_INSERT_ID(), '7722-AUT', 'Toyota', 'Corolla', 2022, 'Blanco', 3, TRUE);

USE autigres_db;

SET @driver_id = (SELECT d.id FROM drivers d
                  JOIN users u ON u.id = d.user_id
                  WHERE u.email = 'carlos@autigres.com');

INSERT INTO vehicles (driver_id, plate_number, brand, model, year, color, capacity, is_active)
VALUES (@driver_id, '7723-AUT', 'Toyota', 'Corolla', 2022, 'Blanco', 3, TRUE);

USE autigres_db;
