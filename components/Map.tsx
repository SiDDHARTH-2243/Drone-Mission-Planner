"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import type { Waypoint } from "@/types/mission";

type MapProps = {
  waypoints: Waypoint[];
  isClosedLoop: boolean;
  onAddWaypoint: (lat: number, lng: number) => void;
  onMoveWaypoint: (id: string, lat: number, lng: number) => void;
};

function ClickHandler({
  onAddWaypoint,
}: {
  onAddWaypoint: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onAddWaypoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function numberedIcon(index: number) {
  return L.divIcon({
    className: "waypoint-marker",
    html: `<div class="wp-pin"><span>WP ${index + 1}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export default function Map({
  waypoints,
  isClosedLoop,
  onAddWaypoint,
  onMoveWaypoint,
}: MapProps) {
  const path: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);
  if (isClosedLoop && waypoints.length > 0) {
    path.push([waypoints[0].lat, waypoints[0].lng]);
  }

  return (
    <MapContainer
      center={[17.6805, 74.0183]}
      zoom={13}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onAddWaypoint={onAddWaypoint} />
      {waypoints.map((wp, i) => (
        <Marker
          key={wp.id}
          position={[wp.lat, wp.lng]}
          icon={numberedIcon(i)}
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
      {path.length > 1 && (
        <Polyline positions={path} pathOptions={{ color: "#38bdf8", weight: 3 }} />
      )}
    </MapContainer>
  );
}
