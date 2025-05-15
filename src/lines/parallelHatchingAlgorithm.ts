import * as turf from "@turf/turf";

export function createParallelHatching(
    polygonCoordinates: number[][],
    step: number,
    bearing: number,
    offset: number
): [number, number][][] {

    console.log("🚀 Input parameters:", { polygonCoordinates, step, bearing, offset });

    // 1: Polygon
    const polygonFeature = turf.polygon([polygonCoordinates]);
    const polygonCentroidPoint = turf.centroid(polygonFeature);
    const normalizedBearing = bearing % 360;
    const rotatedPolygon = turf.transformRotate(polygonFeature, -normalizedBearing, { pivot: polygonCentroidPoint });

    // 2: Polygon Bounding Box
    const polygonBoundingBox = turf.bbox(rotatedPolygon);
    const [minX, minY, maxX, maxY] = polygonBoundingBox;
    console.log("📦 Bounding Box:", polygonBoundingBox);

    // 3: Generating Parallel Vertical Lines inside the Polygon Bounding Box
    const xPadding = (offset > 0 ? offset * 1.1 : step * 0.5) + step * 0.5;
    const yPadding = (maxY - minY) * 0.05 + 0.01;
    const referenceLat = (minY + maxY) / 2;

    const limitX = turf.destination(turf.point([maxX, referenceLat]), xPadding, 90, { units: 'meters' }).geometry.coordinates[0];
    let currentX = turf.destination(turf.point([minX, referenceLat]), xPadding, 270, { units: 'meters' }).geometry.coordinates[0];
    const [lineStartY, lineEndY] = [minY - yPadding, maxY + yPadding];

    const verticalParallelLines: any[] = [];

    while (currentX < limitX) {
        verticalParallelLines.push(turf.lineString([[currentX, lineStartY], [currentX, lineEndY]]));
        currentX = turf.destination(turf.point([currentX, referenceLat]), step, 90, { units: 'meters' }).geometry.coordinates[0];
    }

    console.log("📏 Vertical Parallel Lines have been generated. | Count: ", verticalParallelLines.length);

    // 4: Clipping Vertical Parallel Lines
    const clippedVerticalParallelLines = verticalParallelLines.flatMap(line =>
        turf.lineSplit(line, rotatedPolygon).features.filter(segment =>
            turf.booleanPointInPolygon(
                turf.midpoint(
                    turf.point(segment.geometry.coordinates[0]),
                    turf.point(segment.geometry.coordinates.slice(-1)[0])),
                rotatedPolygon
            )
        )
    );

    console.log("✂️ Vertical Parallel Lines Clipping Finished. | Count: ", clippedVerticalParallelLines.length);

    // 5: Applying Offset to the Clipped Lines
    const offsettedVerticalParallelLines = offset === 0 ? clippedVerticalParallelLines : clippedVerticalParallelLines.map(line => {
        const [start, end] = line.geometry.coordinates;
        const lineAzimuth = turf.bearing(turf.point(start), turf.point(end));
        return turf.lineString([
            turf.destination(turf.point(start), offset, lineAzimuth - 180, { units: 'meters' }).geometry.coordinates,
            turf.destination(turf.point(end), offset, lineAzimuth, { units: 'meters' }).geometry.coordinates
        ]);
    });

    // 6: Rotating Back to the original bearing
    const parallelLines = offsettedVerticalParallelLines.map(line => turf.transformRotate(line, normalizedBearing, { pivot: polygonCentroidPoint }));

    // 7: Extracting coordinates
    const parallelLinesCoordinates: [number, number][][] = parallelLines.map(line => turf.getCoords(line).map(([lon, lat]: number[]) => [lon, lat]));


    console.log("🏁 Done. | Resulting Lines Count:", parallelLinesCoordinates.length);

    return parallelLinesCoordinates;
}