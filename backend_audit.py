"""
backend_audit.py — Full backend endpoint audit for Autigres
Tests every endpoint category for runtime and persistence correctness.
"""
import json, time, sys
import requests

BASE = "https://autigres.fly.dev/api"
PASS = "Test1234!"

results = []

def ok(label):
    results.append(("OK", label))
    print(f"  [OK]   {label}")

def fail(label, detail=""):
    results.append(("FAIL", label))
    print(f"  [FAIL] {label}" + (f" -> {detail}" if detail else ""))

def warn(label, detail=""):
    results.append(("WARN", label))
    print(f"  [WARN] {label}" + (f" -> {detail}" if detail else ""))

def req(method, path, token=None, **kwargs):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = getattr(requests, method)(f"{BASE}{path}", headers=headers, timeout=30, **kwargs)
    return resp

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 1. AUTH ===")

# Register passenger test account (idempotent)
r = req("post", "/auth/register", json={
    "firstName": "Audit", "lastName": "Bot",
    "email": "auditbot@test.com", "phone": "70009999",
    "password": PASS, "role": "passenger"
})
if r.status_code in (200, 201, 409):
    ok(f"POST /auth/register passenger -> {r.status_code}")
else:
    fail("POST /auth/register passenger", f"{r.status_code}: {r.text[:200]}")

# Register driver test account (idempotent)
r = req("post", "/auth/register", json={
    "firstName": "Conductor", "lastName": "Audit",
    "email": "conductor.audit@test.com", "phone": "79999888",
    "password": PASS, "role": "driver"
})
if r.status_code in (200, 201, 409):
    ok(f"POST /auth/register driver -> {r.status_code}")
else:
    fail("POST /auth/register driver", f"{r.status_code}: {r.text[:200]}")

# Duplicate phone should be 409 (not 500)
r = req("post", "/auth/register", json={
    "firstName": "Dup", "lastName": "Phone",
    "email": "dup.phone@test.com", "phone": "70009999",
    "password": PASS, "role": "passenger"
})
if r.status_code == 409:
    ok("POST /auth/register duplicate phone -> 409")
else:
    fail("POST /auth/register duplicate phone", f"expected 409, got {r.status_code}: {r.text[:100]}")

# Duplicate email should be 409
r = req("post", "/auth/register", json={
    "firstName": "Dup", "lastName": "Email",
    "email": "auditbot@test.com", "phone": "70008888",
    "password": PASS, "role": "passenger"
})
if r.status_code == 409:
    ok("POST /auth/register duplicate email -> 409")
else:
    fail("POST /auth/register duplicate email", f"expected 409, got {r.status_code}: {r.text[:100]}")

# Login passenger
r = req("post", "/auth/login", json={"email": "auditbot@test.com", "password": PASS})
if r.status_code == 200 and "accessToken" in r.json():
    BOT_TOKEN = r.json()["accessToken"]
    BOT_USER  = r.json().get("user", {})
    ok("POST /auth/login (passenger auditbot)")
else:
    fail("POST /auth/login (passenger)", f"{r.status_code}: {r.text[:200]}")
    sys.exit(1)

# Login driver
r = req("post", "/auth/login", json={"email": "conductor.audit@test.com", "password": PASS})
if r.status_code == 200 and "accessToken" in r.json():
    DRV_TOKEN = r.json()["accessToken"]
    DRV_USER  = r.json().get("user", {})
    ok("POST /auth/login (driver conductor.audit)")
else:
    fail("POST /auth/login (driver)", f"{r.status_code}: {r.text[:200]}")
    sys.exit(1)

# Login existing passenger (juan@test.com) — for history checks
r = req("post", "/auth/login", json={"email": "juan@test.com", "password": PASS})
if r.status_code == 200:
    PASS_TOKEN = r.json()["accessToken"]
    ok("POST /auth/login (juan@test.com)")
else:
    warn("POST /auth/login (juan@test.com)", f"{r.status_code} — history tests will use auditbot token")
    PASS_TOKEN = BOT_TOKEN

# Wrong password -> 401
r = req("post", "/auth/login", json={"email": "auditbot@test.com", "password": "WRONG"})
if r.status_code == 401:
    ok("POST /auth/login wrong password -> 401")
