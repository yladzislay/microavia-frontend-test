import { LonLat, Ellipsoid } from "@openglobus/og";
import {
    normalizeAngle,
    getProjectionRangeOnAxis,
    getOrientation,
    onSegment,
    segmentsIntersect,
    getIntersectionPoint,
    isPointInPolygon,
    createParallelHatching // Добавляем createParallelHatching
} from './parallelHatchingAlgorithm';

// --- Test Utilities ---
// ... (assert, assertEquals, describe, it) ...
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

function assertInRange(actual: number, expectedMin: number, expectedMax: number, message: string, tolerance: number = 1e-2) {
    const condition = actual >= (expectedMin - tolerance) && actual <= (expectedMax + tolerance);
    assert(condition, `${message} (Expected range: [${expectedMin}, ${expectedMax}], Actual: ${actual})`);
}


function assertEquals(actual: any, expected: any, message: string, tolerance: number = 1e-9) {
    if (typeof actual === 'number' && typeof expected === 'number') {
        if (Math.abs(actual - expected) < tolerance) {
            assert(true, `${message} (Expected: ${expected}, Actual: ${actual})`);
        } else {
            assert(false, `${message} (Expected: ${expected}, Actual: ${actual}, Diff: ${Math.abs(actual-expected)})`);
        }
    } else if (actual instanceof LonLat && expected instanceof LonLat) {
        // Сравниваем только lon и lat для простоты в тестах, если height не важен
        if (Math.abs(actual.lon - expected.lon) < tolerance &&
            Math.abs(actual.lat - expected.lat) < tolerance ) {
            assert(true, `${message} (Expected: LonLat(${expected.lon.toFixed(3)},${expected.lat.toFixed(3)}), Actual: LonLat(${actual.lon.toFixed(3)},${actual.lat.toFixed(3)}))`);
        } else {
            assert(false, `${message} (Expected: LonLat(${expected.lon.toFixed(3)},${expected.lat.toFixed(3)}), Actual: LonLat(${actual.lon.toFixed(3)},${actual.lat.toFixed(3)}))`);
        }
    }
    else if (Array.isArray(actual) && Array.isArray(expected) && actual.every(item => item instanceof LonLat) && expected.every(item => item instanceof LonLat)) {
        if (actual.length === expected.length) {
            let allMatch = true;
            for(let i=0; i<actual.length; i++) {
                if (!(Math.abs(actual[i].lon - expected[i].lon) < tolerance &&
                      Math.abs(actual[i].lat - expected[i].lat) < tolerance)) {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch) {
                 assert(true, `${message} (Expected: ${JSON.stringify(expected.map(p=>[p.lon,p.lat]))}, Actual: ${JSON.stringify(actual.map(p=>[p.lon,p.lat]))})`);
                 return;
            }
        }
         assert(false, `${message} (Expected: ${JSON.stringify(expected.map(p=>[p.lon,p.lat]))}, Actual: ${JSON.stringify(actual.map(p=>[p.lon,p.lat]))})`);

    }
     else if (JSON.stringify(actual) === JSON.stringify(expected)) {
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
        assert(false, `${testName} - EXCEPTION: ${e.message} \n${e.stack}`);
    }
}
// --- Mock Ellipsoid (без изменений) ---
const mockEllipsoidForProjectionTests: Ellipsoid = {
    // @ts-ignore
    direct: (lonLat: LonLat, bearing: number, distance: number) => {
        // Более реалистичный мок для direct, хотя все еще упрощенный (планарная аппроксимация)
        // 1 градус ~ 111000 метров (грубо)
        const metersPerDegree = 111000;
        const dLat = (distance / metersPerDegree) * Math.cos(bearing * Math.PI / 180);
        const dLon = (distance / metersPerDegree) * Math.sin(bearing * Math.PI / 180) / Math.cos(lonLat.lat * Math.PI / 180); // Учет широты для dLon
        return { lon: lonLat.lon + dLon, lat: lonLat.lat + dLat, bearing: bearing };
    },
    // @ts-ignore
    inverse: (p1: LonLat, p2: LonLat) => {
        // Для квадрата [[0,0], [1,0], [1,1], [0,1]] и axisOrigin = (0,0)
        // Используем немного более "реалистичные" расстояния для квадрата со стороной ~111км
        // Это нужно, чтобы step и offset имели смысл.
        const metersPerDegree = 111000;
        if (p1.lon === 0 && p1.lat === 0) {
            if (p2.lon === 0 && p2.lat === 0) return null; 
            if (p2.lon === 1 && p2.lat === 0) return { distance: 1 * metersPerDegree * Math.cos(0), initialAzimuth: 90, finalAzimuth: 90 }; 
            if (p2.lon === 1 && p2.lat === 1) {
                const dist = Math.sqrt(Math.pow(1*metersPerDegree*Math.cos(0.5*Math.PI/180),2) + Math.pow(1*metersPerDegree,2)); // простой пифагор
                return { distance: dist, initialAzimuth: 45, finalAzimuth: 45 }; 
            }
            if (p2.lon === 0 && p2.lat === 1) return { distance: 1 * metersPerDegree, initialAzimuth: 0, finalAzimuth: 0 };   
        }
        // Общий fallback, если не покрыт специальный случай
        const dx = (p2.lon - p1.lon) * metersPerDegree * Math.cos(p1.lat * Math.PI / 180); // в метрах
        const dy = (p2.lat - p1.lat) * metersPerDegree; // в метрах
        const dist = Math.sqrt(dx*dx + dy*dy);
        let angle = Math.atan2(dx, dy) * 180 / Math.PI; // азимут от севера по часовой
        if (angle < 0) angle += 360;
        return { distance: dist, initialAzimuth: angle, finalAzimuth: angle };
    }
};


// @ts-ignore
const GLOBUS = { planet: { ellipsoid: {} } }; // Mock for GLOBUS if not globally available
// --- Замена GLOBUS.planet.ellipsoid на мок для тестов ---
// Это нужно сделать до того, как createParallelHatching будет вызван.
// В реальной тестовой среде (Jest/Mocha) это делается через jest.mock или sinon.stub.
// Здесь мы делаем это более прямолинейно.
const originalGlobusEllipsoid = GLOBUS.planet.ellipsoid;
// @ts-ignore
GLOBUS.planet.ellipsoid = mockEllipsoidForProjectionTests;


// --- Test Suites ---

describe('normalizeAngle', () => { /* ... тесты ... */ 
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


// --- Run all tests (or a way to invoke them) ---
// This is a simple runner. More sophisticated test runners (like Jest, Mocha) would auto-discover and run tests.
function runAllTests() {
    console.log("Starting tests...");
    // Call describe for each suite
    // Example: describe('myFunction tests', () => { /* it(...) calls */ });
    // For now, tests are run directly as they are defined above.
    // Suites will be automatically invoked as the script loads and calls describe/it.

    console.log(`\nTests finished. Passed: ${testsPassed}/${testsRun}`);
    if (testsPassed !== testsRun) {
        console.error("SOME TESTS FAILED!");
        // In a real test runner, this might set an exit code
    }
}

// Run tests when the module is loaded (for Deno/Node.js execution if used directly)
// or tests will be run if this file is imported and run by a test runner.
// For this project, we'll assume it's run in an environment where top-level calls execute.
// To run these tests, you would typically use a command like `deno test your_test_file.ts` or `node your_test_file.ts`
// if you adapt it for Node.
// For now, this manual call helps simulate the test run.
runAllTests();