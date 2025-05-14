// src/main.ts
import './style.css'
import {GLOBUS} from "./globus.ts";
import {Polygon} from "./polygons/polygon.ts";
import {POLYGONS_LAYER} from "./polygons/layer.ts";
import {LINE_LAYER} from "./lines/layer.ts";
import {createParallelHatching} from "./lines/parallelHatchingAlgorithm.ts";
import {Line} from "./lines/line.ts";

GLOBUS.planet.addLayer(POLYGONS_LAYER)
GLOBUS.planet.addLayer(LINE_LAYER)

POLYGONS_LAYER.events.on('ldblclick', (e: any) => {
    try {
        if (e.pickingObject instanceof Polygon) {
            const polygon = e.pickingObject,
                coordinates = polygon.coordinates[0].map((p: any) => [p[0], p[1]]); 

            LINE_LAYER.clear()
            const result = createParallelHatching(coordinates, 100, 0, 50);
            result.map((line: any) => {
                LINE_LAYER.add(new Line(line.map((p: any) => [p[0], p[1]])))
            })
        }
    } catch (e) {
        console.error(e)
    }
})

const entities = POLYGONS_LAYER.getEntities()
if (entities && entities.length > 0) {
    const lastPoly = entities.pop(),
        extent = lastPoly?.getExtent()

    extent && GLOBUS.planet.camera.viewExtent(extent)
}
