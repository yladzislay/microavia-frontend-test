import { Ellipsoid } from "@openglobus/og";
import { GLOBUS } from "../../../globus"; // Adjusted path relative to utils

/**
 * Provides access to the planet's ellipsoid.
 * Note: This creates a dependency on GLOBUS initialization.
 * For more isolated testing, consider passing ellipsoid as a parameter where this is used.
 * @returns {Ellipsoid} The planet's ellipsoid instance.
 * @throws {Error} If GLOBUS or its planet ellipsoid is not initialized.
 */
export function getEllipsoid(): Ellipsoid {
    if (!GLOBUS || !GLOBUS.planet || !GLOBUS.planet.ellipsoid) {
        throw new Error("GLOBUS planet ellipsoid is not initialized. Ensure GLOBUS is imported and initialized before use.");
    }
    return GLOBUS.planet.ellipsoid;
}