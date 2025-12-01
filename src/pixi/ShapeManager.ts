import { Container, Graphics, Text } from 'pixi.js';
import type {Shape, Coordinate, PointShape, PolygonShape} from '../types/shapes';
import RBush from 'rbush';

interface RBushItem {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    id: string;
}

interface ResizeHandleGraphics extends Graphics {
    handleIndex?: number;
    shapeId?: string;
}

// LOD thresholds (Figma-style progressive simplification)
const LOD_MEDIUM_THRESHOLD = 3;   // Hide lines (laterals) when zoomed out 3x
const LOD_LOW_THRESHOLD = 8;      // Hide lines and points when zoomed out 8x
const BUFFER_PERCENT = 0.4;       // 40% buffer around viewport
const BASE_AREA = 2000 * 2000;    // Reference area for zoom calculation

export class ShapeManager {
    private readonly container: Container;
    private readonly shapesContainer: Container;
    private readonly labelsContainer: Container;
    private readonly resizeHandlesContainer: Container;
    private readonly shapes: Map<string, { graphics: Graphics; shape: Shape; inScene: boolean }> = new Map();
    private readonly labels: Map<string, Text> = new Map();
    private readonly selectedShapes: Set<string> = new Set();
    private readonly shapesInScene: Set<string> = new Set(); // Track what's currently in the scene
    private selectionChangedCallback?: (selectedIds: string[]) => void;
    private resizeHandles: ResizeHandleGraphics[] = [];
    private isDragging = false;
    private readonly dragOffset = { x: 0, y: 0 };
    private isResizing = false;
    private resizeHandleIndex = -1;
    private activeShapeId: string | null = null;
    private spatialIndex: RBush<RBushItem> | null = null;

    constructor(container: Container) {
        this.container = container;

        // Create separate containers for shapes, labels, and resize handles
        this.shapesContainer = new Container();
        this.labelsContainer = new Container();
        this.resizeHandlesContainer = new Container();

        // Add them in order (shapes first, labels on top, handles on top)
        this.container.addChild(this.shapesContainer);
        this.container.addChild(this.labelsContainer);
        this.container.addChild(this.resizeHandlesContainer);
    }

    private hexToNumber(hex: string): number {
        return parseInt(hex.replace('#', ''), 16);
    }

    private createPolygon(shape: PolygonShape, coords: Coordinate[]): Graphics {
        const graphics = new Graphics();

        if (coords.length > 0) {
            const points: number[] = [];
            coords.forEach(coord => {
                points.push(coord.x, coord.y);
            });

            graphics.poly(points);

            if (shape.style.fillColor) {
                graphics.fill({
                    color: this.hexToNumber(shape.style.fillColor),
                    alpha: shape.style.opacity || 1,
                });
            }

            if (shape.style.borderColor) {
                graphics.stroke({
                    width: shape.style.borderWidth || 1,
                    color: this.hexToNumber(shape.style.borderColor),
                    alignment: 0.5,
                    cap: 'round',
                    join: 'round',
                });
            }
        }

        return graphics;
    }

    private createLine(shape: Shape, points: Coordinate[]): Graphics {
        const graphics = new Graphics();

        if (points.length >= 2) {
            graphics.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                graphics.lineTo(points[i].x, points[i].y);
            }

            graphics.stroke({
                width: shape.style.borderWidth || 1,
                color: this.hexToNumber(shape.style.borderColor || '#000000'),
                alignment: 0.5,
                cap: 'round',
                join: 'round',
            });
        }

