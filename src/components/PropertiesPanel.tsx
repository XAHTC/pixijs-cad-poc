import React, { useState } from 'react';
import type { Shape } from '../types/shapes';

interface PropertiesPanelProps {
    selectedShape: Shape | null;
    onPropertyChange: (shapeId: string, updates: Partial<Shape>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedShape, onPropertyChange }) => {
    const [fillColor, setFillColor] = useState(selectedShape?.style.fillColor || '#90EE90');
    const [borderColor, setBorderColor] = useState(selectedShape?.style.borderColor || '#228B22');
    const [borderWidth, setBorderWidth] = useState(selectedShape?.style.borderWidth || 2);
    const [opacity, setOpacity] = useState(selectedShape?.style.opacity || 1);

    // Reset form when selectedShape changes
    React.useEffect(() => {
        if (selectedShape) {
            setFillColor(selectedShape.style.fillColor || '#90EE90');
            setBorderColor(selectedShape.style.borderColor || '#228B22');
            setBorderWidth(selectedShape.style.borderWidth || 2);
            setOpacity(selectedShape.style.opacity || 1);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedShape?.id]);

    if (!selectedShape) {
        return (
            <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                width: '280px',
                zIndex: 1000,
            }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: 'black' }}>
                    Properties
                </h3>
                <p style={{ color: '#666', fontSize: '14px', margin: 0, }}>
                    No shape selected
                </p>
            </div>
        );
    }

    const handleFillColorChange = (color: string) => {
        setFillColor(color);
        onPropertyChange(selectedShape.id, {
            style: { ...selectedShape.style, fillColor: color },
        });
    };

    const handleBorderColorChange = (color: string) => {
        setBorderColor(color);
        onPropertyChange(selectedShape.id, {
            style: { ...selectedShape.style, borderColor: color },
        });
    };

    const handleBorderWidthChange = (width: number) => {
        setBorderWidth(width);
        onPropertyChange(selectedShape.id, {
            style: { ...selectedShape.style, borderWidth: width },
        });
    };

    const handleOpacityChange = (newOpacity: number) => {
        setOpacity(newOpacity);
        onPropertyChange(selectedShape.id, {
            style: { ...selectedShape.style, opacity: newOpacity },
        });
    };

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            width: '280px',
            zIndex: 1000,
            maxHeight: 'calc(100vh - 40px)',
            overflow: 'auto',
        }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: 'black' }}>
                Properties
            </h3>

            <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>
                    Shape Type
                </label>
                <div style={{
                    padding: '10px 12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#212529',
                    fontWeight: '500'
                }}>
                    {selectedShape.type.charAt(0).toUpperCase() + selectedShape.type.slice(1)}
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>
                    Shape ID
                </label>
                <div style={{
                    padding: '10px 12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#495057',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace'
                }}>
                    {selectedShape.id}
                </div>
            </div>

            {selectedShape.type === 'polygon' && (
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>
                        Vertices
                    </label>
                    <div style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#212529',
                        fontWeight: '500'
                    }}>
                        {selectedShape.coordinates.length}
                    </div>
                </div>
            )}

            {selectedShape.type === 'line' && (
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>
                        Points
                    </label>
                    <div style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#212529',
                        fontWeight: '500'
                    }}>
                        {selectedShape.points.length}
                    </div>
                </div>
            )}

            {selectedShape.type === 'point' && (
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>
                        Position
                    </label>
                    <div style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#212529',
                        fontFamily: 'monospace'
                    }}>
                        X: {selectedShape.coordinate.x.toFixed(2)}, Y: {selectedShape.coordinate.y.toFixed(2)}
                    </div>
                </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '16px 0' }} />

            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'black'  }}>
                Style
            </h4>

            {(selectedShape.type === 'polygon' || selectedShape.type === 'point') && (
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
                        Fill Color
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                            type="color"
                            value={fillColor}
                            onChange={(e) => handleFillColorChange(e.target.value)}
                            style={{ width: '40px', height: '32px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                        />
                        <input
                            type="text"
                            value={fillColor}
                            onChange={(e) => handleFillColorChange(e.target.value)}
                            style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                        />
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
                    Border Color
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        type="color"
                        value={borderColor}
                        onChange={(e) => handleBorderColorChange(e.target.value)}
                        style={{ width: '40px', height: '32px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <input
                        type="text"
                        value={borderColor}
                        onChange={(e) => handleBorderColorChange(e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                    />
                </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
                    Border Width: {borderWidth}px
                </label>
                <input
                    type="range"
                    min="1"
                    max="10"
                    value={borderWidth}
                    onChange={(e) => handleBorderWidthChange(Number(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>

            <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
                    Opacity: {opacity.toFixed(2)}
                </label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={opacity}
                    onChange={(e) => handleOpacityChange(Number(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>
        </div>
    );
};
