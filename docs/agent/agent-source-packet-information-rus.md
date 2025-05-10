## Пакет исходной информации для AI-Агента (помимо `development-plan.md`)

Этот документ должен сопровождать `development-plan.md`.

---

**Тема: Исходная информация для реализации алгоритма параллельной штриховки**

Привет! Для выполнения задач из `development-plan.md` тебе понадобится следующая информация, которую мы наработали ранее.

### 1. Описание задачи и требований (Краткое резюме)

*   **Цель:** Разработать функцию `createParallelHatching`, генерирующую параллельные линии (штриховку) внутри заданного полигона.
*   **Входные параметры:**
    *   `polygonCoordinates: number[][]` (массив `[longitude, latitude]` точек полигона).
    *   `step: number` (расстояние между линиями в метрах).
    *   `bearing: number` (угол ориентации линий относительно Севера в градусах).
    *   `offset: number` (внешний отступ линий от краев полигона в метрах).
*   **Выходные данные:** `number[][][]` (массив линий, где каждая линия - это массив из двух точек `[longitude, latitude]`).
*   **Ключевая библиотека:** Turf.js (`@turf/turf`).
*   **Структура проекта:** Сервис в `src/services/parallel-hatch-generator/` с разбивкой "один метод – один файл".

### 2. Код для файла `types.ts`

**Расположение:** `src/services/parallel-hatch-generator/types.ts`

```typescript
// src/services/parallel-hatch-generator/types.ts
import { Feature, Point, Polygon, LineString } from '@turf/turf'; // Убедись, что @turf/turf установлен

export type LngLat = [number, number];
export type PolygonCoordinates = LngLat[];
export type LineStringCoordinates = LngLat[];
export type HatchingLines = LineStringCoordinates[];

export interface HatchingOptions {
    step: number;
    bearing: number;
    offset: number;
}

// Типы для внутреннего использования, если нужны для ясности
export type GeoJsonPolygon = Feature<Polygon>;
export type GeoJsonPoint = Feature<Point>;
export type GeoJsonLineString = Feature<LineString>;
```

### 3. Код для файла `preparePolygon.ts`

**Расположение:** `src/services/parallel-hatch-generator/preparePolygon.ts`

```typescript
// src/services/parallel-hatch-generator/preparePolygon.ts
import * as turf from '@turf/turf';
import { PolygonCoordinates, GeoJsonPolygon, GeoJsonPoint } from './types';

interface PreparedPolygonData {
    geojsonPolygon: GeoJsonPolygon;
    polygonCenter: GeoJsonPoint;
    actualBearing: number;
}

export function preparePolygon(
    polygonCoords: PolygonCoordinates,
    bearing: number
): PreparedPolygonData {
    const closedPolygonCoords = [...polygonCoords];
    const firstPoint = closedPolygonCoords[0];
    const lastPoint = closedPolygonCoords[closedPolygonCoords.length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        closedPolygonCoords.push([...firstPoint]);
    }

    const geojsonPolygon = turf.polygon([closedPolygonCoords]);
    const polygonCenter = turf.centroid(geojsonPolygon);
    const actualBearing = bearing % 180;

    return { geojsonPolygon, polygonCenter, actualBearing };
}
```

### 4. Код для файла `generateParentLines.ts` (Последняя предложенная версия)

**Расположение:** `src/services/parallel-hatch-generator/generateParentLines.ts`

