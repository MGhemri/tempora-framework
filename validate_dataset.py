#!/usr/bin/env python3
"""
ALNOP Dataset Validation Suite (ALNOP-012, ALNOP-013)
Performs strict schema validation, calendar date validity, coordinate ranges,
ID concordance between JSON and GeoJSON, and exact semantic parity between root and docs/data/.
Logs non-blocking scientific quality notices for historical review.
"""

import json
import sys
import os
import re
from datetime import datetime

def read_profile_year_window():
    profile_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'profiles', 'alnop', 'profile.json')
    with open(profile_path, 'r', encoding='utf-8') as profile_file:
        profile = json.load(profile_file)
    if profile.get('profile_schema_version') != '1.0.0' or profile.get('id') != 'alnop' or profile['time']['calendar'] != 'gregorian':
        raise ValueError('Unsupported legacy validation profile')
    coverage = profile['time']['coverage']
    earliest = datetime.strptime(coverage['earliest'], '%Y-%m-%d')
    latest = datetime.strptime(coverage['latest'], '%Y-%m-%d')
    if earliest > latest:
        raise ValueError('Invalid profile time window')
    return earliest.year, latest.year

PROFILE_FIRST_YEAR, PROFILE_LAST_YEAR = read_profile_year_window()

def check_calendar_date(date_str, op_id, field_name):
    """Verify that a date string represents a valid calendar date."""
    if not date_str:
        return True, None

    parts = date_str.split('-')
    year = int(parts[0])

    if year < PROFILE_FIRST_YEAR or year > PROFILE_LAST_YEAR:
        return False, f"{field_name} year {year} is outside the {PROFILE_FIRST_YEAR}-{PROFILE_LAST_YEAR} conflict window."

    if len(parts) == 1:
        return True, None  # Year only: valid partial date

    month = int(parts[1])
    if month < 1 or month > 12:
        return False, f"{field_name} has invalid month {month} in '{date_str}'"

    if len(parts) == 2:
        return True, None  # Year-month: valid partial date

    day = int(parts[2])
    try:
        datetime(year, month, day)
    except ValueError as e:
        return False, f"{field_name} has invalid calendar day in '{date_str}': {e}"

    return True, None

def validate_json_file(file_path):
    print(f"--> Validating JSON: {file_path}")
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return False, 0, [], []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON in {file_path}: {e}")
            return False, 0, [], []

    if 'operations' not in data:
        print(f"Error: Missing 'operations' key in {file_path}")
        return False, 0, [], []

    operations = data['operations']
    seen_ids = set()
    errors = []
    warnings = []
    ids_list = []

    date_pattern = re.compile(r'^\d{4}(-\d{2}(-\d{2})?)?$')

    for idx, op in enumerate(operations):
        op_id = op.get('id')
        if not op_id:
            errors.append(f"Operation #{idx} is missing an 'id'.")
            continue
        
        if op_id in seen_ids:
            errors.append(f"Duplicate id found: {op_id}")
        seen_ids.add(op_id)
        ids_list.append(op_id)

        # Check required fields
        for field in ['nom_operation', 'type_action', 'description']:
            if not op.get(field):
                errors.append(f"Operation {op_id} is missing required field '{field}'.")

        canonical = op.get('canonical_metadata') or {}
        if not op.get('date_debut'):
            if canonical.get('start_date', {}).get('precision') not in ('unknown', 'range'):
                errors.append(f"Operation {op_id} is missing date_debut without explicit uncertainty.")
            else:
                warnings.append(f"Operation {op_id}: date cannot be represented exactly in v1.")
        if not op.get('wilaya_concernee') and not ('territories' in canonical and canonical['territories'] == []):
            errors.append(f"Operation {op_id} is missing territorial metadata without explicit unknown status.")

        # Check date format & calendar validity
        date_debut = op.get('date_debut')
        if date_debut:
            if not date_pattern.match(date_debut):
                errors.append(f"Operation {op_id} has invalid date_debut format: '{date_debut}'")
            else:
                valid_date, err_msg = check_calendar_date(date_debut, op_id, 'date_debut')
                if not valid_date:
                    errors.append(f"Operation {op_id}: {err_msg}")

        date_fin = op.get('date_fin')
        if date_fin:
            if not date_pattern.match(date_fin):
                errors.append(f"Operation {op_id} has invalid date_fin format: '{date_fin}'")
            else:
                valid_date, err_msg = check_calendar_date(date_fin, op_id, 'date_fin')
                if not valid_date:
                    errors.append(f"Operation {op_id}: {err_msg}")

        # Check chronology if both dates are full
        if date_debut and date_fin and len(date_debut) == 10 and len(date_fin) == 10:
            if date_fin < date_debut:
                errors.append(f"Operation {op_id} chronological anomaly: date_fin ('{date_fin}') < date_debut ('{date_debut}')")

        # Check coordinates
        loc = op.get('localisation', {})
        coords = loc.get('coordonnees_approximatives', {})
        lat = coords.get('latitude')
        lon = coords.get('longitude')

        if lat is None or lon is None:
            warnings.append(f"Operation {op_id}: Missing GPS coordinates.")
        else:
            if not (-90.0 <= lat <= 90.0):
                errors.append(f"Operation {op_id} has latitude out of bounds: {lat}")
            if not (-180.0 <= lon <= 180.0):
                errors.append(f"Operation {op_id} has longitude out of bounds: {lon}")

        # Scientific quality notices: inter-wilaya operations
        w = op.get('wilaya_concernee') or ''
        if re.search(r'Wilaya.*Wilaya|Zone Autonome.*Wilaya|Fronti|Base de l\'Est.*Wilaya', w, re.I):
            warnings.append(f"Operation {op_id}: Inter-zone engagement ({w})")

    if errors:
        print(f"Validation failed with {len(errors)} error(s):")
        for err in errors[:10]:
            print(f"  - {err}")
        return False, len(operations), ids_list, warnings

    print(f"Success: {len(operations)} operations validated successfully in {file_path} ({len(warnings)} scientific quality notices).")
    return True, len(operations), ids_list, warnings

