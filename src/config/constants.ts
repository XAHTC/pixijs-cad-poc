// Stress test configuration
export const STRESS_TEST_MODE = false;
export const STRESS_TEST_COUNT = 100000;

// LOD (Level of Detail) thresholds for progressive simplification
export const LOD_MEDIUM_THRESHOLD = 3;   // Hide lines (laterals) when zoomed out 3x
export const LOD_LOW_THRESHOLD = 8;      // Hide lines and points when zoomed out 8x

// Culling configuration
export const BUFFER_PERCENT = 0.4;       // 40% buffer around viewport for culling
export const BASE_AREA = 2000 * 2000;    // Reference area for zoom calculation

// Stress test area configuration
export const STRESS_TEST_AREA = {
    width: 50000,     // Large area to test culling (50km x 50km)
    height: 50000,
    baseX: 611000,    // UTM coordinates like real project
    baseY: 4205000,
};

// Viewport configuration
export const VIEWPORT_CONFIG = {
    padding: 50,
    wheel: {
        percent: 0.3,
        smooth: 5,
        interrupt: true,
        trackpadPinch: true,
        wheelZoom: true,
    },
    zoom: {
        minScale: 0.01,  // Can zoom out to see entire world
        maxScale: 10,    // Can zoom in 10x for details
    },
};

// Default shape styles
export const DEFAULT_SHAPE_STYLES = {
    polygon: {
        fillColor: '#90EE90',
        borderColor: '#228B22',
        borderWidth: 2,
    },
    line: {
        borderColor: '#0066ff',
        borderWidth: 2,
    },
    point: {
        fillColor: '#FF6347',
        borderColor: '#8B0000',
        borderWidth: 2,
        radius: 8,
    },
    selection: {
        color: 0x0066ff,
        fillAlpha: 0.7,
    },
};

// PixiJS configuration
export const PIXI_CONFIG = {
    backgroundColor: 0xf0f0f0,
    antialias: true,
    maxResolution: 2,  // Clamp to max 2 for performance
};
