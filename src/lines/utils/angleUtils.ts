/**
 * Нормализует азимут к диапазону [0, 360) градусов.
 * @param angle - Угол в градусах.
 * @returns Нормализованный угол в градусах.
 */
export function normalizeAngle(angle: number): number {
    let normalized = angle % 360;
    if (normalized < 0) {
        normalized += 360;
    }
    return normalized;
}