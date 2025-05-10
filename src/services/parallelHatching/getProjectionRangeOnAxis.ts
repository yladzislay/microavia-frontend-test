import { LonLat, Ellipsoid } from "@openglobus/og";
import { normalizeAngle } from "./utils/angleUtils";

export interface ProjectionRangeInfo {
    minProjection: number;
    maxProjection: number;
    axisOrigin: LonLat;
    projectionAxisBearing: number;
}

/**
 * Calculates the projection range of a polygon onto an axis perpendicular to the main bearing.
 * @param polygon - An array of LonLat points.
 * @param mainBearing - The main bearing in degrees.
 * @param ellipsoidToUse - The ellipsoid for calculations.
 * @returns Information about the projection range.
 */
export function getProjectionRangeOnAxis(
    polygon: LonLat[], 
    mainBearing: number, 
    ellipsoidToUse: Ellipsoid 
): ProjectionRangeInfo {
    if (polygon.length === 0) { 
        throw new Error("Polygon cannot be empty for projection range calculation."); 
    }

    const axisOrigin = polygon[0].clone(); // Use a clone to avoid modifying original
    const projectionAxisBearing = normalizeAngle(mainBearing + 90); 
    
    let minProjection = 0; 
    let maxProjection = 0; 

    // The first point (axisOrigin) projects to 0 on the axis relative to itself.
    // Iterate through the rest of the points.
    for (let i = 1; i < polygon.length; i++) { 
        const vertex = polygon[i];
        let projectedDistance = 0; 
        
        // @ts-ignore // Keep @ts-ignore for inverse as it was in original file
        const invResultsValue = ellipsoidToUse.inverse(axisOrigin, vertex); 
        
        if (invResultsValue && invResultsValue.distance !== undefined && invResultsValue.initialAzimuth !== undefined) { 
            const dist = invResultsValue.distance; 
            const bearingToV = invResultsValue.initialAzimuth;
            
            if (typeof dist === 'number' && typeof bearingToV === 'number') {
                // Calculate the difference in angle between the bearing to the vertex
                // and the bearing of the projection axis.
                const angleDiffRad = normalizeAngle(bearingToV - projectionAxisBearing) * (Math.PI / 180.0); 
                // Project the distance to the vertex onto the projection axis.
                projectedDistance = dist * Math.cos(angleDiffRad);
            } 
        } 
        minProjection = Math.min(minProjection, projectedDistance);
        maxProjection = Math.max(maxProjection, projectedDistance);
    }
    return { minProjection, maxProjection, axisOrigin, projectionAxisBearing };
}