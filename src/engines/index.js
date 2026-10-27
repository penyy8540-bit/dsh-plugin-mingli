/**
 * Engine facade. All charts are computed in the browser (no host RPC, no network).
 * Implementations live in bazi.js / ziwei.js / qimen.js and must follow
 * docs/PLUGIN-CONTRACT.md §2 (snake_case, aligned with the mingli Python contract).
 */
import { buildBazi } from './bazi.js';
import { buildZiwei } from './ziwei.js';
import { buildQimen } from './qimen.js';

export { buildBazi, buildZiwei, buildQimen };

/** Compute both lifetime charts for a profile. */
export function buildAll(profile) {
  return {
    bazi: buildBazi(profile),
    ziwei: buildZiwei(profile),
  };
}
