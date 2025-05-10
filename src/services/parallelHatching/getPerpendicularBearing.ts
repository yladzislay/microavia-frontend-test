import { normalizeAngle } from "./utils/angleUtils";

/**
 * Calculates the perpendicular bearing to a given base bearing.
 * @param baseBearing - The base bearing in degrees.
 * @param direction - The direction for the perpendicular ('left' or 'right'). Defaults to 'right'.
 * @returns The perpendicular bearing in degrees, normalized to [0, 360).
 */
export function getPerpendicularBearing(baseBearing: number, direction: 'left' | 'right' = 'right'): number {
    const normalizedBase = normalizeAngle(baseBearing);
    let perpendicular: number;
    if (direction === 'right') {
        perpendicular = normalizedBase + 90;
    } else { // 'left'
        perpendicular = normalizedBase - 90;
    }
    return normalizeAngle(perpendicular);
}