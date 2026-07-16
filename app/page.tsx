"use client";

import * as turf from "@turf/turf";
import {
  ChevronDown,
  Crosshair,
  Map as MapIcon,
  Maximize,
  Radio,
  Satellite,
  Search,
  User,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import { DEFAULT_ALTITUDE, type Waypoint } from "@/types/mission";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const LOOP_SNAP_METERS = 25;

type EcosystemLink = {
  label: string;
  href?: string;
  comingSoon?: boolean;
};

const ECOSYSTEM_LINKS: EcosystemLink[] = [
  { label: "FutureTech Automation", href: "https://futuretechautomation.in" },
  { label: "Mets Innovative", href: "https://metsinnovative.in/" },
  { label: "DocTech by FTA", comingSoon: true },
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
          <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            <span className="text-label-xs font-label-xs tracking-widest text-zinc-200">
              UAV-01 ALPHA
            </span>
            <span className="h-3 w-px bg-amber-500/30" />
            <span className="text-label-xs font-label-xs uppercase tracking-widest text-amber-500">
              CONNECTED / ARMED
            </span>
          </div>
        </div>

        {/* Right: global tools — search, status icons, account dropdown */}
        <div className="flex items-center justify-end gap-4">
          <div className="relative hidden md:block">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Search parameters..."
              className="w-56 rounded border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-500 transition-colors focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              title="GPS status"
              className="text-zinc-400 transition-colors hover:text-white"
            >
              <Satellite size={18} />
            </button>
            <button
              type="button"
              title="Radio link status"
              className="text-zinc-400 transition-colors hover:text-white"
            >
              <Radio size={18} />
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-1 rounded-none p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-orange-500"
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
                  {ECOSYSTEM_LINKS.map((link) =>
                    link.comingSoon ? (
                      <a
                        key={link.label}
                        aria-disabled="true"
                        onClick={(e) => e.preventDefault()}
                        className="flex cursor-not-allowed items-center gap-1.5 px-3 py-2 text-terminal-sm font-terminal-sm text-zinc-500"
                      >
                        {link.label}
                        <span className="text-[10px] text-amber-400/70">
                          (Coming soon...)
                        </span>
                      </a>
                    ) : (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-terminal-sm font-terminal-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-orange-500"
                      >
                        {link.label}
                      </a>
                    ),
                  )}
                </div>
              </>
            )}
          </div>
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

          {/* Floating map utility toolbar */}
          <div className="absolute right-4 top-4 z-[1000] flex gap-1 rounded-md border border-zinc-800 bg-zinc-950/90 p-1 shadow-xl backdrop-blur-sm">
            <button
              type="button"
              onClick={toggleSatellite}
              title={satellite ? "Switch to vector map" : "Switch to satellite"}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-mono uppercase tracking-widest transition-colors ${
                satellite
                  ? "bg-orange-500/20 text-orange-500"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-orange-500"
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
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Crosshair size={16} />
            </button>
            <button
              type="button"
              onClick={fitToPath}
              disabled={waypoints.length === 0}
              title="Fit map to flight path"
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Maximize size={16} />
            </button>
          </div>
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
