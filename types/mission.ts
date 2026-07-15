export type Waypoint = {
  id: string;
  lat: number;
  lng: number;
  altitude: number;
};

export const DEFAULT_ALTITUDE = 30;

// Ground speed used to estimate how long the plotted path takes to fly.
export const CRUISE_SPEED_MPS = 10;

// Vehicle configuration defaults for the physics-based endurance estimate.
export const DEFAULT_VEHICLE_WEIGHT_KG = 2.5;
export const DEFAULT_BATTERY_CAPACITY_MAH = 5000;
export const DEFAULT_BATTERY_VOLTAGE_V = 22.2;

// Empirical hover-power coefficient (W per kg of all-up weight).
export const HOVER_POWER_W_PER_KG = 170;

// Usable fraction of pack energy before the flight controller forces landing.
export const USABLE_BATTERY_FRACTION = 0.8;
