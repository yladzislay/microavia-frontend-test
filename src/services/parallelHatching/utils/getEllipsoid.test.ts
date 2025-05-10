import { Ellipsoid } from "@openglobus/og";
import { getEllipsoid } from "./getEllipsoid";
import { describe, it, assert, logTestSummary, resetTestCounters } from './testUtils';
import { GLOBUS } from "../../../globus"; // To compare against the actual GLOBUS ellipsoid

// Reset counters for this specific test file execution
resetTestCounters();

describe('getEllipsoid', () => {
    it('should return the GLOBUS planet ellipsoid instance', () => {
        let ellipsoidInstance: Ellipsoid | null = null;
        let errorThrown: Error | null = null;
        try {
            // This relies on GLOBUS being initialized, which it should be as part of project setup
            // if this test is run in an environment where main.ts or globus.ts has been imported.
            ellipsoidInstance = getEllipsoid();
        } catch (e:any) {
            errorThrown = e;
        }

        assert(errorThrown === null, "getEllipsoid should not throw an error if GLOBUS is initialized.");
        if (errorThrown) {
            console.error("Error during getEllipsoid call:", errorThrown.message);
        }
        
        assert(ellipsoidInstance !== null && ellipsoidInstance !== undefined, "Returned ellipsoid should not be null or undefined.");
        if (ellipsoidInstance) {
            assert(ellipsoidInstance instanceof Ellipsoid, "Returned object should be an instance of Ellipsoid.");
            // Check if it's the same instance as the one in GLOBUS (if GLOBUS is accessible and initialized)
            if (GLOBUS && GLOBUS.planet && GLOBUS.planet.ellipsoid) {
                assert(ellipsoidInstance === GLOBUS.planet.ellipsoid, "Returned ellipsoid is the same as GLOBUS.planet.ellipsoid.");
            } else {
                console.warn("Could not directly compare with GLOBUS.planet.ellipsoid as it's not available in this test scope directly without deeper mocking or setup.");
            }
            // Check for essential properties
            assert(typeof (ellipsoidInstance as any).equatorialRadius === 'number' && (ellipsoidInstance as any).equatorialRadius > 0, "Ellipsoid has a positive equatorialRadius.");
        }
    });

    // Optional: Test behavior if GLOBUS is not initialized (harder to test in current setup without mocking GLOBUS)
    // it('should throw an error if GLOBUS is not initialized', () => {
    //     // This would require being able to "unload" or mock GLOBUS as uninitialized
    //     // For now, assume GLOBUS is initialized by the time tests run.
    // });
});

// Log summary for this test file
logTestSummary();