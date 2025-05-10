import { LonLat, Ellipsoid } from "@openglobus/og";
import { isPointOnGeodesicArc } from "./isPointOnGeodesicArc";
import { getEllipsoid } from "./getEllipsoid";
import { describe, it, assert, logTestSummary, resetTestCounters } from './testUtils';

// Reset counters for this specific test file execution
resetTestCounters();

describe('isPointOnGeodesicArc', () => {
    let ellipsoid: Ellipsoid;
    try {
        ellipsoid = getEllipsoid();
    } catch (e: any) {
        console.error("Failed to get ellipsoid for isPointOnGeodesicArc tests:", e.message);
    }

    const pA = new LonLat(0, 0, 0);  // Point A on equator
    const pB = new LonLat(10, 0, 0); // Point B on equator, 10 degrees east
    
    // Calculate midpoint and a point beyond B using ellipsoid.direct and inverse
    let pMid = new LonLat(5,0,0); // Default if direct fails
    let pBeyond = new LonLat(11,0,0); // Default if direct fails
    let pAlmostB = new LonLat(9.999999, 0, 0); // Default

    if (ellipsoid) {
        try {
            // @ts-ignore - ellipsoid.inverse result might have incomplete typing
            const distAB = ellipsoid.inverse(pA, pB).distance;
            // @ts-ignore
            const midResult = ellipsoid.direct(pA, 90, distAB / 2); // Bearing 90 for East along Equator
            pMid = new LonLat(midResult.lon, midResult.lat, midResult.height || 0);

            // @ts-ignore
            const beyondResult = ellipsoid.direct(pB, 90, distAB * 0.1); // 10% of distAB beyond pB
            pBeyond = new LonLat(beyondResult.lon, beyondResult.lat, beyondResult.height || 0);
            
            // @ts-ignore
            const almostBResult = ellipsoid.direct(pB, 270, 1); // 1 meter before B (approx)
            pAlmostB = new LonLat(almostBResult.lon, almostBResult.lat, almostBResult.height || 0);

        } catch (e: any) {
            console.error("Error calculating test points for isPointOnGeodesicArc:", e.message);
        }
    }

    const pOffArc = new LonLat(5, 1, 0); // Point not on the arc (different latitude)

    it('should return true for the start point of an arc', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        assert(isPointOnGeodesicArc(pA, pA, pB, ellipsoid), "Point A is on arc AB (as start)");
    });

    it('should return true for the end point of an arc', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        assert(isPointOnGeodesicArc(pB, pA, pB, ellipsoid), "Point B is on arc AB (as end)");
    });
    
    it('should return true for a point in the middle of an arc', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        assert(isPointOnGeodesicArc(pMid, pA, pB, ellipsoid), `Midpoint pMid (${pMid.lon}, ${pMid.lat}) is on arc AB`);
    });

    it('should return true for a point very close to an endpoint, on the arc', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        assert(isPointOnGeodesicArc(pAlmostB, pA, pB, ellipsoid), `Point pAlmostB (${pAlmostB.lon}, ${pAlmostB.lat}) is on arc AB`);
    });

    it('should return false for a point beyond the arc (collinear)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        assert(!isPointOnGeodesicArc(pBeyond, pA, pB, ellipsoid), `Point pBeyond (${pBeyond.lon}, ${pBeyond.lat}) is NOT on arc AB`);
    });

    it('should return false for a point clearly off the arc', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        assert(!isPointOnGeodesicArc(pOffArc, pA, pB, ellipsoid), "Point pOffArc is NOT on arc AB");
    });

    it('should handle zero-length arc (A=B)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        assert(isPointOnGeodesicArc(pA, pA, pA, ellipsoid), "Point A is on zero-length arc AA");
        assert(!isPointOnGeodesicArc(pB, pA, pA, ellipsoid), "Point B is NOT on zero-length arc AA (since pB is different from pA here)");
    });

    // Test with points that might cause issues due to longitude wrapping (e.g., near antimeridian)
    // This is more advanced and depends heavily on the robustness of ellipsoid.inverse()
    it('should handle points across the antimeridian (conceptual - needs robust points)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        const pEast = new LonLat(175, 0, 0);
        const pWest = new LonLat(-175, 0, 0); // Equivalent to 185 degrees on a continuous circle past 180
        // Midpoint should be near +/-180 longitude on the equator
        // @ts-ignore
        const distEW = ellipsoid.inverse(pEast, pWest).distance; // This will be distance over the shorter arc (10 deg)
                                                              // To test across antimeridian other way, one point needs to be "further"
                                                              // Example: pA = (170,0), pB = (-170,0) means 20 deg across dateline
                                                              // Midpoint would be (180,0) or (-180,0)
        // @ts-ignore
        const midResultAM = ellipsoid.direct(pEast, 90, distEW / 2); // Should go towards pWest
        const pMidAM = new LonLat(midResultAM.lon, midResultAM.lat, midResultAM.height || 0);

        // This test is more about inverse/direct robustness than isPointOnGeodesicArc itself for now
        assert(isPointOnGeodesicArc(pMidAM, pEast, pWest, ellipsoid), 
            `Midpoint ${pMidAM.toString()} of E-W segment across antimeridian (short way)`);
    });
});

// Log summary for this test file
logTestSummary();