else:
    warn("POST /auth/login wrong password", f"expected 401, got {r.status_code}")

# Invalid role -> 400
r = req("post", "/auth/register", json={
    "firstName": "Admin", "lastName": "Try",
    "email": "admin.try@test.com", "phone": "79990000",
    "password": PASS, "role": "admin"
})
if r.status_code == 400:
    ok("POST /auth/register invalid role (admin) -> 400")
else:
    warn("POST /auth/register admin role", f"expected 400, got {r.status_code}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 2. USER PROFILE ===")

# GET /auth/me
r = req("get", "/auth/me", BOT_TOKEN)
if r.status_code == 200:
    u = r.json()
    ok(f"GET /auth/me -> email={u.get('email')} role={u.get('role')}")
else:
    fail("GET /auth/me", f"{r.status_code}: {r.text[:200]}")

# GET /users/profile (passenger)
r = req("get", "/users/profile", BOT_TOKEN)
if r.status_code == 200:
    u = r.json()
    ok(f"GET /users/profile (passenger) -> name={u.get('fullName')}, trips={u.get('totalTrips')}, rating={u.get('ratingAverage')}")
else:
    fail("GET /users/profile (passenger)", f"{r.status_code}: {r.text[:200]}")

# GET /users/profile (driver)
r = req("get", "/users/profile", DRV_TOKEN)
if r.status_code == 200:
    u = r.json()
    ok(f"GET /users/profile (driver) -> name={u.get('fullName')}, trips={u.get('totalTrips')}, rating={u.get('ratingAverage')}")
else:
    fail("GET /users/profile (driver)", f"{r.status_code}: {r.text[:200]}")

# No token -> 401
r = req("get", "/users/profile")
if r.status_code == 401:
    ok("GET /users/profile no token -> 401")
else:
    warn("GET /users/profile no token", f"expected 401, got {r.status_code}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 3. GRAPH ===")

r = req("post", "/graph/shortest-path", BOT_TOKEN, json={
    "fromLat": -17.7833, "fromLng": -63.1821,
    "toLat":   -17.7700, "toLng":   -63.1600,
})
if r.status_code == 200:
    g = r.json()
    plen = len(g.get("polyline", []))
    ok(f"POST /graph/shortest-path -> {plen} nodes, {g.get('totalTimeSeconds',0):.0f}s, Bs.{g.get('estimatedFare',0):.1f}")
else:
    fail("POST /graph/shortest-path", f"{r.status_code}: {r.text[:200]}")

# Same origin=destination
r = req("post", "/graph/shortest-path", BOT_TOKEN, json={
    "fromLat": -17.7833, "fromLng": -63.1821,
    "toLat":   -17.7833, "toLng":   -63.1821,
})
if r.status_code in (200, 422):
    ok(f"POST /graph/shortest-path same O=D -> {r.status_code}")
else:
    warn("POST /graph/shortest-path same O=D", f"{r.status_code}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 4. DRIVER VEHICLE SETUP ===")

# Get current vehicle (may be none)
r = req("get", "/drivers/vehicle", DRV_TOKEN)
if r.status_code == 200:
    v = r.json()
    if v:
        ok(f"GET /drivers/vehicle -> {v.get('brand')} {v.get('model')} ({v.get('plateNumber')})")
        DRV_VEHICLE_ID = v.get("id")
    else:
        ok("GET /drivers/vehicle -> no vehicle yet, registering...")
        # Register vehicle
        r2 = req("post", "/drivers/vehicle", DRV_TOKEN, json={
            "plateNumber": "AUDIT123",
            "brand": "Toyota",
            "model": "Corolla",
            "year": 2022,
            "color": "Blanco",
            "capacity": 4
        })
        if r2.status_code in (200, 201):
            vid = r2.json().get("vehicleId")
            DRV_VEHICLE_ID = vid
            ok(f"POST /drivers/vehicle -> vehicleId={vid}")
        else:
            fail("POST /drivers/vehicle", f"{r2.status_code}: {r2.text[:200]}")
            DRV_VEHICLE_ID = None
else:
    fail("GET /drivers/vehicle", f"{r.status_code}: {r.text[:200]}")
    DRV_VEHICLE_ID = None

