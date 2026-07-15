export type Waypoint = {
  id: string;
  lat: number;
  lng: number;
  altitude: number;
};

export const DEFAULT_ALTITUDE = 30;
export const CRUISE_SPEED_MPS = 12;
