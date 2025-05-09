import { GLOBUS } from "../globus.ts";
import { LonLat, Ellipsoid } from "@openglobus/og";

// --- Вспомогательные функции ---

/**
 * Нормализует азимут к диапазону [0, 360) градусов.
 * @param angle - Угол в градусах.
 * @returns Нормализованный угол в градусах.
 */
function normalizeAngle(angle: number): number {
    let normalized = angle % 360;
    if (normalized < 0) {
        normalized += 360;
    }
    return normalized;
}

/**
 * Вычисляет азимут, перпендикулярный заданному.
 * @param baseBearing - Базовый азимут в градусах.
 * @param direction - Направление смещения ('left' или 'right' относительно базового азимута). По умолчанию 'right'.
 * @returns Перпендикулярный азимут в градусах [0, 360).
 */
function getPerpendicularBearing(baseBearing: number, direction: 'left' | 'right' = 'right'): number {
    const normalizedBase = normalizeAngle(baseBearing);
    let perpendicular: number;
    if (direction === 'right') {
        perpendicular = normalizedBase + 90;
    } else { // 'left'
        perpendicular = normalizedBase - 90;
    }
    return normalizeAngle(perpendicular);
}

/**
 * Интерфейс для охватывающего прямоугольника.
 */
interface BoundingBox {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
}

/**
 * Вычисляет охватывающий прямоугольник (Bounding Box) для полигона.
 * @param polygon - Массив точек LonLat, представляющих полигон.
 * @returns Объект BoundingBox.
 */
function getBoundingBox(polygon: LonLat[]): BoundingBox {
    if (polygon.length === 0) {
        // В реальном приложении здесь лучше выбросить ошибку или вернуть undefined/null
        // и обработать это соответствующим образом.
        // Для текущей задачи, если polygonLonLatArray пуст, функция createParallelHatching вернет пустой массив ранее.
        // Этот случай здесь для полноты функции getBoundingBox.
        console.error("Polygon is empty, cannot calculate bounding box reliably.");
        return { minLon: 0, minLat: 0, maxLon: 0, maxLat: 0 }; // или throw error
    }

    let minLon = polygon[0].lon;
    let minLat = polygon[0].lat;
    let maxLon = polygon[0].lon;
    let maxLat = polygon[0].lat;

    for (let i = 1; i < polygon.length; i++) {
        const point = polygon[i];
        if (point.lon < minLon) minLon = point.lon;
        if (point.lat < minLat) minLat = point.lat;
        if (point.lon > maxLon) maxLon = point.lon;
        if (point.lat > maxLat) maxLat = point.lat;
    }

    return { minLon, minLat, maxLon, maxLat };
}


