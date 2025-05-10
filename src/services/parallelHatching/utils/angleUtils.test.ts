import { normalizeAngle } from './angleUtils';
import { describe, it, assertEquals, logTestSummary, resetTestCounters } from './testUtils';

// Reset counters for this specific test file execution
resetTestCounters();

describe('normalizeAngle', () => {
    it('should return 0 for 0', () => {
        assertEquals(normalizeAngle(0), 0, "normalizeAngle(0)");
    });
    it('should return 90 for 90', () => {
        assertEquals(normalizeAngle(90), 90, "normalizeAngle(90)");
    });
    it('should return 0 for 360', () => {
        assertEquals(normalizeAngle(360), 0, "normalizeAngle(360)");
    });
    it('should return 10 for 370', () => {
        assertEquals(normalizeAngle(370), 10, "normalizeAngle(370)");
    });
    it('should return 350 for -10', () => {
        assertEquals(normalizeAngle(-10), 350, "normalizeAngle(-10)");
    });
    it('should return 0 for -360', () => {
        assertEquals(normalizeAngle(-360), 0, "normalizeAngle(-360)");
    });
    it('should return 270 for -90', () => {
        assertEquals(normalizeAngle(-90), 270, "normalizeAngle(-90)");
    });
    it('should handle large positive numbers', () => {
        assertEquals(normalizeAngle(720), 0, "normalizeAngle(720)");
        assertEquals(normalizeAngle(730), 10, "normalizeAngle(730)");
    });
    it('should handle large negative numbers', () => {
        assertEquals(normalizeAngle(-720), 0, "normalizeAngle(-720)");
        assertEquals(normalizeAngle(-730), 350, "normalizeAngle(-730)");
    });
});

// Log summary for this test file
logTestSummary();