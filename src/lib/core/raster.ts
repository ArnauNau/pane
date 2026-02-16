import type { RgbaColor } from '$lib/core/types';

export interface PixelPattern {
	type: 'checker';
	offsetX: number;
	offsetY: number;
}

export class Raster {
	readonly width: number;
	readonly height: number;
	readonly pixels: Uint8ClampedArray;
	private clipped = false;

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.pixels = new Uint8ClampedArray(width * height * 4);
	}

	markClip(): void {
		this.clipped = true;
	}

	consumeClippedFlag(): boolean {
		const value = this.clipped;
		this.clipped = false;
		return value;
	}

	drawLine(
		x0: number,
		y0: number,
		x1: number,
		y1: number,
		color: RgbaColor,
		width = 1,
		pattern?: PixelPattern
	): void {
		let cx = x0;
		let cy = y0;
		const dx = Math.abs(x1 - x0);
		const sx = x0 < x1 ? 1 : -1;
		const dy = -Math.abs(y1 - y0);
		const sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		const isMostlyHorizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
		const strokeStart = -Math.floor(width / 2);
		const strokeEnd = strokeStart + width - 1;
		while (true) {
			if (width <= 1) {
				this.setPixel(cx, cy, color, pattern);
			} else if (isMostlyHorizontal) {
				for (let oy = strokeStart; oy <= strokeEnd; oy++) {
					this.setPixel(cx, cy + oy, color, pattern);
				}
			} else {
				for (let ox = strokeStart; ox <= strokeEnd; ox++) {
					this.setPixel(cx + ox, cy, color, pattern);
				}
			}

			if (cx === x1 && cy === y1) {
				break;
			}
			const e2 = 2 * err;
			if (e2 >= dy) {
				err += dy;
				cx += sx;
			}
			if (e2 <= dx) {
				err += dx;
				cy += sy;
			}
		}
	}

	fillRect(
		x: number,
		y: number,
		w: number,
		h: number,
		color: RgbaColor,
		pattern?: PixelPattern
	): void {
		for (let py = y; py < y + h; py++) {
			for (let px = x; px < x + w; px++) {
				this.setPixel(px, py, color, pattern);
			}
		}
	}

	fillPolygon(points: { x: number; y: number }[], color: RgbaColor, pattern?: PixelPattern): void {
		if (points.length < 3) {
			return;
		}

		let minY = points[0].y;
		let maxY = points[0].y;
		for (let i = 1; i < points.length; i++) {
			minY = Math.min(minY, points[i].y);
			maxY = Math.max(maxY, points[i].y);
		}

		const yStart = Math.ceil(minY);
		const yEndExclusive = Math.ceil(maxY);
		for (let y = yStart; y < yEndExclusive; y++) {
			const scanY = y + 0.5;
			const intersections: number[] = [];

			for (let i = 0; i < points.length; i++) {
				const p1 = points[i];
				const p2 = points[(i + 1) % points.length];

				if ((p1.y <= scanY && p2.y > scanY) || (p2.y <= scanY && p1.y > scanY)) {
					const x = p1.x + ((scanY - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y);
					intersections.push(x);
				}
			}

			intersections.sort((a, b) => a - b);
			for (let i = 0; i < intersections.length - 1; i += 2) {
				const xStart = Math.ceil(intersections[i]);
				const xEnd = Math.ceil(intersections[i + 1]) - 1;
				for (let x = xStart; x <= xEnd; x++) {
					this.setPixel(x, y, color, pattern);
				}
			}
		}
	}

	strokePolygon(points: { x: number; y: number }[], color: RgbaColor, width = 1): void {
		for (let i = 0; i < points.length; i++) {
			const p1 = points[i];
			const p2 = points[(i + 1) % points.length];
			this.drawLine(p1.x, p1.y, p2.x, p2.y, color, width);
		}
	}

	private setPixel(x: number, y: number, color: RgbaColor, pattern?: PixelPattern): void {
		if (!isWithinBounds(x, y, this.width, this.height)) {
			this.markClip();
			return;
		}

		if (pattern && !passesPattern(x, y, pattern)) {
			return;
		}

		const index = (y * this.width + x) * 4;
		blendPixel(this.pixels, index, color);
	}
}

function passesPattern(x: number, y: number, pattern: PixelPattern): boolean {
	if (pattern.type !== 'checker') {
		return true;
	}
	return ((x + pattern.offsetX + y + pattern.offsetY) & 1) === 0;
}

function isWithinBounds(x: number, y: number, width: number, height: number): boolean {
	return x >= 0 && x < width && y >= 0 && y < height;
}

function blendPixel(buffer: Uint8ClampedArray, index: number, color: RgbaColor): void {
	const srcA = color.a / 255;
	if (srcA <= 0) {
		return;
	}
	if (srcA >= 1) {
		buffer[index] = color.r;
		buffer[index + 1] = color.g;
		buffer[index + 2] = color.b;
		buffer[index + 3] = 255;
		return;
	}

	const dstA = buffer[index + 3] / 255;
	const outA = srcA + dstA * (1 - srcA);
	if (outA <= 0) {
		return;
	}

	buffer[index] = Math.round((color.r * srcA + buffer[index] * dstA * (1 - srcA)) / outA);
	buffer[index + 1] = Math.round((color.g * srcA + buffer[index + 1] * dstA * (1 - srcA)) / outA);
	buffer[index + 2] = Math.round((color.b * srcA + buffer[index + 2] * dstA * (1 - srcA)) / outA);
	buffer[index + 3] = Math.round(outA * 255);
}
