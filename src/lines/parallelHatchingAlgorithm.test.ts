import { LonLat, Ellipsoid } from "@openglobus/og";
import { normalizeAngle as utilNormalizeAngle } from "./utils/angleUtils.ts";
import * as algorithm from './parallelHatchingAlgorithm';

// --- Test Utilities ---
let testsRun = 0;
let testsPassed = 0;
const TEST_TOLERANCE = 1e-7; 

function assert(condition: boolean, message: string) { /* ... */ testsRun++; if(condition) testsPassed++; else console.error(`[FAIL] ${message}`); }
function _formatValue(value: any): string { /* ... */ if (value instanceof LonLat) return `LonLat(${value.lon.toFixed(3)},${value.lat.toFixed(3)})`; if (Array.isArray(value) && value.length > 0 && value[0] instanceof LonLat && !(value[0] instanceof Array)) return `[${value.map(v => _formatValue(v)).join(', ')}]`; if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length > 0 && value[0][0] instanceof LonLat ) return `[\n  ${value.map(line => `[${(line as LonLat[]).map(v => _formatValue(v)).join(', ')}]`).join(',\n  ')}\n]`; if (typeof value === 'number') return value.toString(); return JSON.stringify(value); }
function assertEquals(actual: any, expected: any, message: string, tolerance: number = TEST_TOLERANCE) { /* ... */ let condition = false; if (typeof actual === 'number' && typeof expected === 'number') { condition = Math.abs(actual - expected) < tolerance; } else if (actual instanceof LonLat && expected instanceof LonLat) { condition = Math.abs(actual.lon - expected.lon) < tolerance && Math.abs(actual.lat - expected.lat) < tolerance; } else if (Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length) { if (actual.length === 0) { condition = true; } else if (actual[0] instanceof LonLat && expected[0] instanceof LonLat) { condition = actual.every((val, index) => { const expVal = expected[index]; return val instanceof LonLat && expVal instanceof LonLat && Math.abs(val.lon - expVal.lon) < tolerance && Math.abs(val.lat - expVal.lat) < tolerance; }); } else if (Array.isArray(actual[0]) && Array.isArray(expected[0]) && (actual[0] as any[]).every(item => item instanceof LonLat) && (expected[0] as any[]).every(item => item instanceof LonLat)) { condition = actual.every((lineActual: LonLat[], lineIndex: number) => { const lineExpected = expected[lineIndex] as LonLat[]; if (!lineExpected || lineActual.length !== lineExpected.length) return false; return lineActual.every((ptActual, ptIndex) => { const ptExpected = lineExpected[ptIndex]; return Math.abs(ptActual.lon - ptExpected.lon) < tolerance && Math.abs(ptActual.lat - ptExpected.lat) < tolerance; }); }); } else { condition = JSON.stringify(actual) === JSON.stringify(expected); } } else if (actual === null && expected === null) { condition = true; } else { condition = JSON.stringify(actual) === JSON.stringify(expected); } if (condition) { assert(true, `${message}`); } else { assert(false, `${message} (Expected: ${_formatValue(expected)}, Actual: ${_formatValue(actual)})`); } }


const testSuites: { name: string, tests: { name: string, fn: () => void }[], beforeEachFn?: () => void }[] = [];
let currentSuiteContext: { name: string, tests: { name: string, fn: () => void }[], beforeEachFn?: () => void } | null = null;
function describe(suiteName: string, fn: () => void) { console.log(`\n--- Test Suite: ${suiteName} ---`); currentSuiteContext = { name: suiteName, tests: [] }; testSuites.push(currentSuiteContext); fn(); currentSuiteContext = null; }
function beforeEach(fn: () => void) { if (currentSuiteContext) currentSuiteContext.beforeEachFn = fn; }
function it(testName: string, fn: () => void) { if (currentSuiteContext) currentSuiteContext.tests.push({ name: testName, fn });}

// --- Mock Ellipsoid ---
interface MockInverseDef { p1: {lon:number;lat:number};p2: {lon:number;lat:number};result:any;}
interface MockDirectDef { p: {lon:number;lat:number};bearing:number;distance:number;result:any;}
let mockInverseDefinitions: MockInverseDef[] = [];
let mockDirectDefinitions: MockDirectDef[] = [];
function setMockInverseResults(definitions: MockInverseDef[]) { mockInverseDefinitions = definitions; }
// function setMockDirectResults(definitions: MockDirectDef[]) { mockDirectDefinitions = definitions; }

const MOCK_METERS_PER_DEGREE_APPROX = 111000;

