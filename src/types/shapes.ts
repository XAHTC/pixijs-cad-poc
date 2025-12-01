export interface Coordinate {
    x: number;
    y: number;
}

export interface ShapeStyle {
    fillColor?: string;
    borderColor?: string;
    borderWidth?: number;
    opacity?: number;
}

export interface PolygonShape {
    id: string;
    type: 'polygon';
    coordinates: Coordinate[];
    style: ShapeStyle;
    label?: string;
}

export interface LineShape {
    id: string;
    type: 'line';
    points: Coordinate[];
    style: ShapeStyle;
    label?: string;
}

export interface PointShape {
    id: string;
    type: 'point';
    coordinate: Coordinate;
    style: ShapeStyle;
    radius?: number;
    label?: string;
}

export type Shape = PolygonShape | LineShape | PointShape;

export interface IrrigationProject {
    Id: string;
    Name: string;
    SubAreas: SubArea[];
}

export interface SubArea {
    Id: string;
    Name: string;
    Number: number;
    Coordinates: number[][];
    Blocks: Block[];
}

export interface Block {
    Id: string;
    Name: string;
    Number: number;
    Coordinates: number[][];
    Laterals: {
        Laterals: Lateral[];
    };
}

export interface Lateral {
    Index: number;
    Layout: number[][];
}