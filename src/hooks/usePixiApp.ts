import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';

export const usePixiApp = () => {
    const appRef = useRef<Application | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const app = new Application();
        let mounted = true;

        app.init({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0xf0f0f0,
            antialias: true,
            resolution:  1,  // Dynamic pixel ratio based on device
            autoDensity: true,
        }).then(() => {
            if (mounted && containerRef.current && app.canvas) {
                // Ensure canvas scales properly
                app.canvas.style.width = '100%';
                app.canvas.style.height = '100%';

                containerRef.current.appendChild(app.canvas);
                appRef.current = app;
                setIsReady(true);
            }
        });

        return () => {
            mounted = false;
            setIsReady(false);
            if (appRef.current) {
                appRef.current.destroy(true, { children: true });
                appRef.current = null;
            }
        };
    }, []);

    return { appRef, containerRef, isReady };
};