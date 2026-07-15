"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  useMapEvents,
} from "react-leaflet";
import type { Waypoint } from "@/types/mission";

const INITIAL_ZOOM = 13;

// Marker shrinks as the map zooms in, allowing more precise clicking.
const MARKER_MAX_PX = 40; // zoomed out
const MARKER_MIN_PX = 15; // zoomed in
const ZOOM_MIN = 10;
const ZOOM_MAX = 18;

type MapProps = {
  waypoints: Waypoint[];
  isClosedLoop: boolean;
  onAddWaypoint: (lat: number, lng: number) => void;
  onMoveWaypoint: (id: string, lat: number, lng: number) => void;
};

function MapEvents({
  onAddWaypoint,
  onZoomChange,
}: {
  onAddWaypoint: (lat: number, lng: number) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
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
    html: `<div class="box-border rounded-full bg-blue-500 text-white border-2 border-white flex items-center justify-center font-bold shadow-md" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">${index + 1}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function Map({
  waypoints,
  isClosedLoop,
  onAddWaypoint,
  onMoveWaypoint,
}: MapProps) {
  const [currentZoom, setCurrentZoom] = useState(INITIAL_ZOOM);
  const markerSize = markerSizeForZoom(currentZoom);

  const path: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);
  if (isClosedLoop && waypoints.length > 0) {
    path.push([waypoints[0].lat, waypoints[0].lng]);
  }

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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onAddWaypoint={onAddWaypoint} onZoomChange={setCurrentZoom} />
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
      {isClosedLoop && waypoints.length >= 3 ? (
        <Polygon
          positions={waypoints.map((w) => [w.lat, w.lng])}
          pathOptions={{
            color: "#38bdf8",
            weight: 3,
            fillColor: "url(#hazard-lines)",
            fillOpacity: 1,
          }}
        />
      ) : (
        path.length > 1 && (
          <Polyline
            positions={path}
            pathOptions={{ color: "#38bdf8", weight: 3 }}
          />
        )
      )}
      </MapContainer>
    </>
  );
}
