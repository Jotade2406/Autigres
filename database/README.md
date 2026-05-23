# Autigres — Base de datos MySQL

Motor: **MySQL 8.0+** | Charset: **utf8mb4** | Collation: **utf8mb4_unicode_ci**

## Estructura de carpetas

```
database/
├── migrations/          ← scripts incrementales, uno por versión
│   ├── V001__create_users.sql
│   ├── V002__create_passengers_drivers.sql
│   ├── V003__create_vehicles.sql
│   ├── V004__create_trips.sql
│   ├── V005__create_payments_ratings.sql
│   ├── V006__create_graph.sql
│   └── V007__create_notifications.sql
├── seeds/
│   └── seed_dev_data.sql   ← datos de prueba (solo entorno local)
├── schema.sql              ← schema completo (concat de V001–V007)
└── README.md
```

## Opción A — Schema completo desde cero (más rápido)

Ejecuta un único archivo que crea todas las tablas en orden:

```sql
-- En DataGrip: File > Open > database/schema.sql → Run
SOURCE /ruta/al/proyecto/database/schema.sql;
```

O desde la terminal MySQL:

```bash
mysql -u root -p < database/schema.sql
```

## Opción B — Migrations individuales (orden estricto)

Ejecuta cada migration en secuencia numérica. Cada archivo incluye `USE autigres_db;`.

| Orden | Archivo                              | Crea                                       |
|-------|--------------------------------------|--------------------------------------------|
| 1     | V001__create_users.sql               | `users`                                    |
| 2     | V002__create_passengers_drivers.sql  | `passengers`, `drivers`                    |
| 3     | V003__create_vehicles.sql            | `vehicles`                                 |
| 4     | V004__create_trips.sql               | `trip_requests`, `trips`, `trip_passengers`, `route_waypoints` |
| 5     | V005__create_payments_ratings.sql    | `payments`, `ratings`                      |
| 6     | V006__create_graph.sql               | `graph_nodes`, `graph_edges`               |
| 7     | V007__create_notifications.sql       | `notifications`                            |

```bash
# Ejemplo desde terminal
for f in database/migrations/V*.sql; do mysql -u root -p autigres_db < "$f"; done
```

## Cargar datos de desarrollo

Una vez aplicado el schema, carga el seed **solo en entorno local**:

```bash
mysql -u root -p < database/seeds/seed_dev_data.sql
```

El seed inserta:
- 1 admin (`admin@autigres.com`)
- 3 drivers con vehículos (`driver1–3@autigres.com`)
- 5 passengers (`passenger1–5@autigres.com`)
- 10 nodos de grafo en zona central de Santa Cruz de la Sierra
- 15 aristas conectando esos nodos (13 bidireccionales + 2 unidireccionales)

**Password de todos los usuarios de seed:** `Dev1234!`

## Cómo ejecutar en DataGrip

1. **Crear conexión:** `File > New > Data Source > MySQL`  
   Host: `localhost` | Port: `3306` | User/Pass según tu entorno local.

2. **Schema completo:** Abrir `database/schema.sql` → botón ▶ *Run*.

3. **Migrations individuales:** Abrir cada `V00N__*.sql` en orden → ▶ *Run*.

4. **Seed:** Abrir `seeds/seed_dev_data.sql` → ▶ *Run*.

5. **Verificar:** En el panel *Database*, expandir `autigres_db` y confirmar las 13 tablas.

## Tablas y relaciones

```
users
 ├── passengers          (user_id FK, CASCADE)
 │    └── trip_requests  (passenger_id FK)
 │         └── trip_passengers (request_id FK)
 ├── drivers             (user_id FK, CASCADE)
 │    ├── vehicles       (driver_id FK, CASCADE)
 │    └── trips          (driver_id FK, RESTRICT)
 │         ├── trip_passengers (trip_id FK, CASCADE)
 │         │    └── payments   (trip_passenger_id FK, RESTRICT)
 │         ├── route_waypoints (trip_id FK, CASCADE)
 │         └── ratings         (trip_id FK, RESTRICT)
 └── notifications       (user_id FK, CASCADE)

graph_nodes
 └── graph_edges         (from_node_id / to_node_id FK, CASCADE)
```

## Notas de diseño

- **Pooling:** La tabla `trip_passengers` es la clave del ride-pooling. Un `trip` puede tener N pasajeros, cada uno con su propio pickup/dropoff, orden de recogida y monto de tarifa individual.
- **Grafo:** `graph_nodes` y `graph_edges` persisten el grafo vial. En runtime el backend C# los carga en memoria (grafo de adyacencia) para ejecutar Dijkstra / A*.
- **FK CASCADE vs RESTRICT:** Se usa CASCADE cuando borrar el padre debe borrar el hijo (ej: borrar `user` borra su `passenger`/`driver`). Se usa RESTRICT cuando no se puede borrar el padre si tiene hijos con datos de negocio relevantes (ej: no se puede borrar un `driver` con `trips`).
- **UUIDs:** Las tablas de negocio principales exponen un `uuid` CHAR(36) como identificador público; el `id` INT UNSIGNED es la PK interna para joins eficientes.
