"use client";

import * as turf from "@turf/turf";
import {
  ChevronDown,
  Crosshair,
  Home as HomeIcon,
  Map as MapIcon,
  Maximize,
  Monitor,
  Radio,
  Satellite,
  Search,
  Spline,
  Square,
  Triangle,
  User,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import type { DrawMode } from "@/components/Map";
import { DEFAULT_ALTITUDE, type Waypoint } from "@/types/mission";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const DRAW_MODES: { mode: DrawMode; label: string; Icon: typeof Square }[] = [
  { mode: "free", label: "Free Draw", Icon: Spline },
  { mode: "square", label: "Square", Icon: Square },
  { mode: "triangle", label: "Triangle", Icon: Triangle },
];

function createWaypointId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

const MOCK_PARAMETERS = [
  "WP_NAV_SPEED",
  "RTL_ALT_FINAL",
  "BATT_ARM_VOLT",
  "FENCE_ENABLE",
  "LAND_SPEED",
  "CRUISE_SPEED",
  "SYS_NUM_RESETS",
];

export default function Home() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isClosedLoop, setIsClosedLoop] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isGpsOpen, setIsGpsOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const [drawMode, setDrawMode] = useState<DrawMode>("free");
  const [shapeRadius, setShapeRadius] = useState(0.5);
  const [searchQuery, setSearchQuery] = useState("");
  const [homeNonce, setHomeNonce] = useState(0);

  // Opening one hardware-status popover closes the other.
  const toggleGps = useCallback(() => {
    setIsGpsOpen((o) => !o);
    setIsLinkOpen(false);
  }, []);
  const toggleLink = useCallback(() => {
    setIsLinkOpen((o) => !o);
    setIsGpsOpen(false);
  }, []);

  // Free-draw: append a waypoint (loop-closure snapping is handled in the map
  // click handler via pixel distance).
  const addWaypoint = useCallback((lat: number, lng: number) => {
    setIsClosedLoop(false);
    setWaypoints((prev) => [
      ...prev,
      { id: createWaypointId(), lat, lng, altitude: DEFAULT_ALTITUDE },
    ]);
  }, []);

  const closeLoop = useCallback(() => setIsClosedLoop(true), []);

  // Translate the whole shape by the anchor's drag delta, preserving geometry.
  const translateShape = useCallback((deltaLat: number, deltaLng: number) => {
    setWaypoints((prev) =>
      prev.map((wp) => ({
        ...wp,
        lat: wp.lat + deltaLat,
        lng: wp.lng + deltaLng,
      })),
    );
  }, []);

  // Shape presets: the click is the shape center; build the polygon with Turf,
  // overwrite the route, close the loop, and drop back to free draw.
  const generateShape = useCallback(
    (lat: number, lng: number) => {
      if (drawMode === "free") return;
      const steps = drawMode === "square" ? 4 : 3;
      const circle = turf.circle([lng, lat], shapeRadius, {
        steps,
        units: "kilometers",
      });
      const ring = circle.geometry.coordinates[0]; // [lng, lat][], closed ring
      const corners = ring.slice(0, steps); // drop the duplicated closing point
      setWaypoints(
        corners.map(([clng, clat]) => ({
          id: createWaypointId(),
          lat: clat,
          lng: clng,
          altitude: DEFAULT_ALTITUDE,
        })),
      );
      setIsClosedLoop(true);
      setDrawMode("free");
    },
    [drawMode, shapeRadius],
  );

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

  // Insert a brand-new waypoint at a specific index (from a ghost midpoint),
  // keeping the chronological order of the flight path intact.
  const insertWaypoint = useCallback(
    (index: number, lat: number, lng: number) => {
      setWaypoints((prev) => {
        const next = [...prev];
        next.splice(index, 0, {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lat,
          lng,
          altitude: DEFAULT_ALTITUDE,
        });
        return next;
      });
    },
    [],
  );

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
  const returnHome = useCallback(() => setHomeNonce((n) => n + 1), []);

  return (
    <div className="h-screen w-full bg-background text-on-background antialiased">
      <div className="flex flex-col items-center justify-center h-screen w-full bg-zinc-950 text-center px-6 z-[9999] md:hidden">
        <Monitor className="w-16 h-16 text-orange-500 mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">Desktop Required</h1>
        <p className="text-zinc-400 text-sm max-w-xs">
          SKYCOMMAND GCS is a high-density tactical interface designed for tablet and desktop displays. Please access this application on a larger screen for the full operational experience.
        </p>
      </div>

      <div className="hidden md:flex md:flex-col h-screen w-full overflow-hidden">
        {/* Top header — single row */}
        <header className="z-50 flex w-full flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-black px-4 py-2">
          {/* Left: brand + live status pill */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {/* Logo mark — top-down quadcopter */}
              <svg
                width="26"
                height="26"
                viewBox="0 0 32 32"
                fill="none"
                aria-label="SKYCOMMAND logo"
                className="shrink-0"
              >
                <g
                  stroke="#f97316"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* X-frame arms */}
                  <path d="M9 9 L23 23 M23 9 L9 23" />
                  {/* rotor rings */}
                  <circle cx="9" cy="9" r="4" />
                  <circle cx="23" cy="9" r="4" />
                  <circle cx="9" cy="23" r="4" />
                  <circle cx="23" cy="23" r="4" />
                </g>
                {/* central body */}
                <rect x="13" y="13" width="6" height="6" rx="1.5" fill="#f97316" />
              </svg>
              <span className="text-metric-md font-metric-md font-bold tracking-tighter text-zinc-100">
                SKYCOMMAND GCS
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1">
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-500 transition-colors focus:border-orange-500 focus:outline-none"
              />
              {searchQuery.length > 0 && (
                <div className="absolute top-full mt-2 right-0 w-64 bg-zinc-950 border border-zinc-800 rounded-md shadow-2xl z-[1000] overflow-hidden">
                  {(() => {
                    const filtered = MOCK_PARAMETERS.filter((p) =>
                      p.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    return filtered.length > 0 ? (
                      filtered.map((param) => (
                        <button
                          key={param}
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="block w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
                        >
                          {param}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-zinc-500">
                        No parameters found.
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* GPS status popover */}
              <div className="relative">
                <button
                  type="button"
                  title="GPS status"
                  onClick={toggleGps}
                  className={`transition-colors ${
                    isGpsOpen
                      ? "text-orange-500"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Satellite size={18} />
                </button>
                {isGpsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs shadow-2xl">
                    <div className="grid grid-cols-2 gap-y-1.5 font-mono">
                      <span className="text-zinc-400">STATUS:</span>
                      <span className="text-right font-bold text-orange-500">
                        3D RTK FIX
                      </span>
                      <span className="text-zinc-400">SATELLITES:</span>
                      <span className="text-right text-zinc-200">14 LOCKED</span>
                      <span className="text-zinc-400">HDOP:</span>
                      <span className="text-right text-zinc-200">0.8m</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Telemetry link popover */}
              <div className="relative">
                <button
                  type="button"
                  title="Radio link status"
                  onClick={toggleLink}
                  className={`transition-colors ${
                    isLinkOpen
                      ? "text-orange-500"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Radio size={18} />
                </button>
                {isLinkOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs shadow-2xl">
                    <div className="grid grid-cols-2 gap-y-1.5 font-mono">
                      <span className="text-zinc-400">SIGNAL:</span>
                      <span className="text-right font-bold text-orange-500">
                        EXCELLENT
                      </span>
                      <span className="text-zinc-400">RSSI:</span>
                      <span className="text-right text-zinc-200">-65 dBm</span>
                      <span className="text-zinc-400">PACKET LOSS:</span>
                      <span className="text-right text-zinc-200">0.1%</span>
                    </div>
                  </div>
                )}
              </div>
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
                    <a
                      href="https://github.com/SiDDHARTH-2243"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 border-t border-zinc-800 mt-1 pt-1 px-3 py-2 text-terminal-sm font-terminal-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-orange-500"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                      GitHub
                    </a>
                    <a
                      href="https://www.instagram.com/futuretech_automation"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-terminal-sm font-terminal-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-orange-500"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                      Instagram
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area — stacked on mobile, side-by-side on desktop */}
        <main className="flex flex-col md:flex-row h-full w-full overflow-hidden">
          <div className="relative w-full h-[50vh] md:h-full md:flex-1 bg-zinc-950">
            <Map
              waypoints={waypoints}
              isClosedLoop={isClosedLoop}
              satellite={satellite}
              focusNonce={focusNonce}
              fitNonce={fitNonce}
              homeNonce={homeNonce}
              drawMode={drawMode}
              onAddWaypoint={addWaypoint}
              onCloseLoop={closeLoop}
              onGenerateShape={generateShape}
              onMoveWaypoint={moveWaypoint}
              onInsertWaypoint={insertWaypoint}
              onTranslateShape={translateShape}
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
              <button
                type="button"
                onClick={returnHome}
                title="Return to Home"
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-orange-500"
              >
                <HomeIcon size={16} />
              </button>

              <span className="mx-0.5 my-1 w-px bg-zinc-800" />

              {/* Draw mode presets */}
              {DRAW_MODES.map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDrawMode(mode)}
                  title={label}
                  className={`rounded p-1 transition-colors ${
                    drawMode === mode
                      ? "bg-orange-500/20 text-orange-500"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-orange-500"
                  }`}
                >
                  <Icon size={16} />
                </button>
              ))}

              {/* Shape radius */}
              <label className="ml-0.5 flex items-center gap-1 rounded bg-zinc-900 px-1.5 text-[10px] font-mono text-zinc-400">
                <input
                  type="number"
                  min={0.05}
                  step={0.05}
                  value={shapeRadius}
                  onChange={(e) => setShapeRadius(Number(e.target.value))}
                  title="Shape radius (km)"
                  className="w-10 bg-transparent py-1 text-right tabular-nums text-zinc-100 focus:outline-none"
                />
                km
              </label>
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
    </div>
  );
}
