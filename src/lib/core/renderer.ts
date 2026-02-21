import { Raster, type PixelPattern } from '$lib/core/raster';
import type {
	AssetSpec,
	ColorInput,
	Command,
	Issue,
	PrimitiveCommand,
	RgbaColor,
	TransformSpec
} from '$lib/core/types';

const MAX_EXPANDED_COMMANDS = 2000;
const MAX_USE_DEPTH = 16;
interface ResolvedDither {
	pattern: PixelPattern;
	color: RgbaColor;
}

export function renderSpecToCanvas(spec: AssetSpec, canvas: HTMLCanvasElement): {
	warnings: Issue[];
	errors: Issue[];
} {
	const warnings: Issue[] = [];
	const errors: Issue[] = [];

	const expanded = expandCommands(spec, warnings, errors);
	if (errors.length > 0) {
		return { warnings, errors };
	}

	if (expanded.length > MAX_EXPANDED_COMMANDS) {
		errors.push({
			path: '/asset/commands',
			message: `Expanded command count (${expanded.length}) exceeds limit (${MAX_EXPANDED_COMMANDS}).`,
			hint: 'Reduce nested reuse or primitive count.'
		});
		return { warnings, errors };
	}

	if (expanded.length > 1600) {
		warnings.push({
			path: '/asset/commands',
			message: `Expanded command count (${expanded.length}) is close to the limit.`,
			hint: 'Rendering may feel slower in browser.'
		});
	}

	const raster = new Raster(spec.canvas.width, spec.canvas.height);
	const paletteSet = new Set(
		Object.values(spec.palette?.colors ?? {}).map((value) => normalizeHex(value))
	);
	const warningKeys = new Set<string>();

	for (let i = 0; i < expanded.length; i++) {
		const command = expanded[i];
		try {
			renderPrimitive(command, raster, spec, warnings, warningKeys, paletteSet, i);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown render error';
			errors.push({
				path: `/asset/commands/${i}`,
				message
			});
		}
	}

	if (errors.length > 0) {
		return { warnings, errors };
	}

	canvas.width = spec.canvas.width;
	canvas.height = spec.canvas.height;
	const ctx = canvas.getContext('2d', { alpha: true });
	if (!ctx) {
		errors.push({
			path: '/canvas',
			message: 'Unable to create 2D rendering context.'
		});
		return { warnings, errors };
	}

	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	const outputPixels = new Uint8ClampedArray(raster.pixels);
	ctx.putImageData(new ImageData(outputPixels, raster.width, raster.height), 0, 0);

	return { warnings, errors };
}

function expandCommands(spec: AssetSpec, warnings: Issue[], errors: Issue[]): PrimitiveCommand[] {
	const definitions = spec.definitions ?? {};
	const out: PrimitiveCommand[] = [];

	for (const command of spec.asset.commands) {
		expandCommandRecursive(command, definitions, identityTransform(), out, 0, warnings, errors);
	}

	return out;
}

function expandCommandRecursive(
	command: Command,
	definitions: Record<string, Command>,
	inheritedTransform: TransformSpec,
	out: PrimitiveCommand[],
	depth: number,
	warnings: Issue[],
	errors: Issue[]
): void {
	if (depth > MAX_USE_DEPTH) {
		errors.push({
			path: '/asset/commands',
			message: `Use depth exceeds ${MAX_USE_DEPTH}.`,
			hint: 'Flatten nested use chains.'
		});
		return;
	}

	if (command.type !== 'use') {
		const mergedTransform = composeTransforms(inheritedTransform, command.transform);
		out.push({
			...command,
			transform: mergedTransform
		});
		return;
	}

	const refCommand = definitions[command.ref];
	if (!refCommand) {
		errors.push({
			path: '/asset/commands/ref',
			message: `Unknown definition reference "${command.ref}".`
		});
		return;
	}

	const localUseTransform = composeTransforms(command.transform, command.overrides?.transform);
	const mergedUseTransform = composeTransforms(inheritedTransform, localUseTransform);
	const withOverrides = applyColorOverrides(refCommand, command.overrides?.colors, warnings);

	expandCommandRecursive(
		withOverrides,
		definitions,
		mergedUseTransform,
		out,
		depth + 1,
		warnings,
		errors
	);
}

