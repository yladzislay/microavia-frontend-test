import { GLOBUS } from "../globus.ts";
import { LonLat, Ellipsoid } from "@openglobus/og";

// --- Вспомогательные функции ---

// Экспортируем для тестирования
export function normalizeAngle(angle: number): number {
    let normalized = angle % 360;
    if (normalized < 0) {
        normalized += 360;
    }
    return normalized;
}

// @ts-ignore: Helper function, may be unused
function getPerpendicularBearing(baseBearing: number, direction: 'left' | 'right' = 'right'): number {
    const normalizedBase = normalizeAngle(baseBearing);
    let perpendicular: number;
    if (direction === 'right') {
        perpendicular = normalizedBase + 90;
    } else { // 'left'
        perpendicular = normalizedBase - 90;
    }
    return normalizeAngle(perpendicular);
}

interface BoundingBox {
    minLon: number; minLat: number; maxLon: number; maxLat: number;
}

// @ts-ignore: Helper function, may be unused
function getBoundingBox(polygon: LonLat[]): BoundingBox {
    if (polygon.length === 0) {
        return { minLon: Number.MAX_VALUE, minLat: Number.MAX_VALUE, maxLon: Number.MIN_VALUE, maxLat: Number.MIN_VALUE };
    }
    let minLon = polygon[0].lon, minLat = polygon[0].lat, maxLon = polygon[0].lon, maxLat = polygon[0].lat;
    for (let i = 1; i < polygon.length; i++) {
        const p = polygon[i];
        if (p.lon < minLon) minLon = p.lon; if (p.lat < minLat) minLat = p.lat;
        if (p.lon > maxLon) maxLon = p.lon; if (p.lat > maxLat) maxLat = p.lat;
    }
    return { minLon, minLat, maxLon, maxLat };
}

interface ProjectionRangeInfo {
    minProjection: number; maxProjection: number; axisOrigin: LonLat; projectionAxisBearing: number;
}

function getProjectionRangeOnAxis(polygon: LonLat[], mainBearing: number, ellipsoid: Ellipsoid): ProjectionRangeInfo {
    console.log(`[DEBUG] getProjectionRangeOnAxis: Called. MainBearing: ${mainBearing}, Polygon points: ${polygon.length}`);
    if (polygon.length === 0) {
        console.error("[DEBUG] getProjectionRangeOnAxis: Polygon is empty.");
        throw new Error("Polygon is empty, cannot calculate projection range.");
    }
    
    const axisOrigin = polygon[0];
    const projectionAxisBearing = normalizeAngle(mainBearing + 90);

    let minProjection = 0; // Initial projection for axisOrigin is 0
    let maxProjection = 0; // Initial projection for axisOrigin is 0
    console.log(`[DEBUG] getProjectionRangeOnAxis: axisOrigin=(${axisOrigin.lon.toFixed(5)}, ${axisOrigin.lat.toFixed(5)}), projectionAxisBearing=${projectionAxisBearing.toFixed(5)}`);
    console.log(`[DEBUG] getProjectionRangeOnAxis: Initial min/max with axisOrigin's projection: ${minProjection}, ${maxProjection}`);

    for (let i = 1; i < polygon.length; i++) { // Start from the second point
        const vertex = polygon[i];
        let projectedDistance = 0; 

        // @ts-ignore: ellipsoid.inverse() in this version/context returns an object.
        const invResultsValue = ellipsoid.inverse(axisOrigin, vertex);
        
        // Check if result exists and has the expected properties (even if their type is not strictly number, try to use them)
        if (invResultsValue && invResultsValue.distance !== undefined && invResultsValue.initialAzimuth !== undefined) { 
            const dist = invResultsValue.distance;
            const bearingToV = invResultsValue.initialAzimuth;

            // Add a final safety check for types before math operations
            if (typeof dist === 'number' && typeof bearingToV === 'number') {
                const angleDiffRad = normalizeAngle(bearingToV - projectionAxisBearing) * (Math.PI / 180.0);
                projectedDistance = dist * Math.cos(angleDiffRad);
                // console.log(`[DEBUG] getProjectionRangeOnAxis: Vertex ${i} (${vertex.lon.toFixed(5)}, ${vertex.lat.toFixed(5)}) -> dist=${dist.toFixed(2)}, bearingToV=${bearingToV.toFixed(2)}, angleDiffRad=${angleDiffRad.toFixed(2)}, projectedDistance=${projectedDistance.toFixed(2)}`);
            } else {
                console.warn(`[DEBUG] getProjectionRangeOnAxis: Vertex ${i}. Properties distance/initialAzimuth exist but are not numbers:`, invResultsValue);
            }
        } else {
            // This case means invResultsValue is null, or it's an object missing distance/initialAzimuth
            if (invResultsValue !== null) { 
                console.warn(`[DEBUG] getProjectionRangeOnAxis: ellipsoid.inverse returned object missing distance or initialAzimuth for Vertex ${i}:`, invResultsValue);
            } else {
                // console.log(`[DEBUG] getProjectionRangeOnAxis: ellipsoid.inverse returned null for Vertex ${i}`);
            }
        }
        minProjection = Math.min(minProjection, projectedDistance);
        maxProjection = Math.max(maxProjection, projectedDistance);
    }
    console.log(`[DEBUG] getProjectionRangeOnAxis: Finished. minProjection=${minProjection.toFixed(2)}, maxProjection=${maxProjection.toFixed(2)}`);
    return { minProjection, maxProjection, axisOrigin, projectionAxisBearing };
}

