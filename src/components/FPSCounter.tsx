import { useEffect, useState } from 'react';

export const FPSCounter = () => {
    const [fps, setFps] = useState(0);
    const [visibleShapes, setVisibleShapes] = useState(0);
    const [totalShapes, setTotalShapes] = useState(0);
    const [cullTime, setCullTime] = useState('0');
    const [inScene, setInScene] = useState(0);
    const [lodLevel, setLodLevel] = useState(0);
    const [skippedByLOD, setSkippedByLOD] = useState(0);

    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();
        let animationFrameId: number;

        const updateFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            const elapsed = currentTime - lastTime;

            if (elapsed >= 1000) {
                setFps(Math.round((frameCount * 1000) / elapsed));
                frameCount = 0;
                lastTime = currentTime;
            }

            animationFrameId = requestAnimationFrame(updateFPS);
        };

        animationFrameId = requestAnimationFrame(updateFPS);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // Listen for custom events from ShapeManager
    useEffect(() => {
        const handleVisibleShapesUpdate = (event: CustomEvent) => {
            setVisibleShapes(event.detail.count);
            setTotalShapes(event.detail.total);
            setCullTime(event.detail.cullTime || '0');
            setInScene(event.detail.inScene || 0);
            setLodLevel(event.detail.lodLevel || 0);
            setSkippedByLOD(event.detail.skippedByLOD || 0);
        };

        window.addEventListener('visibleShapesUpdate', handleVisibleShapesUpdate as EventListener);

        return () => {
            window.removeEventListener('visibleShapesUpdate', handleVisibleShapesUpdate as EventListener);
        };
    }, []);

    const cullTimeNum = parseFloat(cullTime);

    const lodLabels = ['Full', 'Medium', 'Low'];
    const lodColors = ['#00ff00', '#ffaa00', '#ff8844'];

    return (
        <div style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#00ff00',
            padding: '12px 16px',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '13px',
            zIndex: 1000,
            minWidth: '240px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
            <div style={{ marginBottom: '6px', fontSize: '15px', fontWeight: 'bold' }}>
                <strong>FPS:</strong> <span style={{ color: fps < 30 ? '#ff4444' : fps < 50 ? '#ffaa00' : '#00ff00' }}>{fps}</span>
            </div>
            {totalShapes > 0 && (
                <>
                    <div style={{ marginBottom: '5px', paddingTop: '6px', borderTop: '1px solid #444' }}>
                        <strong>In Scene:</strong>{' '}
                        <span style={{ color: '#00ddff' }}>
                            {inScene.toLocaleString()}
                        </span>
                        {' '}/ {totalShapes.toLocaleString()}
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                        <strong>Visible:</strong> {visibleShapes.toLocaleString()}
                        {skippedByLOD > 0 && (
                            <span style={{ fontSize: '11px', color: '#888', marginLeft: '4px' }}>
                                (-{skippedByLOD.toLocaleString()} LOD)
                            </span>
                        )}
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                        <strong>LOD:</strong>{' '}
                        <span style={{ color: lodColors[lodLevel] }}>
                            {lodLabels[lodLevel]}
                        </span>
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                        <strong>Culling:</strong>{' '}
                        <span style={{ color: cullTimeNum > 16 ? '#ff4444' : cullTimeNum > 8 ? '#ffaa00' : '#00ff00' }}>
                            {cullTime}ms
                        </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', paddingTop: '4px', borderTop: '1px solid #333' }}>
                        {((inScene / totalShapes) * 100).toFixed(2)}% rendered • RBush R-tree
                    </div>
                </>
            )}
        </div>
    );
};
