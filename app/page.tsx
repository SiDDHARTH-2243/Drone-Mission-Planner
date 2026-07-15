"use client";

import * as turf from "@turf/turf";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import { DEFAULT_ALTITUDE, type Waypoint } from "@/types/mission";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const LOOP_SNAP_METERS = 25;

export default function Home() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isClosedLoop, setIsClosedLoop] = useState(false);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setWaypoints((prev) => {
      if (prev.length >= 3) {
        const first = prev[0];
        const d = turf.distance(
          turf.point([first.lng, first.lat]),
          turf.point([lng, lat]),
          { units: "meters" },
        );
        if (d <= LOOP_SNAP_METERS) {
          setIsClosedLoop(true);
          return prev;
        }
      }
      setIsClosedLoop(false);
      return [
        ...prev,
        {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lat,
          lng,
          altitude: DEFAULT_ALTITUDE,
        },
      ];
    });
  }, []);

  const updateAltitude = useCallback((id: string, altitude: number) => {
    setWaypoints((prev) =>
      prev.map((wp) => (wp.id === id ? { ...wp, altitude } : wp)),
    );
  }, []);

  const moveWaypoint = useCallback((id: string, lat: number, lng: number) => {
    setWaypoints((prev) =>
      prev.map((wp) => (wp.id === id ? { ...wp, lat, lng } : wp)),
    );
  }, []);

  const deleteWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => {
      const next = prev.filter((wp) => wp.id !== id);
      // A closed loop requires at least 3 points.
      if (next.length < 3) {
        setIsClosedLoop(false);
      }
      return next;
    });
  }, []);

  const clearMission = useCallback(() => {
    setWaypoints([]);
    setIsClosedLoop(false);
  }, []);

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <div className="relative flex-1">
        <Map
          waypoints={waypoints}
          isClosedLoop={isClosedLoop}
          onAddWaypoint={handleMapClick}
          onMoveWaypoint={moveWaypoint}
        />
      </div>
      <ControlPanel
        waypoints={waypoints}
        isClosedLoop={isClosedLoop}
        onAltitudeChange={updateAltitude}
        onDeleteWaypoint={deleteWaypoint}
        onClear={clearMission}
      />
    </main>
  );
}
