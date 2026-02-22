<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { DEFAULT_SPEC_JSON, EXAMPLE_SPECS } from '$lib/core/examples';
	import { parseSpec } from '$lib/core/parser';
	import { renderSpecToCanvas } from '$lib/core/renderer';
	import type { Issue } from '$lib/core/types';

	const STORAGE_KEY = 'iso-pixel-art-spec';

	let editorValue = $state(DEFAULT_SPEC_JSON);
	let selectedExample = $state(EXAMPLE_SPECS[0].id);
	let zoom = $state(4);
	let canvasWidth = $state(256);
	let canvasHeight = $state(256);
	let hasRendered = $state(false);
	let parseErrors = $state<Issue[]>([]);
	let parseWarnings = $state<Issue[]>([]);
	let renderErrors = $state<Issue[]>([]);
	let renderWarnings = $state<Issue[]>([]);
	let canvasEl: HTMLCanvasElement | undefined;
	let CodeEditorComponent = $state<null | typeof import('$lib/components/CodeEditor.svelte').default>(
		null
	);

	onMount(() => {
		void import('$lib/components/CodeEditor.svelte').then((module) => {
			CodeEditorComponent = module.default;
		});

		if (browser) {
			const persisted = localStorage.getItem(STORAGE_KEY);
			if (persisted) {
				editorValue = persisted;
			}
		}
		applySpec();
	});

	function onEditorChange(nextValue: string): void {
		editorValue = nextValue;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, editorValue);
		}
	}

	function loadExample(id: string): void {
		const example = EXAMPLE_SPECS.find((item) => item.id === id);
		if (!example) {
			return;
		}

		selectedExample = id;
		onEditorChange(example.json);
		parseErrors = [];
		renderErrors = [];
		parseWarnings = [];
		renderWarnings = [];
		hasRendered = false;
	}

	function applySpec(): void {
		parseErrors = [];
		renderErrors = [];
		parseWarnings = [];
		renderWarnings = [];

		const parsed = parseSpec(editorValue);
		if (!parsed.ok) {
			parseErrors = parsed.errors;
			hasRendered = false;
			return;
		}

		parseWarnings = parsed.warnings;
		canvasWidth = parsed.spec.canvas.width;
		canvasHeight = parsed.spec.canvas.height;
		if (!canvasEl) {
			renderErrors = [{ path: '/canvas', message: 'Canvas element is unavailable.' }];
			hasRendered = false;
			return;
		}

		const result = renderSpecToCanvas(parsed.spec, canvasEl);
		renderWarnings = result.warnings;
		renderErrors = result.errors;
		hasRendered = result.errors.length === 0;
	}

	function exportPng(): void {
		if (!canvasEl || !hasRendered) {
			return;
		}

		const url = canvasEl.toDataURL('image/png');
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'iso-asset.png';
		anchor.click();
	}
</script>

