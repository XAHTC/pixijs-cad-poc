import type {Coordinate, IrrigationProject, Shape} from '../types/shapes';

// function hexToNumber(hex: string): number {
//     return parseInt(hex.replace('#', ''), 16);
// }

function coordsArrayToCoordinate(coords: number[]): Coordinate {
    return {x: coords[0], y: -coords[1]}; // Negate Y for screen coordinates
}

export function parseIrrigationProject(json: IrrigationProject): Shape[] {
    const shapes: Shape[] = [];

    json.SubAreas.forEach((subArea) => {
        // Add SubArea polygon - use default styling for now
        shapes.push({
            id: `subarea-${subArea.Id}`,
            type: 'polygon',
            coordinates: subArea.Coordinates.map(coordsArrayToCoordinate),
            style: {
                fillColor: '#FFFFFF',
                borderColor: '#00CC00',
                borderWidth: 2,
                opacity: 0.3,
            },
            label: `SubArea ${subArea.Number}`,
        });

        // Add Blocks
        subArea.Blocks.forEach((block) => {
            // Extract styles from ExternalSnapshot if available
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const externalSnapshot = (block as any).ExternalSnapshot;
            let fillColor = '#FFFFFF';
            let borderColor = '#0038FF';
            let borderWidth = 1;
            let opacity = 0.2;

            if (externalSnapshot) {
                if (externalSnapshot.BlockDesignFillColor?.Value) {
                    fillColor = externalSnapshot.BlockDesignFillColor.Value;
                }
                if (externalSnapshot.BlockDesignBorderColor?.Value) {
                    borderColor = externalSnapshot.BlockDesignBorderColor.Value;
                }
                if (externalSnapshot.BlockDesignBorderWidth?.Value !== undefined) {
                    borderWidth = externalSnapshot.BlockDesignBorderWidth.Value;
                }
                if (externalSnapshot.BlockDesignOpacity?.Value !== undefined) {
                    opacity = externalSnapshot.BlockDesignOpacity.Value / 100; // Convert percentage to decimal
                }
            }

            shapes.push({
                id: `block-${block.Id}`,
                type: 'polygon',
                coordinates: block.Coordinates.map(coordsArrayToCoordinate),
                style: {
                    fillColor,
                    borderColor,
                    borderWidth,
                    opacity,
                },
                label: `Block ${block.Number}`,
            });

            // Add Laterals (as lines)
            // Extract lateral styles from Block's ExternalSnapshot
            let lateralColor = '#0038FF';
            let lateralWidth = 1;

            if (externalSnapshot?.LateralDesignLineStyle) {
                const lateralStyle = externalSnapshot.LateralDesignLineStyle;
                // Use PostHydraulicCalculation style if available, otherwise PreHydraulicCalculation
                if (lateralStyle.PreHydraulicCalculationBorderColor?.Value) {
                    lateralColor = lateralStyle.PreHydraulicCalculationBorderColor.Value;
                } else if (lateralStyle.PostHydraulicCalculationBorderColor?.Value) {
                    lateralColor = lateralStyle.PostHydraulicCalculationBorderColor.Value;
                }

                if (lateralStyle.PreHydraulicCalculationBorderWidth?.Value !== undefined) {
                    lateralWidth = lateralStyle.PreHydraulicCalculationBorderWidth.Value;
                } else if (lateralStyle.PostHydraulicCalculationBorderWidth?.Value !== undefined) {
                    lateralWidth = lateralStyle.PostHydraulicCalculationBorderWidth.Value;
                }
            }

            block.Laterals.Laterals.forEach((lateral) => {
                if (lateral.Layout && lateral.Layout.length >= 2) {
                    shapes.push({
                        id: `lateral-${block.Id}-${lateral.Index}`,
                        type: 'line',
                        points: lateral.Layout.map(coordsArrayToCoordinate),
                        style: {
                            borderColor: lateralColor,
                            borderWidth: lateralWidth,
                        },
                    });
                }
            });
        });
    });

    return shapes;
}

export function calculateBounds(shapes: Shape[]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
} {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    shapes.forEach((shape) => {
        let coords: Coordinate[] = [];

        if (shape.type === 'polygon') {
            coords = shape.coordinates;
        } else if (shape.type === 'line') {
            coords = shape.points;
        } else if (shape.type === 'point') {
            coords = [shape.coordinate];
        }

        coords.forEach((coord) => {
            minX = Math.min(minX, coord.x);
            maxX = Math.max(maxX, coord.x);
            minY = Math.min(minY, coord.y);
            maxY = Math.max(maxY, coord.y);
        });
    });

    return {minX, maxX, minY, maxY};
}