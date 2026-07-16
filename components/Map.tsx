"use client";

import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Waypoint } from "@/types/mission";

const INITIAL_ZOOM = 13;

// Marker shrinks as the map zooms in, allowing more precise clicking.
const MARKER_MAX_PX = 40; // zoomed out
const MARKER_MIN_PX = 15; // zoomed in
const ZOOM_MIN = 10;
const ZOOM_MAX = 18;

export type DrawMode = "free" | "square" | "triangle";

const LOOP_SNAP_PIXELS = 15;

type MapProps = {
  waypoints: Waypoint[];
  isClosedLoop: boolean;
  satellite: boolean;
  drawMode: DrawMode;
  // Incrementing counters trigger the matching map action from the toolbar.
  focusNonce: number;
  fitNonce: number;
  onAddWaypoint: (lat: number, lng: number) => void;
  onCloseLoop: () => void;
  onGenerateShape: (lat: number, lng: number) => void;
  onMoveWaypoint: (id: string, lat: number, lng: number) => void;
  onInsertWaypoint: (index: number, lat: number, lng: number) => void;
  onTranslateShape: (deltaLat: number, deltaLng: number) => void;
};

const TILE_LAYERS = {
  vector: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
} as const;

// Transparent labels-only overlay stacked above the satellite imagery.
const SATELLITE_LABELS_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png";