```typescript
// src/services/parallel-hatch-generator/generateParentLines.ts
import * as turf from '@turf/turf';
import { GeoJsonPolygon, GeoJsonLineString } from './types';

export function generateParentLines(
    rotatedPolygon: GeoJsonPolygon,
    step: number,
    extraPaddingMeters: number = step * 2 // Может быть уточнено или передано извне
): GeoJsonLineString[] {
    const parentLines: GeoJsonLineString[] = [];
    // const [bboxMinLng, bboxMinLat, bboxMaxLng, bboxMaxLat] = turf.bbox(rotatedPolygon); // Не используется напрямую здесь

    let minPolyLngR = Infinity, maxPolyLngR = -Infinity;
    let minPolyLatR = Infinity, maxPolyLatR = -Infinity;

    turf.getCoords(rotatedPolygon)[0].forEach(coord => {
        minPolyLngR = Math.min(minPolyLngR, coord[0]);
        maxPolyLngR = Math.max(maxPolyLngR, coord[0]);
        minPolyLatR = Math.min(minPolyLatR, coord[1]);
        maxPolyLatR = Math.max(maxPolyLatR, coord[1]);
    });
    
    const lngRange = maxPolyLngR - minPolyLngR;
    // Небольшой запас по долготе, чтобы линии выходили за пределы полигона
    const lngPadding = (lngRange > 1e-6 ? lngRange * 0.1 : 0.01) + 0.01; // 10% от диапазона + небольшой абсолютный запас
    const lineStartLng = minPolyLngR - lngPadding;
    const lineEndLng = maxPolyLngR + lngPadding;

    const firstLineBasePoint = turf.point([minPolyLngR, minPolyLatR]);
    const firstLineY = turf.destination(
        firstLineBasePoint,
        extraPaddingMeters, 
        -90, 
        { units: 'meters' }
    ).geometry.coordinates[1];

    const lastLineBasePoint = turf.point([minPolyLngR, maxPolyLatR]);
    const lastLineYTarget = turf.destination(
        lastLineBasePoint,
        extraPaddingMeters, 
        90, 
        { units: 'meters' }
    ).geometry.coordinates[1];
    
    let currentLineY = firstLineY;
    let safetyCount = 0;
    const MAX_LINES = 5000;

    while (currentLineY < lastLineYTarget && safetyCount < MAX_LINES) {
        if (step <= 0) { // Предохранитель для нулевого или отрицательного шага
            console.warn("Step is zero or negative, breaking parent line generation.");
            break;
        }
        const line = turf.lineString([
            [lineStartLng, currentLineY],
            [lineEndLng, currentLineY]
        ]);
        parentLines.push(line);

        const nextLineOrigin = turf.point([lineStartLng, currentLineY]);
        const nextLineDestination = turf.destination(nextLineOrigin, step, 90, { units: 'meters' });
        
        const newY = nextLineDestination.geometry.coordinates[1];
        if (Math.abs(newY - currentLineY) < 1e-9) { // Уменьшил порог для большей чувствительности к изменениям
             console.warn(`Minimal Y increment detected (Y=${currentLineY}, newY=${newY}, step=${step}m). Potential precision issue. Breaking.`);
             break;
        }
        if (newY <= currentLineY) { // Строгая проверка на увеличение Y
            console.warn(`Current Y did not increase or decreased. Y=${currentLineY}, newY=${newY}. Breaking.`);
            break;
        }
        currentLineY = newY;
        safetyCount++;
    }
    if (safetyCount >= MAX_LINES) console.warn(`Max lines limit (${MAX_LINES}) reached in parent line generation.`);
    return parentLines;
}
```

### 5. Код для файла `clipLinesByPolygon.ts` (С обработкой `GeometryCollection`)

**Расположение:** `src/services/parallel-hatch-generator/clipLinesByPolygon.ts`

```typescript
// src/services/parallel-hatch-generator/clipLinesByPolygon.ts
import * as turf from '@turf/turf';
import { GeoJsonPolygon, GeoJsonLineString } from './types';

export function clipLinesByPolygon(
    parentLines: GeoJsonLineString[],
    rotatedPolygon: GeoJsonPolygon
): GeoJsonLineString[] {
    const clippedLines: GeoJsonLineString[] = [];
    parentLines.forEach(parentLine => {
        try {
            const intersection = turf.intersect(parentLine, rotatedPolygon); // Убрал @ts-ignore, предполагаем, что типы turf достаточно хороши
            if (intersection) {
                const processGeometry = (geom: turf.Geometry) => {
                    if (geom.type === 'LineString' && geom.coordinates.length >= 2) {
                        clippedLines.push(turf.lineString(geom.coordinates));
                    } else if (geom.type === 'MultiLineString') {
                        geom.coordinates.forEach(lineCoords => {
                            if (lineCoords.length >= 2) {
                                clippedLines.push(turf.lineString(lineCoords));
                            }
                        });
                    }
                };

                if (intersection.geometry.type === 'GeometryCollection') {
                    // @ts-ignore turf-intersect может возвращать GeometryCollection, где geometries - массив GeometryObject
                    intersection.geometry.geometries.forEach(processGeometry);
                } else {
                    processGeometry(intersection.geometry);
                }
            }
        } catch (e) {
            console.warn("Error during turf.intersect, skipping one line:", parentLine.geometry.coordinates, e);
        }
    });
    return clippedLines;
}
```

