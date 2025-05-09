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
// @ts-ignore: Пока не используется
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
    // Извлечение параметров (шаг, азимут, отступ уже имеют значения по умолчанию)
    // Входящий `coordinates` — это `polygon.coordinates` (массив колец).
    // Для работы с внешним контуром полигона (согласно требованиям "без отверстий")
    // внутри функции необходимо использовать `coordinates[0]`.
    if (!coordinates || coordinates.length === 0 || !coordinates[0] || coordinates[0].length === 0) {
        console.error("Polygon coordinates are empty or invalid.");
        return [];
    }
    const outerRingRawCoordinates = coordinates[0];

    // Преобразование `outerRingRawCoordinates` в массив экземпляров `LonLat[]`.
    // Высоту передаем, если она есть; для 2D расчетов она может не использоваться.
    const polygonLonLatArray: LonLat[] = outerRingRawCoordinates.map(p => new LonLat(p[0], p[1], p[2]));

    if (polygonLonLatArray.length < 3) {
        console.error("Polygon must have at least 3 vertices.");
        return [];
    }

    // TODO: implement parallel hatching algorithm
    console.log("createParallelHatching called with (defaults applied):", {
        step,
        bearing,
        offset
    });
    console.log("Outer ring LonLat coordinates:", polygonLonLatArray);
    console.log("Ellipsoid for calculations:", GLOBUS.planet.ellipsoid);

    // Временный возврат пустого массива, пока алгоритм не реализован
    return [];
}