# Test vehicle update if we have one
if DRV_VEHICLE_ID:
    r = req("put", f"/drivers/vehicle/{DRV_VEHICLE_ID}", DRV_TOKEN, json={
        "plateNumber": "AUDIT999",
        "brand": "Toyota",
        "model": "Corolla",
        "year": 2023,
        "color": "Negro",
        "capacity": 4
    })
    if r.status_code == 200:
        ok(f"PUT /drivers/vehicle/{{id}} -> updated plate to AUDIT999")
    else:
        fail("PUT /drivers/vehicle/{id}", f"{r.status_code}: {r.text[:200]}")

# Set driver online
r = req("put", "/drivers/availability", DRV_TOKEN, json={"isOnline": True})
if r.status_code == 204:
    ok("PUT /drivers/availability -> 204")
else:
    warn("PUT /drivers/availability", f"{r.status_code}: {r.text[:100]}")

# Update driver location
r = req("put", "/drivers/location", DRV_TOKEN, json={"lat": -17.780, "lng": -63.182})
if r.status_code == 204:
    ok("PUT /drivers/location -> 204")
else:
    warn("PUT /drivers/location", f"{r.status_code}: {r.text[:100]}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 5. TRIP REQUEST FLOW ===")

# Create trip request (single passenger)
r = req("post", "/trips/requests", BOT_TOKEN, json={
    "originLat": -17.7833, "originLng": -63.1821,
    "originAddress": "Plaza Principal",
    "destinationLat": -17.7700, "destinationLng": -63.1600,
    "destinationAddress": "Equipetrol",
    "isPoolingAllowed": False,
    "estimatedFare": 25,
    "paymentMethod": "cash",
    "serviceTier": "economico",
})
if r.status_code in (200, 201):
    rq = r.json()
    REQ_UUID = rq.get("uuid", "")
    ok(f"POST /trips/requests -> uuid={REQ_UUID[:8]}... status={rq.get('status')}")
else:
    fail("POST /trips/requests", f"{r.status_code}: {r.text[:300]}")
    REQ_UUID = ""

TRIP_UUID = ""
if REQ_UUID:
    time.sleep(0.5)
    r = req("get", f"/trips/requests/{REQ_UUID}", BOT_TOKEN)
    if r.status_code == 200:
        rq2 = r.json()
        assigned = rq2.get("assignedTrip")
        TRIP_UUID = assigned.get("tripUuid", "") if assigned else ""
        ok(f"GET /trips/requests/{{uuid}} -> status={rq2.get('status')}, assignedTrip={'yes' if assigned else 'none'}")
    else:
        fail("GET /trips/requests/{uuid}", f"{r.status_code}: {r.text[:200]}")

    # Cancel
    r = req("delete", f"/trips/requests/{REQ_UUID}", BOT_TOKEN)
    if r.status_code == 204:
        ok("DELETE /trips/requests/{uuid} (cancel) -> 204")
    else:
        warn("DELETE /trips/requests/{uuid}", f"{r.status_code}: {r.text[:100]}")

    if TRIP_UUID:
        r = req("get", f"/trips/{TRIP_UUID}", BOT_TOKEN)
        if r.status_code == 200:
            t = r.json()
            ok(f"GET /trips/{{uuid}} -> status={t.get('status')}, tier={t.get('serviceTier')}, fare=Bs.{t.get('fareAmount',0):.0f}")
        else:
            fail("GET /trips/{uuid}", f"{r.status_code}: {r.text[:200]}")

        r = req("get", f"/trips/{TRIP_UUID}/route", BOT_TOKEN)
        if r.status_code == 200:
            rt = r.json()
            ok(f"GET /trips/{{uuid}}/route -> {len(rt.get('polyline',[]))} nodes, {rt.get('totalTimeSeconds',0):.0f}s")
        elif r.status_code == 422:
            warn("GET /trips/{uuid}/route -> 422 (no graph path)")
        else:
            fail("GET /trips/{uuid}/route", f"{r.status_code}: {r.text[:200]}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 6. DRIVER — PENDING TRIPS ===")

