import { LonLat, Vec3, Ellipsoid } from "@openglobus/og";
import { lonLatToCartesian } from "./lonLatToCartesian";
import { getEllipsoid } from "./getEllipsoid";
import { describe, it, assert, assertEquals, logTestSummary, resetTestCounters } from './testUtils';

// Reset counters for this specific test file execution
resetTestCounters();

describe('lonLatToCartesian', () => {
    let ellipsoid: Ellipsoid;
    try {
        ellipsoid = getEllipsoid();
    } catch (e: any) {
        console.error("Failed to get ellipsoid for lonLatToCartesian tests:", e.message);
        // Fallback or skip tests if ellipsoid is critical and not available
    }

    it('should convert LonLat (0,0,0) to Cartesian (EquatorialRadius, 0, 0)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for Equator/PM test"); return; }
        const pointLL = new LonLat(0, 0, 0);
        const pointXYZ: Vec3 = lonLatToCartesian(pointLL, ellipsoid);
        
        const expectedX = (ellipsoid as any).equatorialRadius;
        assertEquals(pointXYZ.x, expectedX, "X coordinate for (0,0,0)", 1e-7);
        assertEquals(pointXYZ.y, 0, "Y coordinate for (0,0,0)", 1e-7);
        assertEquals(pointXYZ.z, 0, "Z coordinate for (0,0,0)", 1e-7);
    });

    it('should convert North Pole LonLat (0,90,0) to Cartesian (0,0,PolarRadius)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for North Pole test"); return; }
        const pointLL = new LonLat(0, 90, 0);
        const pointXYZ: Vec3 = lonLatToCartesian(pointLL, ellipsoid);

        const expectedZ = (ellipsoid as any).polarRadius;
        assertEquals(pointXYZ.x, 0, "X coordinate for North Pole", 1e-7);
        assertEquals(pointXYZ.y, 0, "Y coordinate for North Pole", 1e-7);
        assertEquals(pointXYZ.z, expectedZ, "Z coordinate for North Pole", 1e-7);
    });

    it('should convert South Pole LonLat (0,-90,0) to Cartesian (0,0,-PolarRadius)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for South Pole test"); return; }
        const pointLL = new LonLat(0, -90, 0);
        const pointXYZ: Vec3 = lonLatToCartesian(pointLL, ellipsoid);
        
        const expectedZ = -(ellipsoid as any).polarRadius;
        assertEquals(pointXYZ.x, 0, "X coordinate for South Pole", 1e-7);
        assertEquals(pointXYZ.y, 0, "Y coordinate for South Pole", 1e-7);
        assertEquals(pointXYZ.z, expectedZ, "Z coordinate for South Pole", 1e-7);
    });

    it('should handle height correctly', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for height test"); return; }
        const height = 1000;
        const pointLL = new LonLat(0, 0, height);
        const pointXYZ: Vec3 = lonLatToCartesian(pointLL, ellipsoid);

        // Expected X should be EquatorialRadius + height for a point on equator with height
        // This is because the normal vector points outwards along X-axis at (0,0)
        const expectedX = (ellipsoid as any).equatorialRadius + height;
        assertEquals(pointXYZ.x, expectedX, `X coordinate for (0,0,${height})`, 1e-7);
        assertEquals(pointXYZ.y, 0, `Y coordinate for (0,0,${height})`, 1e-7);
        assertEquals(pointXYZ.z, 0, `Z coordinate for (0,0,${height})`, 1e-7);
    });
});

// Log summary for this test file
logTestSummary();