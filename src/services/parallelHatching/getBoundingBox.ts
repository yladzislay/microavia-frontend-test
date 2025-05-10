import { LonLat } from "@openglobus/og";

export interface BoundingBox { 
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
}

/**
 * Calculates the bounding box of a polygon.
 * @param polygon - An array of LonLat points representing the polygon.
 * @returns The bounding box.
 */
export function getBoundingBox(polygon: LonLat[]): BoundingBox {
    if (polygon.length === 0) {
        // Return an "empty" or "invalid" bounding box
        return { 
            minLon: Number.MAX_VALUE, 
            minLat: Number.MAX_VALUE, 
            maxLon: Number.MIN_VALUE, 
            maxLat: Number.MIN_VALUE 
        };
    }

    let minLon = polygon[0].lon, 
        minLat = polygon[0].lat, 
        maxLon = polygon[0].lon, 
        maxLat = polygon[0].lat;

    for (let i = 1; i < polygon.length; i++) {
        const p = polygon[i];
        if (p.lon < minLon) minLon = p.lon;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lon > maxLon) maxLon = p.lon;
        if (p.lat > maxLat) maxLat = p.lat;
    }
    return { minLon, minLat, maxLon, maxLat };
}