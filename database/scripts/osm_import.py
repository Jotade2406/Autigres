"""
osm_import.py — Downloads OSM road network for Santa Cruz de la Sierra
and generates SQL INSERT statements for graph_nodes and graph_edges.

Road types included: motorway, trunk, primary, secondary, tertiary
(and their _link variants) — main streets only, no residential.

Output: osm_graph.sql — run against Aiven autigres_db
"""

import json
import math
import time
import requests

# Santa Cruz de la Sierra urban area bounding box (south,west,north,east)
BBOX = "-17.850,-63.230,-17.660,-63.020"

HIGHWAY_SPEEDS_KPH = {
    "motorway": 100,
    "motorway_link": 80,
    "trunk": 80,
    "trunk_link": 60,
    "primary": 60,
    "primary_link": 50,
    "secondary": 50,
    "secondary_link": 40,
    "tertiary": 40,
    "tertiary_link": 35,
}

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

OVERPASS_QUERY = f"""
[out:json][timeout:180][bbox:{BBOX}];
(
  way[highway~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link)$"];
);
out body;
>;
out skel qt;
"""


def haversine_meters(lat1, lng1, lat2, lng2):
    R = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


HEADERS = {
    "User-Agent": "autigres-osm-importer/1.0 (autigres ride-pooling app, Santa Cruz Bolivia)",
    "Accept-Encoding": "gzip",
}

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]


def fetch_osm():
    print("Querying Overpass API (this may take 1-3 minutes)...")
    last_err = None
    for mirror in MIRRORS:
        try:
            print(f"  Trying {mirror}...")
            resp = requests.post(
                mirror,
                data={"data": OVERPASS_QUERY},
                headers=HEADERS,
                timeout=240,
            )
            resp.raise_for_status()
            print(f"  Got {len(resp.content) // 1024:,} KB")
            return resp.json()
        except Exception as e:
            print(f"  Failed: {e}")
            last_err = e
    raise RuntimeError(f"All mirrors failed. Last: {last_err}")


def process_osm(data):
    # Index all nodes by OSM id
    osm_nodes = {}  # osm_id -> {"lat": float, "lng": float}
    ways = []

    for elem in data["elements"]:
        if elem["type"] == "node":
            osm_nodes[elem["id"]] = {"lat": elem["lat"], "lng": elem["lon"]}
        elif elem["type"] == "way":
            tags = elem.get("tags", {})
            highway = tags.get("highway", "")
            if highway in HIGHWAY_SPEEDS_KPH:
                ways.append({
                    "nodes": elem["nodes"],
                    "name": tags.get("name", tags.get("ref", "")),
                    "highway": highway,
                    "oneway": tags.get("oneway", "no") in ("yes", "true", "1", "-1"),
                    "oneway_reversed": tags.get("oneway", "no") == "-1",
                })

    print(f"  Raw OSM: {len(osm_nodes):,} nodes, {len(ways):,} ways")

    # Collect only nodes that are referenced by ways
    used_osm_ids = set()
    for way in ways:
        used_osm_ids.update(way["nodes"])

    # Keep only referenced nodes that have coordinates
    used_osm_ids = {n for n in used_osm_ids if n in osm_nodes}
    print(f"  Referenced nodes: {len(used_osm_ids):,}")

    # Assign sequential DB ids (1-based)
    osm_to_db = {}
    nodes_list = []  # (db_id, osm_id, lat, lng)
    for db_id, osm_id in enumerate(sorted(used_osm_ids), start=1):
        node = osm_nodes[osm_id]
        osm_to_db[osm_id] = db_id
        nodes_list.append((db_id, osm_id, node["lat"], node["lng"]))

    # Build edges: consecutive pairs in each way
    edge_set = set()  # (from_db, to_db) to avoid duplicates
    edges_list = []  # (from_db, to_db, dist_m, time_s, name, bidirectional)
    skipped = 0

    for way in ways:
        highway = way["highway"]
        speed_kph = HIGHWAY_SPEEDS_KPH[highway]
        speed_mps = speed_kph * 1000 / 3600
        road_name = (way["name"] or "")[:200]
        oneway = way["oneway"]
        oneway_reversed = way["oneway_reversed"]

        way_nodes = [n for n in way["nodes"] if n in osm_to_db]

        for i in range(len(way_nodes) - 1):
            osm_a = way_nodes[i]
            osm_b = way_nodes[i + 1]
            if osm_a not in osm_to_db or osm_b not in osm_to_db:
                skipped += 1
                continue

            db_a = osm_to_db[osm_a]
            db_b = osm_to_db[osm_b]

            if db_a == db_b:
                continue

            na = osm_nodes[osm_a]
            nb = osm_nodes[osm_b]
            dist = haversine_meters(na["lat"], na["lng"], nb["lat"], nb["lng"])

            if dist < 1:  # skip zero-length segments
                continue

            time_s = max(1, int(dist / speed_mps))

            if oneway:
                if oneway_reversed:
                    key = (db_b, db_a)
                    if key not in edge_set:
                        edge_set.add(key)
                        edges_list.append((db_b, db_a, dist, time_s, road_name, False))
                else:
                    key = (db_a, db_b)
                    if key not in edge_set:
                        edge_set.add(key)
                        edges_list.append((db_a, db_b, dist, time_s, road_name, False))
            else:
                key = (min(db_a, db_b), max(db_a, db_b))
                if key not in edge_set:
                    edge_set.add(key)
                    edges_list.append((db_a, db_b, dist, time_s, road_name, True))

    print(f"  Edges generated: {len(edges_list):,} (skipped {skipped} missing nodes)")
    return nodes_list, edges_list