<main class="app-shell">
	<header class="topbar">
		<div class="brand">
			<h1>PANE Playground</h1>
			<p>Isometric Pixel Art Notation Engine</p>
		</div>
		<div class="controls">
			<label>
				<span>Example</span>
				<select
					value={selectedExample}
					onchange={(event) => {
						const target = event.currentTarget as HTMLSelectElement;
						loadExample(target.value);
					}}
				>
					{#each EXAMPLE_SPECS as example}
						<option value={example.id}>{example.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Zoom</span>
				<select
					value={zoom}
					onchange={(event) => {
						const target = event.currentTarget as HTMLSelectElement;
						zoom = Number(target.value);
					}}
				>
					<option value={1}>1x</option>
					<option value={2}>2x</option>
					<option value={4}>4x</option>
					<option value={8}>8x</option>
				</select>
			</label>
			<button type="button" class="btn-primary" onclick={applySpec}>Apply</button>
			<button type="button" class="btn-secondary" onclick={exportPng} disabled={!hasRendered}
				>Export PNG</button
			>
		</div>
	</header>

	<section class="workspace">
		<div class="panel panel-editor">
			<div class="panel-title">Spec (JSON)</div>
			{#if CodeEditorComponent}
				<CodeEditorComponent value={editorValue} onChange={onEditorChange} />
			{:else}
				<textarea
					class="editor-fallback"
					value={editorValue}
					oninput={(event) => {
						const target = event.currentTarget as HTMLTextAreaElement;
						onEditorChange(target.value);
					}}
				></textarea>
			{/if}
		</div>

		<div class="panel panel-preview">
			<div class="panel-title">Preview</div>
			<div class="preview-surface">
				<canvas
					bind:this={canvasEl}
					width={canvasWidth}
					height={canvasHeight}
					style={`width:${canvasWidth * zoom}px;height:${canvasHeight * zoom}px;`}
				></canvas>
			</div>
		</div>
	</section>

	<section class="issues">
		<div class="issue-column">
			<h2>Errors</h2>
			{#if parseErrors.length === 0 && renderErrors.length === 0}
				<p class="empty">No errors.</p>
			{:else}
				{#each [...parseErrors, ...renderErrors] as issue}
					<div class="issue error">
						<div class="path">{issue.path}</div>
						<div>{issue.message}</div>
						{#if issue.hint}
							<div class="hint">{issue.hint}</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>

		<div class="issue-column">
			<h2>Warnings</h2>
			{#if parseWarnings.length === 0 && renderWarnings.length === 0}
				<p class="empty">No warnings.</p>
			{:else}
				{#each [...parseWarnings, ...renderWarnings] as issue}
					<div class="issue warning">
						<div class="path">{issue.path}</div>
						<div>{issue.message}</div>
						{#if issue.hint}
							<div class="hint">{issue.hint}</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</section>
</main>

<style>
	.app-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
	}

	.topbar {
		padding: 10px 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
		gap: 12px;
	}

	.brand h1 {
		margin: 0;
		font-size: 14px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.brand p {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--text-secondary);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-secondary);
	}

	label span {
		color: var(--text-tertiary);
		text-transform: uppercase;
		font-size: 11px;
		letter-spacing: 0.05em;
	}

	select,
	button {
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
		border-radius: 0;
		padding: 6px 10px;
		font-size: 12px;
	}

	.btn-primary {
		background: var(--accent-color);
		border-color: var(--accent-color);
		color: #fff;
	}

	.btn-primary:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	.btn-secondary {
		background: var(--bg-tertiary);
	}

	button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.main-content {
		flex: 1;
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr);
		min-height: 0;
	}

	.work-column {
		min-width: 0;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
	}

	.workspace {
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		border-bottom: 1px solid var(--border-color);
	}

	.panel {
		min-height: 0;
		background: var(--bg-secondary);
		display: flex;
		flex-direction: column;
	}

	.panel + .panel {
		border-left: 1px solid var(--border-color);
	}

	.panel-title {
		padding: 8px 12px;
		border-bottom: 1px solid var(--border-color);
		font-size: 11px;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.editor-fallback {
		flex: 1;
		width: 100%;
		min-height: 420px;
		padding: 12px;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 13px;
		resize: none;
		outline: none;
	}

	.preview-surface {
		flex: 1;
		min-height: 420px;
		overflow: auto;
		padding: 14px;
		background-color: #111111;
		background-image: repeating-conic-gradient(#181818 0deg 90deg, #111111 90deg 180deg);
		background-size: 20px 20px;
	}

	canvas {
		display: block;
		image-rendering: pixelated;
		background: transparent;
	}

	.issues {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	.issue-column {
		padding: 12px;
		background: var(--bg-secondary);
	}

	.issue-column + .issue-column {
		border-left: 1px solid var(--border-color);
	}

	h2 {
		margin: 0 0 8px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
	}

	.issue {
		padding: 8px;
		margin-top: 8px;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		font-size: 12px;
	}

	.issue.error {
		border-left: 3px solid var(--error-color);
	}

	.issue.warning {
		border-left: 3px solid var(--warn-color);
	}

	.path {
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 11px;
		margin-bottom: 2px;
	}

	.hint {
		color: var(--text-secondary);
		margin-top: 4px;
		font-size: 11px;
	}

	.empty {
		color: var(--text-secondary);
		margin: 0;
		font-size: 12px;
	}

	@media (max-width: 1280px) {
		.main-content {
			grid-template-columns: 280px minmax(0, 1fr);
		}
	}

	@media (max-width: 1080px) {
		.main-content {
			grid-template-columns: 1fr;
		}

		.docs-column {
			border-bottom: 1px solid var(--border-color);
		}

		.workspace,
		.issues {
			grid-template-columns: 1fr;
		}

		.panel + .panel,
		.issue-column + .issue-column {
			border-left: none;
			border-top: 1px solid var(--border-color);
		}
	}
</style>
