import { LonLat, Ellipsoid } from "@openglobus/og";
import { getEllipsoid } from "./getEllipsoid";

const GEO_TOLERANCE = 1e-6; // Tolerance for distance comparisons, might need adjustment

/**
 * Checks if a point C lies on the geodesic arc defined by A and B.
 * Uses distances: dist(A,C) + dist(C,B) should be approximately equal to dist(A,B).
 * @param pointC_lonlat - The point to check.
 * @param arcStartA_lonlat - The start point of the geodesic arc.
 * @param arcEndB_lonlat - The end point of the geodesic arc.
 * @param ellipsoid - Optional ellipsoid instance. If not provided, uses the global ellipsoid.
 * @returns {boolean} True if pointC is on the arc AB, false otherwise.
 */
export function isPointOnGeodesicArc(
    pointC_lonlat: LonLat, 
    arcStartA_lonlat: LonLat, 
    arcEndB_lonlat: LonLat,
    ellipsoid?: Ellipsoid
): boolean {
    const ell = ellipsoid || getEllipsoid();

    // Check if C is very close to A or B using LonLat.equal
    if (pointC_lonlat.equal(arcStartA_lonlat, GEO_TOLERANCE) || pointC_lonlat.equal(arcEndB_lonlat, GEO_TOLERANCE)) {
        return true;
    }

    // If A and B are the same point
    if (arcStartA_lonlat.equal(arcEndB_lonlat, GEO_TOLERANCE)) {
        // C must also be the same point A (or B)
        return pointC_lonlat.equal(arcStartA_lonlat, GEO_TOLERANCE);
    }

    // Get distances using ellipsoid.inverse.
    // @ts-ignore is used due to potential incomplete typings for the result of inverse() (e.g. missing distance).
    // We expect the result to have a 'distance' property.
    // @ts-ignore
    const invAC = ell.inverse(arcStartA_lonlat, pointC_lonlat);
    // @ts-ignore
    const invCB = ell.inverse(pointC_lonlat, arcEndB_lonlat);
    // @ts-ignore
    const invAB = ell.inverse(arcStartA_lonlat, arcEndB_lonlat);

    const distAC = invAC.distance;
    const distCB = invCB.distance;
    const distAB = invAB.distance;

    // Check if C is on the great circle path (distAC + distCB approx distAB)
    if (Math.abs(distAC + distCB - distAB) > GEO_TOLERANCE) {
        return false; 
    }

    // At this point, C is on the great circle defined by A and B.
    // We also need to ensure C is *between* A and B, not on the other side of the great circle.
    // The distance check (distAC + distCB == distAB) correctly handles this.
    // If C were on the great circle but outside the segment AB, then
    // either distAB + distBC approx distAC, or distAC + distAB approx distBC.
    // The current check `distAC + distCB - distAB` being small covers this.
    return true;
}