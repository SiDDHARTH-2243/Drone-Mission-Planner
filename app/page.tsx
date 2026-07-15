"use client";

import * as turf from "@turf/turf";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import { DEFAULT_ALTITUDE, type Waypoint } from "@/types/mission";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const LOOP_SNAP_METERS = 25;

const NAV_ITEMS: { icon: string; label: string; active?: boolean }[] = [
  { icon: "map", label: "MISSION", active: true },
  { icon: "analytics", label: "TELEMETRY" },
  { icon: "precision_manufacturing", label: "PAYLOAD" },
  { icon: "memory", label: "HARDWARE" },
  { icon: "terminal", label: "TERMINAL" },
];

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
      if (next.length < 3) {
        setIsClosedLoop(false);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (isClosedLoop) {
      setIsClosedLoop(false);
      return;
    }
    setWaypoints((prev) => prev.slice(0, -1));
  }, [isClosedLoop]);

  const clearMission = useCallback(() => {
    setWaypoints([]);
    setIsClosedLoop(false);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-on-background antialiased">
      {/* TopNavBar */}
      <nav className="z-50 flex w-full items-center justify-between border-b border-zinc-800 bg-black px-4 py-2">
        <div className="flex items-center gap-4">
          <span className="text-metric-md font-metric-md font-bold tracking-tighter text-zinc-100">
            SKYCOMMAND GCS
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              search
            </span>
            <input
              className="h-7 w-64 rounded-none border border-zinc-700 bg-zinc-900 py-1 pl-8 pr-2 text-terminal-sm font-terminal-sm text-zinc-300 placeholder-zinc-600 transition-colors focus:border-cyan-neon focus:outline-none"
              placeholder="Search parameters..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-1">
            {["satellite_alt", "settings_input_antenna", "account_circle"].map(
              (icon) => (
                <button
                  key={icon}
                  className="rounded-none p-1 text-zinc-400 transition-colors duration-150 hover:bg-zinc-800 hover:text-cyan-neon"
                >
                  <span className="material-symbols-outlined text-lg">
                    {icon}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      </nav>

      <div className="relative flex flex-1 overflow-hidden">
        {/* SideNavBar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-black py-4 md:flex">
          <div className="mb-6 px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border border-zinc-600 bg-zinc-800">
                <span className="material-symbols-outlined text-sm text-zinc-300">
                  flight
                </span>
              </div>
              <div className="overflow-hidden">
                <h2 className="truncate text-data-mono font-data-mono leading-tight text-zinc-100">
                  UAV-01 ALPHA
                </h2>
                <p className="mt-0.5 text-label-xs font-label-xs uppercase tracking-widest text-green-500">
                  CONNECTED / ARMED
                </p>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 px-2">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href="#"
                className={`flex items-center gap-3 rounded-none px-3 py-2 ${
                  item.active
                    ? "border border-zinc-700 bg-zinc-800 text-cyan-neon hover:bg-zinc-700"
                    : "border border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {item.icon}
                </span>
                <span className="text-label-xs font-label-xs tracking-widest">
                  {item.label}
                </span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="relative flex h-full flex-1">
          {/* Map Canvas */}
          <div className="relative flex-1 overflow-hidden bg-zinc-950">
            <Map
              waypoints={waypoints}
              isClosedLoop={isClosedLoop}
              onAddWaypoint={handleMapClick}
              onMoveWaypoint={moveWaypoint}
            />
            {/* Crosshair overlay */}
            <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center opacity-30">
              <div className="h-full w-px bg-cyan-neon" />
              <div className="absolute h-px w-full bg-cyan-neon" />
              <div className="absolute h-8 w-8 rounded-none border border-cyan-neon" />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-none border border-cyan-neon bg-black/50" />
            </div>
          </div>

          {/* Right Control Panel */}
          <ControlPanel
            waypoints={waypoints}
            isClosedLoop={isClosedLoop}
            onAltitudeChange={updateAltitude}
            onDeleteWaypoint={deleteWaypoint}
            onUndo={undo}
            onClear={clearMission}
          />
        </main>
      </div>
    </div>
  );
}
