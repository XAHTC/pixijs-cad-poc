import {useEffect, useRef, useState} from 'react';
import {usePixiApp} from '../hooks/usePixiApp';
import {Viewport} from 'pixi-viewport';
import {Graphics} from 'pixi.js';
import {ShapeManager} from '../pixi/ShapeManager';
import {calculateBounds, parseIrrigationProject} from '../utils/jsonParser';
import {generateStressTestShapes} from '../utils/stressTestGenerator';
import projectDataRaw from '../data/project.json';
import {Toolbar} from './Toolbar';
import {FPSCounter} from './FPSCounter';
import type {DrawMode} from './Toolbar';
import {STRESS_TEST_MODE, STRESS_TEST_COUNT, STRESS_TEST_AREA, VIEWPORT_CONFIG} from '../config/constants';
import type {IrrigationProject} from '../types/shapes';

const projectData = projectDataRaw as IrrigationProject;

export const PixiCanvas = () => {
    const {appRef, containerRef, isReady} = usePixiApp();
    const shapeManagerRef = useRef<ShapeManager | null>(null);
    const viewportRef = useRef<Viewport | null>(null);
    const [drawMode, setDrawMode] = useState<DrawMode>('select');
    const drawModeRef = useRef<DrawMode>('select');

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
                areaWidth: STRESS_TEST_AREA.width,
                areaHeight: STRESS_TEST_AREA.height,
                baseX: STRESS_TEST_AREA.baseX,
                baseY: STRESS_TEST_AREA.baseY,
            })
            : parseIrrigationProject(projectData);

        console.log(`Loaded ${shapes.length} shapes in ${STRESS_TEST_MODE ? 'STRESS TEST' : 'NORMAL'} mode`);

        const bounds = calculateBounds(shapes);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;

        const viewport = new Viewport({
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            worldWidth: width + VIEWPORT_CONFIG.padding * 2,
            worldHeight: height + VIEWPORT_CONFIG.padding * 2,
            events: appRef.current.renderer.events,
        });

        appRef.current.stage.addChild(viewport);
        viewportRef.current = viewport;

        viewport
            .drag()
            .pinch() // Two-finger pinch zoom
            .wheel(VIEWPORT_CONFIG.wheel)
            .clampZoom(VIEWPORT_CONFIG.zoom);

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
        });

        // Helper function to add selection handler to shapes
        const addShapeSelectionHandler = (shapeId: string, graphics: Graphics) => {
            graphics.on('pointerdown', (event) => {
                event.stopPropagation();
                const multiSelect = event.ctrlKey || event.metaKey;

                if (multiSelect && manager.isSelected(shapeId)) {
                    manager.deselectShape(shapeId);
                } else {
                    manager.selectShape(shapeId, multiSelect);
                }
            });
        };

        console.time('Adding shapes');
        shapes.forEach((shape) => {
            const graphics = manager.addShape(shape);

            // Add click handler for selection
            addShapeSelectionHandler(shape.id, graphics);

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

        // Helper function to handle new shape creation
        const handleNewShape = (shapeId: string) => {
            const graphics = manager.getShape(shapeId)?.graphics;
            if (graphics) {
                addShapeSelectionHandler(shapeId, graphics);
            }
            manager.selectShape(shapeId, false);
            setDrawMode('select');
        };

        // Add click handler on viewport for deselection or shape creation
        viewport.on('pointerdown', (event) => {
            const localPos = viewport.toLocal(event.global);
            const currentMode = drawModeRef.current;

            if (currentMode === 'polygon') {
                const newShape = manager.createNewPolygon(localPos.x, localPos.y);
                handleNewShape(newShape.id);
            } else if (currentMode === 'line') {
                const newShape = manager.createNewLine(localPos.x, localPos.y);
                handleNewShape(newShape.id);
            } else if (currentMode === 'point') {
                const newShape = manager.createNewPoint(localPos.x, localPos.y);
                handleNewShape(newShape.id);
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
            <div
                ref={containerRef}
                style={{width: '100%', height: '100vh', backgroundColor: '#f0f0f0'}}
            />
        </>
    );
};