function getOrientation(p: LonLat, q: LonLat, r: LonLat): number {
    const val = (q.lat - p.lat) * (r.lon - q.lon) - (q.lon - p.lon) * (r.lat - q.lat);
    if (val === 0) return 0;
    return (val > 0) ? 1 : 2;
}

function onSegment(p: LonLat, q: LonLat, r: LonLat): boolean {
    return (q.lon <= Math.max(p.lon, r.lon) && q.lon >= Math.min(p.lon, r.lon) &&
            q.lat <= Math.max(p.lat, r.lat) && q.lat >= Math.min(p.lat, r.lat));
}

function segmentsIntersect(p1: LonLat, q1: LonLat, p2: LonLat, q2: LonLat): boolean {
    const o1 = getOrientation(p1, q1, p2);
    const o2 = getOrientation(p1, q1, q2);
    const o3 = getOrientation(p2, q2, p1);
    const o4 = getOrientation(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
}

function getIntersectionPoint(p1: LonLat, q1: LonLat, p2: LonLat, q2: LonLat): LonLat | null {
    const a1 = q1.lat - p1.lat, b1 = p1.lon - q1.lon, c1 = a1 * p1.lon + b1 * p1.lat;
    const a2 = q2.lat - p2.lat, b2 = p2.lon - q2.lon, c2 = a2 * p2.lon + b2 * p2.lat;
    const determinant = a1 * b2 - a2 * b1;
    if (determinant === 0) return null;
    const lon = (b2 * c1 - b1 * c2) / determinant;
    const lat = (a1 * c2 - a2 * c1) / determinant;
    return new LonLat(lon, lat);
}

function isPointInPolygon(point: LonLat, polygon: LonLat[]): boolean {
    let intersectionsVal = 0;
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % n];
        if (point.lat < p2.lat !== point.lat < p1.lat) {
            const intersectionLon = (p2.lon - p1.lon) * (point.lat - p1.lat) / (p2.lat - p1.lat) + p1.lon;
            if (point.lon < intersectionLon) {
                intersectionsVal++;
            }
        }
    }
    return intersectionsVal % 2 === 1;
}

