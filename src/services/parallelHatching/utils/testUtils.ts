import { LonLat, Vec3 } from "@openglobus/og";

export let testsRun = 0;
export let testsPassed = 0;

export function resetTestCounters() {
    testsRun = 0;
    testsPassed = 0;
}

export function assert(condition: boolean, message: string) {
    testsRun++;
    if (condition) {
        testsPassed++;
        // console.log(`[PASS] ${message}`); // Keep console logs for individual test files if they run it
    } else {
        console.error(`[FAIL] ${message}`);
    }
    // For a central runner, actual throwing or detailed collection would be better
    if (!condition) {
        // throw new Error(`Assertion failed: ${message}`);
    }
}

export function assertEquals(actual: any, expected: any, message: string, tolerance: number = 1e-9) {
    let condition = false;
    if (typeof actual === 'number' && typeof expected === 'number') {
        condition = Math.abs(actual - expected) < tolerance;
    } else if (actual instanceof Vec3 && expected instanceof Vec3) {
        condition = actual.equal(expected, tolerance);
    } else if (actual instanceof LonLat && expected instanceof LonLat) {
        condition = actual.equal(expected); // LonLat.equal uses its internal tolerance
    } else if (JSON.stringify(actual) === JSON.stringify(expected)) {
        condition = true;
    }
    
    if (condition) {
        assert(true, `${message} (Expected: ${expected?.toString()}, Actual: ${actual?.toString()})`);
    } else {
        assert(false, `${message} (Expected: ${expected?.toString()}, Actual: ${actual?.toString()})`);
    }
}

export function assertLonLatArrayEquals(actual: LonLat[], expected: LonLat[], message: string, tolerance: number = 1e-6) {
    if (actual.length !== expected.length) {
        assert(false, `${message} - Array length mismatch. Expected: ${expected.length}, Actual: ${actual.length}`);
        return;
    }
    for (let i = 0; i < actual.length; i++) {
        if (!actual[i].equal(expected[i], tolerance)) { // LonLat.equal can take a tolerance
            assert(false, `${message} - Element ${i} mismatch. Expected: ${expected[i].toString()}, Actual: ${actual[i].toString()}`);
            return;
        }
    }
    assert(true, `${message} - Arrays match.`);
}

export function describe(suiteName: string, fn: () => void): void {
    console.log(`\n--- Test Suite: ${suiteName} ---`);
    const oldTestsRun = testsRun;
    const oldTestsPassed = testsPassed;
    fn();
    const suiteTestsRun = testsRun - oldTestsRun;
    const suiteTestsPassed = testsPassed - oldTestsPassed;
    console.log(`--- Suite End: ${suiteName} | Passed: ${suiteTestsPassed}/${suiteTestsRun} ---`);

}

export function it(testName: string, fn: () => void): void {
    // console.log(`  Running test: ${testName}`); // Optional: log start of each test
    try {
        fn();
        // If assert doesn't throw, and we reached here, it means no assert(false) was hit in fn for this 'it'
        // However, asserts log pass/fail themselves. This 'it' doesn't track pass/fail directly.
        // console.log(`  [DONE] ${testName}`);
    } catch (e: any) {
        testsRun++; // Count as a run even if exception outside assert
        console.error(`  [EXCEPTION IN TEST] ${testName}: ${e.message} \n${e.stack}`);
        // No, assert(false) is not called here, as assert is designed to log.
        // If assert throws, this catch would handle it.
    }
}

// This function would be called by a master test runner file, not here.
export function logTestSummary(): void {
    console.log(`\n--- Global Test Execution Summary ---`);
    console.log(`Total tests executed globally: ${testsRun}`);
    console.log(`Total tests passed globally: ${testsPassed}`);
    if (testsPassed !== testsRun && testsRun > 0) {
        console.error(`${testsRun - testsPassed} TEST(S) FAILED!`);
    } else if (testsRun > 0) {
        console.log("All executed tests passed!");
    } else {
        console.log("No tests were executed.");
    }
}

// Example of how a single test file might run its tests:
// describe("My Function Tests", () => {
//   it("should do something", () => {
//     assertEquals(myFunction(2), 4, "Test 2*2=4");
//   });
// });
// logTestSummary(); // Call at the end of a test file if it's run standalone.