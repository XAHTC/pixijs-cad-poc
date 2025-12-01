import type { Shape, Coordinate } from '../types/shapes';

export interface StressTestConfig {
    targetShapeCount: number;
    areaWidth: number;
    areaHeight: number;
    baseX?: number;
    baseY?: number;
}

/**
 * Generate irrigation-style shapes for stress testing
 * Creates SubAreas (large fields), Blocks (sections), and Laterals (irrigation lines)
 * Similar to the real project.json structure
 */
export function generateStressTestShapes(config: StressTestConfig): Shape[] {
    const {
        targetShapeCount,
        areaWidth,
        areaHeight,
        baseX = 611000,
        baseY = 4205000,
    } = config;

    const shapes: Shape[] = [];

    // Block colors (similar to real project)
    const blockColors = [
        { fill: '#FFEBEE', border: '#F44336' },
        { fill: '#E3F2FD', border: '#2196F3' },
        { fill: '#E8F5E9', border: '#4CAF50' },
        { fill: '#FFF3E0', border: '#FF9800' },
        { fill: '#F3E5F5', border: '#9C27B0' },
        { fill: '#E0F7FA', border: '#00BCD4' },
        { fill: '#FFF9C4', border: '#FFEB3B' },
        { fill: '#FCE4EC', border: '#E91E63' },
    ];

    // Calculate how many SubAreas we need
    const subAreaSize = 1500; // Each SubArea is ~1500m x 1500m
    const subAreasPerRow = Math.ceil(areaWidth / subAreaSize);
    const subAreasPerCol = Math.ceil(areaHeight / subAreaSize);
    const totalSubAreas = subAreasPerRow * subAreasPerCol;

    // Calculate blocks and laterals per SubArea to reach target count
    const blocksPerSubArea = Math.max(3, Math.floor(Math.sqrt(targetShapeCount / totalSubAreas / 50))); // ~50 laterals per block
    const lateralsPerBlock = Math.ceil(targetShapeCount / (totalSubAreas * blocksPerSubArea));

    console.log(`Generating ${totalSubAreas} SubAreas with ${blocksPerSubArea} Blocks each and ${lateralsPerBlock} Laterals per Block`);

    let shapeCount = 0;
    let subAreaIndex = 0;

    for (let row = 0; row < subAreasPerRow; row++) {
        for (let col = 0; col < subAreasPerCol; col++) {
            const subAreaX = baseX + row * subAreaSize;
            const subAreaY = baseY + col * subAreaSize;
            const subAreaWidth = subAreaSize + (Math.random() - 0.5) * 200;
            const subAreaHeight = subAreaSize + (Math.random() - 0.5) * 200;

            // Create SubArea polygon (large field)
            const subAreaCoords: Coordinate[] = [
                { x: subAreaX, y: -subAreaY },
                { x: subAreaX + subAreaWidth, y: -subAreaY },
                { x: subAreaX + subAreaWidth, y: -(subAreaY + subAreaHeight) },
                { x: subAreaX, y: -(subAreaY + subAreaHeight) },
                { x: subAreaX, y: -subAreaY },
            ];

            shapes.push({
                id: `subarea-${subAreaIndex}`,
                type: 'polygon',
                coordinates: subAreaCoords,
                style: {
                    fillColor: '#FFFFFF',
                    borderColor: '#00CC00',
                    borderWidth: 2,
                    opacity: 0.3,
                },
                label: `SubArea ${subAreaIndex + 1}`,
            });
            shapeCount++;

            // Create Blocks within SubArea
            const blockSize = Math.floor(subAreaWidth / Math.sqrt(blocksPerSubArea));
            const blocksPerRowInSubArea = Math.floor(subAreaWidth / blockSize);
            const blocksPerColInSubArea = Math.ceil(blocksPerSubArea / blocksPerRowInSubArea);

            for (let bRow = 0; bRow < blocksPerRowInSubArea && shapeCount < targetShapeCount; bRow++) {
                for (let bCol = 0; bCol < blocksPerColInSubArea && shapeCount < targetShapeCount; bCol++) {
                    const blockX = subAreaX + bRow * blockSize + Math.random() * 20;
                    const blockY = subAreaY + bCol * blockSize + Math.random() * 20;
                    const blockW = blockSize - 50 + Math.random() * 30;
                    const blockH = blockSize - 50 + Math.random() * 30;

                    const colorPair = blockColors[(subAreaIndex + bRow * blocksPerColInSubArea + bCol) % blockColors.length];

                    // Create Block polygon
                    const blockCoords: Coordinate[] = [
                        { x: blockX, y: -blockY },
                        { x: blockX + blockW, y: -blockY },
                        { x: blockX + blockW, y: -(blockY + blockH) },
                        { x: blockX, y: -(blockY + blockH) },
                        { x: blockX, y: -blockY },
                    ];

                    shapes.push({
                        id: `block-${subAreaIndex}-${bRow}-${bCol}`,
                        type: 'polygon',
                        coordinates: blockCoords,
                        style: {
                            fillColor: colorPair.fill,
                            borderColor: colorPair.border,
                            borderWidth: 1,
                            opacity: 0.2,
                        },
                        label: `Block ${bRow * blocksPerColInSubArea + bCol + 1}`,
                    });
                    shapeCount++;

                    // Create Laterals (irrigation lines) within Block
                    const lateralSpacing = blockH / (lateralsPerBlock + 1);
                    const lateralColor = colorPair.border;

                    for (let l = 0; l < lateralsPerBlock && shapeCount < targetShapeCount; l++) {
                        const lateralY = blockY + (l + 1) * lateralSpacing;
                        const startX = blockX + 10;
                        const endX = blockX + blockW - 10;

                        shapes.push({
                            id: `lateral-${subAreaIndex}-${bRow}-${bCol}-${l}`,
                            type: 'line',
                            points: [
                                { x: startX, y: -lateralY },
                                { x: endX, y: -lateralY },
                            ],
                            style: {
                                borderColor: lateralColor,
                                borderWidth: 0.5,
                            },
                        });
                        shapeCount++;

                        if (shapeCount >= targetShapeCount) break;
                    }
                }
            }

            subAreaIndex++;
            if (shapeCount >= targetShapeCount) break;
        }
        if (shapeCount >= targetShapeCount) break;
    }

    console.log(`Generated ${shapes.length} shapes (Target: ${targetShapeCount})`);
    return shapes;
}