# Create a fresh trip for lifecycle testing
r = req("post", "/trips/requests", BOT_TOKEN, json={
    "originLat": -17.7800, "originLng": -63.1800,
    "originAddress": "Av. Monsenor Rivero",
    "destinationLat": -17.7720, "destinationLng": -63.1650,
    "destinationAddress": "Equipetrol Norte",
    "isPoolingAllowed": False,
    "estimatedFare": 20,
    "paymentMethod": "cash",
    "serviceTier": "confort",
})
LIFECYCLE_REQ_UUID = ""
LIFECYCLE_TRIP_UUID = ""
if r.status_code in (200, 201):
    rq = r.json()
    LIFECYCLE_REQ_UUID = rq.get("uuid", "")
    assigned = rq.get("assignedTrip")
    LIFECYCLE_TRIP_UUID = assigned.get("tripUuid","") if assigned else ""
    ok(f"Created lifecycle trip request -> reqUuid={LIFECYCLE_REQ_UUID[:8]}...")
else:
    fail("Create lifecycle trip request", f"{r.status_code}: {r.text[:150]}")

# List pending trips (driver sees unassigned Scheduled trips)
r = req("get", "/drivers/pending-trips", DRV_TOKEN)
if r.status_code == 200:
    trips = r.json()
    ok(f"GET /drivers/pending-trips -> {len(trips)} trips")
else:
    fail("GET /drivers/pending-trips", f"{r.status_code}: {r.text[:200]}")

# Single pending trip (first one)
r = req("get", "/drivers/pending-trip", DRV_TOKEN)
if r.status_code == 200:
    t = r.json()
    if t:
        ok(f"GET /drivers/pending-trip -> uuid={str(t.get('tripUuid',''))[:8]}...")
        if not LIFECYCLE_TRIP_UUID:
            LIFECYCLE_TRIP_UUID = t.get("tripUuid","")
    else:
        ok("GET /drivers/pending-trip -> null (none available)")
else:
    fail("GET /drivers/pending-trip", f"{r.status_code}: {r.text[:200]}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 7. TRIP LIFECYCLE (accept->arrive->pickup->start->complete) ===")

