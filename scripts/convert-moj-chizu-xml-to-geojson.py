#!/usr/bin/env python3
"""Convert MOJ registry-map XML zip into Worker-readable GeoJSON.

The Ministry of Justice map XML may use an arbitrary local coordinate system.
When that is the case, geometries are useful as parcel-shape reference only and
must not be treated as WGS84 coordinates. The Worker can still use the feature
properties as lot-number candidates.
"""

from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


TIZU = "{http://www.moj.go.jp/MINJI/tizuxml}"
ZUMEN = "{http://www.moj.go.jp/MINJI/tizuzumen}"


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1]


def child_text(element: ET.Element, name: str) -> str:
    child = element.find(f"{TIZU}{name}")
    return (child.text or "").strip() if child is not None else ""


def first_xml_name(zip_path: Path) -> str:
    with zipfile.ZipFile(zip_path) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith(".xml")]
    if not names:
        raise SystemExit(f"No XML file found in {zip_path}")
    return names[0]


def read_xml_root(zip_path: Path) -> ET.Element:
    with zipfile.ZipFile(zip_path) as archive:
        xml_name = first_xml_name(zip_path)
        with archive.open(xml_name) as handle:
            return ET.parse(handle).getroot()


def direct_position(column: ET.Element, point_lookup: dict[str, list[float]]) -> list[float] | None:
    direct = column.find(f".//{ZUMEN}GM_Position.direct")
    if direct is not None:
        x = direct.findtext(f"{ZUMEN}X")
        y = direct.findtext(f"{ZUMEN}Y")
        if x and y:
            return [float(x), float(y)]
    point_ref = column.find(f".//{ZUMEN}GM_PointRef.point")
    point_id = point_ref.attrib.get("idref") if point_ref is not None else ""
    return point_lookup.get(point_id)


def build_point_lookup(root: ET.Element) -> dict[str, list[float]]:
    points: dict[str, list[float]] = {}
    for point in root.findall(f".//{ZUMEN}GM_Point"):
        point_id = point.attrib.get("id", "")
        x = point.findtext(f".//{ZUMEN}X")
        y = point.findtext(f".//{ZUMEN}Y")
        if point_id and x and y:
            points[point_id] = [float(x), float(y)]
    return points


def build_curve_lookup(root: ET.Element, point_lookup: dict[str, list[float]]) -> dict[str, list[list[float]]]:
    curves: dict[str, list[list[float]]] = {}
    for curve in root.findall(f".//{ZUMEN}GM_Curve"):
        curve_id = curve.attrib.get("id", "")
        if not curve_id:
            continue
        coords: list[list[float]] = []
        for column in curve.findall(f".//{ZUMEN}GM_PointArray.column"):
            position = direct_position(column, point_lookup)
            if position is not None:
                coords.append(position)
        if coords:
            curves[curve_id] = coords
    return curves


def append_curve(ring: list[list[float]], curve: list[list[float]]) -> None:
    for coord in curve:
        if not ring or ring[-1] != coord:
            ring.append(coord)


def build_surface_lookup(root: ET.Element, curve_lookup: dict[str, list[list[float]]]) -> dict[str, list[list[list[float]]]]:
    surfaces: dict[str, list[list[list[float]]]] = {}
    for surface in root.findall(f".//{ZUMEN}GM_Surface"):
        surface_id = surface.attrib.get("id", "")
        if not surface_id:
            continue
        rings: list[list[list[float]]] = []
        exterior = surface.find(f".//{ZUMEN}GM_SurfaceBoundary.exterior")
        if exterior is not None:
            ring: list[list[float]] = []
            for generator in exterior.findall(f".//{ZUMEN}GM_CompositeCurve.generator"):
                curve = curve_lookup.get(generator.attrib.get("idref", ""))
                if curve:
                    append_curve(ring, curve)
            if ring:
                if ring[0] != ring[-1]:
                    ring.append(ring[0])
                rings.append(ring)
        for interior in surface.findall(f".//{ZUMEN}GM_SurfaceBoundary.interior"):
            ring = []
            for generator in interior.findall(f".//{ZUMEN}GM_CompositeCurve.generator"):
                curve = curve_lookup.get(generator.attrib.get("idref", ""))
                if curve:
                    append_curve(ring, curve)
            if ring:
                if ring[0] != ring[-1]:
                    ring.append(ring[0])
                rings.append(ring)
        surfaces[surface_id] = rings
    return surfaces


def parcel_shape_id(parcel: ET.Element) -> str:
    shape = parcel.find(f"{TIZU}形状")
    return shape.attrib.get("idref", "") if shape is not None else ""


def convert(zip_path: Path, output_path: Path, lot_prefix: str | None) -> dict[str, object]:
    root = read_xml_root(zip_path)
    map_name = root.findtext(f"{TIZU}地図名") or ""
    city_code = root.findtext(f"{TIZU}市区町村コード") or ""
    city_name = root.findtext(f"{TIZU}市区町村名") or ""
    coordinate_system = root.findtext(f"{TIZU}座標系") or ""

    point_lookup = build_point_lookup(root)
    curve_lookup = build_curve_lookup(root, point_lookup)
    surface_lookup = build_surface_lookup(root, curve_lookup)

    features: list[dict[str, object]] = []
    for parcel in root.findall(f".//{TIZU}筆"):
        lot_number = child_text(parcel, "地番")
        if lot_prefix and not lot_number.startswith(lot_prefix):
            continue
        oaza = child_text(parcel, "大字名")
        koaza = child_text(parcel, "小字名")
        shape_id = parcel_shape_id(parcel)
        rings = surface_lookup.get(shape_id, [])
        geometry: dict[str, object] | None = None
        if rings:
            geometry = {
                "type": "Polygon",
                "coordinates": rings,
            }
        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "市区町村コード": city_code,
                    "市区町村名": city_name,
                    "地図名": map_name,
                    "座標系": coordinate_system,
                    "大字コード": child_text(parcel, "大字コード"),
                    "丁目コード": child_text(parcel, "丁目コード"),
                    "小字コード": child_text(parcel, "小字コード"),
                    "予備コード": child_text(parcel, "予備コード"),
                    "大字名": oaza,
                    "小字名": koaza,
                    "地番": lot_number,
                    "lotNumber": lot_number,
                    "municipality": city_name,
                    "oaza": oaza,
                    "koaza": koaza,
                    "地図種類": "登記所備付地図",
                    "座標値種別": child_text(parcel, "座標値種別"),
                    "shapeId": shape_id,
                    "sourceZip": str(zip_path),
                    "sourceXml": first_xml_name(zip_path),
                    "warning": "座標系が任意座標系の場合、geometryはWGS84ではなく地番候補・筆界候補の補助参照。",
                },
            }
        )

    output = {
        "type": "FeatureCollection",
        "name": f"moj-chizu-{city_code}-{map_name}",
        "features": features,
        "metadata": {
            "sourceZip": str(zip_path),
            "cityCode": city_code,
            "cityName": city_name,
            "mapName": map_name,
            "coordinateSystem": coordinate_system,
            "featureCount": len(features),
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return output["metadata"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-zip", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--lot-prefix")
    args = parser.parse_args()
    metadata = convert(args.input_zip, args.output, args.lot_prefix)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