### 6. Код для файла `applyOffsetToLines.ts`

**Расположение:** `src/services/parallel-hatch-generator/applyOffsetToLines.ts`

```typescript
// src/services/parallel-hatch-generator/applyOffsetToLines.ts
import * as turf from '@turf/turf';
import { GeoJsonLineString } from './types';

export function applyOffsetToLines(
    clippedLines: GeoJsonLineString[],
    offset: number
): GeoJsonLineString[] {
    if (offset === 0) {
        return clippedLines;
    }
    
    const offsetLines: GeoJsonLineString[] = [];
    clippedLines.forEach(line => {
        const lineCoords = line.geometry.coordinates;
        if (lineCoords.length < 2) return;

        const startPoint = turf.point(lineCoords[0]);
        const endPoint = turf.point(lineCoords[lineCoords.length - 1]);

        // Для очень коротких линий turf.bearing может дать непредсказуемый результат, если точки почти совпадают.
        // turf.distance(startPoint, endPoint) < 1e-6 (метры) -> можно не применять offset или вернуть исходную.
        // Однако, это может быть лишним усложнением для этого этапа.

        const lineBearing = turf.bearing(startPoint, endPoint);

        const newStartPoint = turf.destination(startPoint, offset, lineBearing - 180, { units: 'meters' });
        const newEndPoint = turf.destination(endPoint, offset, lineBearing, { units: 'meters' });
        
        offsetLines.push(turf.lineString([newStartPoint.geometry.coordinates, newEndPoint.geometry.coordinates]));
    });
    return offsetLines;
}
```

### 7. Код для файла `rotateLines.ts`

**Расположение:** `src/services/parallel-hatch-generator/rotateLines.ts`

```typescript
// src/services/parallel-hatch-generator/rotateLines.ts
import * as turf from '@turf/turf';
import { GeoJsonLineString, GeoJsonPoint } from './types';

export function rotateLines(
    linesToRotate: GeoJsonLineString[],
    bearingToRestore: number,
    pivotPoint: GeoJsonPoint
): GeoJsonLineString[] {
    return linesToRotate.map(line =>
        turf.transformRotate(line, bearingToRestore, { pivot: pivotPoint }) as GeoJsonLineString
    );
}
```

### 8. Код для файла `formatResult.ts`

**Расположение:** `src/services/parallel-hatch-generator/formatResult.ts`

```typescript
// src/services/parallel-hatch-generator/formatResult.ts
import { GeoJsonLineString, HatchingLines, LineStringCoordinates } from './types';

export function formatResult(finalLinesGeoJSON: GeoJsonLineString[]): HatchingLines {
    return finalLinesGeoJSON.map(line => line.geometry.coordinates as LineStringCoordinates);
}
```

### 9. Код для файла `index.ts` (сервис `createParallelHatchingService`)

**Расположение:** `src/services/parallel-hatch-generator/index.ts`

