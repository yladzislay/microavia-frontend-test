import { LonLat, Ellipsoid } from "@openglobus/og";
import { geodesicSegmentsIntersection } from "./geodesicSegmentsIntersection";
import { getEllipsoid } from "./getEllipsoid";
import { describe, it, assert, assertLonLatArrayEquals, logTestSummary, resetTestCounters } from './testUtils';

// Reset counters for this specific test file execution
resetTestCounters();

describe('geodesicSegmentsIntersection', () => {
    let ellipsoid: Ellipsoid;
    try {
        ellipsoid = getEllipsoid();
    } catch (e: any) {
        console.error("Failed to get ellipsoid for geodesicSegmentsIntersection tests:", e.message);
    }

    it('should find intersection for two clearly crossing equatorial segments', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        const p1 = new LonLat(-10, 0); 
        const q1 = new LonLat(10, 0);
        const p2 = new LonLat(0, -10); 
        const q2 = new LonLat(0, 10);
        
        const expectedIntersection = [new LonLat(0, 0)];
        const intersections = geodesicSegmentsIntersection(p1, q1, p2, q2, ellipsoid);
        
        assert(intersections.length === 1, "Crossing equatorial segments: Expect 1 intersection point");
        if (intersections.length === 1) {
            // Using a slightly larger tolerance for the result of intersection calculation
            assertLonLatArrayEquals(intersections, expectedIntersection, "Crossing equatorial segments: Intersection point check", 1e-5);
        }
    });

    it('should find no intersection for parallel (same latitude, different longitude ranges, not overlapping) segments', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        const p1 = new LonLat(-10, 10); 
        const q1 = new LonLat(10, 10);
        const p2 = new LonLat(-10, 20); // Different latitude
        const q2 = new LonLat(10, 20);
        
        const intersections = geodesicSegmentsIntersection(p1, q1, p2, q2, ellipsoid);
        assert(intersections.length === 0, "Parallel segments (different latitudes): Expect 0 intersection points");
    });

    it('should find no intersection for non-overlapping collinear (same great circle) segments', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        const p1 = new LonLat(0, 0);
        const q1 = new LonLat(10, 0);
        const p2 = new LonLat(20, 0); // Collinear on equator, but no overlap
        const q2 = new LonLat(30, 0);
        
        const intersections = geodesicSegmentsIntersection(p1, q1, p2, q2, ellipsoid);
        assert(intersections.length === 0, "Non-overlapping collinear segments: Expect 0 intersection points");
    });
    
    it('should find intersections for overlapping collinear (same great circle) segments', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        const p1 = new LonLat(0, 0);    // Segment 1: (0,0) to (20,0)
        const q1 = new LonLat(20, 0);
        const p2 = new LonLat(10, 0);   // Segment 2: (10,0) to (30,0)
        const q2 = new LonLat(30, 0);
        
        // Expected overlap points are the endpoints of the shared portion
        const expectedIntersections = [new LonLat(10,0), new LonLat(20,0)]; 
        const intersections = geodesicSegmentsIntersection(p1, q1, p2, q2, ellipsoid);
        
        // Sort for comparison as order might not be guaranteed for collinear results
        intersections.sort((a, b) => a.lon - b.lon);
        expectedIntersections.sort((a, b) => a.lon - b.lon);

        assert(intersections.length === 2, `Overlapping collinear segments: Expect 2 intersection points. Got ${intersections.length}`);
        if (intersections.length === 2) {
             assertLonLatArrayEquals(intersections, expectedIntersections, "Overlapping collinear segments: Intersection points check", 1e-5);
        }
    });

    it('should find one intersection for segments meeting at an endpoint', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        const p1 = new LonLat(0, 0);
        const q1 = new LonLat(10, 0); 
        const p2 = new LonLat(10, 0); 
        const q2 = new LonLat(10, 10);
        
        const expectedIntersection = [new LonLat(10, 0)];
        const intersections = geodesicSegmentsIntersection(p1, q1, p2, q2, ellipsoid);
        
        assert(intersections.length === 1, `Segments meeting at endpoint: Expect 1 intersection. Got ${intersections.length}`);
        if (intersections.length === 1) {
            assertLonLatArrayEquals(intersections, expectedIntersection, "Segments meeting at endpoint: Intersection point check", 1e-5);
        }
    });

    // More complex cases
    it('should handle segments where one completely contains the other (collinear)', () => {
        if (!ellipsoid) { assert(false, "Ellipsoid not available for test"); return; }
        const p1 = new LonLat(0, 0);   // Outer segment
        const q1 = new LonLat(30, 0);
        const p2 = new LonLat(10, 0);  // Inner segment
        const q2 = new LonLat(20, 0);
        
        // The inner segment's endpoints are the "intersections" in terms of overlap points
        const expectedIntersections = [new LonLat(10,0), new LonLat(20,0)];
        const intersections = geodesicSegmentsIntersection(p1, q1, p2, q2, ellipsoid);

        intersections.sort((a, b) => a.lon - b.lon);
        expectedIntersections.sort((a, b) => a.lon - b.lon);

        assert(intersections.length === 2, `One segment contains another (collinear): Expect 2. Got ${intersections.length}`);
        if (intersections.length === 2) {
            assertLonLatArrayEquals(intersections, expectedIntersections, "Contained collinear segment: points check", 1e-5);
        }
    });
});

// Log summary for this test file
logTestSummary();