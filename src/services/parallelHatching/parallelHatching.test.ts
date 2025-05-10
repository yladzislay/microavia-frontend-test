import { LonLat } from "@openglobus/og"; // Ellipsoid might not be needed directly in all tests

// {{change 1: Update import paths for all functions}}
import { normalizeAngle } from './utils/angleUtils';
import { getPerpendicularBearing } from './getPerpendicularBearing';
import { getBoundingBox } from './getBoundingBox';
import { getProjectionRangeOnAxis } from './getProjectionRangeOnAxis';
import { 
    getOrientation,
    onSegment,
    segmentsIntersect,
    getIntersectionPoint,
    isPointInPolygon 
} from './utils/planarGeometryUtils';
import { createParallelHatching } from './createParallelHatching';

// --- Test Utilities ( 그대로 유지 ) ---

let testsRun = 0;
let testsPassed = 0;

function assert(condition: boolean, message: string) {
    testsRun++;
    if (condition) {
        testsPassed++;
        console.log(`[PASS] ${message}`);
    } else {
        console.error(`[FAIL] ${message}`);
    }
}

function assertEquals(actual: any, expected: any, message: string) {
    if (typeof actual === 'number' && typeof expected === 'number' && Math.abs(actual - expected) < 1e-9) {
        assert(true, `${message} (Expected: ${expected}, Actual: ${actual})`);
    } else if (JSON.stringify(actual) === JSON.stringify(expected)) {
        assert(true, `${message} (Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)})`);
    } else {
        assert(false, `${message} (Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)})`);
    }
}

function describe(suiteName: string, fn: () => void) {
    console.log(`\n--- Test Suite: ${suiteName} ---`);
    fn();
}

function it(testName: string, fn: () => void) {
    try {
        fn();
    } catch (e: any) {
        assert(false, `${testName} - EXCEPTION: ${e.message}`);
    }
}

// --- Mock Ellipsoid ( 그대로 유지 ) ---
// This will need to be more sophisticated for functions like getProjectionRangeOnAxis
const mockEllipsoid = {
    // @ts-ignore
    direct: (lonLat: LonLat, bearing: number, distance: number) => {
        const newLon = lonLat.lon + (distance / 100000) * Math.sin(bearing * Math.PI / 180);
        const newLat = lonLat.lat + (distance / 100000) * Math.cos(bearing * Math.PI / 180);
        return { lon: newLon, lat: newLat, bearing: bearing }; 
    },
    // @ts-ignore
    inverse: (p1: LonLat, p2: LonLat) => {
        if (p1.lon === p2.lon && p1.lat === p2.lat) return null;
        const dx = p2.lon - p1.lon;
        const dy = p2.lat - p1.lat;
        const distance = Math.sqrt(dx*dx + dy*dy) * 100000; 
        let initialAzimuth = Math.atan2(dx, dy) * 180 / Math.PI;
        if (initialAzimuth < 0) initialAzimuth += 360;
        return { distance, initialAzimuth, finalAzimuth: initialAzimuth };
    }
};

// --- Test Suites (Currently only for normalizeAngle) ---

describe('normalizeAngle', () => {
    it('should return 0 for 0', () => {
        assertEquals(normalizeAngle(0), 0, "normalizeAngle(0)");
    });
    it('should return 90 for 90', () => {
        assertEquals(normalizeAngle(90), 90, "normalizeAngle(90)");
    });
    it('should return 0 for 360', () => {
        assertEquals(normalizeAngle(360), 0, "normalizeAngle(360)");
    });
    it('should return 10 for 370', () => {
        assertEquals(normalizeAngle(370), 10, "normalizeAngle(370)");
    });
    it('should return 350 for -10', () => {
        assertEquals(normalizeAngle(-10), 350, "normalizeAngle(-10)");
    });
    it('should return 0 for -360', () => {
        assertEquals(normalizeAngle(-360), 0, "normalizeAngle(-360)");
    });
    it('should return 270 for -90', () => {
        assertEquals(normalizeAngle(-90), 270, "normalizeAngle(-90)");
    });
    it('should handle large positive numbers', () => {
        assertEquals(normalizeAngle(720), 0, "normalizeAngle(720)");
        assertEquals(normalizeAngle(730), 10, "normalizeAngle(730)");
    });
    it('should handle large negative numbers', () => {
        assertEquals(normalizeAngle(-720), 0, "normalizeAngle(-720)");
        assertEquals(normalizeAngle(-730), 350, "normalizeAngle(-730)");
    });
});

// TODO: Add test suites for other functions:
// describe('getPerpendicularBearing', () => { /* ... */ });
// describe('getBoundingBox', () => { /* ... */ });
// describe('getProjectionRangeOnAxis', () => { /* ... using mockEllipsoid or a better mock */ });
// describe('planarGeometryUtils (getOrientation, onSegment, segmentsIntersect, getIntersectionPoint, isPointInPolygon)', () => { /* ... */ });
// describe('createParallelHatching', () => { /* ... complex tests needed here ... */ });


function runAllTests() {
    console.log("Starting tests...");
    // Test suites are automatically invoked.
    console.log(`\nTests finished. Passed: ${testsPassed}/${testsRun}`);
    if (testsPassed !== testsRun) {
        console.error("SOME TESTS FAILED!");
    }
}

runAllTests();