// --- Основная функция ---
export function createParallelHatching(
    coordinates: [number, number, number?][][],
    step: number = 100,
    bearing: number = 0,
    offset: number = 50
): LonLat[][] {
    if (!coordinates || coordinates.length === 0 || !coordinates[0] || coordinates[0].length === 0) {
        console.error("Polygon coordinates are empty or invalid."); return [];
    }
    const outerRingRawCoordinates = coordinates[0];
    const polygonLonLatArray: LonLat[] = outerRingRawCoordinates.map(p => new LonLat(p[0], p[1], p[2]));

    if (polygonLonLatArray.length < 3) {
        console.error("Polygon must have at least 3 vertices."); return [];
    }

    const ellipsoid: Ellipsoid = GLOBUS.planet.ellipsoid;
    const corridorInfo: ProjectionRangeInfo = getProjectionRangeOnAxis(polygonLonLatArray, bearing, ellipsoid); 

    const generatedInfiniteLines: LonLat[][] = [];
    const veryLargeDistance = 10000000; 

    const startProjectionDistance = corridorInfo.minProjection - offset;
    const endProjectionDistance = corridorInfo.maxProjection + offset;
    let currentProjectionDistance = startProjectionDistance;

    while (currentProjectionDistance <= endProjectionDistance) {
        // @ts-ignore: Linter seems to have issues with OpenGlobus types for direct()
        const lineCenterResult = ellipsoid.direct(corridorInfo.axisOrigin, corridorInfo.projectionAxisBearing, currentProjectionDistance);
        const lineCenterPoint = new LonLat(lineCenterResult.lon, lineCenterResult.lat);
        
        // @ts-ignore: Linter seems to have issues with OpenGlobus types for direct()
        const point1Result = ellipsoid.direct(lineCenterPoint, bearing, veryLargeDistance);
        const point1 = new LonLat(point1Result.lon, point1Result.lat);

        // @ts-ignore: Linter seems to have issues with OpenGlobus types for direct()
        const point2Result = ellipsoid.direct(lineCenterPoint, normalizeAngle(bearing + 180), veryLargeDistance);
        const point2 = new LonLat(point2Result.lon, point2Result.lat);
        
        generatedInfiniteLines.push([point1, point2]);
        
        if (step <= 0) {
             console.warn("Step is non-positive. Generating lines based on initial projection distance only.");
             break;
        }
        currentProjectionDistance += step;
    }

    const finalLines: LonLat[][] = [];
    for (const infiniteLine of generatedInfiniteLines) {
        const lineStart = infiniteLine[0]; 
        const lineEnd = infiniteLine[1];   
        const intersectionPoints: LonLat[] = [];

        for (let i = 0; i < polygonLonLatArray.length; i++) {
            const polyP1 = polygonLonLatArray[i];
            const polyP2 = polygonLonLatArray[(i + 1) % polygonLonLatArray.length];
            if (segmentsIntersect(lineStart, lineEnd, polyP1, polyP2)) {
                const intersection = getIntersectionPoint(lineStart, lineEnd, polyP1, polyP2);
                if (intersection && onSegment(polyP1, intersection, polyP2) && onSegment(lineStart, intersection, lineEnd)) {
                    intersectionPoints.push(intersection);
                }
            }
        }

        if (intersectionPoints.length >= 2) {
            intersectionPoints.sort((a, b) => {
                const distSqA = Math.pow(a.lon - lineStart.lon, 2) + Math.pow(a.lat - lineStart.lat, 2);
                const distSqB = Math.pow(b.lon - lineStart.lon, 2) + Math.pow(b.lat - lineStart.lat, 2);
                return distSqA - distSqB;
            });
            
            for (let i = 0; i < intersectionPoints.length - 1; i += 2) {
                let p1_intersect = intersectionPoints[i];
                let p2_intersect = intersectionPoints[i + 1];
                
                const midPoint = new LonLat((p1_intersect.lon + p2_intersect.lon) / 2, (p1_intersect.lat + p2_intersect.lat) / 2);

                if (isPointInPolygon(midPoint, polygonLonLatArray)) {
                    // @ts-ignore: Linter seems to have issues with OpenGlobus types for direct()
                    const extendedP1Result = ellipsoid.direct(p1_intersect, normalizeAngle(bearing + 180), offset);
                    const extendedP1 = new LonLat(extendedP1Result.lon, extendedP1Result.lat);
                    
                    // @ts-ignore: Linter seems to have issues with OpenGlobus types for direct()
                    const extendedP2Result = ellipsoid.direct(p2_intersect, bearing, offset);
                    const extendedP2 = new LonLat(extendedP2Result.lon, extendedP2Result.lat);
                                        
                    finalLines.push([extendedP1, extendedP2]);
                }
            }
        }
    }
    
    console.log(`createParallelHatching: step=${step}, bearing=${bearing}, offset=${offset}. Generated ${finalLines.length} lines.`);
    return finalLines;
}