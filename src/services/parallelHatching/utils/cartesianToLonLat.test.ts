import { LonLat, Vec3, Ellipsoid } from "@openglobus/og";
import { cartesianToLonLat } from "./cartesianToLonLat";
import { lonLatToCartesian } from "./lonLatToCartesian"; // For consistency check
import { getEllipsoid } from "./getEllipsoid";
import { describe, it, assert, assertEquals, logTestSummary, resetTestCounters } from './testUtils';

// Reset counters for this specific test file execution
resetTestCounters();

describe('cartesianToLonLat', () => {
    let ellipsoid: Ellipsoid;
    try {
        ellipsoid = getEllipsoid();
    } catch (e: any) {
        console.error("Failed to get ellipsoid for cartesianToLonLat tests:", e.message);
    }

    it('should convert Cartesian (EquatorialRadius,0,0) to LonLat (0,0,0)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for (EqR,0,0) test"); return; }
        const x = (ellipsoid as any).equatorialRadius;
        const pointXYZ = new Vec3(x, 0, 0);
        const pointLL: LonLat = cartesianToLonLat(pointXYZ, ellipsoid);
        
        assertEquals(pointLL.lon, 0, "Longitude for (EqR,0,0)", 1e-7);
        assertEquals(pointLL.lat, 0, "Latitude for (EqR,0,0)", 1e-7);
        assertEquals(pointLL.height, 0, "Height for (EqR,0,0)", 1e-7); // Altitude might have some minor diff
    });

    it('should convert Cartesian (0,0,PolarRadius) to North Pole LonLat (any,90,0)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for (0,0,PolR) test"); return; }
        const z = (ellipsoid as any).polarRadius;
        const pointXYZ = new Vec3(0, 0, z);
        const pointLL: LonLat = cartesianToLonLat(pointXYZ, ellipsoid);

        // Longitude at poles is ambiguous, often defaults to 0.
        // assertEquals(pointLL.lon, 0, "Longitude for North Pole", 1e-7); // Not strictly enforced
        assertEquals(pointLL.lat, 90, "Latitude for North Pole", 1e-7);
        assertEquals(pointLL.height, 0, "Height for North Pole", 1e-7);
    });

    it('should convert Cartesian (0,0,-PolarRadius) to South Pole LonLat (any,-90,0)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for (0,0,-PolR) test"); return; }
        const z = -(ellipsoid as any).polarRadius;
        const pointXYZ = new Vec3(0, 0, z);
        const pointLL: LonLat = cartesianToLonLat(pointXYZ, ellipsoid);

        assertEquals(pointLL.lat, -90, "Latitude for South Pole", 1e-7);
        assertEquals(pointLL.height, 0, "Height for South Pole", 1e-7);
    });

    it('should be consistent with lonLatToCartesian', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for consistency test"); return; }
        
        const originalLonLats = [
            new LonLat(0, 0, 0),
            new LonLat(10, 20, 100),
            new LonLat(-30, -45, 500),
            new LonLat(170, 80, 1000), // Near pole
            new LonLat(-170, -85, 200) // Near pole, other hemisphere
        ];

        for (const originalLL of originalLonLats) {
            const cartesian: Vec3 = lonLatToCartesian(originalLL, ellipsoid);
            const convertedLL: LonLat = cartesianToLonLat(cartesian, ellipsoid);

            // Using LonLat.equal for comparison as it has internal tolerance
            assert(
                convertedLL.equal(originalLL), 
                `Consistency check for ${originalLL.toString()}: Expected ${originalLL.toString()}, Got ${convertedLL.toString()}`
            );
            // If more precision is needed for specific component:
            assertEquals(convertedLL.lon, originalLL.lon, `Lon consistency for ${originalLL.lon}`, 1e-6);
            assertEquals(convertedLL.lat, originalLL.lat, `Lat consistency for ${originalLL.lat}`, 1e-6);
            assertEquals(convertedLL.height, originalLL.height, `Height consistency for ${originalLL.height}`, 1e-4); // Height can have larger errors in conversion
        }
    });
});

// Log summary for this test file
logTestSummary();