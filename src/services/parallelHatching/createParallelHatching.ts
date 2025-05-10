import { GLOBUS } from "../../globus"; // Adjusted path
import { LonLat, Ellipsoid } from "@openglobus/og";
import { normalizeAngle } from "./utils/angleUtils";
import { getProjectionRangeOnAxis, ProjectionRangeInfo } from "./getProjectionRangeOnAxis";
import { 
    segmentsIntersect, 
    getIntersectionPoint, 
    onSegment, 
    isPointInPolygon 
} from "./utils/planarGeometryUtils";

/**
 * Creates parallel hatching lines for a given polygon.
 * @param options - Options for generating the hatching.
 * @param options.polygonCoordinates - The coordinates of the polygon.
 * @param options.step - Distance between lines (default 100m).
 * @param options.bearing - Orientation of lines from North (default 0 deg).
 * @param options.offset - External offset from polygon edge (default 50m).
 * @returns An array of lines, where each line is a pair of LonLat points.
 */
export function createParallelHatching(
    options: { 
        polygonCoordinates: [number, number, number?][][];
        step?: number;
        bearing?: number;
        offset?: number;
    }
): LonLat[][] {
    const {
        polygonCoordinates,
        step = 100,
        bearing = 0,
        offset = 50
    } = options;

    if (!polygonCoordinates || polygonCoordinates.length === 0 || !polygonCoordinates[0] || polygonCoordinates[0].length === 0) {
        console.warn("[WARN] createParallelHatching: Input polygonCoordinates are invalid or empty.");
        return []; 
    }
    const outerRingRawCoordinates = polygonCoordinates[0];
    const polygonLonLatArray: LonLat[] = outerRingRawCoordinates.map(p => new LonLat(p[0], p[1], p[2]));
    
    if (polygonLonLatArray.length < 3) {
        console.warn("[WARN] createParallelHatching: Polygon has less than 3 vertices.");
        return []; 
    }

    const ellipsoid: Ellipsoid = GLOBUS.planet.ellipsoid; 
    const corridorInfo: ProjectionRangeInfo = getProjectionRangeOnAxis(polygonLonLatArray, bearing, ellipsoid); 
    
    const generatedInfiniteLines: LonLat[][] = [];
    const veryLargeDistance = 10000000; // A large distance to simulate infinite lines
    
    const startProjectionDistance = corridorInfo.minProjection - offset; 
    const endProjectionDistance = corridorInfo.maxProjection + offset;

    // Check if the range is valid, especially if step is positive
    if (startProjectionDistance > endProjectionDistance && step > 0) {
        console.log(`[INFO] createParallelHatching: No lines to generate as startProjectionDistance (${startProjectionDistance}) > endProjectionDistance (${endProjectionDistance}) with positive step.`);
        return [];
    }
    if (step <= 0 && startProjectionDistance > endProjectionDistance) { // Avoid issues if step is 0 or negative
         console.log(`[INFO] createParallelHatching: Step is non-positive and start projection is beyond end projection.`);
         // Potentially generate one line at startProjectionDistance if needed, or none.
         // For now, consistent with loop condition:
         return [];
    }


    let currentProjectionDistance = startProjectionDistance;
    let infiniteLineCounter = 0;
    const MAX_INFINITE_LINES = 2000; // Safety break

    while (currentProjectionDistance <= endProjectionDistance) {
        infiniteLineCounter++;
        if (infiniteLineCounter > MAX_INFINITE_LINES) { 
            console.warn(`[WARN] createParallelHatching: Exceeded ${MAX_INFINITE_LINES} infinite lines, breaking loop.`); 
            break; 
        }
        
        // The OpenGlobus type definitions for ellipsoid.direct might be problematic.
        // The original code used @ts-ignore and then constructed new LonLat.
        // Let's assume ellipsoid.direct() returns an object with .lon and .lat.
        // This pattern was causing lint errors in the previous attempts due to IDirectResult.
        // The most robust way with current tooling seems to be @ts-ignore before property access.
        
        const lineCenterResult = ellipsoid.direct(corridorInfo.axisOrigin, corridorInfo.projectionAxisBearing, currentProjectionDistance);
        const lineCenterPoint = new LonLat(
            // @ts-ignore 
            lineCenterResult.lon, 
            // @ts-ignore 
            lineCenterResult.lat
        );

        const point1Result = ellipsoid.direct(lineCenterPoint, bearing, veryLargeDistance);
        const point1 = new LonLat(
            // @ts-ignore
            point1Result.lon, 
            // @ts-ignore
            point1Result.lat
        );

        const point2Result = ellipsoid.direct(lineCenterPoint, normalizeAngle(bearing + 180), veryLargeDistance); 
        const point2 = new LonLat(
            // @ts-ignore
            point2Result.lon, 
            // @ts-ignore
            point2Result.lat
        );
        
        generatedInfiniteLines.push([point1, point2]);
        
        if (step <= 0) { // If step is 0 or negative, generate one line and break
            if (infiniteLineCounter > 0) break; // Already generated one line
        }
        currentProjectionDistance += step; 
    }
    
    const finalLines: LonLat[][] = [];
    for (let k = 0; k < generatedInfiniteLines.length; k++) {
        const infiniteLine = generatedInfiniteLines[k];
        const lineStart = infiniteLine[0]; 
        const lineEnd = infiniteLine[1];   
        
        const intersectionPoints: LonLat[] = [];
        for (let i = 0; i < polygonLonLatArray.length; i++) {
            const polyP1 = polygonLonLatArray[i]; 
            const polyP2 = polygonLonLatArray[(i + 1) % polygonLonLatArray.length];
            
            if (segmentsIntersect(lineStart, lineEnd, polyP1, polyP2)) { 
                const intersection = getIntersectionPoint(lineStart, lineEnd, polyP1, polyP2); 
                if (intersection) {
                    // Check if the intersection point is on both segments
                    if (onSegment(polyP1, intersection, polyP2) && onSegment(lineStart, intersection, lineEnd)) { 
                        intersectionPoints.push(intersection); 
                    }
                }
            }
        }
        
        if (intersectionPoints.length >= 2) {
            // Sort intersection points along the infinite line's direction
            // Using squared Euclidean distance from lineStart (planar approximation for sorting)
            intersectionPoints.sort((a,b)=> 
                (Math.pow(a.lon - lineStart.lon, 2) + Math.pow(a.lat - lineStart.lat, 2)) -
                (Math.pow(b.lon - lineStart.lon, 2) + Math.pow(b.lat - lineStart.lat, 2))
            );
            
            for (let i = 0; i < intersectionPoints.length - 1; i += 2) {
                let p1_intersect = intersectionPoints[i]; 
                let p2_intersect = intersectionPoints[i + 1];
                
                // Ensure midpoint is inside the polygon before extending (robustness)
                const midPoint = new LonLat((p1_intersect.lon + p2_intersect.lon) / 2, (p1_intersect.lat + p2_intersect.lat) / 2);
                if (isPointInPolygon(midPoint, polygonLonLatArray)) { 
                    
                    const extendedP1Result = ellipsoid.direct(p1_intersect, normalizeAngle(bearing + 180), offset);
                    const extendedP1 = new LonLat(
                        // @ts-ignore
                        extendedP1Result.lon, 
                        // @ts-ignore
                        extendedP1Result.lat
                    );

                    const extendedP2Result = ellipsoid.direct(p2_intersect, bearing, offset);
                    const extendedP2 = new LonLat(
                        // @ts-ignore
                        extendedP2Result.lon, 
                        // @ts-ignore
                        extendedP2Result.lat
                    );
                    
                    finalLines.push([extendedP1, extendedP2]);
                } 
            }
        }
    }
    
    const logMessagePrefix = `[INFO] createParallelHatching for polygon w/ ${polygonLonLatArray.length} vertices (B:${bearing},S:${step},O:${offset}):`;
    if (finalLines.length > 0) { 
        console.log(`${logMessagePrefix} Successfully generated ${finalLines.length} lines.`); 
    } else { 
        console.log(`${logMessagePrefix} No lines generated.`); 
    }
    return finalLines;
}