import { LonLat, Ellipsoid, Vec3 } from "@openglobus/og";
import { getEllipsoid } from "./getEllipsoid";
import { lonLatToCartesian, cartesianToLonLat } from "./"; // Index import for sibling utils
import { isPointOnGeodesicArc } from "./isPointOnGeodesicArc";

const GEO_TOLERANCE = 1e-6; 
const COPLANAR_TOLERANCE = 1e-9; // Tolerance for vector operations

/**
 * Finds the intersection point(s) of two geodesic segments (defined by LonLat pairs).
 * Returns an array of LonLat intersection points. Empty if no intersection or error.
 * This implementation uses the intersection of two planes method.
 * WARNING: Geodesic math is complex; this implementation is a best-effort based on common
 * vector math approaches and may have limitations or edge cases not perfectly handled,
 * especially near poles or the anti-meridian without more specific library support.
 */
export function geodesicSegmentsIntersection(
    p1_lonlat: LonLat, q1_lonlat: LonLat, 
    p2_lonlat: LonLat, q2_lonlat: LonLat,
    ellipsoid?: Ellipsoid
): LonLat[] {
    const ell = ellipsoid || getEllipsoid();
    
    // Convert LonLat points to Cartesian ECEF coordinates
    const p1_cart = lonLatToCartesian(p1_lonlat, ell);
    const q1_cart = lonLatToCartesian(q1_lonlat, ell);
    const p2_cart = lonLatToCartesian(p2_lonlat, ell);
    const q2_cart = lonLatToCartesian(q2_lonlat, ell);

    // Create normal vectors for the planes defined by the origin and each segment.
    // A segment from A to B defines a plane OAB with normal N = A x B.
    let n1 = Vec3.cross(p1_cart, q1_cart); 
    let n2 = Vec3.cross(p2_cart, q2_cart);

    // Check for degenerate segments (e.g., if p1, q1, and origin are collinear)
    if (n1.lengthIsZero(COPLANAR_TOLERANCE) || n2.lengthIsZero(COPLANAR_TOLERANCE)) {
        // This implies one of the segments doesn't uniquely define a plane with the origin,
        // or is a zero-length segment at the origin.
        // console.warn("Geodesic intersection: Degenerate segment detected.");
        // TODO: Handle specific cases like overlapping collinear segments if necessary.
        // For now, return no intersection for such degenerate cases.
        return []; 
    }
    n1.normalize(); // Modifies in place
    n2.normalize(); // Modifies in place

    // The line of intersection of the two planes is perpendicular to both normals.
    // Its direction vector is L = N1 x N2.
    let intersectionLineDir = Vec3.cross(n1, n2);

    // If intersectionLineDir is a zero vector, the normals N1 and N2 are collinear.
    // This means the planes are parallel and may be identical.
    // Segments lie on the same great circle.
    if (intersectionLineDir.lengthIsZero(COPLANAR_TOLERANCE)) {
        // console.debug("Geodesic intersection: Segments appear to be on the same great circle.");
        // Check for overlap along the common great circle.
        const overlapIntersections: LonLat[] = [];
        if (isPointOnGeodesicArc(p1_lonlat, p2_lonlat, q2_lonlat, ell)) overlapIntersections.push(p1_lonlat.clone());
        if (isPointOnGeodesicArc(q1_lonlat, p2_lonlat, q2_lonlat, ell)) overlapIntersections.push(q1_lonlat.clone());
        if (isPointOnGeodesicArc(p2_lonlat, p1_lonlat, q1_lonlat, ell)) overlapIntersections.push(p2_lonlat.clone());
        if (isPointOnGeodesicArc(q2_lonlat, p1_lonlat, q1_lonlat, ell)) overlapIntersections.push(q2_lonlat.clone());
        
        const uniqueIntersections: LonLat[] = [];
        for (const pt of overlapIntersections) {
            if (!uniqueIntersections.some(u => u.equal(pt, GEO_TOLERANCE))) {
                uniqueIntersections.push(pt);
            }
        }
        return uniqueIntersections;
    }
    intersectionLineDir.normalize(); // Modifies in place

    // The intersection line L passes through the origin. The points where L pierces
    // the ellipsoid are the two potential intersection points of the great circles.
    const { x: vx, y: vy, z: vz } = intersectionLineDir;
    
    // Access ellipsoid radii using (ell as any) due to potential typing issues
    const eqRadius = (ell as any).equatorialRadius;
    const polRadius = (ell as any).polarRadius;
    if (typeof eqRadius !== 'number' || typeof polRadius !== 'number') {
        throw new Error("Invalid ellipsoid radii obtained.");
    }
    const a2 = eqRadius * eqRadius;
    const b2 = eqRadius * eqRadius; 
    const c2 = polRadius * polRadius;       

    // Calculate scaling factor t such that t*L lies on the ellipsoid surface.
    // (t*vx)^2/a^2 + (t*vy)^2/b^2 + (t*vz)^2/c^2 = 1
    const denom = (vx*vx)/a2 + (vy*vy)/b2 + (vz*vz)/c2;
    if (Math.abs(denom) < COPLANAR_TOLERANCE) { // Should be non-zero if intersectionLineDir is normalized
        // console.warn("Geodesic intersection: Denominator for scaling factor is near zero.");
        return [];
    }
    const t = 1 / Math.sqrt(denom);

    const potentialIntersectionPointsCartesian: Vec3[] = [];
    potentialIntersectionPointsCartesian.push(intersectionLineDir.clone().scaleTo(t));  // scaleTo modifies in place, use clone
    potentialIntersectionPointsCartesian.push(intersectionLineDir.clone().scaleTo(-t)); // scaleTo modifies in place, use clone
    
    const intersections: LonLat[] = [];
    for (const p_cart of potentialIntersectionPointsCartesian) {
        const p_lonlat = cartesianToLonLat(p_cart, ell);
        // Check if this point lies on both original geodesic ARCS
        if (isPointOnGeodesicArc(p_lonlat, p1_lonlat, q1_lonlat, ell) &&
            isPointOnGeodesicArc(p_lonlat, p2_lonlat, q2_lonlat, ell)) {
            if (!intersections.some(existing => existing.equal(p_lonlat, GEO_TOLERANCE))) {
                intersections.push(p_lonlat);
            }
        }
    }
    return intersections;
}