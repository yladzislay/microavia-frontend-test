import { GLOBUS } from "../globus.ts";
import { LonLat, Ellipsoid } from "@openglobus/og";
import { normalizeAngle } from "./utils/angleUtils.ts"; 

// --- Вспомогательные функции ---

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

export interface BoundingBox { 
    minLon: number; minLat: number; maxLon: number; maxLat: number;
}

export function getBoundingBox(polygon: LonLat[]): BoundingBox {
    if (polygon.length === 0) {
        return { minLon: Number.MAX_VALUE, minLat: Number.MAX_VALUE, maxLon: Number.MIN_VALUE, maxLat: Number.MIN_VALUE };
    }
    let minLon = polygon[0].lon, minLat = polygon[0].lat, maxLon = polygon[0].lon, maxLat = polygon[0].lat;
    for (let i = 1; i < polygon.length; i++) { const p = polygon[i]; if (p.lon < minLon) minLon = p.lon; if (p.lat < minLat) minLat = p.lat; if (p.lon > maxLon) maxLon = p.lon; if (p.lat > maxLat) maxLat = p.lat; }
    return { minLon, minLat, maxLon, maxLat };
}

export interface ProjectionRangeInfo { minProjection: number; maxProjection: number; axisOrigin: LonLat; projectionAxisBearing: number;}

// Изменяем getProjectionRangeOnAxis, чтобы он принимал ellipsoid как параметр
export function getProjectionRangeOnAxis(
    polygon: LonLat[], 
    mainBearing: number, 
    ellipsoidToUse: Ellipsoid 
): ProjectionRangeInfo {
    // console.log(`[LOG] getProjectionRangeOnAxis: START...`);
    if (polygon.length === 0) { throw new Error("Polygon empty"); }
    const axisOrigin = polygon[0];
    const projectionAxisBearing = normalizeAngle(mainBearing + 90); 
    let minProjection = 0; let maxProjection = 0; 
    for (let i = 1; i < polygon.length; i++) { 
        const vertex = polygon[i];
        let projectedDistance = 0; 
        // @ts-ignore
        const invResultsValue = ellipsoidToUse.inverse(axisOrigin, vertex); 
        if (invResultsValue && invResultsValue.distance !== undefined && invResultsValue.initialAzimuth !== undefined) { 
            const dist = invResultsValue.distance; const bearingToV = invResultsValue.initialAzimuth;
            if (typeof dist === 'number' && typeof bearingToV === 'number') {
                const angleDiffRad = normalizeAngle(bearingToV - projectionAxisBearing) * (Math.PI / 180.0); 
                projectedDistance = dist * Math.cos(angleDiffRad);
            } 
        } 
        minProjection = Math.min(minProjection, projectedDistance);
        maxProjection = Math.max(maxProjection, projectedDistance);
    }
    return { minProjection, maxProjection, axisOrigin, projectionAxisBearing };
}

export function getOrientation(p: LonLat, q: LonLat, r: LonLat): number { 
    const val = (q.lat - p.lat) * (r.lon - q.lon) - (q.lon - p.lon) * (r.lat - q.lat); 
    if (Math.abs(val) < 1e-9) return 0;  
    return (val > 0) ? 1 : 2; 
}
export function onSegment(p: LonLat, q: LonLat, r: LonLat): boolean { 
    const tolerance = 1e-9;  
    return (q.lon <= Math.max(p.lon, r.lon) + tolerance && q.lon >= Math.min(p.lon, r.lon) - tolerance && 
            q.lat <= Math.max(p.lat, r.lat) + tolerance && q.lat >= Math.min(p.lat, r.lat) - tolerance); 
}
export function segmentsIntersect(p1: LonLat, q1: LonLat, p2: LonLat, q2: LonLat): boolean { 
    const o1 = getOrientation(p1, q1, p2); const o2 = getOrientation(p1, q1, q2); 
    const o3 = getOrientation(p2, q2, p1); const o4 = getOrientation(p2, q2, q1); 
    if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {  return (o1 !== o2 && o3 !== o4); } 
    if (o1 === 0 && onSegment(p1, p2, q1)) return true; 
    if (o2 === 0 && onSegment(p1, q2, q1)) return true; 
    if (o3 === 0 && onSegment(p2, p1, q2)) return true; 
    if (o4 === 0 && onSegment(p2, q1, q2)) return true; 
    return false; 
}
export function getIntersectionPoint(p1: LonLat, q1: LonLat, p2: LonLat, q2: LonLat): LonLat | null { 
    const a1 = q1.lat - p1.lat, b1 = p1.lon - q1.lon, c1 = a1 * p1.lon + b1 * p1.lat; 
    const a2 = q2.lat - p2.lat, b2 = p2.lon - q2.lon, c2 = a2 * p2.lon + b2 * p2.lat; 
    const determinant = a1 * b2 - a2 * b1; 
    if (Math.abs(determinant) < 1e-9) {  return null; } 
    const lon = (b2 * c1 - b1 * c2) / determinant; 
    const lat = (a1 * c2 - a2 * c1) / determinant; 
    return new LonLat(lon, lat); 
}
export function isPointInPolygon(point: LonLat, polygon: LonLat[]): boolean { 
    let intersectionsVal = 0; const n = polygon.length; if (n < 3) return false;  
    for (let i = 0; i < n; i++) { 
        const p1 = polygon[i]; const p2 = polygon[(i + 1) % n];  
        if (getOrientation(p1, p2, point) === 0 && onSegment(p1, point, p2)) { return false;  } 
        if ((p1.lat <= point.lat && point.lat < p2.lat) || (p2.lat <= point.lat && point.lat < p1.lat)) { 
            const vt = (point.lat - p1.lat) / (p2.lat - p1.lat); 
            const intersectionLon = p1.lon + vt * (p2.lon - p1.lon); 
            if (point.lon < intersectionLon) {  intersectionsVal++; } 
        } 
    } 
    return intersectionsVal % 2 === 1; 
}