// @ts-ignore 
const mockEllipsoid: Ellipsoid = {
    direct: (lonLat: LonLat, bearing: number, distance: number) => {
        const def = mockDirectDefinitions.find(d => Math.abs(d.p.lon - lonLat.lon) < TEST_TOLERANCE && Math.abs(d.p.lat - lonLat.lat) < TEST_TOLERANCE && Math.abs(d.bearing - bearing) < TEST_TOLERANCE && Math.abs(d.distance - distance) < TEST_TOLERANCE);
        if (def) return def.result;
        const dLat = (distance / MOCK_METERS_PER_DEGREE_APPROX) * Math.cos(bearing * Math.PI / 180);
        const dLon = (distance / MOCK_METERS_PER_DEGREE_APPROX) * Math.sin(bearing * Math.PI / 180) / Math.cos(lonLat.lat * Math.PI / 180);
        return { lon: lonLat.lon + dLon, lat: lonLat.lat + dLat, bearing: bearing };
    },
    inverse: (p1: LonLat, p2: LonLat) => {
        const def = mockInverseDefinitions.find( d => Math.abs(d.p1.lon - p1.lon) < TEST_TOLERANCE && Math.abs(d.p1.lat - p1.lat) < TEST_TOLERANCE && Math.abs(d.p2.lon - p2.lon) < TEST_TOLERANCE && Math.abs(d.p2.lat - p2.lat) < TEST_TOLERANCE );
        if (def) return def.result;
        if (Math.abs(p1.lon - p2.lon) < TEST_TOLERANCE && Math.abs(p1.lat - p2.lat) < TEST_TOLERANCE) return null;
        const dx = (p2.lon - p1.lon) * MOCK_METERS_PER_DEGREE_APPROX * Math.cos(p1.lat * Math.PI / 180);
        const dy = (p2.lat - p1.lat) * MOCK_METERS_PER_DEGREE_APPROX;
        const distance = Math.sqrt(dx*dx + dy*dy);
        let initialAzimuth = utilNormalizeAngle(Math.atan2(dx, dy) * 180 / Math.PI); 
        return { distance, initialAzimuth, finalAzimuth: initialAzimuth };
    }
};

// --- Test Suites Definitions ---
describe('normalizeAngle (from utils)', () => { 
    it('should return 0 for 0', () => { assertEquals(utilNormalizeAngle(0), 0, "0"); });
    it('should return 90 for 90', () => { assertEquals(utilNormalizeAngle(90), 90, "90"); });
});

describe('getProjectionRangeOnAxis (from algorithm)', () => {
    const squareDeg = 1.0; 
    const sideLenMeters = squareDeg * MOCK_METERS_PER_DEGREE_APPROX;
    const squarePolygon = [ new LonLat(0,0), new LonLat(squareDeg,0), new LonLat(squareDeg,squareDeg), new LonLat(0,squareDeg) ];
    beforeEach(() => { 
        mockInverseDefinitions = []; mockDirectDefinitions = []; 
        const p00={lon:0,lat:0}; const p10={lon:squareDeg,lat:0}; const p11={lon:squareDeg,lat:squareDeg}; const p01={lon:0,lat:squareDeg};
        setMockInverseResults([
            {p1:p00,p2:p10,result:{distance:sideLenMeters,initialAzimuth:90,finalAzimuth:90}},
            {p1:p00,p2:p11,result:{distance:Math.sqrt(2)*sideLenMeters,initialAzimuth:45,finalAzimuth:45}},
            {p1:p00,p2:p01,result:{distance:sideLenMeters,initialAzimuth:0,finalAzimuth:0}},
        ]);
    });
    it('mainBearing 0', () => {
        const result = algorithm.getProjectionRangeOnAxis(squarePolygon, 0, mockEllipsoid); 
        assertEquals(result.minProjection, 0, "minProjection B0", 0.1);
        assertEquals(result.maxProjection, sideLenMeters, "maxProjection B0", 0.1);
    });
    it('mainBearing 90', () => {
        const result = algorithm.getProjectionRangeOnAxis(squarePolygon, 90, mockEllipsoid); 
        assertEquals(result.minProjection, -sideLenMeters, "minProjection B90", 0.1);
        assertEquals(result.maxProjection, 0, "maxProjection B90", 0.1);
    });
});

describe('segmentsIntersect & getIntersectionPoint (from algorithm)', () => { 
    const p1=new LonLat(0,0); const q1=new LonLat(2,2); const p2=new LonLat(0,2); const q2=new LonLat(2,0);
    it('X shape', () => {
        assertEquals(algorithm.segmentsIntersect(p1,q1,p2,q2), true, "segmentsIntersect"); 
        assertEquals(algorithm.getIntersectionPoint(p1,q1,p2,q2), new LonLat(1,1), "getIntersectionPoint"); 
    });
});

