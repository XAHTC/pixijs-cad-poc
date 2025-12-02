import type {Coordinate, IrrigationProject, Shape} from '../types/shapes';

function coordsArrayToCoordinate(coords: number[]): Coordinate | null {
    if (!coords || coords.length < 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
        return null;
    }
    return {x: coords[0], y: -coords[1]}; // Negate Y for screen coordinates
}

export function parseIrrigationProject(json: IrrigationProject): Shape[] {
    const shapes: Shape[] = [];

    if (!json || !json.SubAreas) {
        console.error('Invalid irrigation project data');
        return shapes;
    }

    json.SubAreas.forEach((subArea) => {
        if (!subArea || !subArea.Coordinates || subArea.Coordinates.length < 3) {
            console.warn(`Skipping invalid subarea: ${subArea?.Id}`);
            return;
        }

        // Add SubArea polygon - use default styling for now
        const coordinates = subArea.Coordinates
            .map(coordsArrayToCoordinate)
            .filter((coord): coord is Coordinate => coord !== null);

        if (coordinates.length < 3) {
            console.warn(`Subarea ${subArea.Id} has insufficient valid coordinates`);
            return;
        }

        shapes.push({
            id: `subarea-${subArea.Id}`,
            type: 'polygon',
            coordinates,
            style: {
                fillColor: '#FFFFFF',
                borderColor: '#00CC00',
                borderWidth: 2,
                opacity: 0.3,
            },
            label: `SubArea ${subArea.Number}`,
        });

        // Add Blocks
        if (!subArea.Blocks) {
            return;
        }

        subArea.Blocks.forEach((block) => {
            if (!block || !block.Coordinates || block.Coordinates.length < 3) {
                console.warn(`Skipping invalid block: ${block?.Id}`);
                return;
            }

            // Extract styles from ExternalSnapshot if available
            const externalSnapshot = block.ExternalSnapshot;
            let fillColor = '#FFFFFF';
            let borderColor = '#0038FF';
            let borderWidth = 1;
            let opacity = 0.2;

            if (externalSnapshot) {
                if (externalSnapshot.BlockDesignFillColor?.Value) {
                    fillColor = String(externalSnapshot.BlockDesignFillColor.Value);
                }
                if (externalSnapshot.BlockDesignBorderColor?.Value) {
                    borderColor = String(externalSnapshot.BlockDesignBorderColor.Value);
                }
                if (externalSnapshot.BlockDesignBorderWidth?.Value !== undefined) {
                    borderWidth = Number(externalSnapshot.BlockDesignBorderWidth.Value);
                }
                if (externalSnapshot.BlockDesignOpacity?.Value !== undefined) {
                    opacity = Number(externalSnapshot.BlockDesignOpacity.Value) / 100; // Convert percentage to decimal
                }
            }

            const blockCoordinates = block.Coordinates
                .map(coordsArrayToCoordinate)
                .filter((coord): coord is Coordinate => coord !== null);

            if (blockCoordinates.length < 3) {
                console.warn(`Block ${block.Id} has insufficient valid coordinates`);
                return;
            }

            shapes.push({
                id: `block-${block.Id}`,
                type: 'polygon',
                coordinates: blockCoordinates,
                style: {
                    fillColor,
                    borderColor,
                    borderWidth,
                    opacity,
                },
                label: `Block ${block.Number}`,
            });

            // Add Laterals (as lines)
            if (!block.Laterals?.Laterals) {
                return;
            }

            // Extract lateral styles from Block's ExternalSnapshot
            let lateralColor = '#0038FF';
            let lateralWidth = 1;

            if (externalSnapshot?.LateralDesignLineStyle) {
                const lateralStyle = externalSnapshot.LateralDesignLineStyle;
                // Use PreHydraulicCalculation style if available, otherwise PostHydraulicCalculation
                if (lateralStyle.PreHydraulicCalculationBorderColor?.Value) {
                    lateralColor = String(lateralStyle.PreHydraulicCalculationBorderColor.Value);
                } else if (lateralStyle.PostHydraulicCalculationBorderColor?.Value) {
                    lateralColor = String(lateralStyle.PostHydraulicCalculationBorderColor.Value);
                }

                if (lateralStyle.PreHydraulicCalculationBorderWidth?.Value !== undefined) {
                    lateralWidth = Number(lateralStyle.PreHydraulicCalculationBorderWidth.Value);
                } else if (lateralStyle.PostHydraulicCalculationBorderWidth?.Value !== undefined) {
                    lateralWidth = Number(lateralStyle.PostHydraulicCalculationBorderWidth.Value);
                }
            }

            block.Laterals.Laterals.forEach((lateral) => {
                if (!lateral || !lateral.Layout || lateral.Layout.length < 2) {
                    return;
                }

                const lateralPoints = lateral.Layout
                    .map(coordsArrayToCoordinate)
                    .filter((coord): coord is Coordinate => coord !== null);

                if (lateralPoints.length < 2) {
                    return;
                }

                shapes.push({
                    id: `lateral-${block.Id}-${lateral.Index}`,
                    type: 'line',
                    points: lateralPoints,
                    style: {
                        borderColor: lateralColor,
                        borderWidth: lateralWidth,
                    },
                });
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
    if (!shapes || shapes.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    shapes.forEach((shape) => {
        if (!shape) return;

        let coords: Coordinate[] = [];

        if (shape.type === 'polygon') {
            coords = shape.coordinates;
        } else if (shape.type === 'line') {
            coords = shape.points;
        } else if (shape.type === 'point') {
            coords = [shape.coordinate];
        }

        coords.forEach((coord) => {
            if (!coord || !Number.isFinite(coord.x) || !Number.isFinite(coord.y)) {
                return;
            }
            minX = Math.min(minX, coord.x);
            maxX = Math.max(maxX, coord.x);
            minY = Math.min(minY, coord.y);
            maxY = Math.max(maxY, coord.y);
        });
    });

    // If no valid coordinates were found, return a default bounds
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) ||
        !Number.isFinite(minY) || !Number.isFinite(maxY)) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    return {minX, maxX, minY, maxY};
}