export type Waypoint = {
  id: string;
  lat: number;
  lng: number;
  altitude: number;
};

export const DEFAULT_ALTITUDE = 30;

// Default ground speed used to estimate how long the plotted path takes to fly.
export const DEFAULT_CRUISE_SPEED_MPS = 10;

// Vehicle configuration defaults for the physics-based endurance estimate.
export const DEFAULT_VEHICLE_WEIGHT_KG = 2.5;
export const DEFAULT_BATTERY_CAPACITY_MAH = 5000;
export const DEFAULT_BATTERY_VOLTAGE_V = 22.2;
export const DEFAULT_MOTOR_KV = 800;
export const DEFAULT_PROP_DIAMETER_IN = 10;
export const DEFAULT_PROP_PITCH_IN = 4.5;

// Momentum-theory (disk-loading) hover-power constants.
export const PROP_COUNT = 4;
export const GRAVITY_MPS2 = 9.81;
export const AIR_DENSITY_KG_M3 = 1.225; // ISA sea level
export const HOVER_EFFICIENCY_LOSS = 1.5; // real-world motor/prop losses
export const INCH_TO_METERS = 0.0254;

// Usable fraction of pack energy before the flight controller forces landing.
export const USABLE_BATTERY_FRACTION = 0.8;
