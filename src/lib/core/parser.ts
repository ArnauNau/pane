import { validateSchema } from '$lib/core/schema';
import type {
	AssetSpec,
	Command,
	Issue,
	ParseResult,
	PrimitiveCommand,
	UseCommand
} from '$lib/core/types';

const MAX_CANVAS_AREA = 1024 * 1024;
const MAX_USE_DEPTH = 16;

const COLOR_OVERRIDE_ALLOW_LIST: Record<PrimitiveCommand['type'], Set<string>> = {
	iso_tile: new Set(['fill', 'outline']),
	iso_prism: new Set(['topFill', 'leftFill', 'rightFill', 'outline']),
	rect: new Set(['fill', 'stroke']),
	line: new Set(['color']),
	polygon: new Set(['fill', 'stroke'])
};

export function parseSpec(input: string): ParseResult {
	let raw: unknown;
	try {
		raw = JSON.parse(input);
	} catch {
		return {
			ok: false,
			errors: [
				{
					path: '/',
					message: 'Invalid JSON document.',
					hint: 'Check commas, quotes, and brace/array closure.'
				}
			]
		};
	}

	const schemaResult = validateSchema(raw);
	if (!schemaResult.ok) {
		return { ok: false, errors: schemaResult.errors };
	}

	const spec = schemaResult.data;
	const errors: Issue[] = [];
	const warnings: Issue[] = [];

	validateCanvas(spec, warnings);
	validateUseReferences(spec, errors);
	validateDitherSeed(spec, errors);
	validateUseColorOverrides(spec, errors);

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	return { ok: true, spec, warnings };
}

function validateCanvas(spec: AssetSpec, warnings: Issue[]): void {
	const area = spec.canvas.width * spec.canvas.height;
	if (area > MAX_CANVAS_AREA) {
		warnings.push({
			path: '/canvas',
			message: `Canvas area (${area}) is above recommended limits.`,
			hint: 'Reduce canvas size to avoid slower rendering.'
		});
	} else if (area > MAX_CANVAS_AREA * 0.75) {
		warnings.push({
			path: '/canvas',
			message: `Canvas area (${area}) is close to the upper safe limit.`,
			hint: 'Large canvases can reduce responsiveness in browser rendering.'
		});
	}
}

function validateUseReferences(spec: AssetSpec, errors: Issue[]): void {
	const definitions = spec.definitions ?? {};

	for (const command of spec.asset.commands) {
		validateUseRefInCommand(command, definitions, errors, '/asset/commands');
	}

	for (const [name, command] of Object.entries(definitions)) {
		validateUseRefInCommand(command, definitions, errors, `/definitions/${name}`);
	}

	const visiting = new Set<string>();
	const visited = new Set<string>();

	for (const name of Object.keys(definitions)) {
		checkCycles(name, definitions, visiting, visited, errors);
	}

	for (const command of spec.asset.commands) {
		const depth = getUseDepth(command, definitions, 0, new Set<string>());
		if (depth > MAX_USE_DEPTH) {
			errors.push({
				path: '/asset/commands',
				message: `Nested use depth ${depth} exceeds max allowed ${MAX_USE_DEPTH}.`,
				hint: 'Flatten component chains to reduce indirection.'
			});
		}
	}
}

function validateUseRefInCommand(
	command: Command,
	definitions: Record<string, Command>,
	errors: Issue[],
	basePath: string
): void {
	if (command.type !== 'use') {
		return;
	}

	if (!definitions[command.ref]) {
		errors.push({
			path: `${basePath}/ref`,
			message: `Unknown definition reference "${command.ref}".`,
			hint: 'Add it to definitions or fix the ref value.'
		});
	}
}

function checkCycles(
	name: string,
	definitions: Record<string, Command>,
	visiting: Set<string>,
	visited: Set<string>,
	errors: Issue[]
): void {
	if (visited.has(name)) {
		return;
	}
	if (visiting.has(name)) {
		errors.push({
			path: `/definitions/${name}`,
			message: 'Circular use reference detected.',
			hint: 'Break circular references between definitions.'
		});
		return;
	}

	visiting.add(name);
	const command = definitions[name];
	if (command?.type === 'use' && definitions[command.ref]) {
		checkCycles(command.ref, definitions, visiting, visited, errors);
	}
	visiting.delete(name);
	visited.add(name);
}

function getUseDepth(
	command: Command,
	definitions: Record<string, Command>,
	level: number,
	seen: Set<string>
): number {
	if (command.type !== 'use') {
		return level;
	}
	if (seen.has(command.ref)) {
		return MAX_USE_DEPTH + 1;
	}

	const ref = definitions[command.ref];
	if (!ref) {
		return level + 1;
	}

	const nextSeen = new Set(seen);
	nextSeen.add(command.ref);
	return getUseDepth(ref, definitions, level + 1, nextSeen);
}

function validateDitherSeed(spec: AssetSpec, errors: Issue[]): void {
	const needsSeed = hasDither(spec.asset.commands, spec.definitions ?? {}, new Set<string>());
	if (needsSeed && typeof spec.seed !== 'number') {
		errors.push({
			path: '/seed',
			message: 'Seed is required when dither is used.',
			hint: 'Add an integer seed at root level, for example `"seed": 42`.'
		});
	}
}

function hasDither(
	commands: Command[],
	definitions: Record<string, Command>,
	seen: Set<string>
): boolean {
	for (const command of commands) {
		if ('dither' in command && command.dither) {
			return true;
		}
		if (command.type === 'use') {
			if (seen.has(command.ref)) {
				continue;
			}
			const ref = definitions[command.ref];
			if (ref && hasDither([ref], definitions, new Set([...seen, command.ref]))) {
				return true;
			}
		}
	}

	return false;
}

function validateUseColorOverrides(spec: AssetSpec, errors: Issue[]): void {
	const definitions = spec.definitions ?? {};
	for (const command of spec.asset.commands) {
		validateCommandOverrides(command, definitions, errors, '/asset/commands');
	}
	for (const [name, command] of Object.entries(definitions)) {
		validateCommandOverrides(command, definitions, errors, `/definitions/${name}`);
	}
}

function validateCommandOverrides(
	command: Command,
	definitions: Record<string, Command>,
	errors: Issue[],
	path: string
): void {
	if (command.type !== 'use') {
		return;
	}

	const targetPrimitive = resolvePrimitiveDefinition(command, definitions);
	if (!targetPrimitive) {
		return;
	}

	const allowed = COLOR_OVERRIDE_ALLOW_LIST[targetPrimitive.type];
	const colorOverrides = command.overrides?.colors ?? {};
	for (const colorKey of Object.keys(colorOverrides)) {
		if (!allowed.has(colorKey)) {
			errors.push({
				path: `${path}/overrides/colors/${colorKey}`,
				message: `Color override "${colorKey}" is not allowed for primitive "${targetPrimitive.type}".`,
				hint: `Allowed keys: ${Array.from(allowed).join(', ')}`
			});
		}
	}

	const refCommand = definitions[command.ref];
	if (refCommand) {
		validateCommandOverrides(refCommand, definitions, errors, `/definitions/${command.ref}`);
	}
}

function resolvePrimitiveDefinition(
	command: UseCommand,
	definitions: Record<string, Command>
): PrimitiveCommand | null {
	const visited = new Set<string>();
	let current: Command | undefined = definitions[command.ref];

	while (current) {
		if (current.type !== 'use') {
			return current as PrimitiveCommand;
		}
		if (visited.has(current.ref)) {
			return null;
		}
		visited.add(current.ref);
		current = definitions[current.ref];
	}

	return null;
}
