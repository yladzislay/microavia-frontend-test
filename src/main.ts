import './style.css';
import { GLOBUS } from './globus.ts';
import { Polygon } from './polygons/polygon.ts';
import { POLYGONS_LAYER } from './polygons/layer.ts';
import { LINE_LAYER } from './lines/layer.ts';
import { createParallelHatching } from './lines/parallelHatchingAlgorithm.ts';
import { Line } from './lines/line.ts';

// 📌 Инициализация слоёв
[GLOBUS.planet.addLayer(POLYGONS_LAYER), GLOBUS.planet.addLayer(LINE_LAYER)];

// 📌 Обработчик двойного клика
POLYGONS_LAYER.events.on('ldblclick', (e: any) => {
    if (!(e.pickingObject instanceof Polygon)) return;
    LINE_LAYER.clear();
    const coordinates = e.pickingObject.coordinates[0].map(([lon, lat]: any) => [lon, lat]);
    createParallelHatching(coordinates, 100, 0, 50).forEach(line => LINE_LAYER.add(new Line(line)));
});

// 📌 Центрирование камеры по последнему полигону
const lastPoly = POLYGONS_LAYER.getEntities().pop();
lastPoly?.getExtent() && GLOBUS.planet.camera.viewExtent(lastPoly.getExtent());
