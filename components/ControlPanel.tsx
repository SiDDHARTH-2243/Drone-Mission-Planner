"use client";

import * as turf from "@turf/turf";
import { useMemo, useState } from "react";
import {
  AIR_DENSITY_KG_M3,
  DEFAULT_CRUISE_SPEED_MPS,
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
  onUndo: () => void;
  onClear: () => void;
};

// Flight time as MM:SS (minutes may exceed 60), matching the prototype's 42:15.
function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
  onUndo,
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
  const [cruiseSpeed, setCruiseSpeed] = useState(DEFAULT_CRUISE_SPEED_MPS);

  // Time to fly the plotted path at the configured ground speed.
  const pathSeconds = cruiseSpeed > 0 ? totalMeters / cruiseSpeed : 0;

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

  const insufficientRange = totalMeters > 0 && pathSeconds > maxFlightSeconds;

  const mavlink = useMemo(() => toMavlink(waypoints), [waypoints]);

  const configFields: {
    label: string;
    value: number;
    set: (n: number) => void;
    step: number;
    suffix: string;
  }[] = [
    { label: "Mass", value: vehicleWeight, set: setVehicleWeight, step: 0.1, suffix: "kg" },
    { label: "Cap", value: batteryCapacity, set: setBatteryCapacity, step: 100, suffix: "mAh" },
    { label: "Volt", value: batteryVoltage, set: setBatteryVoltage, step: 0.1, suffix: "V" },
    { label: "Motor", value: motorKV, set: setMotorKV, step: 10, suffix: "KV" },
    { label: "Prop", value: propDiameter, set: setPropDiameter, step: 0.5, suffix: "in" },
    { label: "Pitch", value: propPitch, set: setPropPitch, step: 0.1, suffix: "in" },
  ];

  return (
    <aside className="z-20 flex h-full w-[450px] shrink-0 flex-col border-l border-zinc-800 bg-black">
      <div className="hide-scrollbar flex flex-1 flex-col overflow-y-auto scroll-smooth">
        {/* 1. Telemetry Header */}
        <section className="border-b border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-4 flex items-center justify-center">
            <div className="px-6">
              <h3 className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Total Dist
              </h3>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-2xl font-mono tabular-nums ${
                    insufficientRange ? "text-red-500" : "text-zinc-100"
                  }`}
                >
                  {(totalMeters / 1000).toFixed(1)}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">km</span>
              </div>
            </div>
            <div className="border-l border-zinc-700 px-6">
              <h3 className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Ext Time
              </h3>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-2xl font-mono tabular-nums ${
                    insufficientRange ? "text-red-500" : "text-zinc-100"
                  }`}
                >
                  {formatClock(pathSeconds)}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <div className="flex flex-col">
              <label className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Crz Spd
              </label>
              <div className="flex">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={cruiseSpeed}
                  onChange={(e) => setCruiseSpeed(Number(e.target.value))}
                  className="w-14 rounded-none border border-zinc-700 bg-black px-1 py-0.5 text-center text-terminal-sm font-terminal-sm tabular-nums text-zinc-100 focus:border-cyan-neon focus:outline-none"
                />
                <span className="flex items-center rounded-none border-y border-r border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
                  m/s
                </span>
              </div>
            </div>
            <div className="flex flex-col border-x border-zinc-800 text-center">
              <label className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                WPTs
              </label>
              <span className="text-terminal-sm font-terminal-sm font-mono tabular-nums text-zinc-100">
                {waypoints.length}
              </span>
            </div>
            <div className="flex justify-end">
              {isClosedLoop && (
                <span className="flex items-center gap-1.5 rounded-none border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-green-500">
                  <span className="h-1.5 w-1.5 animate-pulse bg-green-500" />
                  LOOP CLOSED
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 2. Safety Banner */}
        {insufficientRange && (
          <section className="border-b border-zinc-800 p-3">
            <div className="flex items-start gap-2 rounded-none border border-red-500 bg-red-950/50 p-2">
              <span className="material-symbols-outlined mt-0.5 text-sm text-red-500">
                warning
              </span>
              <div>
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-500">
                  BATT WARN
                </h4>
                <p className="mt-0.5 text-[10px] font-mono uppercase text-red-400/80">
                  INSUFFICIENT RANGE FOR RETURN.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 3. Waypoints Manager */}
        <section className="border-b border-zinc-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <span className="material-symbols-outlined text-[14px]">route</span>{" "}
              WPT MGR
            </h3>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onUndo}
                disabled={waypoints.length === 0 && !isClosedLoop}
                className="rounded-none border border-zinc-700 px-2 py-0.5 text-[10px] font-mono uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={waypoints.length === 0}
                className="rounded-none border border-zinc-700 px-2 py-0.5 text-[10px] font-mono uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clr
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-none border border-zinc-800">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="w-8 px-2 py-1 text-[10px] font-mono font-normal uppercase text-zinc-500">
                    #
                  </th>
                  <th className="px-2 py-1 text-[10px] font-mono font-normal uppercase text-zinc-500">
                    LAT
                  </th>
                  <th className="px-2 py-1 text-[10px] font-mono font-normal uppercase text-zinc-500">
                    LNG
                  </th>
                  <th className="w-20 px-2 py-1 text-[10px] font-mono font-normal uppercase text-zinc-500">
                    ALT(m)
                  </th>
                  <th className="w-6 px-1 py-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-terminal-sm font-terminal-sm tabular-nums text-zinc-300">
                {waypoints.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-4 text-center text-[10px] font-mono uppercase text-zinc-600"
                    >
                      No waypoints — click the map
                    </td>
                  </tr>
                ) : (
                  waypoints.map((wp, i) => {
                    const isLast = i === waypoints.length - 1;
                    return (
                      <tr
                        key={wp.id}
                        className={
                          isLast
                            ? "group border-l-2 border-l-cyan-neon bg-cyan-neon/10 hover:bg-cyan-neon/20"
                            : "group hover:bg-zinc-900"
                        }
                      >
                        <td
                          className={`px-2 py-1 ${
                            isLast ? "text-cyan-neon" : "text-zinc-600"
                          }`}
                        >
                          {(i + 1).toString().padStart(2, "0")}
                        </td>
                        <td
                          className={`px-2 py-1 ${
                            isLast ? "text-zinc-100" : ""
                          }`}
                        >
                          {wp.lat.toFixed(4)}
                        </td>
                        <td
                          className={`px-2 py-1 ${
                            isLast ? "text-zinc-100" : ""
                          }`}
                        >
                          {wp.lng.toFixed(4)}
                        </td>
                        <td className="px-2 py-0.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={wp.altitude}
                            onChange={(e) =>
                              onAltitudeChange(wp.id, Number(e.target.value))
                            }
                            className={`w-full rounded-none border bg-black px-1 py-0 text-terminal-sm font-terminal-sm tabular-nums focus:border-cyan-neon focus:outline-none ${
                              isLast
                                ? "border-cyan-neon/50 text-cyan-neon"
                                : "border-zinc-800 text-zinc-300"
                            }`}
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteWaypoint(wp.id)}
                            aria-label={`Delete waypoint ${i + 1}`}
                            className="text-zinc-700 hover:text-red-500"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              close
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Vehicle Configuration (editable) */}
        <section className="border-b border-zinc-800 p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <span className="material-symbols-outlined text-[14px]">build</span>{" "}
            CONFIG
          </h3>
          <div className="rounded-none border border-zinc-800 bg-zinc-950 p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {configFields.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between border-b border-zinc-900 pb-1"
                >
                  <label className="text-[10px] font-mono uppercase text-zinc-600">
                    {f.label}
                  </label>
                  <div className="flex items-baseline gap-0.5">
                    <input
                      type="number"
                      min={0}
                      step={f.step}
                      value={f.value}
                      onChange={(e) => f.set(Number(e.target.value))}
                      className="w-16 rounded-none border border-zinc-800 bg-black px-1 py-0 text-right text-terminal-sm font-terminal-sm tabular-nums text-zinc-300 focus:border-cyan-neon focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-zinc-600">
                      {f.suffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-zinc-800 pt-2 text-[10px] font-mono uppercase text-zinc-500">
              <span className="tabular-nums">E: {totalEnergyWh.toFixed(0)}Wh</span>
              <span className="tabular-nums">
                P_HOV: {hoverPowerW.toFixed(0)}W
              </span>
            </div>
          </div>
        </section>

        {/* 5. MAVLink Terminal — live JSON of the mission */}
        <section className="flex min-h-[250px] flex-1 flex-col bg-black p-0">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 p-2">
            <h3 className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <span className="material-symbols-outlined text-[14px]">
                terminal
              </span>{" "}
              MAVLink Telemetry Stream
            </h3>
            <div className="h-2 w-2 animate-pulse rounded-none bg-green-500" />
          </div>
          <pre className="hide-scrollbar flex-1 overflow-y-auto bg-black p-3 text-[11px] font-mono leading-tight tabular-nums text-green-500">
            {JSON.stringify(mavlink, null, 2)}
            {"\n"}
            <span className="animate-pulse">_</span>
          </pre>
        </section>
      </div>
    </aside>
  );
}