// --- Основная функция ---
export function createParallelHatching(
    coordinates: [number, number, number?][][],
    step: number = 100,
    bearing: number = 0,
    offset: number = 50
): LonLat[][] {
    if (!coordinates || coordinates.length === 0 || !coordinates[0] || coordinates[0].length === 0) {
        console.error("Polygon coordinates are empty or invalid."); return [];
    }
    const outerRingRawCoordinates = coordinates[0];
    const polygonLonLatArray: LonLat[] = outerRingRawCoordinates.map(p => new LonLat(p[0], p[1], p[2]));

    if (polygonLonLatArray.length < 3) {
        console.error("Polygon must have at least 3 vertices.");
        return [];
    }

    const ellipsoid = GLOBUS.planet.ellipsoid;
    const corridorInfo = getProjectionRangeOnAxis(polygonLonLatArray, bearing, ellipsoid);

    const generatedInfiniteLines: LonLat[][] = [];
    const veryLargeDistance = 10000000; // 10 000 км

    // Отступ offset здесь используется для расширения коридора, чтобы линии начинались "за" полигоном
    const startProjectionDistance = corridorInfo.minProjection - offset;
    const endProjectionDistance = corridorInfo.maxProjection + offset;
    let currentProjectionDistance = startProjectionDistance;

    // Если step = 0, генерируем только одну линию, проходящую через центр исходного коридора (minProj + maxProj) / 2
    // плюс/минус отступы, если нужно.
    // Но в ТЗ сказано "шаг", что подразумевает множество линий. Если шаг 0, то текущая логика сгенерирует много линий в одном месте.
    // Более корректно, если step=0, генерировать одну линию или не генерировать вообще, если шаг невалиден.
    // Для текущей реализации, если step=0, то while будет выполняться бесконечно, если currentProjectionDistance <= endProjectionDistance.
    // Добавим проверку step > 0 в условие while или break.

    while (currentProjectionDistance <= endProjectionDistance) {
        // Add explicit type annotation for the result of ellipsoid.direct()
        const lineCenterResult: { lon: number; lat: number; bearing?: number } = ellipsoid.direct(corridorInfo.axisOrigin, corridorInfo.projectionAxisBearing, currentProjectionDistance);
        const lineCenterPoint = new LonLat(lineCenterResult.lon, lineCenterResult.lat);
        
        const point1Result: { lon: number; lat: number; bearing?: number } = ellipsoid.direct(lineCenterPoint, bearing, veryLargeDistance);
        const point1 = new LonLat(point1Result.lon, point1Result.lat);

        const point2Result = ellipsoid.direct(lineCenterPoint, normalizeAngle(bearing + 180), veryLargeDistance);
        const point2 = new LonLat(point2Result.lon, point2Result.lat);
        
        generatedInfiniteLines.push([point1, point2]);
        
        if (step <= 0) {
             console.warn("Step is non-positive. Generating lines based on initial projection distance only.");
             break;
        }
        currentProjectionDistance += step;
    }

    const finalLines: LonLat[][] = []; // Переименовано из clippedLines для ясности
    for (const infiniteLine of generatedInfiniteLines) {
        const lineStart = infiniteLine[0]; // "Дальняя" точка 1 "бесконечной" линии
        const lineEnd = infiniteLine[1];   // "Дальняя" точка 2 "бесконечной" линии
        const intersectionPoints: LonLat[] = [];

        for (let i = 0; i < polygonLonLatArray.length; i++) {
            const polyP1 = polygonLonLatArray[i];
            const polyP2 = polygonLonLatArray[(i + 1) % polygonLonLatArray.length];
            // @ts-ignore: Assuming segmentsIntersect, getIntersectionPoint, onSegment are defined elsewhere
            if (segmentsIntersect(lineStart, lineEnd, polyP1, polyP2)) {
                // @ts-ignore: Assuming getIntersectionPoint, onSegment are defined elsewhere
                const intersection = getIntersectionPoint(lineStart, lineEnd, polyP1, polyP2);
                // @ts-ignore: Assuming onSegment is defined elsewhere
                if (intersection && onSegment(polyP1, intersection, polyP2) && onSegment(lineStart, intersection, lineEnd)) {
                    intersectionPoints.push(intersection);
                }
            }
        }

        if (intersectionPoints.length >= 2) {
            intersectionPoints.sort((a, b) => {
                // Сортируем по проекции на линию, проходящую через lineStart с азимутом bearing
                // Это более надежно, чем просто по lon/lat, особенно для линий под углом
                // Для простоты используем квадрат расстояния от lineStart
                const distSqA = Math.pow(a.lon - lineStart.lon, 2) + Math.pow(a.lat - lineStart.lat, 2);
                const distSqB = Math.pow(b.lon - lineStart.lon, 2) + Math.pow(b.lat - lineStart.lat, 2);
                return distSqA - distSqB;
            });

            for (let i = 0; i < intersectionPoints.length - 1; i += 2) {
                const p1 = intersectionPoints[i];
                const p2 = intersectionPoints[i + 1];

                const midPoint = new LonLat((p1.lon + p2.lon) / 2, (p1.lat + p2.lat) / 2);
                // @ts-ignore: Assuming isPointInPolygon is defined elsewhere
                if (isPointInPolygon(midPoint, polygonLonLatArray)) {
                    // Важно: finalP1 и finalP2 должны быть в правильном порядке для LineString
                    // main.ts ожидает [start, end], [start, end] ...
                    // Убедимся, что порядок соответствует основному bearing
                    // Это немного сложно, т.к. actualBearingP1P2 может быть ~bearing или ~ (bearing+180)
                    // в зависимости от того, как были найдены пересечения.
                    // Вместо этого, просто используем исходные p1, p2 для определения направления смещения,
                    // так как они уже отсортированы вдоль "бесконечной" линии.

                    const extendedP1 = ellipsoid.direct(p1, normalizeAngle(bearing + 180), offset);
                    const extendedP2 = ellipsoid.direct(p2, bearing, offset);

                    finalLines.push([extendedP1, extendedP2]);
                }
            }
        }
    }

    console.log("Final lines count (after offset):", finalLines.length);
    if (finalLines.length > 0) {
        console.log("First final line (with offset):", finalLines[0]);
    }

    return finalLines;
}