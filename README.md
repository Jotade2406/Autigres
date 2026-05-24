# Autigres — Plataforma de Ride-Sharing para Santa Cruz de la Sierra

**Autigres** es una aplicación móvil de transporte compartido diseñada para Bolivia. Conecta pasajeros con conductores locales, ofrece viajes compartidos con descuento del 30 %, y usa un motor de ruteo propio sobre el mapa real de Santa Cruz — sin depender de Google Maps para el grafo.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│  Mobile (React Native + Expo 54)                        │
│  Android/iOS — New Architecture habilitada              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / JWT
┌──────────────────────▼──────────────────────────────────┐
│  Backend  ASP.NET Core 8  (Fly.io — autigres.fly.dev)   │
│  Clean Architecture: API / Core / Infrastructure        │
└──────────┬──────────────────────┬───────────────────────┘
           │ EF Core + Pomelo     │ Grafo OSM en RAM
┌──────────▼──────────┐  ┌────────▼──────────────────────┐
│  Aiven MySQL        │  │  Dijkstra (27k nodos, 29k     │
│  (autigres_db)      │  │  aristas) — sub-milisegundo   │
└─────────────────────┘  └───────────────────────────────┘
```

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Mobile | React Native 0.76, Expo 54, TypeScript |
| Mapas | `react-native-maps` + Google Maps SDK |
| Estado global | Zustand |
| HTTP | Axios + interceptor JWT |
| Backend | ASP.NET Core 8, C# |
| ORM | Entity Framework Core 8 + Pomelo (MySQL) |
| Base de datos | Aiven MySQL 8 (cloud managed) |
| Deploy backend | Fly.io (2 máquinas, auto-scaling) |
| Build mobile | EAS Build (Expo Application Services) |
| CI/CD | GitHub Actions → Fly.io |
| Autenticación | JWT Bearer, 24h expiry |

---

## Funcionalidades implementadas

### Pasajero
- Registro e inicio de sesión (JWT)
- Búsqueda de destino en mapa interactivo
- Selección de tipo de servicio: **Económico**, **Confort**, **Premium**
- Tarifa estimada en tiempo real (fórmula: Bs. 5 base + Bs. 2.50/km + Bs. 0.50/min)
- **Viaje individual** o **Compartido** (−30 % de tarifa)
- Sistema de viaje compartido (pooling):
  - Detección de pasajero compatible por proximidad geográfica (Haversine)
  - Invitación de compartir con temporizador de 60 segundos
  - Banner de solicitud entrante en tiempo real (polling cada 2s)
  - Aceptar / rechazar → crea viaje combinado automáticamente
- Pantalla de espera de conductor con radar animado
- Pantalla de viaje activo con animación del **Tigrecito** sobre la ruta real
- Historial de viajes
- Perfil con rating y total de viajes
- Cancelación de viaje

### Conductor
- Cola de viajes disponibles (actualizados cada 3s)
- Aceptar viaje (asigna vehículo activo automáticamente)
- Flujo completo: Llegada → Inicio → Completar
- Registro y gestión de vehículo
- Historial de viajes realizados

### Motor de ruteo (OSM)
- Grafo vial de Santa Cruz cargado desde OpenStreetMap
- **27,231 nodos**, **29,118 aristas** en memoria
- Dijkstra ejecuta en **< 1ms** por consulta
- Fallback automático: Backend → OSRM público → Google Maps → Haversine

---

## Cómo correr el proyecto localmente

### Requisitos
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android Studio / emulador Android

### Backend

```bash
cd backend
dotnet restore
dotnet run --project src/Autigres.API
```

Variables de entorno necesarias (o en `appsettings.Development.json`):
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=autigres_db;User=...;Password=...;SslMode=Required"
  },
  "JwtSettings": {
    "Secret": "tu-secreto-jwt-de-al-menos-32-chars",
    "Issuer": "autigres-api",
    "Audience": "autigres-mobile",
    "ExpirationHours": 24
  }
}
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

Escanear con Expo Go (o usar emulador Android con `npx expo run:android`).

---

## Deploy

### Backend → Fly.io

```bash
flyctl deploy --remote-only
```

El CI/CD de GitHub Actions hace esto automáticamente en cada push a `master`.

### Mobile → APK (Android)

```bash
cd mobile
npx eas-cli build --platform android --profile preview
```

El APK se descarga desde el dashboard de EAS: [expo.dev](https://expo.dev/accounts/juand2406/projects/mobile)

---

## Estructura del proyecto

```
autigres/
├── backend/
│   └── src/
│       ├── Autigres.API/          # Controllers, DTOs, Middleware
│       ├── Autigres.Core/         # Entidades, Interfaces, Enums, Excepciones
│       └── Autigres.Infrastructure/ # EF Core, Repositorios, Servicios
│
├── mobile/
│   └── src/
│       ├── api/                   # Cliente Axios + endpoints tipados
│       ├── components/            # AuMap, TigrecitoLayer, etc.
│       ├── hooks/                 # useTripPolling, useLocation, etc.
│       ├── navigation/            # PassengerNavigator, DriverNavigator
│       ├── screens/               # 19 pantallas (pasajero + conductor + auth)
│       ├── services/              # directions.ts (ruteo con fallback)
│       ├── store/                 # Zustand stores (auth, trip)
│       └── theme/                 # Colors, Spacing
│
├── database/
│   └── scripts/
│       ├── osm_import.py          # Importa grafo de OpenStreetMap a MySQL
│       └── osm_graph.sql          # Dump del grafo de Santa Cruz (27k nodos)
│
├── .github/workflows/
│   └── fly-deploy.yml             # CI/CD automático a Fly.io
│
└── fly.toml                       # Configuración de Fly.io
```

---

## API — Endpoints principales

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/users/profile` | Perfil con rating y estadísticas |
| POST | `/api/trips/requests` | Crear solicitud de viaje |
| GET | `/api/trips/requests/{uuid}` | Polling de estado de solicitud |
| DELETE | `/api/trips/requests/{uuid}` | Cancelar solicitud |
| GET | `/api/trips/{uuid}` | Detalle de viaje |
| GET | `/api/trips/history` | Historial del pasajero |
| GET | `/api/trips/requests/{uuid}/nearby` | Buscar pasajero compatible |
| POST | `/api/trips/share-requests` | Invitar a compartir viaje |
| GET | `/api/trips/share-requests/incoming` | Polling de invitaciones entrantes |
| POST | `/api/trips/share-requests/{uuid}/accept` | Aceptar compartir |
| GET | `/api/drivers/pending-trips` | Cola de viajes para conductor |
| POST | `/api/drivers/trips/{uuid}/accept` | Aceptar viaje |
| POST | `/api/drivers/trips/{uuid}/arrive` | Marcar llegada |
| POST | `/api/drivers/trips/{uuid}/start` | Iniciar viaje |
| POST | `/api/drivers/trips/{uuid}/complete` | Completar viaje |
| POST | `/api/graph/shortest-path` | Ruta más corta (Dijkstra OSM) |
| GET | `/api/trips/{uuid}/route` | Polilínea de ruta de un viaje |