// --- Основная функция ---
export function createParallelHatching(
    coordinates: [number, number, number?][][],
    step: number = 100,
    bearing: number = 0,
    offset: number = 50,
    ellipsoidOverride?: Ellipsoid 
): LonLat[][] {
    // console.log(`[LOG] createParallelHatching: Initiated ...`);
    if (!coordinates || coordinates.length === 0 || !coordinates[0] || coordinates[0].length === 0) { return []; }
    const outerRingRawCoordinates = coordinates[0];
    const polygonLonLatArray: LonLat[] = outerRingRawCoordinates.map(p => new LonLat(p[0], p[1], p[2]));
    if (polygonLonLatArray.length < 3) { return []; }

    const ellipsoid: Ellipsoid = ellipsoidOverride || GLOBUS.planet.ellipsoid;
    const corridorInfo: ProjectionRangeInfo = getProjectionRangeOnAxis(polygonLonLatArray, bearing, ellipsoid); 
    
    const generatedInfiniteLines: LonLat[][] = [];
    const veryLargeDistance = 10000000; 
    const startProjectionDistance = corridorInfo.minProjection - offset;
    const endProjectionDistance = corridorInfo.maxProjection + offset;
    if (startProjectionDistance > endProjectionDistance && step > 0) { return []; }

    let currentProjectionDistance = startProjectionDistance;
    let infiniteLineCounter = 0;
    while (currentProjectionDistance <= endProjectionDistance) {
        infiniteLineCounter++;
        // @ts-ignore
        const lineCenterResult = ellipsoid.direct(corridorInfo.axisOrigin, corridorInfo.projectionAxisBearing, currentProjectionDistance);
        const lineCenterPoint = new LonLat(lineCenterResult.lon, lineCenterResult.lat);
        // @ts-ignore
        const point1Result = ellipsoid.direct(lineCenterPoint, bearing, veryLargeDistance);
        const point1 = new LonLat(point1Result.lon, point1Result.lat);
        // @ts-ignore
        const point2Result = ellipsoid.direct(lineCenterPoint, normalizeAngle(bearing + 180), veryLargeDistance); 
        const point2 = new LonLat(point2Result.lon, point2Result.lat);
        generatedInfiniteLines.push([point1, point2]);
        if (step <= 0) { break; }
        currentProjectionDistance += step;
        if (infiniteLineCounter > 2000) { break; }
    }
    
    const finalLines: LonLat[][] = [];
    for (let k = 0; k < generatedInfiniteLines.length; k++) {
        const infiniteLine = generatedInfiniteLines[k];
        const lineStart = infiniteLine[0]; const lineEnd = infiniteLine[1];   
        const intersectionPoints: LonLat[] = [];
        for (let i = 0; i < polygonLonLatArray.length; i++) {
            const polyP1 = polygonLonLatArray[i]; const polyP2 = polygonLonLatArray[(i + 1) % polygonLonLatArray.length];
            if (segmentsIntersect(lineStart, lineEnd, polyP1, polyP2)) { // Используем экспортированную segmentsIntersect
                const intersection = getIntersectionPoint(lineStart, lineEnd, polyP1, polyP2); // Используем экспортированную
                if (intersection) {
                    if (onSegment(polyP1, intersection, polyP2) && onSegment(lineStart, intersection, lineEnd)) { // Используем экспортированную
                        intersectionPoints.push(intersection); 
                    }
                }
            }
        }
        if (intersectionPoints.length >= 2) {
            intersectionPoints.sort((a,b)=> (Math.pow(a.lon-lineStart.lon,2)+Math.pow(a.lat-lineStart.lat,2)) - (Math.pow(b.lon-lineStart.lon,2)+Math.pow(b.lat-lineStart.lat,2)));
            for (let i = 0; i < intersectionPoints.length - 1; i += 2) {
                let p1_intersect = intersectionPoints[i]; let p2_intersect = intersectionPoints[i + 1];
                const midPoint = new LonLat((p1_intersect.lon+p2_intersect.lon)/2, (p1_intersect.lat+p2_intersect.lat)/2);
                if (isPointInPolygon(midPoint, polygonLonLatArray)) { // Используем экспортированную
                    // @ts-ignore
                    const extendedP1Result = ellipsoid.direct(p1_intersect, normalizeAngle(bearing + 180), offset); 
                    const extendedP1 = new LonLat(extendedP1Result.lon, extendedP1Result.lat);
                    // @ts-ignore
                    const extendedP2Result = ellipsoid.direct(p2_intersect, bearing, offset);
                    const extendedP2 = new LonLat(extendedP2Result.lon, extendedP2Result.lat);
                    finalLines.push([extendedP1, extendedP2]);
                } 
            }
        }
    }
    if (finalLines.length > 0) { console.log(`[INFO] createParallelHatching: Successfully generated ${finalLines.length} lines.`); }
    else { console.log(`[INFO] createParallelHatching: No lines generated.`); }
    return finalLines;
}