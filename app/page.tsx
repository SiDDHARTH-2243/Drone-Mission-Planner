"use client";

import * as turf from "@turf/turf";
import { ChevronDown, Crosshair, Map as MapIcon, Maximize, User } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import { DEFAULT_ALTITUDE, type Waypoint } from "@/types/mission";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const LOOP_SNAP_METERS = 25;

const ECOSYSTEM_LINKS = [
  { label: "DocTech", href: "#" },
  { label: "FTA Official Site", href: "#" },
  { label: "METS Innovation Hub", href: "#" },
];

export default function Home() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isClosedLoop, setIsClosedLoop] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);

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

  // Map utility toolbar actions — bump a nonce; the Map component reacts.
  const toggleSatellite = useCallback(() => setSatellite((v) => !v), []);
  const centerOnFirst = useCallback(() => setFocusNonce((n) => n + 1), []);
  const fitToPath = useCallback(() => setFitNonce((n) => n + 1), []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-on-background antialiased">
      {/* Top header — single row */}
      <header className="z-50 flex w-full items-center justify-between border-b border-zinc-800 bg-black px-4 py-2">
        {/* Left: brand + live status pill */}
        <div className="flex items-center gap-4">
          <span className="text-metric-md font-metric-md font-bold tracking-tighter text-zinc-100">
            SKYCOMMAND GCS
          </span>
          <div className="flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            <span className="text-label-xs font-label-xs tracking-widest text-zinc-200">
              UAV-01 ALPHA
            </span>
            <span className="h-3 w-px bg-green-500/30" />
            <span className="text-label-xs font-label-xs uppercase tracking-widest text-green-500">
              CONNECTED / ARMED
            </span>
          </div>
        </div>

        {/* Center: map utility toolbar */}
        <div className="flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 p-1">
          <button
            type="button"
            onClick={toggleSatellite}
            title={satellite ? "Switch to vector map" : "Switch to satellite"}
            className={`flex items-center gap-1.5 rounded-none px-2 py-1 text-[10px] font-mono uppercase tracking-widest transition-colors ${
              satellite
                ? "bg-cyan-neon/20 text-cyan-neon"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-cyan-neon"
            }`}
          >
            <MapIcon size={16} />
            {satellite ? "SAT" : "VEC"}
          </button>
          <button
            type="button"
            onClick={centerOnFirst}
            disabled={waypoints.length === 0}
            title="Center on Waypoint 1"
            className="rounded-none p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-cyan-neon disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Crosshair size={16} />
          </button>
          <button
            type="button"
            onClick={fitToPath}
            disabled={waypoints.length === 0}
            title="Fit map to flight path"
            className="rounded-none p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-cyan-neon disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Maximize size={16} />
          </button>
        </div>

        {/* Right: account / ecosystem dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 rounded-none p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-cyan-neon"
          >
            <User size={18} />
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-56 border border-zinc-700 bg-zinc-900 shadow-lg">
                <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  Explore More
                </div>
                {ECOSYSTEM_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-terminal-sm font-terminal-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-cyan-neon"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area — map fills all space left of the panel */}
      <main className="relative flex h-full flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden bg-zinc-950">
          <Map
            waypoints={waypoints}
            isClosedLoop={isClosedLoop}
            satellite={satellite}
            focusNonce={focusNonce}
            fitNonce={fitNonce}
            onAddWaypoint={handleMapClick}
            onMoveWaypoint={moveWaypoint}
          />
        </div>

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
  );
}
