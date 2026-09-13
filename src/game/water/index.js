/**
 * M4 水体核心 (completion standard 14) — public surface.
 */
export { AirSupply } from './AirSupply.js';
export { underwaterFogDistance, waterDepthAbove } from './WaterVisibility.js';
export { Item, updateFloat, waterSurfaceTop } from './ItemBuoyancy.js';
export { placeSolidUnderwater, findErroneousAirHoles } from './WaterPlacement.js';