def write_sql(nodes_list, edges_list, out_path="osm_graph.sql"):
    CHUNK = 500  # rows per INSERT statement

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("-- OSM graph import for Santa Cruz de la Sierra\n")
        f.write("-- Generated by osm_import.py\n\n")
        f.write("USE autigres_db;\n\n")
        f.write("SET FOREIGN_KEY_CHECKS = 0;\n")
        f.write("TRUNCATE TABLE graph_edges;\n")
        f.write("TRUNCATE TABLE graph_nodes;\n")
        f.write("SET FOREIGN_KEY_CHECKS = 1;\n\n")

        # graph_nodes in chunks
        print(f"Writing {len(nodes_list):,} nodes...")
        for i in range(0, len(nodes_list), CHUNK):
            chunk = nodes_list[i:i + CHUNK]
            f.write("INSERT INTO graph_nodes (id, node_key, lat, lng, city) VALUES\n")
            rows = []
            for db_id, osm_id, lat, lng in chunk:
                rows.append(f"  ({db_id}, '{osm_id}', {lat:.8f}, {lng:.8f}, 'Santa Cruz de la Sierra')")
            f.write(",\n".join(rows))
            f.write(";\n\n")

        # Set AUTO_INCREMENT past our last id
        next_id = len(nodes_list) + 1
        f.write(f"ALTER TABLE graph_nodes AUTO_INCREMENT = {next_id};\n\n")

        # graph_edges in chunks
        print(f"Writing {len(edges_list):,} edges...")
        for i in range(0, len(edges_list), CHUNK):
            chunk = edges_list[i:i + CHUNK]
            f.write("INSERT INTO graph_edges (from_node_id, to_node_id, distance_meters, time_seconds_avg, road_name, is_bidirectional) VALUES\n")
            rows = []
            for from_db, to_db, dist, time_s, name, bidir in chunk:
                safe_name = name.replace("'", "\\'") if name else ""
                bidir_val = 1 if bidir else 0
                rows.append(f"  ({from_db}, {to_db}, {dist:.2f}, {time_s}, '{safe_name}', {bidir_val})")
            f.write(",\n".join(rows))
            f.write(";\n\n")

        next_edge_id = len(edges_list) + 1
        f.write(f"ALTER TABLE graph_edges AUTO_INCREMENT = {next_edge_id};\n")

    size_kb = __import__("os").path.getsize(out_path) // 1024
    print(f"\nSQL file: {out_path} ({size_kb:,} KB)")
    print(f"Summary: {len(nodes_list):,} nodes, {len(edges_list):,} edges")


def main():
    t0 = time.time()
    data = fetch_osm()
    print(f"  Downloaded in {time.time()-t0:.1f}s")

    nodes_list, edges_list = process_osm(data)
    write_sql(nodes_list, edges_list, out_path="database/scripts/osm_graph.sql")

    print(f"\nTotal time: {time.time()-t0:.1f}s")
    print("\nNext step:")
    print("  mysql -h mysql-1d6e1c3b-juand2406-7491.k.aivencloud.com -P 26695 -u avnadmin --ssl-mode=REQUIRED -p autigres_db < database/scripts/osm_graph.sql")


if __name__ == "__main__":
    main()