function applyColorOverrides(
	command: Command,
	colorOverrides: Record<string, ColorInput> | undefined,
	warnings: Issue[]
): Command {
	if (!colorOverrides || Object.keys(colorOverrides).length === 0) {
		return structuredClone(command);
	}

	const clone = structuredClone(command);
	if (clone.type === 'use') {
		clone.overrides ??= {};
		clone.overrides.colors = { ...(clone.overrides.colors ?? {}), ...colorOverrides };
		return clone;
	}

	for (const [key, value] of Object.entries(colorOverrides)) {
		if (key in clone) {
			(clone as unknown as Record<string, unknown>)[key] = value;
		} else {
			warnings.push({
				path: `/definitions/${clone.type}`,
				message: `Ignored color override "${key}" for primitive "${clone.type}".`
			});
		}
	}
	return clone;
}

function renderPrimitive(
	command: PrimitiveCommand,
	raster: Raster,
	spec: AssetSpec,
	warnings: Issue[],
	warningKeys: Set<string>,
	paletteSet: Set<string>,
	commandIndex: number
): void {
	switch (command.type) {
		case 'iso_tile':
			renderIsoTile(command, raster, spec, warnings, warningKeys, paletteSet);
			break;
		case 'iso_prism':
			renderIsoPrism(command, raster, spec, warnings, warningKeys, paletteSet);
			break;
		case 'rect':
			renderRect(command, raster, spec, warnings, warningKeys, paletteSet);
			break;
		case 'line':
			renderLine(command, raster, spec, warnings, warningKeys, paletteSet);
			break;
		case 'polygon':
			renderPolygon(command, raster, spec, warnings, warningKeys, paletteSet);
			break;
	}

	if (raster.consumeClippedFlag()) {
		warnings.push({
			path: `/asset/commands/${commandIndex}`,
			message: 'Primitive exceeded canvas bounds and was clipped.'
		});
	}
}

function renderIsoTile(
	command: PrimitiveCommand & { type: 'iso_tile' },
	raster: Raster,
	spec: AssetSpec,
	warnings: Issue[],
	warningKeys: Set<string>,
	paletteSet: Set<string>
): void {
	const axisAligned = !command.transform?.flipX && !command.transform?.flipY;
	const translateX = command.transform?.translateX ?? 0;
	const translateY = command.transform?.translateY ?? 0;
	const anchorX = command.x + translateX;
	const anchorY = command.y + translateY;
	const points = isoTopFacePoints(command.x, command.y, command.w, command.h);
	const transformed = transformPoints(points, command.transform, { x: command.x, y: command.y });
	const fill = resolveColor(command.fill, spec, warnings, warningKeys, paletteSet, '/fill');
	const dither = resolveDither(command.dither, spec, warnings, warningKeys, paletteSet, '/dither');
	if (axisAligned) {
		fillIsoDiamondRows(raster, anchorX, anchorY, command.w, command.h, fill);
		if (dither) {
			fillIsoDiamondRows(raster, anchorX, anchorY, command.w, command.h, dither.color, dither.pattern);
		}
	} else {
		raster.fillPolygon(transformed, fill);
		if (dither) {
			raster.fillPolygon(transformed, dither.color, dither.pattern);
		}
	}

	if (command.outline) {
		const outline = resolveColor(command.outline, spec, warnings, warningKeys, paletteSet, '/outline');
		if (axisAligned) {
			drawIsoDiamondOutlineRows(raster, anchorX, anchorY, command.w, command.h, outline);
		} else {
			raster.strokePolygon(transformed, outline, 1);
		}
	}
}

