import { LonLat } from "@openglobus/og";

const TOLERANCE = 1e-9; // Tolerance for floating point comparisons

/**
 * Finds the orientation of an ordered triplet (p, q, r).
 * The function returns following values:
 * 0 --> p, q and r are collinear
 * 1 --> Clockwise
 * 2 --> Counterclockwise
 */
export function getOrientation(p: LonLat, q: LonLat, r: LonLat): number { 
    const val = (q.lat - p.lat) * (r.lon - q.lon) - (q.lon - p.lon) * (r.lat - q.lat); 
    if (Math.abs(val) < TOLERANCE) return 0;  // collinear
    return (val > 0) ? 1 : 2; // clock or counterclock wise
}

/**
 * Given three collinear points p, q, r, the function checks if
 * point q lies on segment 'pr'.
 */
export function onSegment(p: LonLat, q: LonLat, r: LonLat): boolean { 
    return (
        q.lon <= Math.max(p.lon, r.lon) + TOLERANCE && 
        q.lon >= Math.min(p.lon, r.lon) - TOLERANCE && 
        q.lat <= Math.max(p.lat, r.lat) + TOLERANCE && 
        q.lat >= Math.min(p.lat, r.lat) - TOLERANCE
    );
}

/**
 * Checks if two line segments 'p1q1' and 'p2q2' intersect.
 */
export function segmentsIntersect(p1: LonLat, q1: LonLat, p2: LonLat, q2: LonLat): boolean { 
    const o1 = getOrientation(p1, q1, p2); 
    const o2 = getOrientation(p1, q1, q2); 
    const o3 = getOrientation(p2, q2, p1); 
    const o4 = getOrientation(p2, q2, q1); 

    // General case
    if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
        return (o1 !== o2 && o3 !== o4);
    }

    // Special Cases for collinear points
    // p1, q1 and p2 are collinear and p2 lies on segment p1q1
    if (o1 === 0 && onSegment(p1, p2, q1)) return true; 
    // p1, q1 and q2 are collinear and q2 lies on segment p1q1
    if (o2 === 0 && onSegment(p1, q2, q1)) return true; 
    // p2, q2 and p1 are collinear and p1 lies on segment p2q2
    if (o3 === 0 && onSegment(p2, p1, q2)) return true; 
    // p2, q2 and q1 are collinear and q1 lies on segment p2q2
    if (o4 === 0 && onSegment(p2, q1, q2)) return true; 

    return false; // Doesn't fall in any of the above cases
}

/**
 * Calculates the intersection point of two line segments, if it exists.
 * Assumes lines are not parallel (determinant is not zero).
 * This function finds the intersection of the lines defined by the segments.
 * The caller should use segmentsIntersect and onSegment to confirm the intersection
 * point lies on both segments.
 */
export function getIntersectionPoint(p1: LonLat, q1: LonLat, p2: LonLat, q2: LonLat): LonLat | null { 
    const a1 = q1.lat - p1.lat;
    const b1 = p1.lon - q1.lon;
    const c1 = a1 * p1.lon + b1 * p1.lat; 

    const a2 = q2.lat - p2.lat;
    const b2 = p2.lon - q2.lon;
    const c2 = a2 * p2.lon + b2 * p2.lat; 

    const determinant = a1 * b2 - a2 * b1; 

    if (Math.abs(determinant) < TOLERANCE) { 
        // Lines are parallel or collinear
        return null; 
    } else { 
        const lon = (b2 * c1 - b1 * c2) / determinant; 
        const lat = (a1 * c2 - a2 * c1) / determinant; 
        return new LonLat(lon, lat); 
    } 
}

/**
 * Checks if a point is inside a polygon using the ray casting algorithm.
 * Handles points on the boundary as specified by onSegment behavior.
 * If a point is on an edge, this function might return false (not strictly inside).
 * The original code returned false if onSegment, which implies "strictly inside".
 */
export function isPointInPolygon(point: LonLat, polygon: LonLat[]): boolean { 
    const n = polygon.length; 
    if (n < 3) return false;  // A polygon must have at least 3 vertices.

    let intersectionsCount = 0; 
    
    for (let i = 0; i < n; i++) { 
        const p1 = polygon[i]; 
        const p2 = polygon[(i + 1) % n];  // Next vertex, wrapping around

        // Check if the point is collinear with and on the segment p1p2
        // If so, it's on the boundary, not strictly inside (consistent with original logic)
        if (getOrientation(p1, p2, point) === 0 && onSegment(p1, point, p2)) {
            return false; 
        }

        // Check if the ray from 'point' crosses the edge (p1, p2)
        // The ray goes from point to (point.lon + infinity, point.lat)
        // Based on point.lat being between p1.lat and p2.lat (exclusive of one end for robustness)
        if ((p1.lat <= point.lat && point.lat < p2.lat) || (p2.lat <= point.lat && point.lat < p1.lat)) {
            // Calculate the x-coordinate of the intersection of the ray with the line segment
            // This uses the formula for x-intersection of a horizontal line (y = point.lat)
            // with the line defined by p1 and p2.
            // vt is the interpolation factor along the segment from p1 to p2 where y=point.lat
            const vt = (point.lat - p1.lat) / (p2.lat - p1.lat);
            const intersectionLon = p1.lon + vt * (p2.lon - p1.lon);
            
            // If point.lon is to the left of the intersection point, it's an intersection
            if (point.lon < intersectionLon) {
                intersectionsCount++;
            }
        }
    } 
    // If the number of intersections is odd, the point is inside.
    return intersectionsCount % 2 === 1; 
}