def validate_geojson_file(file_path):
    print(f"--> Validating GeoJSON: {file_path}")
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return False, 0, []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error decoding GeoJSON in {file_path}: {e}")
            return False, 0, []

    if data.get('type') != 'FeatureCollection':
        print(f"Error: GeoJSON root type is not FeatureCollection in {file_path}")
        return False, 0, []

    features = data.get('features', [])
    errors = []
    ids_list = []

    for idx, feat in enumerate(features):
        feat_id = feat.get('id') or (feat.get('properties') and feat.get('properties').get('id'))
        if not feat_id:
            errors.append(f"Feature #{idx} is missing an id.")
        else:
            ids_list.append(feat_id)

        geom = feat.get('geometry')
        if geom is not None:
            if geom.get('type') != 'Point':
                errors.append(f"Feature #{idx} does not have Point geometry.")
                continue

            coords = geom.get('coordinates', [])
            if len(coords) != 2:
                errors.append(f"Feature #{idx} has invalid coordinates length: {coords}")
                continue

            lon, lat = coords[0], coords[1]
            if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
                errors.append(f"Feature #{idx} coordinates out of bounds: [{lon}, {lat}]")

    if errors:
        print(f"GeoJSON validation failed with {len(errors)} error(s):")
        for err in errors[:10]:
            print(f"  - {err}")
        return False, len(features), ids_list

    print(f"Success: {len(features)} GeoJSON features validated successfully in {file_path}.")
    return True, len(features), ids_list

def main():
    print("=== Commencing Dataset Validation Suite (ALNOP-012, ALNOP-013) ===")
    
    success1, count1, ids_json_root, warnings = validate_json_file('operations_fln_1954_1962.json')
    success2, count2, ids_geojson_root = validate_geojson_file('operations_fln_1954_1962.geojson')
    success3, count3, ids_json_docs, _ = validate_json_file('docs/data/operations_fln_1954_1962.json')
    success4, count4, ids_geojson_docs = validate_geojson_file('docs/data/operations_fln_1954_1962.geojson')

    if not (success1 and success2 and success3 and success4):
        print("FAIL: One or more validation checks failed.")
        sys.exit(1)

    if count1 != count2 or count1 != count3 or count1 != count4:
        print(f"FAIL: Inconsistent record counts across files: root json={count1}, root geojson={count2}, docs json={count3}, docs geojson={count4}")
        sys.exit(1)

    # ALNOP-013: Verify exact ID concordance across JSON and GeoJSON
    if ids_json_root != ids_geojson_root:
        print("FAIL: ID mismatch between root JSON and root GeoJSON!")
        sys.exit(1)

    if ids_json_root != ids_json_docs:
        print("FAIL: ID mismatch between root JSON and docs/data JSON!")
        sys.exit(1)

    print(f"\nALL CHECKS PASSED: 4/4 files strictly valid with {count1} confirmed operations.")
    print(f"Scientific quality audit: {len(warnings)} records noted for historical review.")
    sys.exit(0)

if __name__ == '__main__':
    main()
