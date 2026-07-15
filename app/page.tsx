"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import { DEFAULT_ALTITUDE, type Waypoint } from "@/types/mission";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Home() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const addWaypoint = useCallback((lat: number, lng: number) => {
    setWaypoints((prev) => [
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
    ]);
  }, []);

  const updateAltitude = useCallback((id: string, altitude: number) => {
    setWaypoints((prev) =>
      prev.map((wp) => (wp.id === id ? { ...wp, altitude } : wp)),
    );
  }, []);

  const clearMission = useCallback(() => setWaypoints([]), []);

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <div className="relative flex-1">
        <Map waypoints={waypoints} onAddWaypoint={addWaypoint} />
      </div>
      <ControlPanel
        waypoints={waypoints}
        onAltitudeChange={updateAltitude}
        onClear={clearMission}
      />
    </main>
  );
}
