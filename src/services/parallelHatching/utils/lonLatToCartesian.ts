import { LonLat, Ellipsoid, Vec3 } from "@openglobus/og";
import { getEllipsoid } from "./getEllipsoid";

/**
 * Converts LonLat to ECEF Cartesian Vec3.
 * Uses height 0 if not specified in LonLat.
 * @param lonLat - The LonLat point to convert.
 * @param ellipsoid - Optional ellipsoid instance. If not provided, uses the global ellipsoid.
 * @returns {Vec3} The ECEF Cartesian coordinates.
 */
export function lonLatToCartesian(lonLat: LonLat, ellipsoid?: Ellipsoid): Vec3 {
    const ell = ellipsoid || getEllipsoid();
    // geodeticToCartesian is a method on Ellipsoid instance
    return ell.geodeticToCartesian(lonLat.lon, lonLat.lat, lonLat.height || 0);
}