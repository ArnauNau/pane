import Ajv from 'ajv';
import type { AssetSpec, Issue } from '$lib/core/types';

const colorSchema = {
	type: 'string',
	anyOf: [
		{ pattern: '^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$' },
		{ pattern: '^@[A-Za-z_][A-Za-z0-9_]*$' }
	]
};

const transformSchema = {
	type: 'object',
	properties: {
		translateX: { type: 'integer' },
		translateY: { type: 'integer' },
		flipX: { type: 'boolean' },
		flipY: { type: 'boolean' }
	},
	additionalProperties: false
};

const ditherSchema = {
	type: 'object',
	properties: {
		pattern: { type: 'string', enum: ['checker'] },
		color: colorSchema,
		offsetX: { type: 'integer' },
		offsetY: { type: 'integer' }
	},
	required: ['pattern', 'color'],
	additionalProperties: false
};

const commandBaseProperties = {
	transform: transformSchema,
	dither: ditherSchema
};

const isoTileSchema = {
	type: 'object',
	properties: {
		type: { const: 'iso_tile' },
		x: { type: 'integer' },
		y: { type: 'integer' },
		w: { type: 'integer', minimum: 2, multipleOf: 2 },
		h: { type: 'integer', minimum: 2, multipleOf: 2 },
		fill: colorSchema,
		outline: colorSchema,
		...commandBaseProperties
	},
	required: ['type', 'x', 'y', 'w', 'h', 'fill'],
	additionalProperties: false
};

const isoPrismSchema = {
	type: 'object',
	properties: {
		type: { const: 'iso_prism' },
		x: { type: 'integer' },
		y: { type: 'integer' },
		w: { type: 'integer', minimum: 2, multipleOf: 2 },
		h: { type: 'integer', minimum: 2, multipleOf: 2 },
		depth: { type: 'integer', minimum: 1 },
		topFill: colorSchema,
		leftFill: colorSchema,
		rightFill: colorSchema,
		outline: colorSchema,
		...commandBaseProperties
	},
	required: ['type', 'x', 'y', 'w', 'h', 'depth', 'topFill', 'leftFill', 'rightFill'],
	additionalProperties: false
};

const rectSchema = {
	type: 'object',
	properties: {
		type: { const: 'rect' },
		x: { type: 'integer' },
		y: { type: 'integer' },
		w: { type: 'integer', minimum: 1 },
		h: { type: 'integer', minimum: 1 },
		fill: colorSchema,
		stroke: colorSchema,
		strokeWidth: { type: 'integer', minimum: 1 },
		...commandBaseProperties
	},
	required: ['type', 'x', 'y', 'w', 'h'],
	anyOf: [{ required: ['fill'] }, { required: ['stroke'] }],
	additionalProperties: false
};

const lineSchema = {
	type: 'object',
	properties: {
		type: { const: 'line' },
		x1: { type: 'integer' },
		y1: { type: 'integer' },
		x2: { type: 'integer' },
		y2: { type: 'integer' },
		color: colorSchema,
		width: { type: 'integer', minimum: 1 },
		...commandBaseProperties
	},
	required: ['type', 'x1', 'y1', 'x2', 'y2', 'color'],
	additionalProperties: false
};

const polygonSchema = {
	type: 'object',
	properties: {
		type: { const: 'polygon' },
		points: {
			type: 'array',
			minItems: 3,
			items: {
				type: 'object',
				properties: {
					x: { type: 'integer' },
					y: { type: 'integer' }
				},
				required: ['x', 'y'],
				additionalProperties: false
			}
		},
		fill: colorSchema,
		stroke: colorSchema,
		strokeWidth: { type: 'integer', minimum: 1 },
		...commandBaseProperties
	},
	required: ['type', 'points'],
	anyOf: [{ required: ['fill'] }, { required: ['stroke'] }],
	additionalProperties: false
};

const useSchema = {
	type: 'object',
	properties: {
		type: { const: 'use' },
		ref: { type: 'string', minLength: 1 },
		transform: transformSchema,
		overrides: {
			type: 'object',
			properties: {
				colors: {
					type: 'object',
					patternProperties: {
						'^[A-Za-z_][A-Za-z0-9_]*$': colorSchema
					},
					additionalProperties: false
				},
				transform: transformSchema
			},
			additionalProperties: false
		}
	},
	required: ['type', 'ref'],
	additionalProperties: false
};

const commandSchema = {
	oneOf: [isoTileSchema, isoPrismSchema, rectSchema, lineSchema, polygonSchema, useSchema]
};

const assetSchema = {
	type: 'object',
	properties: {
		version: { type: 'string', minLength: 1 },
		canvas: {
			type: 'object',
			properties: {
				width: { type: 'integer', minimum: 16, maximum: 1024 },
				height: { type: 'integer', minimum: 16, maximum: 1024 }
			},
			required: ['width', 'height'],
			additionalProperties: false
		},
		palette: {
			type: 'object',
			properties: {
				colors: {
					type: 'object',
					patternProperties: {
						'^[A-Za-z_][A-Za-z0-9_]*$': {
							type: 'string',
							pattern: '^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'
						}
					},
					additionalProperties: false
				}
			},
			required: ['colors'],
			nullable: true,
			additionalProperties: false
		},
		seed: { type: 'integer', nullable: true },
		definitions: {
			type: 'object',
			nullable: true,
			additionalProperties: commandSchema
		},
		asset: {
			type: 'object',
			properties: {
				id: { type: 'string', minLength: 1 },
				commands: {
					type: 'array',
					minItems: 1,
					maxItems: 2000,
					items: commandSchema
				}
			},
			required: ['id', 'commands'],
			additionalProperties: false
		}
	},
	required: ['version', 'canvas', 'asset'],
	additionalProperties: false
};

const ajv = new Ajv({
	allErrors: true,
	allowUnionTypes: true
});

const validate = ajv.compile<AssetSpec>(assetSchema);

export function validateSchema(spec: unknown): { ok: true; data: AssetSpec } | { ok: false; errors: Issue[] } {
	const ok = validate(spec);
	if (ok) {
		return { ok: true, data: spec as AssetSpec };
	}

	const issues: Issue[] =
		validate.errors?.map((error) => ({
			path: error.instancePath || '/',
			message: error.message ?? 'Invalid value',
			hint: schemaHint(error.keyword)
		})) ?? [];

	return { ok: false, errors: issues };
}

function schemaHint(keyword: string): string | undefined {
	switch (keyword) {
		case 'required':
			return 'Add the missing property and try Apply again.';
		case 'additionalProperties':
			return 'Remove unexpected properties or update the command type.';
		case 'type':
			return 'Check the property type against the schema.';
		case 'pattern':
			return 'Check color format (`#RRGGBB`, `#RRGGBBAA`) or palette reference (`@name`).';
		case 'oneOf':
			return 'Command shape does not match any supported primitive.';
		default:
			return undefined;
	}
}
