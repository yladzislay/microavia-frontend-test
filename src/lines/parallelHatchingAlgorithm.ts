import {GLOBUS} from "../globus.ts";
import {LonLat} from "@openglobus/og";

export function createParallelHatching(coordinates: [number, number, number?][][], step = 100, bearing = 0, offset = 50): LonLat[][] {
    // TODO: implement parallel hatching algorithm
    console.log(GLOBUS.planet, coordinates, step, bearing, offset);
    return []
}