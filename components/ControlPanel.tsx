"use client";

import * as turf from "@turf/turf";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AIR_DENSITY_KG_M3,
  CRUISE_SPEED_MPS,
  DEFAULT_BATTERY_CAPACITY_MAH,
  DEFAULT_BATTERY_VOLTAGE_V,
  DEFAULT_MOTOR_KV,
  DEFAULT_PROP_DIAMETER_IN,
  DEFAULT_PROP_PITCH_IN,
  DEFAULT_VEHICLE_WEIGHT_KG,
  GRAVITY_MPS2,
  HOVER_EFFICIENCY_LOSS,
  INCH_TO_METERS,
  PROP_COUNT,
  USABLE_BATTERY_FRACTION,
  type Waypoint,
} from "@/types/mission";

type Props = {
  waypoints: Waypoint[];
  isClosedLoop: boolean;
  onAltitudeChange: (id: string, altitude: number) => void;
  onDeleteWaypoint: (id: string) => void;
  onClear: () => void;
};

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(0)} m`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function toMavlink(waypoints: Waypoint[]) {
  return waypoints.map((wp, i) => ({
    seq: i,
    frame: 3, // MAV_FRAME_GLOBAL_RELATIVE_ALT
    command: 16, // MAV_CMD_NAV_WAYPOINT
    current: i === 0 ? 1 : 0,
    autocontinue: 1,
    param1: 0,
    param2: 0,
    param3: 0,
    param4: 0,
    x: wp.lat,
    y: wp.lng,
    z: wp.altitude,
  }));
}

export default function ControlPanel({
  waypoints,
  isClosedLoop,
  onAltitudeChange,
  onDeleteWaypoint,
  onClear,
}: Props) {
  const totalMeters = useMemo(() => {
    let sum = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const a = turf.point([waypoints[i - 1].lng, waypoints[i - 1].lat]);
      const b = turf.point([waypoints[i].lng, waypoints[i].lat]);
      sum += turf.distance(a, b, { units: "meters" });
    }
    if (isClosedLoop && waypoints.length > 1) {
      const first = waypoints[0];
      const last = waypoints[waypoints.length - 1];
      sum += turf.distance(
        turf.point([last.lng, last.lat]),
        turf.point([first.lng, first.lat]),
        { units: "meters" },
      );
    }
    return sum;
  }, [waypoints, isClosedLoop]);

  const [vehicleWeight, setVehicleWeight] = useState(DEFAULT_VEHICLE_WEIGHT_KG);
  const [batteryCapacity, setBatteryCapacity] = useState(
    DEFAULT_BATTERY_CAPACITY_MAH,
  );
  const [batteryVoltage, setBatteryVoltage] = useState(
    DEFAULT_BATTERY_VOLTAGE_V,
  );
  const [motorKV, setMotorKV] = useState(DEFAULT_MOTOR_KV);
  const [propDiameter, setPropDiameter] = useState(DEFAULT_PROP_DIAMETER_IN);
  const [propPitch, setPropPitch] = useState(DEFAULT_PROP_PITCH_IN);

  // Time to fly the plotted path at the fixed ground speed.
  const pathSeconds = totalMeters / CRUISE_SPEED_MPS;

  // Hover power via momentum theory (disk loading).
  const propRadiusM = (propDiameter * INCH_TO_METERS) / 2;
  const totalDiskAreaM2 = Math.PI * propRadiusM * propRadiusM * PROP_COUNT;
  const thrustN = vehicleWeight * GRAVITY_MPS2;
  const idealHoverPowerW =
    totalDiskAreaM2 > 0
      ? Math.sqrt(
          Math.pow(thrustN, 3) / (2 * AIR_DENSITY_KG_M3 * totalDiskAreaM2),
        )
      : 0;
  const hoverPowerW = idealHoverPowerW * HOVER_EFFICIENCY_LOSS;

  // Physics-based endurance from the battery/vehicle configuration.
  const totalEnergyWh = (batteryVoltage * batteryCapacity) / 1000;
  const maxFlightMinutes =
    hoverPowerW > 0
      ? (totalEnergyWh / hoverPowerW) * 60 * USABLE_BATTERY_FRACTION
      : 0;
  const maxFlightSeconds = maxFlightMinutes * 60;

  const insufficientRange =
    totalMeters > 0 && pathSeconds > maxFlightSeconds;

  const mavlink = useMemo(() => toMavlink(waypoints), [waypoints]);

  return (
    <aside className="flex h-screen w-[420px] flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Mission Planner
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Click the map to drop waypoints.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 border-b border-zinc-800 px-4 py-3 text-xs">
        <div>
          <div className="text-zinc-500">Total Distance</div>
          <div className="text-lg font-mono text-sky-400">
            {formatDistance(totalMeters)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Est. Flight Time</div>
          <div
            className={`text-lg font-mono ${
              insufficientRange ? "text-red-500" : "text-sky-400"
            }`}
          >
            {formatDuration(pathSeconds)}
          </div>
        </div>
        <div className="col-span-2 text-[10px] text-zinc-600">
          Cruise speed {CRUISE_SPEED_MPS} m/s · {waypoints.length} waypoints
          {isClosedLoop && (
            <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 font-semibold uppercase text-emerald-400">
              Loop Closed
            </span>
          )}
        </div>
        <div className="col-span-2 flex items-center justify-between text-[10px] text-zinc-600">
          <span>
            Max endurance{" "}
            <span
              className={`font-mono ${
                insufficientRange ? "text-red-400" : "text-zinc-400"
              }`}
            >
              {formatDuration(maxFlightSeconds)}
            </span>
          </span>
          <span>Hover power {hoverPowerW.toFixed(0)} W</span>
        </div>
        <div className="col-span-2 text-[9px] leading-snug text-zinc-600">
          * Estimates assume standard sea-level air density and negligible
          aerodynamic drag. Real flight times will vary.
        </div>
        {insufficientRange && (
          <div className="col-span-2 flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-400">
            <AlertTriangle size={14} className="shrink-0" />
            BATTERY WARNING: INSUFFICIENT RANGE
          </div>
        )}
      </section>

      <section className="flex flex-col border-b border-zinc-800">
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Waypoints
            </h2>
            <button
              type="button"
              onClick={onClear}
              disabled={waypoints.length === 0}
              className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300"
            >
              <Trash2 size={12} />
              Clear Mission
            </button>
          </div>

          {waypoints.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500">
              No waypoints yet.
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto rounded border border-zinc-800/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Lat</th>
                  <th className="py-1 pr-2">Lng</th>
                  <th className="py-1">Alt (m)</th>
                  <th className="py-1" aria-label="Delete" />
                </tr>
              </thead>
              <tbody className="font-mono">
                {waypoints.map((wp, i) => (
                  <tr key={wp.id} className="border-t border-zinc-800/60">
                    <td className="py-1 pr-2 text-zinc-400">{i + 1}</td>
                    <td className="py-1 pr-2 text-zinc-300">
                      {wp.lat.toFixed(5)}
                    </td>
                    <td className="py-1 pr-2 text-zinc-300">
                      {wp.lng.toFixed(5)}
                    </td>
                    <td className="py-1">
                      <input
                        type="number"
                        value={wp.altitude}
                        min={0}
                        step={1}
                        onChange={(e) =>
                          onAltitudeChange(wp.id, Number(e.target.value))
                        }
                        className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-right text-zinc-100 outline-none focus:border-sky-500"
                      />
                    </td>
                    <td className="py-1 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteWaypoint(wp.id)}
                        aria-label={`Delete waypoint ${i + 1}`}
                        className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-zinc-800 px-4 py-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Vehicle Configuration
        </h2>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Weight (kg)</span>
            <input
              type="number"
              value={vehicleWeight}
              min={0}
              step={0.1}
              onChange={(e) => setVehicleWeight(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Capacity (mAh)</span>
            <input
              type="number"
              value={batteryCapacity}
              min={0}
              step={100}
              onChange={(e) => setBatteryCapacity(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Voltage (V)</span>
            <input
              type="number"
              value={batteryVoltage}
              min={0}
              step={0.1}
              onChange={(e) => setBatteryVoltage(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Motor (KV)</span>
            <input
              type="number"
              value={motorKV}
              min={0}
              step={10}
              onChange={(e) => setMotorKV(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Prop ⌀ (in)</span>
            <input
              type="number"
              value={propDiameter}
              min={0}
              step={0.5}
              onChange={(e) => setPropDiameter(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-500">Pitch (in)</span>
            <input
              type="number"
              value={propPitch}
              min={0}
              step={0.1}
              onChange={(e) => setPropPitch(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100 outline-none focus:border-sky-500"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
          <span>
            Pack energy{" "}
            <span className="font-mono text-zinc-400">
              {totalEnergyWh.toFixed(1)} Wh
            </span>
          </span>
          <span>
            Disk area{" "}
            <span className="font-mono text-zinc-400">
              {totalDiskAreaM2.toFixed(3)} m²
            </span>
          </span>
        </div>
      </section>

      <section className="flex min-h-[180px] flex-1 flex-col overflow-hidden">
        <div className="border-b border-zinc-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          MAVLink Preview
        </div>
        <pre className="flex-1 overflow-auto bg-black px-4 py-2 text-[11px] leading-snug text-emerald-300">
          {JSON.stringify(mavlink, null, 2)}
        </pre>
      </section>
    </aside>
  );
}