```typescript
// src/services/parallel-hatch-generator/index.ts
import * as turf from '@turf/turf';
import { PolygonCoordinates, HatchingOptions, HatchingLines, GeoJsonLineString } from './types'; // Добавил GeoJsonLineString
import { preparePolygon } from './preparePolygon';
import { generateParentLines } from './generateParentLines';
import { clipLinesByPolygon } from './clipLinesByPolygon';
import { applyOffsetToLines } from './applyOffsetToLines';
import { rotateLines } from './rotateLines';
import { formatResult } from './formatResult';

export function createParallelHatchingService(
    polygonCoordinates: PolygonCoordinates,
    options: HatchingOptions
): HatchingLines {
    const { step, bearing, offset } = options;

    if (step <= 0) {
        console.warn("Step must be positive. Returning empty array.");
        return [];
    }

    const prepData = preparePolygon(polygonCoordinates, bearing);
    // Важно: transformRotate мутирует исходный объект, если опция mutate: true (по умолчанию false для turf > 5.0).
    // Чтобы быть уверенным, можно клонировать, но turf.polygon уже создает новый объект.
    const rotatedPolygon = turf.transformRotate(prepData.geojsonPolygon, -prepData.actualBearing, { pivot: prepData.polygonCenter });

    // Передаем extraPaddingMeters в generateParentLines. Можно сделать его зависимым от offset.
    // Например, extraPaddingMeters = (offset > 0 ? offset : 0) + step * 2;
    // Или просто оставить step * 2, если offset применяется только к финальным отрезкам.
    // Для генерации родительских линий, которые потом будут обрезаться,
    // нам нужно, чтобы они выходили за пределы полигона настолько,
    // чтобы после обрезки и применения offset внешние концы были корректны.
    // Значит, padding должен быть не меньше offset.
    const paddingForParentLines = (offset > 0 ? offset * 1.5 : step) + step; // Запас должен быть больше offset

    const parentLines: GeoJsonLineString[] = generateParentLines(rotatedPolygon, step, paddingForParentLines);
    if (parentLines.length === 0) return []; // Если не сгенерировано родительских линий

    const clippedLines: GeoJsonLineString[] = clipLinesByPolygon(parentLines, rotatedPolygon);
    if (clippedLines.length === 0) return []; // Если ничего не пересеклось

    const offsetLines: GeoJsonLineString[] = applyOffsetToLines(clippedLines, offset);
    
    const finalLines: GeoJsonLineString[] = rotateLines(offsetLines, prepData.actualBearing, prepData.polygonCenter);

    return formatResult(finalLines);
}
```

### 10. Код для файла `src/lines/parallelHatchingAlgorithm.ts` (точка входа)

```typescript
// src/lines/parallelHatchingAlgorithm.ts
import { createParallelHatchingService } from '../services/parallel-hatch-generator'; 
import { PolygonCoordinates, HatchingOptions } from '../services/parallel-hatch-generator/types';

/**
 * @param polygon Массив точек полигона. Каждая точка - массив [longitude, latitude].
 * @param step Расстояние между линиями в метрах.
 * @param bearing Угол штриховки в градусах (0 = север).
 * @param offset Внешний отступ от края полигона в метрах.
 * @returns Массив линий. Каждая линия - массив из двух точек.
 */
export function createParallelHatching(
    polygon: number[][],
    step: number,
    bearing: number,
    offset: number
): number[][][] {

    const options: HatchingOptions = {
        step,
        bearing,
        offset
    };
    // Убедимся, что входной polygon соответствует типу PolygonCoordinates.
    // number[][] совместим с LngLat[], если LngLat это [number, number].
    return createParallelHatchingService(polygon as PolygonCoordinates, options);
}
```

**Небольшие уточнения в коде выше:**

*   **`generateParentLines.ts`:** Добавлена проверка на `step <= 0`. Чуть изменена логика `lngPadding` для большей надежности. Уточнена проверка на "застревание" `currentLineY`.
*   **`clipLinesByPolygon.ts`:** Немного улучшена обработка `GeometryCollection` и добавлено логирование координат при ошибке `turf.intersect`.
*   **`index.ts` (сервис):** Добавлена проверка `step <= 0`. Уточнена логика `paddingForParentLines` для `generateParentLines`, чтобы она учитывала `offset`. Добавлены проверки на пустые массивы на промежуточных этапах для раннего выхода.
*   **Общее:** Убраны некоторые `@ts-ignore` там, где типы Turf.js должны быть достаточно хороши в последних версиях, но агент должен быть готов их вернуть, если его среда TypeScript будет ругаться.