function renderIsoPrism(
	command: PrimitiveCommand & { type: 'iso_prism' },
	raster: Raster,
	spec: AssetSpec,
	warnings: Issue[],
	warningKeys: Set<string>,
	paletteSet: Set<string>
): void {
	const axisAligned = !command.transform?.flipX && !command.transform?.flipY;
	const top = isoTopFacePoints(command.x, command.y, command.w, command.h);
	if (axisAligned && command.w % 2 === 0) {
		top[1] = { ...top[1], x: top[1].x - 1 };
	}
	const [, r, b, l] = top;
	const depth = command.depth;
	const left = axisAligned
		? [
				l,
				{ x: command.x - 1, y: b.y },
				{ x: command.x - 1, y: b.y + depth - 1 },
				{ x: l.x, y: l.y + depth - 1 }
			]
		: [l, b, { x: b.x, y: b.y + depth - 1 }, { x: l.x, y: l.y + depth - 1 }];
	const right = axisAligned
		? [
				r,
				{ x: command.x, y: b.y },
				{ x: command.x, y: b.y + depth - 1 },
				{ x: r.x, y: r.y + depth - 1 }
			]
		: [r, b, { x: b.x, y: b.y + depth - 1 }, { x: r.x, y: r.y + depth - 1 }];

	const origin = { x: command.x, y: command.y };
	const topPoints = transformPoints(top, command.transform, origin);
	const leftPoints = transformPoints(left, command.transform, origin);
	const rightPoints = transformPoints(right, command.transform, origin);

	const topFill = resolveColor(command.topFill, spec, warnings, warningKeys, paletteSet, '/topFill');
	const leftFill = resolveColor(command.leftFill, spec, warnings, warningKeys, paletteSet, '/leftFill');
	const rightFill = resolveColor(command.rightFill, spec, warnings, warningKeys, paletteSet, '/rightFill');
	const dither = resolveDither(command.dither, spec, warnings, warningKeys, paletteSet, '/dither');
	const translateX = command.transform?.translateX ?? 0;
	const translateY = command.transform?.translateY ?? 0;
	const anchorX = command.x + translateX;
	const anchorY = command.y + translateY;

	if (axisAligned) {
		fillIsoDiamondRows(raster, anchorX, anchorY, command.w, command.h, topFill);
		if (dither) {
			fillIsoDiamondRows(
				raster,
				anchorX,
				anchorY,
				command.w,
				command.h,
				dither.color,
				dither.pattern
			);
		}
		fillAxisAlignedLeftFace(raster, anchorX, anchorY, command.w, command.h, depth, leftFill);
		fillAxisAlignedRightFace(raster, anchorX, anchorY, command.w, command.h, depth, rightFill);
	} else {
		raster.fillPolygon(topPoints, topFill);
		if (dither) {
			raster.fillPolygon(topPoints, dither.color, dither.pattern);
		}
		raster.fillPolygon(leftPoints, leftFill);
		raster.fillPolygon(rightPoints, rightFill);
	}

	if (command.outline) {
		const outline = resolveColor(command.outline, spec, warnings, warningKeys, paletteSet, '/outline');
		if (axisAligned) {
			drawAxisAlignedPrismOutline(raster, anchorX, anchorY, command.w, command.h, depth, outline);
		} else {
			drawPrismOutline(raster, topPoints, leftPoints, rightPoints, outline, null);
		}
	}
}

function renderRect(
	command: PrimitiveCommand & { type: 'rect' },
	raster: Raster,
	spec: AssetSpec,
	warnings: Issue[],
	warningKeys: Set<string>,
	paletteSet: Set<string>
): void {
	const corners = [
		{ x: command.x, y: command.y },
		{ x: command.x + command.w - 1, y: command.y },
		{ x: command.x + command.w - 1, y: command.y + command.h - 1 },
		{ x: command.x, y: command.y + command.h - 1 }
	];
	const transformed = transformPoints(corners, command.transform, { x: command.x, y: command.y });
	const minX = Math.min(...transformed.map((p) => p.x));
	const minY = Math.min(...transformed.map((p) => p.y));
	const maxX = Math.max(...transformed.map((p) => p.x));
	const maxY = Math.max(...transformed.map((p) => p.y));
	const w = maxX - minX + 1;
	const h = maxY - minY + 1;
	const dither = resolveDither(command.dither, spec, warnings, warningKeys, paletteSet, '/dither');

	if (command.fill) {
		const fill = resolveColor(command.fill, spec, warnings, warningKeys, paletteSet, '/fill');
		raster.fillRect(minX, minY, w, h, fill);
		if (dither) {
			raster.fillRect(minX, minY, w, h, dither.color, dither.pattern);
		}
	}

	if (command.stroke) {
		const stroke = resolveColor(command.stroke, spec, warnings, warningKeys, paletteSet, '/stroke');
		const strokeWidth = command.strokeWidth ?? 1;
		raster.drawLine(minX, minY, maxX, minY, stroke, strokeWidth);
		raster.drawLine(maxX, minY, maxX, maxY, stroke, strokeWidth);
		raster.drawLine(maxX, maxY, minX, maxY, stroke, strokeWidth);
		raster.drawLine(minX, maxY, minX, minY, stroke, strokeWidth);
	}
}