if LIFECYCLE_TRIP_UUID:
    # Accept
    r = req("post", f"/drivers/trips/{LIFECYCLE_TRIP_UUID}/accept", DRV_TOKEN)
    if r.status_code in (200, 204):
        ok(f"POST /drivers/trips/{{uuid}}/accept -> {r.status_code}")
    else:
        fail("POST /drivers/trips/{uuid}/accept", f"{r.status_code}: {r.text[:200]}")

    # Verify serviceTier is correct (confort, not economico)
    r = req("get", f"/trips/{LIFECYCLE_TRIP_UUID}", DRV_TOKEN)
    if r.status_code == 200:
        t = r.json()
        tier = t.get("serviceTier", "")
        if tier == "confort":
            ok(f"serviceTier correctly returned as 'confort' (not defaulting to economico)")
        else:
            fail(f"serviceTier expected 'confort', got '{tier}'")
        ok(f"Trip after accept -> status={t.get('status')}, driver={'yes' if t.get('driver') else 'none'}, vehicle={'yes' if t.get('vehicle') else 'none'}")
    else:
        fail("GET /trips/{uuid} after accept", f"{r.status_code}: {r.text[:200]}")

    # Arrive
    r = req("post", f"/drivers/trips/{LIFECYCLE_TRIP_UUID}/arrive", DRV_TOKEN)
    if r.status_code in (200, 204):
        ok(f"POST /drivers/trips/{{uuid}}/arrive -> {r.status_code}")
    else:
        fail("POST /drivers/trips/{uuid}/arrive", f"{r.status_code}: {r.text[:200]}")

    # Verify arrivedAt persisted
    r = req("get", f"/trips/{LIFECYCLE_TRIP_UUID}", BOT_TOKEN)
    if r.status_code == 200:
        t = r.json()
        if t.get("arrivedAt"):
            ok(f"arrivedAt persisted -> {t['arrivedAt'][:19]}")
        else:
            fail("arrivedAt not persisted after /arrive")

    # Get passenger UUID for pickup/dropoff
    passengers = t.get("passengers", [])
    pass_uuid = passengers[0].get("passengerUuid","") if passengers else ""

    if pass_uuid:
        # Pickup passenger — correct URL: /passengers/{uuid}/pickup
        r = req("post", f"/drivers/trips/{LIFECYCLE_TRIP_UUID}/passengers/{pass_uuid}/pickup", DRV_TOKEN)
        if r.status_code in (200, 204):
            ok(f"POST /drivers/trips/{{uuid}}/passengers/{{passUuid}}/pickup -> {r.status_code}")
        else:
            fail("POST /drivers/trips/{uuid}/passengers/{passUuid}/pickup", f"{r.status_code}: {r.text[:200]}")
    else:
        warn("No passengers found on trip — skipping pickup/dropoff")

    # Start trip
    r = req("post", f"/drivers/trips/{LIFECYCLE_TRIP_UUID}/start", DRV_TOKEN)
    if r.status_code in (200, 204):
        ok(f"POST /drivers/trips/{{uuid}}/start -> {r.status_code}")
    else:
        fail("POST /drivers/trips/{uuid}/start", f"{r.status_code}: {r.text[:200]}")

    # Verify status = in_progress
    r = req("get", f"/trips/{LIFECYCLE_TRIP_UUID}", BOT_TOKEN)
    if r.status_code == 200:
        t = r.json()
        if t.get("status") == "in_progress":
            ok("Trip status = in_progress")
        else:
            fail(f"Expected in_progress, got '{t.get('status')}'")

    # Route during in_progress
    r = req("get", f"/trips/{LIFECYCLE_TRIP_UUID}/route", BOT_TOKEN)
    if r.status_code == 200:
        rt = r.json()
        ok(f"GET /trips/{{uuid}}/route (in_progress) -> {len(rt.get('polyline',[]))} nodes")
    elif r.status_code == 422:
        warn("Route -> 422 (no graph path)")
    else:
        fail("GET /trips/{uuid}/route during in_progress", f"{r.status_code}: {r.text[:100]}")

    # Dropoff passenger
    if pass_uuid:
        r = req("post", f"/drivers/trips/{LIFECYCLE_TRIP_UUID}/passengers/{pass_uuid}/dropoff", DRV_TOKEN)
        if r.status_code in (200, 204):
            ok(f"POST /drivers/trips/{{uuid}}/passengers/{{passUuid}}/dropoff -> {r.status_code}")
        else:
            fail("POST /drivers/trips/{uuid}/passengers/{passUuid}/dropoff", f"{r.status_code}: {r.text[:200]}")

    # Complete trip
    r = req("post", f"/drivers/trips/{LIFECYCLE_TRIP_UUID}/complete", DRV_TOKEN)
    if r.status_code in (200, 204):
        ok(f"POST /drivers/trips/{{uuid}}/complete -> {r.status_code}")
    else:
        fail("POST /drivers/trips/{uuid}/complete", f"{r.status_code}: {r.text[:200]}")

    # Verify final status = completed
    r = req("get", f"/trips/{LIFECYCLE_TRIP_UUID}", BOT_TOKEN)
    if r.status_code == 200:
        t = r.json()
        if t.get("status") == "completed":
            ok("Trip status = completed")
        else:
            fail(f"Expected completed, got '{t.get('status')}'")

    # Submit rating (passenger rates driver)
    r = req("post", "/ratings", BOT_TOKEN, json={
        "tripUuid": LIFECYCLE_TRIP_UUID,
        "ratedUserUuid": DRV_USER.get("uuid", ""),
        "score": 5,
        "comment": "Audit test rating"
    })
    if r.status_code in (200, 201):
        ok("POST /ratings -> submitted")
    else:
        fail("POST /ratings", f"{r.status_code}: {r.text[:200]}")

    # Duplicate rating must be rejected
    r = req("post", "/ratings", BOT_TOKEN, json={
        "tripUuid": LIFECYCLE_TRIP_UUID,
        "ratedUserUuid": DRV_USER.get("uuid", ""),
        "score": 3,
    })
    if r.status_code in (400, 409, 422):
        ok(f"Duplicate rating correctly rejected -> {r.status_code}")
    else:
        warn("Duplicate rating", f"expected 4xx, got {r.status_code}")

else:
    warn("No lifecycle trip UUID — skipping lifecycle test")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 8. DRIVER HISTORY ===")

r = req("get", "/drivers/trips/history", DRV_TOKEN)
if r.status_code == 200:
    dh = r.json()
    ok(f"GET /drivers/trips/history -> {len(dh)} items")
    if dh:
        sample = dh[0]
        needed = ["tripUuid","createdAt","originAddress","destinationAddress","fareAmount","status"]
        missing = [k for k in needed if k not in sample]
        if missing:
            warn("Driver history item missing keys", str(missing))
        else:
            ok("Driver history item shape OK")