// Runs toolbar map actions from inside the MapContainer, where useMap() always
// resolves to the live map (avoids StrictMode's detached-instance pitfalls).
function MapCommands({
  waypoints,
  focusNonce,
  fitNonce,
}: {
  waypoints: Waypoint[];
  focusNonce: number;
  fitNonce: number;
}) {
  const map = useMap();
  const wpRef = useRef(waypoints);
  wpRef.current = waypoints;

  // Center on Waypoint 1.
  useEffect(() => {
    if (focusNonce === 0) return;
    const wps = wpRef.current;
    if (wps.length === 0) return;
    map.setView([wps[0].lat, wps[0].lng], map.getZoom(), { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // Fit the view to the whole flight path.
  useEffect(() => {
    if (fitNonce === 0) return;
    const wps = wpRef.current;
    if (wps.length === 0) return;
    if (wps.length === 1) {
      map.setView([wps[0].lat, wps[0].lng], map.getZoom());
      return;
    }
    const lats = wps.map((w) => w.lat);
    const lngs = wps.map((w) => w.lng);
    // Zoom animation is unreliable here, so fit without animating.
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [48, 48], animate: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  return null;
}

function MapEvents({
  waypoints,
  drawMode,
  onAddWaypoint,
  onCloseLoop,
  onGenerateShape,
  onZoomChange,
}: {
  waypoints: Waypoint[];
  drawMode: DrawMode;
  onAddWaypoint: (lat: number, lng: number) => void;
  onCloseLoop: () => void;
  onGenerateShape: (lat: number, lng: number) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      // Shape presets: the click is the shape center.
      if (drawMode !== "free") {
        onGenerateShape(e.latlng.lat, e.latlng.lng);
        return;
      }
      // Loop closure via pixel distance so snapping is zoom-independent.
      if (waypoints.length >= 3) {
        const firstPoint = map.latLngToContainerPoint([
          waypoints[0].lat,
          waypoints[0].lng,
        ]);
        if (e.containerPoint.distanceTo(firstPoint) < LOOP_SNAP_PIXELS) {
          onCloseLoop();
          return;
        }
      }
      onAddWaypoint(e.latlng.lat, e.latlng.lng);
    },
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });
  return null;
}

function markerSizeForZoom(zoom: number) {
  const t = Math.min(1, Math.max(0, (zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)));
  return Math.round(MARKER_MAX_PX - t * (MARKER_MAX_PX - MARKER_MIN_PX));
}

function numberedIcon(index: number, size: number) {
  const fontSize = Math.max(8, Math.round(size * 0.42));
  return L.divIcon({
    className: "waypoint-marker",
    html: `<div class="box-border rounded-full bg-orange-500 text-white border-2 border-white flex items-center justify-center font-bold shadow-md" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">${index + 1}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Smaller, semi-transparent "ghost" marker sitting on each path segment;
// clicking it inserts a real waypoint there.
function ghostIcon(size: number) {
  const g = Math.max(10, Math.round(size * 0.6));
  return L.divIcon({
    className: "waypoint-ghost",
    html: `<div class="box-border rounded-full border-2 border-dashed border-orange-500 bg-orange-500/20 opacity-70" style="width:${g}px;height:${g}px;"></div>`,
    iconSize: [g, g],
    iconAnchor: [g / 2, g / 2],
  });
}

type Midpoint = { lat: number; lng: number; insertIndex: number };

// Geographic center of every consecutive waypoint pair (plus the closing
// last->first leg when the loop is closed). insertIndex is where a new
// waypoint must be spliced to keep the path order.
function computeMidpoints(
  waypoints: Waypoint[],
  isClosedLoop: boolean,
): Midpoint[] {
  const mids: Midpoint[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    mids.push({
      lat: (a.lat + b.lat) / 2,
      lng: (a.lng + b.lng) / 2,
      insertIndex: i + 1,
    });
  }
  if (isClosedLoop && waypoints.length >= 2) {
    const last = waypoints[waypoints.length - 1];
    const first = waypoints[0];
    mids.push({
      lat: (last.lat + first.lat) / 2,
      lng: (last.lng + first.lng) / 2,
      insertIndex: waypoints.length,
    });
  }
  return mids;
}

// Distinct white "anchor" node used to translate the whole shape.
function anchorIcon() {
  return L.divIcon({
    className: "mission-anchor",
    html: `<div class="flex items-center justify-center border-2 border-orange-500 bg-white shadow-md" style="width:22px;height:22px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// Geographic center of the closed mission polygon, as [lat, lng].
function shapeCentroid(waypoints: Waypoint[]): [number, number] | null {
  if (waypoints.length < 3) return null;
  const ring = waypoints.map((w) => [w.lng, w.lat]);
  ring.push([waypoints[0].lng, waypoints[0].lat]); // close the ring
  const c = turf.centroid(turf.polygon([ring]));
  const [lng, lat] = c.geometry.coordinates;
  return [lat, lng];
}

export default function Map({
  waypoints,
  isClosedLoop,
  satellite,
  drawMode,
  focusNonce,
  fitNonce,
  onAddWaypoint,
  onCloseLoop,
  onGenerateShape,
  onMoveWaypoint,
  onInsertWaypoint,
  onTranslateShape,
}: MapProps) {
  const [currentZoom, setCurrentZoom] = useState(INITIAL_ZOOM);
  const markerSize = markerSizeForZoom(currentZoom);

  const path: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);
  if (isClosedLoop && waypoints.length > 0) {
    path.push([waypoints[0].lat, waypoints[0].lng]);
  }

  // Midpoint ghosts and the translation anchor only apply in free-draw mode.
  const midpoints =
    drawMode === "free" ? computeMidpoints(waypoints, isClosedLoop) : [];
  const anchor =
    drawMode === "free" && isClosedLoop ? shapeCentroid(waypoints) : null;

  return (
    <>
      <svg style={{ width: 0, height: 0, position: "absolute" }}>
        <defs>
          <pattern
            id="hazard-lines"
            width="10"
            height="10"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="10"
              stroke="#f97316"
              strokeWidth="2"
              opacity="0.5"
            />
          </pattern>
        </defs>
      </svg>
      <MapContainer
        center={[17.6805, 74.0183]}
        zoom={INITIAL_ZOOM}
        style={{ width: "100%", height: "100%" }}
      >
      {satellite ? (
        <>
          <TileLayer
            key="satellite"
            attribution={TILE_LAYERS.satellite.attribution}
            url={TILE_LAYERS.satellite.url}
          />
          {/* Transparent labels overlay floats above the imagery. */}
          <TileLayer
            key="satellite-labels"
            url={SATELLITE_LABELS_URL}
            zIndex={10}
          />
        </>
      ) : (
        <TileLayer
          key="vector"
          attribution={TILE_LAYERS.vector.attribution}
          url={TILE_LAYERS.vector.url}
        />
      )}
      <MapCommands
        waypoints={waypoints}
        focusNonce={focusNonce}
        fitNonce={fitNonce}
      />
      <MapEvents
        waypoints={waypoints}
        drawMode={drawMode}
        onAddWaypoint={onAddWaypoint}
        onCloseLoop={onCloseLoop}
        onGenerateShape={onGenerateShape}
        onZoomChange={setCurrentZoom}
      />
      {midpoints.map((mid) => (
        <Marker
          key={`ghost-${mid.insertIndex}-${mid.lat.toFixed(5)}-${mid.lng.toFixed(5)}`}
          position={[mid.lat, mid.lng]}
          icon={ghostIcon(markerSize)}
          eventHandlers={{
            click: () => onInsertWaypoint(mid.insertIndex, mid.lat, mid.lng),
          }}
        />
      ))}
      {waypoints.map((wp, i) => (
        <Marker
          key={wp.id}
          position={[wp.lat, wp.lng]}
          icon={numberedIcon(i, markerSize)}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const { lat, lng } = marker.getLatLng();
              onMoveWaypoint(wp.id, lat, lng);
            },
          }}
        />
      ))}
      {anchor && (
        <Marker
          key="mission-anchor"
          position={anchor}
          icon={anchorIcon()}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const { lat, lng } = marker.getLatLng();
              onTranslateShape(lat - anchor[0], lng - anchor[1]);
            },
          }}
        />
      )}
      {isClosedLoop && waypoints.length >= 3 ? (
        <Polygon
          positions={waypoints.map((w) => [w.lat, w.lng])}
          pathOptions={{
            color: "#f97316",
            weight: 3,
            fillColor: "url(#hazard-lines)",
            fillOpacity: 1,
          }}
        />
      ) : (
        path.length > 1 && (
          <Polyline
            positions={path}
            pathOptions={{ color: "#f97316", weight: 3 }}
          />
        )
      )}
      </MapContainer>
    </>
  );
}