function renderLine(
	command: PrimitiveCommand & { type: 'line' },
	raster: Raster,
	spec: AssetSpec,
	warnings: Issue[],
	warningKeys: Set<string>,
	paletteSet: Set<string>
): void {
	const origin = { x: command.x1, y: command.y1 };
	const start = transformPoint({ x: command.x1, y: command.y1 }, command.transform, origin);
	const end = transformPoint({ x: command.x2, y: command.y2 }, command.transform, origin);
	const color = resolveColor(command.color, spec, warnings, warningKeys, paletteSet, '/color');
	raster.drawLine(start.x, start.y, end.x, end.y, color, command.width ?? 1);
}

function renderPolygon(
	command: PrimitiveCommand & { type: 'polygon' },
	raster: Raster,
	spec: AssetSpec,
	warnings: Issue[],
	warningKeys: Set<string>,
	paletteSet: Set<string>
): void {
	const origin = command.points[0];
	const points = transformPoints(command.points, command.transform, origin);
	const dither = resolveDither(command.dither, spec, warnings, warningKeys, paletteSet, '/dither');

	if (command.fill) {
		const fill = resolveColor(command.fill, spec, warnings, warningKeys, paletteSet, '/fill');
		raster.fillPolygon(points, fill);
		if (dither) {
			raster.fillPolygon(points, dither.color, dither.pattern);
		}
	}

	if (command.stroke) {
		const stroke = resolveColor(command.stroke, spec, warnings, warningKeys, paletteSet, '/stroke');
		raster.strokePolygon(points, stroke, command.strokeWidth ?? 1);
	}
}

function resolveDither(
	dither: PrimitiveCommand['dither'],
	spec: AssetSpec,
	warnings: Issue[],
	warningKeys: Set<string>,
	paletteSet: Set<string>,
	path: string
): ResolvedDither | undefined {
	if (!dither) {
		return undefined;
	}

	const color = resolveColor(dither.color, spec, warnings, warningKeys, paletteSet, `${path}/color`);
	return {
		color,
		pattern: {
			type: 'checker',
			offsetX: dither.offsetX ?? 0,
			offsetY: dither.offsetY ?? 0
		}
	};
}

function resolveColor(
	input: ColorInput,
	spec: AssetSpec,
	warnings: Issue[],
	warningKeys: Set<string>,
	paletteSet: Set<string>,
	path: string
): RgbaColor {
	let hex: string;
	if (input.startsWith('@')) {
		const token = input.slice(1);
		hex = spec.palette?.colors[token] ?? '';
		if (!hex) {
			throw new Error(`Palette color reference "${input}" not found.`);
		}
	} else {
		hex = input;
	}

	const normalized = normalizeHex(hex);
	if (spec.palette && !paletteSet.has(normalized)) {
		pushWarningOnce(
			warnings,
			warningKeys,
			`${path}:${normalized}`,
			`Color ${hex} is not present in palette.`,
			path
		);
	}

	return parseHexColor(normalized);
}

function parseHexColor(hex: string): RgbaColor {
	const value = hex.startsWith('#') ? hex.slice(1) : hex;
	if (value.length !== 6 && value.length !== 8) {
		throw new Error(`Invalid hex color "${hex}".`);
	}

	const r = parseInt(value.slice(0, 2), 16);
	const g = parseInt(value.slice(2, 4), 16);
	const b = parseInt(value.slice(4, 6), 16);
	const a = value.length === 8 ? parseInt(value.slice(6, 8), 16) : 255;
	return { r, g, b, a };
}

function normalizeHex(input: string): string {
	return input.toUpperCase();
}