else:
    fail("GET /drivers/trips/history", f"{r.status_code}: {r.text[:200]}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 9. PASSENGER HISTORY ===")

r = req("get", "/trips/history", PASS_TOKEN)
if r.status_code == 200:
    h = r.json()
    ok(f"GET /trips/history -> {len(h)} items")
    if h:
        sample = h[0]
        needed = ["tripUuid","createdAt","originAddress","destinationAddress","fareAmount","status"]
        missing = [k for k in needed if k not in sample]
        if missing:
            warn("History item missing keys", str(missing))
        else:
            ok("History item shape OK")
else:
    fail("GET /trips/history", f"{r.status_code}: {r.text[:200]}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 10. POOLING — Share Requests ===")

# Register dedicated pooling test accounts (idempotent)
for email, phone, first in [("poolpax1@test.com", "71110001", "Pool"), ("poolpax2@test.com", "71110002", "Pool2")]:
    req("post", "/auth/register", json={
        "firstName": first, "lastName": "Pax",
        "email": email, "phone": phone,
        "password": PASS, "role": "passenger"
    })

r2 = req("post", "/auth/login", json={"email": "poolpax1@test.com", "password": PASS})
r3 = req("post", "/auth/login", json={"email": "poolpax2@test.com", "password": PASS})

if r2.status_code == 200 and r3.status_code == 200:
    T2 = r2.json()["accessToken"]
    T3 = r3.json()["accessToken"]
    ok("Login poolpax1 + poolpax2")

    def create_trip_req(token, olat, olng, dlat, dlng, addr_o, addr_d):
        r = req("post", "/trips/requests", token, json={
            "originLat": olat, "originLng": olng, "originAddress": addr_o,
            "destinationLat": dlat, "destinationLng": dlng, "destinationAddress": addr_d,
            "isPoolingAllowed": True, "estimatedFare": 22, "paymentMethod": "cash",
            "serviceTier": "economico",
        })
        if r.status_code in (200, 201):
            d = r.json()
            return d.get("uuid"), (d.get("assignedTrip") or {}).get("tripUuid", "")
        return None, None

    req_uuid_a, _ = create_trip_req(T2,
        -17.7810, -63.1810, -17.7700, -63.1620,
        "Av. Brasil", "Barrio Equipetrol")
    req_uuid_b, _ = create_trip_req(T3,
        -17.7815, -63.1808, -17.7698, -63.1618,
        "Av. Brasil 2", "Barrio Equipetrol 2")

    if req_uuid_a and req_uuid_b:
        ok(f"Two pooling requests -> A={req_uuid_a[:8]}... B={req_uuid_b[:8]}...")

        # Nearby partner search
        r = req("get", f"/trips/requests/{req_uuid_a}/nearby", T2)
        if r.status_code == 200:
            partner = r.json()
            ok(f"GET /trips/requests/{{uuid}}/nearby -> partner={'found' if partner else 'none'}")
        else:
            warn("GET /trips/requests/{uuid}/nearby", f"{r.status_code}: {r.text[:100]}")

        # Create share request
        r = req("post", "/trips/share-requests", T2, json={
            "myRequestUuid": req_uuid_a,
            "targetRequestUuid": req_uuid_b,
        })
        if r.status_code == 200:
            sr_uuid = r.json().get("uuid", "")
            ok(f"POST /trips/share-requests -> {sr_uuid[:8]}...")

            # Poll share request
            r = req("get", f"/trips/share-requests/{sr_uuid}", T2)
            if r.status_code == 200:
                sr = r.json()
                ok(f"GET /trips/share-requests/{{uuid}} -> status={sr.get('status')}")
            else:
                fail("GET /trips/share-requests/{uuid}", f"{r.status_code}: {r.text[:100]}")

            # Incoming for pasajero2
            r = req("get", f"/trips/share-requests/incoming?requestUuid={req_uuid_b}", T3)
            if r.status_code == 200:
                incoming = r.json()
                ok(f"GET /trips/share-requests/incoming -> {'found' if incoming else 'none'}")
            else:
                fail("GET share-requests/incoming", f"{r.status_code}: {r.text[:100]}")

            # Accept
            r = req("post", f"/trips/share-requests/{sr_uuid}/accept", T3)
            if r.status_code == 200:
                combined = r.json().get("combinedTripUuid", "")
                ok(f"POST /share-requests/{{uuid}}/accept -> combinedTrip={combined[:8] if combined else 'none'}...")
                if combined:
                    r = req("get", f"/trips/{combined}", T2)
                    if r.status_code == 200:
                        ct = r.json()
                        ok(f"Combined trip -> status={ct.get('status')}, passengers={ct.get('totalPassengers')}, fare=Bs.{ct.get('fareAmount',0):.0f}")
                    else:
                        fail("GET combined trip", f"{r.status_code}: {r.text[:100]}")
            else:
                fail("POST /share-requests/{uuid}/accept", f"{r.status_code}: {r.text[:200]}")
        else:
            fail("POST /trips/share-requests", f"{r.status_code}: {r.text[:200]}")
