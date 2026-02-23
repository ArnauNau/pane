import { EXAMPLE_SPECS } from '$lib/core/examples';
import { PANL_JSON_SCHEMA } from '$lib/core/schema';

export const PANL_SHORT_NAME = 'PANL';
export const PANL_LANGUAGE_NAME = 'Pixel Art Notation Language';
export const PANL_VERSION = '0.1';
export const PANL_SPEC_URL = '/docs';
export const PANL_JSON_URL = '/docs/panl.json';
export const PANL_MARKDOWN_URL = '/docs/panl.md';

export interface NotationDocField {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

export type NotationDocKind = 'primitive' | 'helper' | 'root';

export interface NotationDoc {
	id: string;
	title: string;
	kind: NotationDocKind;
	signature: string;
	summary: string;
	fields: NotationDocField[];
	notes?: string[];
}

export const NOTATION_DOCS: NotationDoc[] = [
	{
		id: 'root',
		title: 'Root Spec',
		kind: 'root',
		signature: '{ version, canvas, palette?, seed?, definitions?, asset }',
		summary: 'Top-level document for a single asset render.',
		fields: [
			{
				name: 'version',
				type: 'string',
				required: true,
				description: 'Notation version tag, currently "0.1".'
			},
			{
				name: 'canvas',
				type: '{ width: int, height: int }',
				required: true,
				description: 'Fixed output canvas size.'
			},
			{
				name: 'palette',
				type: '{ colors: Record<string, hex> }',
				required: false,
				description: 'Named colors referenced via @token.'
			},
			{
				name: 'seed',
				type: 'int',
				required: false,
				description: 'Required when dither is used.'
			},
			{
				name: 'definitions',
				type: 'Record<string, command>',
				required: false,
				description: 'Reusable named command definitions.'
			},
			{
				name: 'asset',
				type: '{ id: string, commands: command[] }',
				required: true,
				description: 'Asset identifier and render command list.'
			}
		],
		notes: [
			'Commands are rendered in array order.',
			'Warnings do not block PNG export.'
		]
	},
	{
		id: 'iso_prism',
		title: 'iso_prism',
		kind: 'primitive',
		signature: 'iso_prism(x, y, w, h, depth, topFill, leftFill, rightFill, outline?)',
		summary: 'Isometric block primitive with top, left, and right faces.',
		fields: [
			{ name: 'x', type: 'int', required: true, description: 'Top-face center X coordinate.' },
			{ name: 'y', type: 'int', required: true, description: 'Top-face center Y coordinate.' },
			{ name: 'w', type: 'int (even)', required: true, description: 'Top-face width.' },
			{ name: 'h', type: 'int (even)', required: true, description: 'Top-face height.' },
			{ name: 'depth', type: 'int >= 1', required: true, description: 'Prism vertical depth.' },
			{
				name: 'topFill/leftFill/rightFill',
				type: 'color',
				required: true,
				description: 'Face fill colors.'
			},
			{
				name: 'outline',
				type: 'color',
				required: false,
				description: 'Optional outline color.'
			},
			{
				name: 'transform',
				type: 'transform',
				required: false,
				description: 'translate / flip transforms.'
			},
			{
				name: 'dither',
				type: 'dither',
				required: false,
				description: 'Checker overlay on top face.'
			}
		]
	},
	{
		id: 'iso_tile',
		title: 'iso_tile',
		kind: 'primitive',
		signature: 'iso_tile(x, y, w, h, fill, outline?)',
		summary: 'Flat isometric diamond (top-face only).',
		fields: [
			{ name: 'x', type: 'int', required: true, description: 'Diamond center X.' },
			{ name: 'y', type: 'int', required: true, description: 'Diamond top Y.' },
			{ name: 'w', type: 'int (even)', required: true, description: 'Diamond width.' },
			{ name: 'h', type: 'int (even)', required: true, description: 'Diamond height.' },
			{ name: 'fill', type: 'color', required: true, description: 'Fill color.' },
			{
				name: 'outline',
				type: 'color',
				required: false,
				description: 'Optional edge color.'
			},
			{
				name: 'transform',
				type: 'transform',
				required: false,
				description: 'translate / flip transforms.'
			},
			{
				name: 'dither',
				type: 'dither',
				required: false,
				description: 'Checker overlay.'
			}
		]
	},
	{
		id: 'rect',
		title: 'rect',
		kind: 'primitive',
		signature: 'rect(x, y, w, h, fill? | stroke?)',
		summary: 'Axis-aligned rectangle primitive.',
		fields: [
			{ name: 'x,y', type: 'int', required: true, description: 'Top-left corner.' },
			{ name: 'w,h', type: 'int >= 1', required: true, description: 'Dimensions.' },
			{
				name: 'fill',
				type: 'color',
				required: false,
				description: 'Fill color (required if stroke missing).'
			},
			{
				name: 'stroke',
				type: 'color',
				required: false,
				description: 'Stroke color (required if fill missing).'
			},
			{
				name: 'strokeWidth',
				type: 'int >= 1',
				required: false,
				description: 'Stroke width.'
			},
			{
				name: 'transform',
				type: 'transform',
				required: false,
				description: 'translate / flip transforms.'
			}
		]
	},
	{
		id: 'line',
		title: 'line',
		kind: 'primitive',
		signature: 'line(x1, y1, x2, y2, color, width?)',
		summary: 'Integer-based raster line primitive.',
		fields: [
			{ name: 'x1,y1,x2,y2', type: 'int', required: true, description: 'Line endpoints.' },
			{ name: 'color', type: 'color', required: true, description: 'Line color.' },
			{ name: 'width', type: 'int >= 1', required: false, description: 'Line width.' },
			{
				name: 'transform',
				type: 'transform',
				required: false,
				description: 'translate / flip transforms.'
			}
		]
	},
	{
		id: 'polygon',
		title: 'polygon',
		kind: 'primitive',
		signature: 'polygon(points, fill? | stroke?)',
		summary: 'Custom polygon primitive with integer points.',
		fields: [
			{
				name: 'points',
				type: 'Array<{x:int,y:int}>',
				required: true,
				description: 'At least 3 points.'
			},
			{
				name: 'fill',
				type: 'color',
				required: false,
				description: 'Fill color (required if stroke missing).'
			},
			{
				name: 'stroke',
				type: 'color',
				required: false,
				description: 'Stroke color (required if fill missing).'
			},
			{
				name: 'strokeWidth',
				type: 'int >= 1',
				required: false,
				description: 'Stroke width.'
			},
			{
				name: 'transform',
				type: 'transform',
				required: false,
				description: 'translate / flip transforms.'
			}
		]
	},
	{
		id: 'use',
		title: 'use',
		kind: 'primitive',
		signature: 'use(ref, transform?, overrides?)',
		summary: 'Reference a named definition and apply allowed overrides.',
		fields: [
			{ name: 'ref', type: 'string', required: true, description: 'Definition name to reuse.' },
			{
				name: 'transform',
				type: 'transform',
				required: false,
				description: 'Per-instance transform.'
			},
			{
				name: 'overrides.colors',
				type: 'Record<string, color>',
				required: false,
				description: 'Allowed color key overrides only.'
			},
			{
				name: 'overrides.transform',
				type: 'transform',
				required: false,
				description: 'Additional transform override.'
			}
		],
		notes: ['Geometry overrides are blocked in v1 by parser rules.']
	},
	{
		id: 'color',
		title: 'color',
		kind: 'helper',
		signature: 'hex | @paletteToken',
		summary: 'Color input accepted by draw commands.',
		fields: [
			{
				name: 'hex',
				type: '#RRGGBB | #RRGGBBAA',
				required: true,
				description: 'Direct color literal.'
			},
			{
				name: '@name',
				type: 'palette reference',
				required: false,
				description: 'Lookup in palette.colors.'
			}
		]
	},
	{
		id: 'transform',
		title: 'transform',
		kind: 'helper',
		signature: '{ translateX?, translateY?, flipX?, flipY? }',
		summary: 'Integer transform properties applied in local coordinates.',
		fields: [
			{ name: 'translateX', type: 'int', required: false, description: 'Horizontal translation.' },
			{ name: 'translateY', type: 'int', required: false, description: 'Vertical translation.' },
			{
				name: 'flipX',
				type: 'boolean',
				required: false,
				description: 'Mirror around local origin on X.'
			},
			{
				name: 'flipY',
				type: 'boolean',
				required: false,
				description: 'Mirror around local origin on Y.'
			}
		]
	},
	{
		id: 'dither',
		title: 'dither',
		kind: 'helper',
		signature: '{ pattern: "checker", color, offsetX?, offsetY? }',
		summary: 'Optional checker overlay for selected primitives.',
		fields: [
			{
				name: 'pattern',
				type: '"checker"',
				required: true,
				description: 'Current v1 supported pattern.'
			},
			{
				name: 'color',
				type: 'color',
				required: true,
				description: 'Overlay color.'
			},
			{
				name: 'offsetX/offsetY',
				type: 'int',
				required: false,
				description: 'Pattern phase offsets.'
			}
		]
	}
];

export interface PanlExampleDoc {
	id: string;
	label: string;
	spec: unknown;
}

export interface PanlSpecDocument {
	name: string;
	version: string;
	canonicalPath: string;
	machineReadablePath: string;
	markdownPath: string;
	schema: unknown;
	entries: NotationDoc[];
	examples: PanlExampleDoc[];
}

const PANL_EXAMPLES: PanlExampleDoc[] = EXAMPLE_SPECS.map((example) => ({
	id: example.id,
	label: example.label,
	spec: JSON.parse(example.json) as unknown
}));

export function getNotationDocsByKind(kind: NotationDocKind): NotationDoc[] {
	return NOTATION_DOCS.filter((doc) => doc.kind === kind);
}

export function buildPanlSpecDocument(): PanlSpecDocument {
	return {
		name: PANL_LANGUAGE_NAME,
		version: PANL_VERSION,
		canonicalPath: PANL_SPEC_URL,
		machineReadablePath: PANL_JSON_URL,
		markdownPath: PANL_MARKDOWN_URL,
		schema: PANL_JSON_SCHEMA,
		entries: NOTATION_DOCS,
		examples: PANL_EXAMPLES
	};
}

export function buildPanlMarkdown(): string {
	const lines: string[] = [];
	const groups: NotationDocKind[] = ['root', 'primitive', 'helper'];

	lines.push(`# ${PANL_SHORT_NAME} Specification v${PANL_VERSION}`);
	lines.push('');
	lines.push(`${PANL_LANGUAGE_NAME} defines deterministic, anti-aliased-free isometric pixel art assets.`);
	lines.push('');
	lines.push('## Canonical Endpoints');
	lines.push('');
	lines.push(`- Human-readable: \`${PANL_SPEC_URL}\``);
	lines.push(`- Machine-readable JSON: \`${PANL_JSON_URL}\``);
	lines.push(`- Markdown export: \`${PANL_MARKDOWN_URL}\``);
	lines.push('');
	lines.push('## Document Structure');
	lines.push('');
	lines.push('```json');
	lines.push('{');
	lines.push('  "version": "0.1",');
	lines.push('  "canvas": { "width": 256, "height": 256 },');
	lines.push('  "palette": { "colors": { "name": "#RRGGBB" } },');
	lines.push('  "seed": 42,');
	lines.push('  "definitions": { "name": { "type": "..." } },');
	lines.push('  "asset": { "id": "asset_id", "commands": [{ "type": "..." }] }');
	lines.push('}');
	lines.push('```');
	lines.push('');

	for (const group of groups) {
		const docs = getNotationDocsByKind(group);
		lines.push(`## ${capitalize(group)} Commands`);
		lines.push('');

		for (const doc of docs) {
			lines.push(`### \`${doc.title}\``);
			lines.push('');
			lines.push(`- Signature: \`${doc.signature}\``);
			lines.push(`- Summary: ${doc.summary}`);
			lines.push('');
			lines.push('| Field | Type | Required | Description |');
			lines.push('| --- | --- | --- | --- |');
			for (const field of doc.fields) {
				lines.push(
					`| \`${escapePipes(field.name)}\` | \`${escapePipes(field.type)}\` | ${field.required ? 'yes' : 'no'} | ${escapePipes(field.description)} |`
				);
			}
			lines.push('');

			if (doc.notes?.length) {
				lines.push('Notes:');
				for (const note of doc.notes) {
					lines.push(`- ${note}`);
				}
				lines.push('');
			}
		}
	}

	lines.push('## JSON Schema');
	lines.push('');
	lines.push('```json');
	lines.push(JSON.stringify(PANL_JSON_SCHEMA, null, 2));
	lines.push('```');

	return lines.join('\n');
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapePipes(value: string): string {
	return value.replaceAll('|', '\\|');
}