        return graphics;
    }

    private createPoint(shape: PointShape): Graphics {
        const graphics = new Graphics();

        graphics.circle(
            shape.coordinate.x,
            shape.coordinate.y,
            shape.radius || 5
        );

        if (shape.style.fillColor) {
            graphics.fill({
                color: this.hexToNumber(shape.style.fillColor),
                alpha: shape.style.opacity || 1,
            });
        }

        if (shape.style.borderColor) {
            graphics.stroke({
                width: shape.style.borderWidth || 1,
                color: this.hexToNumber(shape.style.borderColor),
                alignment: 0.5,
            });
        }

        return graphics;
    }

    // private createLabel(shape: PolygonShape, coords: Coordinate[]): Text {
    //     const centerX = coords.reduce((sum, c) => sum + c.x, 0) / coords.length;
    //     const centerY = coords.reduce((sum, c) => sum + c.y, 0) / coords.length;

    //     const textStyle = new TextStyle({
    //         fontFamily: 'Arial, sans-serif',
    //         fontSize: 14,
    //         fontWeight: 'normal',
    //         fill: '#000000',
    //         align: 'center',
    //     });

    //     const text = new Text({
    //         text: shape.label || '',
    //         style: textStyle,
    //     });

    //     text.position.set(centerX, centerY);
    //     text.anchor.set(0.5);

    //     // High resolution for crisp text
    //     text.resolution = 4;

    //     return text;
    // }

    addShape(shape: Shape): Graphics {
        let graphics: Graphics;

        if (shape.type === 'polygon') {
            graphics = this.createPolygon(shape, shape.coordinates);

            // // Add label to labels container (on top)
            // if (shape.label) {
            //     const text = this.createLabel(shape, shape.coordinates);
            //     this.labelsContainer.addChild(text);
            //     this.labels.set(shape.id, text);
            // }
        } else if (shape.type === 'line') {
            graphics = this.createLine(shape, shape.points);
        } else if (shape.type === 'point') {
            graphics = this.createPoint(shape);
        } else {
            graphics = new Graphics();
        }

        graphics.eventMode = 'static';
        graphics.cursor = 'pointer';
        graphics.label = shape.id;

        // Don't add to scene initially - let culling decide what to render
        // This prevents adding 100k shapes then immediately removing 95k on first cull
        this.shapes.set(shape.id, { graphics, shape, inScene: false });

        return graphics;
    }

    private calculateShapeBounds(shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        if (shape.type === 'polygon') {
            shape.coordinates.forEach(coord => {
                if (coord.x < minX) minX = coord.x;
                if (coord.x > maxX) maxX = coord.x;
                if (coord.y < minY) minY = coord.y;
                if (coord.y > maxY) maxY = coord.y;
            });
        } else if (shape.type === 'line') {
            shape.points.forEach(point => {
                if (point.x < minX) minX = point.x;
                if (point.x > maxX) maxX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.y > maxY) maxY = point.y;
            });
        } else if (shape.type === 'point') {
            const r = shape.radius || 5;
            minX = shape.coordinate.x - r;
            maxX = shape.coordinate.x + r;
            minY = shape.coordinate.y - r;
            maxY = shape.coordinate.y + r;
        }

        return { minX, minY, maxX, maxY };
    }

    buildSpatialIndex(): void {
        // Create RBush spatial index
        this.spatialIndex = new RBush<RBushItem>();

        // Insert all shapes with their bounding boxes
        const items: RBushItem[] = [];
        this.shapes.forEach(({ shape }) => {
            const bounds = this.calculateShapeBounds(shape);
            items.push({
                ...bounds,
                id: shape.id,
            });
        });

        this.spatialIndex.load(items); // Bulk load is faster than individual inserts

        console.log(`RBush spatial index built with ${items.length} items`);
    }

    removeShape(id: string): void {
        const shapeData = this.shapes.get(id);
        if (shapeData) {
            this.shapesContainer.removeChild(shapeData.graphics);
            shapeData.graphics.destroy();
            this.shapes.delete(id);
        }

        const label = this.labels.get(id);
        if (label) {
            this.labelsContainer.removeChild(label);
            label.destroy();
            this.labels.delete(id);
        }
    }

    clear(): void {
        this.shapes.forEach(({ graphics }) => graphics.destroy());
        this.labels.forEach((label) => label.destroy());
        this.shapes.clear();
        this.labels.clear();
        this.shapesInScene.clear();
        this.shapesContainer.removeChildren();
        this.labelsContainer.removeChildren();
    }

    getShape(id: string): { graphics: Graphics; shape: Shape } | undefined {
        const shapeData = this.shapes.get(id);
        if (!shapeData) return undefined;
        return { graphics: shapeData.graphics, shape: shapeData.shape };
    }

    getAllShapes(): Array<{ graphics: Graphics; shape: Shape }> {
        return Array.from(this.shapes.values()).map(({ graphics, shape }) => ({ graphics, shape }));
    }

    getShapeCount(): number {
        return this.shapes.size;
    }

    private updateShapeVisuals(id: string, selected: boolean): void {
        const shapeData = this.shapes.get(id);
        if (!shapeData) return;

        const { graphics, shape } = shapeData;
        graphics.clear();

        // Redraw the shape with selection highlight
        if (shape.type === 'polygon') {
            const coords = shape.coordinates;
            if (coords.length > 0) {
                const points: number[] = [];
                coords.forEach(coord => {
                    points.push(coord.x, coord.y);
                });

                graphics.poly(points);

                if (shape.style.fillColor) {
                    const baseAlpha = shape.style.opacity !== undefined ? shape.style.opacity : 1;
                    graphics.fill({
                        color: this.hexToNumber(shape.style.fillColor),
                        alpha: selected ? baseAlpha * 0.7 : baseAlpha,
                    });
                }

                graphics.stroke({
                    width: shape.style.borderWidth || 1,
                    color: selected ? 0x0066ff : this.hexToNumber(shape.style.borderColor || '#000000'),
                    alignment: 0.5,
                    cap: 'round',
                    join: 'round',
                });
            }
        } else if (shape.type === 'line') {
            const points = shape.points;
            if (points.length >= 2) {
                graphics.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    graphics.lineTo(points[i].x, points[i].y);
                }

                graphics.stroke({
                    width: shape.style.borderWidth || 1,
                    color: selected ? 0x0066ff : this.hexToNumber(shape.style.borderColor || '#000000'),
                    alignment: 0.5,
                    cap: 'round',
                    join: 'round',
                });
            }
        } else if (shape.type === 'point') {
            graphics.circle(
                shape.coordinate.x,
                shape.coordinate.y,
                shape.radius || 5
            );

            if (shape.style.fillColor) {
                const baseAlpha = shape.style.opacity !== undefined ? shape.style.opacity : 1;
                graphics.fill({
                    color: selected ? 0x0066ff : this.hexToNumber(shape.style.fillColor),
                    alpha: baseAlpha,
                });
            }

            graphics.stroke({
                width: shape.style.borderWidth || 1,
                color: selected ? 0x0066ff : this.hexToNumber(shape.style.borderColor || '#000000'),
                alignment: 0.5,
            });
        }
    }

    selectShape(id: string, multiSelect: boolean = false): void {
        if (!multiSelect) {
            // Clear previous selections
            this.selectedShapes.forEach(selectedId => {
                this.updateShapeVisuals(selectedId, false);
            });
            this.selectedShapes.clear();
            this.clearResizeHandles();
        }

        this.selectedShapes.add(id);
        this.updateShapeVisuals(id, true);

        // Show resize handles only for single selection
        if (this.selectedShapes.size === 1) {
            this.createResizeHandles(id);
            this.enableResize();
        } else {
            this.clearResizeHandles();
        }

        if (this.selectionChangedCallback) {
            this.selectionChangedCallback(Array.from(this.selectedShapes));
        }
    }

    deselectShape(id: string): void {
        if (this.selectedShapes.has(id)) {
            this.selectedShapes.delete(id);
            this.updateShapeVisuals(id, false);

            // Update resize handles
            if (this.selectedShapes.size === 1) {
                const remainingId = Array.from(this.selectedShapes)[0];
                this.createResizeHandles(remainingId);
                this.enableResize();
            } else {
                this.clearResizeHandles();
            }

            if (this.selectionChangedCallback) {
                this.selectionChangedCallback(Array.from(this.selectedShapes));
            }
        }
    }

    clearSelection(): void {
        this.selectedShapes.forEach(id => {
            this.updateShapeVisuals(id, false);
        });
        this.selectedShapes.clear();
        this.clearResizeHandles();

        if (this.selectionChangedCallback) {
            this.selectionChangedCallback([]);
        }
    }

    isSelected(id: string): boolean {
        return this.selectedShapes.has(id);
    }

    getSelectedShapes(): string[] {
        return Array.from(this.selectedShapes);
    }

    onSelectionChanged(callback: (selectedIds: string[]) => void): void {
        this.selectionChangedCallback = callback;
    }

    private clearResizeHandles(): void {
        this.resizeHandles.forEach(handle => handle.destroy());
        this.resizeHandles = [];
        this.resizeHandlesContainer.removeChildren();
    }

    private createResizeHandles(shapeId: string): void {
        this.clearResizeHandles();

        const shapeData = this.shapes.get(shapeId);
        if (!shapeData) return;

        const { shape } = shapeData;

        if (shape.type === 'polygon') {
            // Create handles for each vertex of the polygon
            shape.coordinates.forEach((coord, index) => {
                const handle = new Graphics() as ResizeHandleGraphics;
                handle.rect(-4, -4, 8, 8);
                handle.fill({ color: 0xffffff });
                handle.stroke({ width: 2, color: 0x0066ff });
                handle.position.set(coord.x, coord.y);
                handle.eventMode = 'static';
                handle.cursor = 'pointer';

                // Store the index in the handle
                handle.handleIndex = index;
                handle.shapeId = shapeId;

                this.resizeHandlesContainer.addChild(handle);
                this.resizeHandles.push(handle);
            });
        } else if (shape.type === 'point') {
            // Create handles for point resize
            const directions = [
                { x: -1, y: -1 }, { x: 1, y: -1 },
                { x: 1, y: 1 }, { x: -1, y: 1 }
            ];

            const radius = shape.radius || 5;
            directions.forEach((dir, index) => {
                const handle = new Graphics() as ResizeHandleGraphics;
                handle.rect(-4, -4, 8, 8);
                handle.fill({ color: 0xffffff });
                handle.stroke({ width: 2, color: 0x0066ff });
                handle.position.set(
                    shape.coordinate.x + dir.x * radius,
                    shape.coordinate.y + dir.y * radius
                );
                handle.eventMode = 'static';
                handle.cursor = 'nwse-resize';

                handle.handleIndex = index;
                handle.shapeId = shapeId;

                this.resizeHandlesContainer.addChild(handle);
                this.resizeHandles.push(handle);
            });
        }
    }

    private updateResizeHandles(shapeId: string): void {
        const shapeData = this.shapes.get(shapeId);
        if (!shapeData) return;

        const { shape } = shapeData;

        if (shape.type === 'polygon') {
            shape.coordinates.forEach((coord, index) => {
                if (this.resizeHandles[index]) {
                    this.resizeHandles[index].position.set(coord.x, coord.y);
                }
            });
        } else if (shape.type === 'point') {
            const radius = shape.radius || 5;
            const directions = [
                { x: -1, y: -1 }, { x: 1, y: -1 },
                { x: 1, y: 1 }, { x: -1, y: 1 }
            ];

            directions.forEach((dir, index) => {
                if (this.resizeHandles[index]) {
                    this.resizeHandles[index].position.set(
                        shape.coordinate.x + dir.x * radius,
                        shape.coordinate.y + dir.y * radius
                    );
                }
            });
        }
    }

    enableDragAndDrop(shapeId: string, graphics: Graphics): void {
        graphics.on('pointerdown', (event) => {
            if (this.isSelected(shapeId) && graphics.parent) {
                this.isDragging = true;
                this.activeShapeId = shapeId;

                const shapeData = this.shapes.get(shapeId);
                if (shapeData) {
                    const globalPos = event.global;
                    const localPos = graphics.parent.toLocal(globalPos);

                    if (shapeData.shape.type === 'polygon') {
                        const firstCoord = shapeData.shape.coordinates[0];
                        this.dragOffset.x = localPos.x - firstCoord.x;
                        this.dragOffset.y = localPos.y - firstCoord.y;
                    } else if (shapeData.shape.type === 'point') {
                        this.dragOffset.x = localPos.x - shapeData.shape.coordinate.x;
                        this.dragOffset.y = localPos.y - shapeData.shape.coordinate.y;
                    } else if (shapeData.shape.type === 'line') {
                        const firstPoint = shapeData.shape.points[0];
                        this.dragOffset.x = localPos.x - firstPoint.x;
                        this.dragOffset.y = localPos.y - firstPoint.y;
                    }
                }
            }
        });
    }

    enableResize(): void {
        this.resizeHandles.forEach((handle) => {
            handle.on('pointerdown', (event) => {
                event.stopPropagation();
                this.isResizing = true;
                this.resizeHandleIndex = handle.handleIndex ?? -1;
                this.activeShapeId = handle.shapeId ?? null;
            });
        });
    }

    handlePointerMove(event: {global: {x: number; y: number}}): void {
        if (this.isDragging && this.activeShapeId) {
            const shapeData = this.shapes.get(this.activeShapeId);
            if (!shapeData) return;

            const globalPos = event.global;
            const localPos = this.shapesContainer.toLocal(globalPos);

            if (shapeData.shape.type === 'polygon') {
                const dx = localPos.x - this.dragOffset.x - shapeData.shape.coordinates[0].x;
                const dy = localPos.y - this.dragOffset.y - shapeData.shape.coordinates[0].y;

                shapeData.shape.coordinates.forEach(coord => {
                    coord.x += dx;
                    coord.y += dy;
                });
            } else if (shapeData.shape.type === 'point') {
                shapeData.shape.coordinate.x = localPos.x - this.dragOffset.x;
                shapeData.shape.coordinate.y = localPos.y - this.dragOffset.y;
            } else if (shapeData.shape.type === 'line') {
                const dx = localPos.x - this.dragOffset.x - shapeData.shape.points[0].x;
                const dy = localPos.y - this.dragOffset.y - shapeData.shape.points[0].y;

                shapeData.shape.points.forEach(point => {
                    point.x += dx;
                    point.y += dy;
                });
            }

            this.updateShapeVisuals(this.activeShapeId, true);
            this.updateResizeHandles(this.activeShapeId);
        } else if (this.isResizing && this.activeShapeId) {
            const shapeData = this.shapes.get(this.activeShapeId);
            if (!shapeData) return;

            const globalPos = event.global;
            const localPos = this.shapesContainer.toLocal(globalPos);

            if (shapeData.shape.type === 'polygon') {
                // Move the specific vertex
                shapeData.shape.coordinates[this.resizeHandleIndex].x = localPos.x;
                shapeData.shape.coordinates[this.resizeHandleIndex].y = localPos.y;
            } else if (shapeData.shape.type === 'point') {
                // Resize the point by adjusting radius
                const dx = localPos.x - shapeData.shape.coordinate.x;
                const dy = localPos.y - shapeData.shape.coordinate.y;
                const newRadius = Math.sqrt(dx * dx + dy * dy);
                shapeData.shape.radius = Math.max(3, newRadius);
            }

            this.updateShapeVisuals(this.activeShapeId, true);
            this.updateResizeHandles(this.activeShapeId);
        }
    }

    handlePointerUp(): void {
        this.isDragging = false;
        this.isResizing = false;
        this.activeShapeId = null;
        this.resizeHandleIndex = -1;
    }

    createNewPolygon(x: number, y: number, size: number = 50): Shape {
        const id = `polygon-${Date.now()}`;
        const halfSize = size / 2;

        const newShape: Shape = {
            id,
            type: 'polygon',
            coordinates: [
                { x: x - halfSize, y: y - halfSize },
                { x: x + halfSize, y: y - halfSize },
                { x: x + halfSize, y: y + halfSize },
                { x: x - halfSize, y: y + halfSize },
            ],
            style: {
                fillColor: '#90EE90',
                borderColor: '#228B22',
                borderWidth: 2,
            },
        };

        const graphics = this.addShape(newShape);
        this.enableDragAndDrop(id, graphics);

        return newShape;
    }

    createNewLine(x: number, y: number, length: number = 100): Shape {
        const id = `line-${Date.now()}`;

        const newShape: Shape = {
            id,
            type: 'line',
            points: [
                { x, y },
                { x: x + length, y },
            ],
            style: {
                borderColor: '#0066ff',
                borderWidth: 2,
            },
        };

        const graphics = this.addShape(newShape);
        this.enableDragAndDrop(id, graphics);

        return newShape;
    }

    createNewPoint(x: number, y: number, radius: number = 8): Shape {
        const id = `point-${Date.now()}`;

        const newShape: Shape = {
            id,
            type: 'point',
            coordinate: { x, y },
            radius,
            style: {
                fillColor: '#FF6347',
                borderColor: '#8B0000',
                borderWidth: 2,
            },
        };

        const graphics = this.addShape(newShape);
        this.enableDragAndDrop(id, graphics);

        return newShape;
    }

    getShapeById(id: string): Shape | undefined {
        return this.shapes.get(id)?.shape;
    }

    cullShapes(viewportBounds: { x: number; y: number; width: number; height: number }): void {
        const startTime = performance.now();

        if (!this.spatialIndex) {
            console.warn('Spatial index not built, building now...');
            this.buildSpatialIndex();
        }

        // Calculate zoom level (smaller viewport = zoomed in)
        const viewportArea = viewportBounds.width * viewportBounds.height;
        const zoomOutFactor = Math.sqrt(viewportArea / BASE_AREA); // >1 when zoomed out

        // Dynamic buffer
        const bufferX = viewportBounds.width * BUFFER_PERCENT;
        const bufferY = viewportBounds.height * BUFFER_PERCENT;

        const bufferedBounds = {
            minX: viewportBounds.x - bufferX,
            minY: viewportBounds.y - bufferY,
            maxX: viewportBounds.x + viewportBounds.width + bufferX,
            maxY: viewportBounds.y + viewportBounds.height + bufferY,
        };

        let visibleCount = 0;
        let checkedCount = 0;
        let addedCount = 0;
        let removedCount = 0;
        let skippedByLOD = 0;

        // Use RBush to quickly find visible shapes (O(log n) instead of O(n))
        const visibleItems = this.spatialIndex!.search(bufferedBounds);
        const potentiallyVisibleIds = new Set(visibleItems.map(item => item.id));
        checkedCount = potentiallyVisibleIds.size;

        // Determine LOD level based on zoom
        // LOD 0: Full detail (zoomed in)
        // LOD 1: Skip lines, show simplified polygons (medium zoom)
        // LOD 2: Show only bounding boxes (zoomed out)
        let lodLevel = 0;
        if (zoomOutFactor > LOD_LOW_THRESHOLD) {
            lodLevel = 2; // Very zoomed out
        } else if (zoomOutFactor > LOD_MEDIUM_THRESHOLD) {
            lodLevel = 1; // Medium zoom
        }

        // Process visible shapes
        this.shapes.forEach((shapeData, id) => {
            const shouldBeVisible = potentiallyVisibleIds.has(id);

            if (shouldBeVisible) {
                visibleCount++;

                // LOD filtering: skip lines when zoomed out
                if (lodLevel >= 1 && shapeData.shape.type === 'line') {
                    if (shapeData.inScene) {
                        this.shapesContainer.removeChild(shapeData.graphics);
                        shapeData.inScene = false;
                        removedCount++;
                    }
                    skippedByLOD++;
                    return;
                }

                // Add to scene if not already there
                if (!shapeData.inScene) {
                    this.shapesContainer.addChild(shapeData.graphics);
                    shapeData.inScene = true;
                    this.shapesInScene.add(id);
                    addedCount++;
                }
            } else if (shapeData.inScene) {
                // Remove shapes that are no longer visible
                this.shapesContainer.removeChild(shapeData.graphics);
                shapeData.inScene = false;
                this.shapesInScene.delete(id);
                removedCount++;
            }
        });

        const cullTime = performance.now() - startTime;

        // Also cull labels for invisible shapes (keep using visibility for labels - fewer objects)
        this.labels.forEach((label, shapeId) => {
            const shapeData = this.shapes.get(shapeId);
            if (shapeData) {
                label.visible = shapeData.inScene;
            }
        });

        // Hide resize handles when the selected shape is culled
        if (this.activeShapeId) {
            const shapeData = this.shapes.get(this.activeShapeId);
            if (shapeData) {
                this.resizeHandles.forEach(handle => {
                    handle.visible = shapeData.inScene;
                });
            }
        } else if (this.selectedShapes.size === 1) {
            const selectedId = Array.from(this.selectedShapes)[0];
            const shapeData = this.shapes.get(selectedId);
            if (shapeData) {
                this.resizeHandles.forEach(handle => {
                    handle.visible = shapeData.inScene;
                });
            }
        }

        // Dispatch event for FPS counter
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('visibleShapesUpdate', {
                detail: {
                    count: visibleCount,
                    total: this.shapes.size,
                    cullTime: cullTime.toFixed(2),
                    checked: checkedCount,
                    added: addedCount,
                    removed: removedCount,
                    inScene: this.shapesContainer.children.length,
                    skippedByLOD,
                    lodLevel
                }
            }));
        }
    }
}