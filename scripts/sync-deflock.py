#!/usr/bin/env python3
"""
sync-deflock.py — Fetch community ALPR camera data from DeFlock and write
it to data/cameras/cameras.geojson, validated against data/schema.json.

Usage:
    python3 scripts/sync-deflock.py [--endpoint URL] [--output PATH]

Privacy:
    - Sends only the GET request with no session token, user ID, or location.
    - Uses a generic User-Agent to avoid fingerprinting.
    - Output file is local-only; nothing is uploaded.
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_ENDPOINT = "https://deflock.me/api/v1/cameras.geojson"
DEFAULT_OUTPUT = Path(__file__).parent.parent / "data" / "cameras" / "cameras.geojson"
SCHEMA_PATH = Path(__file__).parent.parent / "data" / "schema.json"

REQUIRED_VENDORS = {"flock_safety", "vigilant", "motorola", "unknown"}
REQUIRED_STATUSES = {"active", "inactive", "unverified"}


def fetch_geojson(endpoint: str) -> dict:
    req = urllib.request.Request(
        endpoint,
        headers={
            "User-Agent": "ClearPath/0.1 (privacy-first navigation; OSS)",
            "Accept": "application/geo+json, application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        print(f"ERROR: HTTP {e.code} from {endpoint}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"ERROR: Network error — {e.reason}", file=sys.stderr)
        sys.exit(1)


def validate(data: dict) -> list[str]:
    errors = []
    if data.get("type") != "FeatureCollection":
        errors.append("Root type must be 'FeatureCollection'")
        return errors

    features = data.get("features", [])
    if not isinstance(features, list):
        errors.append("'features' must be an array")
        return errors

    for i, feature in enumerate(features):
        props = feature.get("properties", {})
        fid = props.get("id", f"<index {i}>")

        if feature.get("type") != "Feature":
            errors.append(f"Feature {fid}: type must be 'Feature'")

        geom = feature.get("geometry", {})
        if geom.get("type") != "Point":
            errors.append(f"Feature {fid}: geometry.type must be 'Point'")

        coords = geom.get("coordinates", [])
        if len(coords) < 2:
            errors.append(f"Feature {fid}: coordinates must have [lng, lat]")
        else:
            lng, lat = coords[0], coords[1]
            if not (-180 <= lng <= 180):
                errors.append(f"Feature {fid}: longitude {lng} out of range")
            if not (-90 <= lat <= 90):
                errors.append(f"Feature {fid}: latitude {lat} out of range")

        if props.get("vendor") not in REQUIRED_VENDORS:
            errors.append(f"Feature {fid}: unknown vendor '{props.get('vendor')}'")

        if props.get("status") not in REQUIRED_STATUSES:
            errors.append(f"Feature {fid}: unknown status '{props.get('status')}'")

        if "last_verified" not in props:
            errors.append(f"Feature {fid}: missing 'last_verified'")

    return errors


def normalize(data: dict) -> dict:
    """Ensure generated_at is present and set default avoid_radius_meters."""
    data["generated_at"] = datetime.now(timezone.utc).isoformat()
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        props.setdefault("avoid_radius_meters", 50)
        feature["properties"] = props
    return data


def main():
    parser = argparse.ArgumentParser(description="Sync DeFlock camera data")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="GeoJSON endpoint URL")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output file path")
    parser.add_argument("--no-validate", action="store_true", help="Skip schema validation")
    args = parser.parse_args()

    print(f"Fetching from {args.endpoint} …")
    data = fetch_geojson(args.endpoint)

    if not args.no_validate:
        errors = validate(data)
        if errors:
            print("Validation errors:", file=sys.stderr)
            for err in errors:
                print(f"  • {err}", file=sys.stderr)
            sys.exit(1)
        print(f"Validation OK — {len(data.get('features', []))} features")

    data = normalize(data)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    count = len(data.get("features", []))
    size_kb = output_path.stat().st_size / 1024
    print(f"Written {count} cameras → {output_path} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