function pushWarningOnce(
	warnings: Issue[],
	keys: Set<string>,
	key: string,
	message: string,
	path: string
): void {
	if (keys.has(key)) {
		return;
	}
	keys.add(key);
	warnings.push({ path, message });
}

function isoTopFacePoints(x: number, y: number, w: number, h: number): { x: number; y: number }[] {
	return [
		{ x, y },
		{ x: x + w / 2, y: y + h / 2 },
		{ x, y: y + h },
		{ x: x - w / 2, y: y + h / 2 }
	];
}

function drawPrismOutline(
	raster: Raster,
	top: { x: number; y: number }[],
	left: { x: number; y: number }[],
	right: { x: number; y: number }[],
	color: RgbaColor,
	topAnchor: { x: number; y: number; w: number; h: number } | null
): void {
	const [t, r, b, l] = top;
	const bottomLeft = left[3];
	const bottomCenter = left[2];
	const bottomRight = right[3];

	if (topAnchor) {
		drawIsoDiamondOutlineRows(raster, topAnchor.x, topAnchor.y, topAnchor.w, topAnchor.h, color);
	} else {
		raster.strokePolygon(top, color, 1);
	}

	const segments: Array<{
		start: { x: number; y: number };
		end: { x: number; y: number };
		width?: number;
	}> = [
		{ start: l, end: bottomLeft },
		{ start: r, end: bottomRight },
		{ start: b, end: bottomCenter, width: 2 },
		{ start: bottomLeft, end: bottomCenter },
		{ start: bottomCenter, end: bottomRight }
	];

	for (const segment of segments) {
		raster.drawLine(
			segment.start.x,
			segment.start.y,
			segment.end.x,
			segment.end.y,
			color,
			segment.width ?? 1
		);
	}
}

function drawAxisAlignedPrismOutline(
	raster: Raster,
	x: number,
	y: number,
	w: number,
	h: number,
	depth: number,
	color: RgbaColor
): void {
	const halfW = w / 2;
	const halfH = h / 2;
	const step = Math.max(1, Math.round(w / h));
	const leftX = x - halfW;
	const rightX = x + halfW - 1;
	const sideTopY = y + halfH;
	const seamTopY = y + h;
	const sideBottomY = sideTopY + depth - 1;
	const seamBottomY = seamTopY + depth - 1;

	drawIsoDiamondOutlineRows(raster, x, y, w, h, color);
	raster.drawLine(leftX, sideTopY, leftX, sideBottomY, color, 1);
	raster.drawLine(rightX, sideTopY, rightX, sideBottomY, color, 1);
	raster.drawLine(x, seamTopY, x, seamBottomY, color, 2);

	for (let i = 0; i < halfH - 1; i++) {
		const py = sideBottomY + 1 + i;
		const inset = i * step;
		const leftSpanX = leftX + inset;
		const rightSpanX = rightX - (step - 1) - inset;
		raster.fillRect(leftSpanX, py, step, 1, color);
		raster.fillRect(rightSpanX, py, step, 1, color);
	}

	raster.fillRect(x - 2, seamBottomY, 4, 1, color);
}

function fillAxisAlignedLeftFace(
	raster: Raster,
	x: number,
	y: number,
	w: number,
	h: number,
	depth: number,
	color: RgbaColor
): void {
	const halfW = w / 2;
	const halfH = h / 2;
	const step = Math.max(1, Math.round(w / h));
	const leftX = x - halfW;
	const seamLeftX = x - 1;
	const sideTopY = y + halfH;
	const seamTopY = y + h;
	const sideBottomY = sideTopY + depth - 1;
	const seamBottomY = seamTopY + depth - 1;

	for (let py = sideTopY; py <= seamBottomY; py++) {
		let spanLeft = leftX;
		let spanRight: number;

		if (py <= seamTopY) {
			const topIndex = py - sideTopY;
			const topOffset = Math.min(topIndex * step + (step - 1), halfW - 1);
			spanRight = leftX + topOffset;
		} else {
			spanRight = seamLeftX;
		}

		if (py >= sideBottomY + 1) {
			const bottomIndex = py - (sideBottomY + 1);
			const bottomOffset = Math.min(bottomIndex * step, halfW - step);
			spanLeft = leftX + bottomOffset;
		}

		const width = spanRight - spanLeft + 1;
		if (width > 0) {
			raster.fillRect(spanLeft, py, width, 1, color);
		}
	}
}