else:
    warn("Could not log in poolpax1/2 for pooling test", f"poolpax1={r2.status_code}, poolpax2={r3.status_code}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 11. ERROR HANDLING ===")

# 404 on nonexistent trip
r = req("get", "/trips/00000000-0000-0000-0000-000000000000", BOT_TOKEN)
if r.status_code == 404:
    ok("Nonexistent trip -> 404")
else:
    warn("Nonexistent trip", f"expected 404, got {r.status_code}")

# Unauthorized access (no token)
r = req("get", "/trips/history")
if r.status_code == 401:
    ok("GET /trips/history no token -> 401")
else:
    warn("No token", f"expected 401, got {r.status_code}")

# Passenger can't call driver endpoint
r = req("post", "/drivers/trips/00000000-0000-0000-0000-000000000000/accept", BOT_TOKEN)
if r.status_code in (401, 403):
    ok(f"Passenger calling driver endpoint -> {r.status_code} (correct)")
else:
    warn("Passenger calling driver endpoint", f"expected 401/403, got {r.status_code}")

# Driver can't cancel passenger trip request
if LIFECYCLE_REQ_UUID:
    r = req("delete", f"/trips/requests/{LIFECYCLE_REQ_UUID}", DRV_TOKEN)
    if r.status_code in (400, 401, 403):
        ok(f"Driver can't cancel passenger request -> {r.status_code} (blocked)")
    else:
        warn("Driver cancelling passenger request", f"got {r.status_code}: {r.text[:100]}")

# Bad UUID format
r = req("get", "/trips/not-a-uuid", BOT_TOKEN)
if r.status_code in (400, 404):
    ok(f"Malformed UUID -> {r.status_code}")
else:
    warn("Malformed UUID", f"expected 400/404, got {r.status_code}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 12. PERSISTENCE CHECKS ===")

# Verify rating average updated
r = req("get", "/users/profile", DRV_TOKEN)
if r.status_code == 200:
    dm = r.json()
    ok(f"Driver profile after audit -> rating={dm.get('ratingAverage',0):.2f}, trips={dm.get('totalTrips',0)}")
else:
    warn("GET /users/profile (driver)", f"{r.status_code}")

# Verify completed trip appears in driver history
r = req("get", "/drivers/trips/history", DRV_TOKEN)
if r.status_code == 200:
    history = r.json()
    if LIFECYCLE_TRIP_UUID:
        found = any(item.get("tripUuid") == LIFECYCLE_TRIP_UUID for item in history)
        if found:
            ok("Completed trip appears in driver history")
        else:
            warn("Completed trip NOT found in driver history — may be shape mismatch")
else:
    warn("GET /drivers/trips/history for persistence check", f"{r.status_code}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
total  = len(results)
passed = sum(1 for s, _ in results if s == "OK")
warned = sum(1 for s, _ in results if s == "WARN")
failed = sum(1 for s, _ in results if s == "FAIL")

print(f"\nRESULT: {passed}/{total} OK  |  {warned} WARN  |  {failed} FAIL\n")

if failed:
    print("FAILURES:")
    for s, l in results:
        if s == "FAIL":
            print(f"  x {l}")

if warned:
    print("\nWARNINGS:")
    for s, l in results:
        if s == "WARN":
            print(f"  ! {l}")
