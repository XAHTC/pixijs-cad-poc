import React from 'react';

export type DrawMode = 'select' | 'polygon' | 'line' | 'point' | null;

interface ToolbarProps {
    currentMode: DrawMode;
    onModeChange: (mode: DrawMode) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ currentMode, onModeChange }) => {
    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            gap: '8px',
            zIndex: 1000,
        }}>
            <button
                onClick={() => onModeChange('select')}
                style={{
                    padding: '8px 16px',
                    backgroundColor: currentMode === 'select' ? '#0066ff' : '#f0f0f0',
                    color: currentMode === 'select' ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: currentMode === 'select' ? 'bold' : 'normal',
                }}
            >
                Select
            </button>
            <button
                onClick={() => onModeChange('polygon')}
                style={{
                    padding: '8px 16px',
                    backgroundColor: currentMode === 'polygon' ? '#0066ff' : '#f0f0f0',
                    color: currentMode === 'polygon' ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: currentMode === 'polygon' ? 'bold' : 'normal',
                }}
            >
                Polygon
            </button>
            <button
                onClick={() => onModeChange('line')}
                style={{
                    padding: '8px 16px',
                    backgroundColor: currentMode === 'line' ? '#0066ff' : '#f0f0f0',
                    color: currentMode === 'line' ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: currentMode === 'line' ? 'bold' : 'normal',
                }}
            >
                Line
            </button>
            <button
                onClick={() => onModeChange('point')}
                style={{
                    padding: '8px 16px',
                    backgroundColor: currentMode === 'point' ? '#0066ff' : '#f0f0f0',
                    color: currentMode === 'point' ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: currentMode === 'point' ? 'bold' : 'normal',
                }}
            >
                Point
            </button>
        </div>
    );
};
