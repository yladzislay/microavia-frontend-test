import { GLOBUS } from "../../globus"; 
import { LonLat, Ellipsoid } from "@openglobus/og";
import { normalizeAngle } from "./utils/angleUtils";
import { getProjectionRangeOnAxis, ProjectionRangeInfo } from "./getProjectionRangeOnAxis";
import { geodesicSegmentsIntersection } from "./utils/geodesicSegmentsIntersection";
import { isPointInGeodesicPolygon } from "./utils/isPointInGeodesicPolygon";

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
    const veryLargeDistance = 10000000; 
    
    const startProjectionDistance = corridorInfo.minProjection - offset; 
    const endProjectionDistance = corridorInfo.maxProjection + offset;

    if (startProjectionDistance > endProjectionDistance && step > 0) {
        // console.log already in previous attempts
        return [];
    }
    if (step <= 0 && startProjectionDistance > endProjectionDistance) {
         // console.log already in previous attempts
         return [];
    }

    let currentProjectionDistance = startProjectionDistance;
    let infiniteLineCounter = 0;
    const MAX_INFINITE_LINES = 2000; 

    while (currentProjectionDistance <= endProjectionDistance) {
        infiniteLineCounter++;
        if (infiniteLineCounter > MAX_INFINITE_LINES) { 
            console.warn(`[WARN] createParallelHatching: Exceeded ${MAX_INFINITE_LINES} infinite lines, breaking loop.`); 
            break; 
        }
        
        // @ts-ignore
        const lineCenterResult = ellipsoid.direct(corridorInfo.axisOrigin, corridorInfo.projectionAxisBearing, currentProjectionDistance);
        const lineCenterPoint = new LonLat(lineCenterResult.lon, lineCenterResult.lat );

        // @ts-ignore
        const point1Result = ellipsoid.direct(lineCenterPoint, bearing, veryLargeDistance);
        const point1 = new LonLat(point1Result.lon, point1Result.lat );

        // @ts-ignore
        const point2Result = ellipsoid.direct(lineCenterPoint, normalizeAngle(bearing + 180), veryLargeDistance); 
        const point2 = new LonLat( point2Result.lon, point2Result.lat );
        
        generatedInfiniteLines.push([point1, point2]);
        
        if (step <= 0) { 
            if (infiniteLineCounter > 0) break; 
        }
        currentProjectionDistance += step; 
    }
    
    const finalLines: LonLat[][] = [];
    for (let k = 0; k < generatedInfiniteLines.length; k++) {
        const infiniteLine = generatedInfiniteLines[k];
        const lineStart = infiniteLine[0]; 
        const lineEnd = infiniteLine[1];   
        
        let currentLineIntersections: LonLat[] = [];
        for (let i = 0; i < polygonLonLatArray.length; i++) {
            const polyP1 = polygonLonLatArray[i]; 
            const polyP2 = polygonLonLatArray[(i + 1) % polygonLonLatArray.length];
            
            const newIntersections = geodesicSegmentsIntersection(lineStart, lineEnd, polyP1, polyP2, ellipsoid);
            if (newIntersections.length > 0) {
                currentLineIntersections.push(...newIntersections);
            }
        }
        
        const uniqueIntersectionPoints: LonLat[] = [];
        if (currentLineIntersections.length > 0) {
            for (const pt of currentLineIntersections) {
                if (!uniqueIntersectionPoints.some(u => u.equal(pt, 1e-7))) { 
                    uniqueIntersectionPoints.push(pt);
                }
            }
        }
        
        if (uniqueIntersectionPoints.length >= 2) {
            uniqueIntersectionPoints.sort((a,b)=> 
                (Math.pow(a.lon - lineStart.lon, 2) + Math.pow(a.lat - lineStart.lat, 2)) -
                (Math.pow(b.lon - lineStart.lon, 2) + Math.pow(b.lat - lineStart.lat, 2))
            );
            
            for (let j = 0; j < uniqueIntersectionPoints.length - 1; j += 2) { 
                let p1_intersect = uniqueIntersectionPoints[j]; 
                let p2_intersect = uniqueIntersectionPoints[j + 1];
                
                const midPoint = new LonLat((p1_intersect.lon + p2_intersect.lon) / 2, (p1_intersect.lat + p2_intersect.lat) / 2);
                
                if (isPointInGeodesicPolygon(midPoint, polygonLonLatArray, ellipsoid)) { 
                    
                    const extendedP1Result = ellipsoid.direct(p1_intersect, normalizeAngle(bearing + 180), offset);
                    const extendedP1 = new LonLat( /* @ts-ignore */ extendedP1Result.lon, /* @ts-ignore */ extendedP1Result.lat );

                    const extendedP2Result = ellipsoid.direct(p2_intersect, bearing, offset);
                    const extendedP2 = new LonLat( /* @ts-ignore */ extendedP2Result.lon, /* @ts-ignore */ extendedP2Result.lat );
                    
                    finalLines.push([extendedP1, extendedP2]);
                } else {
                     if (console && typeof console.debug === 'function') {
                        // console.debug(`Midpoint ${midPoint.toString()} NOT in polygon (geodesic placeholder). Segment from ${p1_intersect.toString()} to ${p2_intersect.toString()}`);
                    }
                }
            }
        }
    }
    
    const logMessagePrefix = `[INFO] createParallelHatching for polygon w/ ${polygonLonLatArray.length} vertices (B:${bearing},S:${step},O:${offset}):`;
    if (finalLines.length > 0) { 
        console.log(`${logMessagePrefix} Successfully generated ${finalLines.length} lines.`); 
    } else { 
        console.log(`${logMessagePrefix} No lines generated (check geodesic placeholders or intersection logic).`); 
    }
    return finalLines;
}