function fillAxisAlignedRightFace(
	raster: Raster,
	x: number,
	y: number,
	w: number,
	h: number,
	depth: number,
	color: RgbaColor
): void {
	const halfW = w / 2;
	const halfH = h / 2;
	const step = Math.max(1, Math.round(w / h));
	const rightX = x + halfW - 1;
	const seamRightX = x;
	const sideTopY = y + halfH;
	const seamTopY = y + h;
	const sideBottomY = sideTopY + depth - 1;
	const seamBottomY = seamTopY + depth - 1;

	for (let py = sideTopY; py <= seamBottomY; py++) {
		let spanLeft: number;
		let spanRight = rightX;

		if (py <= seamTopY) {
			const topIndex = py - sideTopY;
			const topOffset = Math.min(topIndex * step + (step - 1), halfW - 1);
			spanLeft = rightX - topOffset;
		} else {
			spanLeft = seamRightX;
		}

		if (py >= sideBottomY + 1) {
			const bottomIndex = py - (sideBottomY + 1);
			const bottomOffset = Math.min(bottomIndex * step, halfW - step);
			spanRight = rightX - bottomOffset;
		}

		const width = spanRight - spanLeft + 1;
		if (width > 0) {
			raster.fillRect(spanLeft, py, width, 1, color);
		}
	}
}

function fillIsoDiamondRows(
	raster: Raster,
	x: number,
	y: number,
	w: number,
	h: number,
	color: RgbaColor,
	pattern?: PixelPattern
): void {
	const half = h / 2;
	const step = Math.max(1, Math.round(w / h));
	for (let row = 0; row < h; row++) {
		const mirror = row < half ? row : h - 1 - row;
		const rowWidth = step * 2 * (mirror + 1);
		const left = x - rowWidth / 2;
		raster.fillRect(left, y + row, rowWidth, 1, color, pattern);
	}
}

function drawIsoDiamondOutlineRows(
	raster: Raster,
	x: number,
	y: number,
	w: number,
	h: number,
	color: RgbaColor
): void {
	const half = h / 2;
	const step = Math.max(1, Math.round(w / h));
	for (let row = 0; row < h; row++) {
		const mirror = row < half ? row : h - 1 - row;
		const rowWidth = step * 2 * (mirror + 1);
		const left = x - rowWidth / 2;
		const right = left + rowWidth - step;
		raster.fillRect(left, y + row, step, 1, color);
		raster.fillRect(right, y + row, step, 1, color);
	}
}

function identityTransform(): TransformSpec {
	return { translateX: 0, translateY: 0, flipX: false, flipY: false };
}

function composeTransforms(
	parent?: TransformSpec,
	child?: TransformSpec
): TransformSpec {
	const p = { ...identityTransform(), ...(parent ?? {}) };
	const c = { ...identityTransform(), ...(child ?? {}) };
	return {
		translateX: (p.translateX ?? 0) + ((p.flipX ? -1 : 1) * (c.translateX ?? 0)),
		translateY: (p.translateY ?? 0) + ((p.flipY ? -1 : 1) * (c.translateY ?? 0)),
		flipX: Boolean(p.flipX) !== Boolean(c.flipX),
		flipY: Boolean(p.flipY) !== Boolean(c.flipY)
	};
}

function transformPoints(
	points: { x: number; y: number }[],
	transform: TransformSpec | undefined,
	origin: { x: number; y: number }
): { x: number; y: number }[] {
	return points.map((point) => transformPoint(point, transform, origin));
}

function transformPoint(
	point: { x: number; y: number },
	transform: TransformSpec | undefined,
	origin: { x: number; y: number }
): { x: number; y: number } {
	if (!transform) {
		return { x: point.x, y: point.y };
	}

	let dx = point.x - origin.x;
	let dy = point.y - origin.y;
	if (transform.flipX) {
		dx = -dx;
	}
	if (transform.flipY) {
		dy = -dy;
	}

	return {
		x: origin.x + dx + (transform.translateX ?? 0),
		y: origin.y + dy + (transform.translateY ?? 0)
	};
}
