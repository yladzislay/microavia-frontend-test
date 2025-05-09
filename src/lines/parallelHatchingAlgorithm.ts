import { GLOBUS } from "../globus.ts";
import { LonLat } from "@openglobus/og";

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