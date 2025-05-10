import { LonLat, Ellipsoid, Vec3 } from "@openglobus/og";
import { getEllipsoid } from "./getEllipsoid";

/**
 * Converts ECEF Cartesian Vec3 to LonLat.
 * @param cartesian - The ECEF Cartesian Vec3 point.
 * @param ellipsoid - Optional ellipsoid instance. If not provided, uses the global ellipsoid.
 * @returns {LonLat} The geographic coordinates.
 */
export function cartesianToLonLat(cartesian: Vec3, ellipsoid?: Ellipsoid): LonLat {
    const ell = ellipsoid || getEllipsoid();
    // Addressing potential typing issue with cartesianToGeodetic from previous attempts
    const geodeticArray = (ell as any).cartesianToGeodetic(cartesian); 
    if (!geodeticArray || geodeticArray.length < 3) {
        throw new Error("cartesianToGeodetic did not return expected [lon, lat, alt] array.");
    }
    return new LonLat(geodeticArray[0], geodeticArray[1], geodeticArray[2]);
}