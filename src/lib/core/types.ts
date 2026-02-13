export type HexColor = `#${string}`;
export type PaletteColorRef = `@${string}`;
export type ColorInput = HexColor | PaletteColorRef;

export interface CanvasSpec {
	width: number;
	height: number;
}

export interface TransformSpec {
	translateX?: number;
	translateY?: number;
	flipX?: boolean;
	flipY?: boolean;
}

export interface DitherSpec {
	pattern: 'checker';
	color: ColorInput;
	offsetX?: number;
	offsetY?: number;
}

export interface PrimitiveBase {
	transform?: TransformSpec;
	dither?: DitherSpec;
}

export interface IsoTileCommand extends PrimitiveBase {
	type: 'iso_tile';
	x: number;
	y: number;
	w: number;
	h: number;
	fill: ColorInput;
	outline?: ColorInput;
}

export interface IsoPrismCommand extends PrimitiveBase {
	type: 'iso_prism';
	x: number;
	y: number;
	w: number;
	h: number;
	depth: number;
	topFill: ColorInput;
	leftFill: ColorInput;
	rightFill: ColorInput;
	outline?: ColorInput;
}

export interface RectCommand extends PrimitiveBase {
	type: 'rect';
	x: number;
	y: number;
	w: number;
	h: number;
	fill?: ColorInput;
	stroke?: ColorInput;
	strokeWidth?: number;
}

export interface LineCommand extends PrimitiveBase {
	type: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	color: ColorInput;
	width?: number;
}

export interface PolygonPoint {
	x: number;
	y: number;
}

export interface PolygonCommand extends PrimitiveBase {
	type: 'polygon';
	points: PolygonPoint[];
	fill?: ColorInput;
	stroke?: ColorInput;
	strokeWidth?: number;
}

export interface UseOverrides {
	colors?: Record<string, ColorInput>;
	transform?: TransformSpec;
}

export interface UseCommand {
	type: 'use';
	ref: string;
	transform?: TransformSpec;
	overrides?: UseOverrides;
}

export type Command =
	| IsoTileCommand
	| IsoPrismCommand
	| RectCommand
	| LineCommand
	| PolygonCommand
	| UseCommand;

export type PrimitiveCommand = Exclude<Command, UseCommand>;

export interface PaletteSpec {
	colors: Record<string, HexColor>;
}

export interface AssetSpec {
	version: string;
	canvas: CanvasSpec;
	palette?: PaletteSpec;
	seed?: number;
	definitions?: Record<string, Command>;
	asset: {
		id: string;
		commands: Command[];
	};
}

export interface Issue {
	path: string;
	message: string;
	hint?: string;
}

export interface ParseResultSuccess {
	ok: true;
	spec: AssetSpec;
	warnings: Issue[];
}

export interface ParseResultFailure {
	ok: false;
	errors: Issue[];
}

export type ParseResult = ParseResultSuccess | ParseResultFailure;

export interface RenderResult {
	ok: boolean;
	warnings: Issue[];
	errors: Issue[];
}

export interface RgbaColor {
	r: number;
	g: number;
	b: number;
	a: number;
}