---

## Modelo de negocio (cómo se vende)

### Propuesta de valor
Autigres es el **primer sistema de ride-sharing con pooling inteligente** pensado para ciudades medianas latinoamericanas como Santa Cruz de la Sierra, donde las apps globales (Uber, InDriver) no tienen pooling local ni algoritmos adaptados al mapa real de la ciudad.

### Diferenciadores clave

1. **Grafo OSM propio**: No pagamos por cada llamada a Google Maps Directions. El ruteo Dijkstra corre en RAM, responde en < 1ms y es gratuito.

2. **Pooling real**: Dos pasajeros con rutas compatibles pueden compartir viaje, pagan un 30 % menos cada uno, y el conductor hace un solo viaje más rentable.

3. **Stack moderno y escalable**: ASP.NET Core 8 con Clean Architecture. Fácil de extender con nuevas ciudades (solo se importa el OSM correspondiente).

4. **Costo de infra bajo**: Fly.io + Aiven MySQL cuestan menos de \$30/mes para carga inicial. Escala horizontalmente.

5. **App nativa de calidad**: React Native con New Architecture, mapas fluidos, animaciones, experiencia cercana a las apps top del mercado.

### Tarifas sugeridas
- **Comisión por viaje individual**: 12–15 % sobre la tarifa
- **Comisión por viaje compartido**: 8–10 % (menor comisión → más incentivo a compartir)
- **Suscripción conductor premium**: acceso a cola prioritaria y estadísticas avanzadas

---

## Equipo

Proyecto desarrollado como plataforma de transporte local para Bolivia.

---

## Licencia

Uso interno / privado. Todos los derechos reservados.
