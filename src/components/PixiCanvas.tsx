import {useEffect, useRef, useState} from 'react';
import {usePixiApp} from '../hooks/usePixiApp';
import {Viewport} from 'pixi-viewport';
import {ShapeManager} from '../pixi/ShapeManager';
import {calculateBounds, parseIrrigationProject} from '../utils/jsonParser';
import {generateStressTestShapes} from '../utils/stressTestGenerator';
import projectData from '../data/project.json';
import {Toolbar} from './Toolbar';
import {FPSCounter} from './FPSCounter';
import type {DrawMode} from './Toolbar';
import type {Shape} from '../types/shapes';

// Toggle stress test mode
const STRESS_TEST_MODE = true;
const STRESS_TEST_COUNT = 100000;

export const PixiCanvas = () => {
    const {appRef, containerRef, isReady} = usePixiApp();
    const shapeManagerRef = useRef<ShapeManager | null>(null);
    const viewportRef = useRef<Viewport | null>(null);
    const [drawMode, setDrawMode] = useState<DrawMode>('select');
    const drawModeRef = useRef<DrawMode>('select');
    const [selectedShape, setSelectedShape] = useState<Shape | null>(null);

    // Sync drawMode with ref
    useEffect(() => {
        drawModeRef.current = drawMode;
    }, [drawMode]);

    useEffect(() => {
        if (!isReady || !appRef.current) return;

        // Generate shapes based on mode
        const shapes = STRESS_TEST_MODE
            ? generateStressTestShapes({
                targetShapeCount: STRESS_TEST_COUNT,
                areaWidth: 50000,  // Large area to test culling (50km x 50km)
                areaHeight: 50000,
                baseX: 611000,     // UTM coordinates like real project
                baseY: 4205000,
            })
            : parseIrrigationProject(projectData);

        console.log(`Loaded ${shapes.length} shapes in ${STRESS_TEST_MODE ? 'STRESS TEST' : 'NORMAL'} mode`);

        const bounds = calculateBounds(shapes);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const padding = 50;

        const viewport = new Viewport({
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            worldWidth: width + padding * 2,
            worldHeight: height + padding * 2,
            events: appRef.current.renderer.events,
        });

        appRef.current.stage.addChild(viewport);
        viewportRef.current = viewport;

        viewport
            .drag()
            .pinch() // Two-finger pinch zoom
            .wheel({
                percent: 0.3,
                smooth: 5,
                interrupt: true,
                trackpadPinch: true, // Enable trackpad pinch
                wheelZoom: true,     // Enable scroll wheel zoom
            });

        const manager = new ShapeManager(viewport);
        shapeManagerRef.current = manager;

        // Culling function to hide off-screen shapes
        let cullingScheduled = false;

        const updateCulling = () => {
            // Use requestAnimationFrame to batch culling updates per frame
            if (cullingScheduled) return;

            cullingScheduled = true;
            requestAnimationFrame(() => {
                const bounds = {
                    x: viewport.left,
                    y: viewport.top,
                    width: viewport.worldScreenWidth,
                    height: viewport.worldScreenHeight,
                };
                manager.cullShapes(bounds);
                cullingScheduled = false;
            });
        };

        // Update culling on viewport changes
        viewport.on('moved', updateCulling);
        viewport.on('zoomed', updateCulling);

        // Add selection change callback
        manager.onSelectionChanged((selectedIds) => {
            console.log('Selected shapes:', selectedIds);
            if (selectedIds.length === 1) {
                const shape = manager.getShapeById(selectedIds[0]);
                setSelectedShape(shape || null);
            } else {
                setSelectedShape(null);
            }
        });

        console.time('Adding shapes');
        shapes.forEach((shape) => {
            const graphics = manager.addShape(shape);

            // Add click handler for selection and drag
            graphics.on('pointerdown', (event) => {
                event.stopPropagation();
                const multiSelect = event.ctrlKey || event.metaKey;

                if (multiSelect && manager.isSelected(shape.id)) {
                    manager.deselectShape(shape.id);
                } else {
                    manager.selectShape(shape.id, multiSelect);
                }
            });

            // Enable drag and drop for the shape
            manager.enableDragAndDrop(shape.id, graphics);
        });
        console.timeEnd('Adding shapes');

        // Build spatial index for fast culling
        console.time('Building spatial index');
        manager.buildSpatialIndex();
        console.timeEnd('Building spatial index');

        // Add global pointer move handler for drag/resize
        viewport.on('pointermove', (event) => {
            manager.handlePointerMove(event);
        });

        // Add global pointer up handler
        viewport.on('pointerup', () => {
            manager.handlePointerUp();
        });

        viewport.on('pointerupoutside', () => {
            manager.handlePointerUp();
        });

        // Add click handler on viewport for deselection or shape creation
        viewport.on('pointerdown', (event) => {
            const localPos = viewport.toLocal(event.global);
            const currentMode = drawModeRef.current;

            if (currentMode === 'polygon') {
                const newShape = manager.createNewPolygon(localPos.x, localPos.y);
                // Add selection and drag handlers to the new shape
                const graphics = manager.getShape(newShape.id)?.graphics;
                if (graphics) {
                    graphics.on('pointerdown', (e) => {
                        e.stopPropagation();
                        const multiSelect = e.ctrlKey || e.metaKey;

                        if (multiSelect && manager.isSelected(newShape.id)) {
                            manager.deselectShape(newShape.id);
                        } else {
                            manager.selectShape(newShape.id, multiSelect);
                        }
                    });
                }
                // Auto-select the newly created shape
                manager.selectShape(newShape.id, false);
                setDrawMode('select');
            } else if (currentMode === 'line') {
                const newShape = manager.createNewLine(localPos.x, localPos.y);
                const graphics = manager.getShape(newShape.id)?.graphics;
                if (graphics) {
                    graphics.on('pointerdown', (e) => {
                        e.stopPropagation();
                        const multiSelect = e.ctrlKey || e.metaKey;

                        if (multiSelect && manager.isSelected(newShape.id)) {
                            manager.deselectShape(newShape.id);
                        } else {
                            manager.selectShape(newShape.id, multiSelect);
                        }
                    });
                }
                manager.selectShape(newShape.id, false);
                setDrawMode('select');
            } else if (currentMode === 'point') {
                const newShape = manager.createNewPoint(localPos.x, localPos.y);
                const graphics = manager.getShape(newShape.id)?.graphics;
                if (graphics) {
                    graphics.on('pointerdown', (e) => {
                        e.stopPropagation();
                        const multiSelect = e.ctrlKey || e.metaKey;

                        if (multiSelect && manager.isSelected(newShape.id)) {
                            manager.deselectShape(newShape.id);
                        } else {
                            manager.selectShape(newShape.id, multiSelect);
                        }
                    });
                }
                manager.selectShape(newShape.id, false);
                setDrawMode('select');
            } else if (currentMode === 'select') {
                manager.clearSelection();
            }
        });

        viewport.fitWorld(true);
        viewport.moveCenter((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);

        // Initial culling after positioning viewport
        updateCulling();

        const handleResize = () => {
            if (viewport) {
                viewport.resize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            manager.clear();
            viewport.destroy();
        };
    }, [isReady, appRef]);

    return (
        <>
            <FPSCounter />
            <Toolbar currentMode={drawMode} onModeChange={setDrawMode} />
            {/*<PropertiesPanel*/}
            {/*    selectedShape={selectedShape}*/}
            {/*    onPropertyChange={handlePropertyChange}*/}
            {/*/>*/}
            <div
                ref={containerRef}
                style={{width: '100%', height: '100vh', backgroundColor: '#f0f0f0'}}
            />
        </>
    );
};