describe('isPointInPolygon (from algorithm)', () => { 
    const square=[new LonLat(0,0),new LonLat(1,0),new LonLat(1,1),new LonLat(0,1)];
    it('point inside', () => { assertEquals(algorithm.isPointInPolygon(new LonLat(0.5,0.5),square), true, "inside"); }); 
    it('point outside', () => { assertEquals(algorithm.isPointInPolygon(new LonLat(1.5,0.5),square), false, "outside"); }); 
});

describe('createParallelHatching (Integration)', () => {
    const squareCoordsDegrees: [number, number, (number | undefined)?][] = [ [0,0,0], [1,0,0], [1,1,0], [0,1,0], [0,0,0] ];
    const coordinatesInput: [number, number, (number | undefined)?][][] = [squareCoordsDegrees];
    
    beforeEach(() => {
        mockInverseDefinitions = []; mockDirectDefinitions = [];
        const p00={lon:0,lat:0}; const p10={lon:1,lat:0}; const p11={lon:1,lat:1}; const p01={lon:0,lat:1};
        setMockInverseResults([ 
            {p1:p00,p2:p10,result:{distance:1*MOCK_METERS_PER_DEGREE_APPROX,initialAzimuth:90,finalAzimuth:90}},
            {p1:p00,p2:p11,result:{distance:Math.sqrt(2)*MOCK_METERS_PER_DEGREE_APPROX,initialAzimuth:45,finalAzimuth:45}},
            {p1:p00,p2:p01,result:{distance:1*MOCK_METERS_PER_DEGREE_APPROX,initialAzimuth:0,finalAzimuth:0}},
        ]);
    });

    it('should generate 3 lines for a simple square', () => {
        const step=0.5*MOCK_METERS_PER_DEGREE_APPROX; const offset=0.1*MOCK_METERS_PER_DEGREE_APPROX; const bearing=0;
        const resultLines = algorithm.createParallelHatching(coordinatesInput, step, bearing, offset); 
        assertEquals(resultLines.length, 3, "Expected 3 lines for the square");
    });
    it('should generate 1 line if step is very large', () => {
        const step=2*MOCK_METERS_PER_DEGREE_APPROX; const offset=0.1*MOCK_METERS_PER_DEGREE_APPROX; const bearing=0;
        const resultLines = algorithm.createParallelHatching(coordinatesInput, step, bearing, offset); 
        assertEquals(resultLines.length, 1, "Expected 1 line");
    });
});

// --- Run all tests ---
function runAllRegisteredTests() {
    console.log("Starting all registered tests...");
    setupMockBeforeAllTests(); 
    testsRun = 0; testsPassed = 0;
    for (const suite of testSuites) {
        console.log(`\n--- Running Suite: ${suite.name} ---`);
        let suiteTestsPassedCount = 0;
        for (const test of suite.tests) {
            const testOriginalTestsRun = testsRun; 
            const testOriginalTestsPassed = testsPassed;
            let testPassedThisTime = false;
            if (suite.beforeEachFn) { suite.beforeEachFn(); }
            try {
                test.fn(); 
                const assertsRunInTest = testsRun - testOriginalTestsRun;
                if (assertsRunInTest === 0) {
                     console.warn(`    [WARN] Test "${test.name}" in suite "${suite.name}" did not run any assertions.`);
                } else if (testsPassed - testOriginalTestsPassed === assertsRunInTest) { 
                     console.log(`    [OK] ${test.name}`);
                     testPassedThisTime = true;
                }
            } catch (e: any) {
                 console.error(`    [FAIL] ${test.name} - EXCEPTION: ${e.message} \n${e.stack}`);
                 if(testsRun === testOriginalTestsRun) testsRun++; 
            }
            if(testPassedThisTime) suiteTestsPassedCount++;
        }
        console.log(`--- Suite End: ${suite.name} (${suiteTestsPassedCount}/${suite.tests.length} passed) ---`);
    }
    console.log(`\nAll tests finished. Total Passed: ${testsPassed}/${testsRun}`);
    if (testsPassed !== testsRun) console.error(`SOME TESTS FAILED! (${testsRun - testsPassed} failures)`);
    else console.log("ALL TESTS PASSED!");
    restoreOriginalEllipsoidAfterAllTests(); 
}
runAllRegisteredTests();