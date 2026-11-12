// Unit helpers. Weights are always stored in lb; run distances are stored in meters.
export const METERS_PER_MILE = 1609.344;

export const miToM = (mi: number): number => Math.round(mi * METERS_PER_MILE);
export const mToMi = (m: number): number => Math.round((m / METERS_PER_MILE) * 100) / 100;
