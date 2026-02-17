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

<main class="page">
	<header class="toolbar">
		<h1>Iso Pixel Art Playground</h1>
		<div class="controls">
			<label>
				Example
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
				Zoom
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
			<button type="button" onclick={applySpec}>Apply</button>
			<button type="button" class="secondary" onclick={exportPng} disabled={!hasRendered}>Export PNG</button>
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
	.page {
		min-height: 100vh;
		padding: 14px;
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 10px;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 0 12px;
		background: transparent;
		/*border-bottom: 1px solid var(--border);*/
	}

	h1 {
		margin: 0;
		font-size: 16px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
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
		color: var(--muted);
		font-size: 12px;
	}

	select,
	button {
		border: 1px solid #232932;
		background: var(--bg-2);
		color: var(--text);
		padding: 6px 10px;
		border-radius: 0;
	}

	button {
		cursor: pointer;
		background: #1c2129;
		border-color: #2a313d;
	}

	button.secondary {
		background: #14181f;
		border-color: #252a33;
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.workspace {
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.panel {
		background: var(--bg-1);
		min-height: 500px;
		display: flex;
		flex-direction: column;
		/*border-top: 1px solid var(--border);*/
	}

	.panel-title {
		padding: 10px 6px;
		/*border-bottom: 1px solid var(--border);*/
		font-size: 12px;
		color: var(--muted);
		text-transform: uppercase;
	}

	.panel-editor {
		min-width: 0;
	}

	.editor-fallback {
		flex: 1;
		width: 100%;
		min-height: 420px;
		padding: 12px;
		border: 0;
		background: transparent;
		color: var(--text);
		font-family: 'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace;
		font-size: 13px;
		resize: none;
		outline: none;
	}

	.panel-preview {
		min-width: 0;
	}

	.preview-surface {
		flex: 1;
		min-height: 420px;
		overflow: auto;
		padding: 14px;
		background-color: #0b0d11;
		background-image: repeating-conic-gradient(
			#101318 0deg 90deg,
			#0b0d11 90deg 180deg,
			#101318 180deg 270deg,
			#0b0d11 270deg 360deg
		);
		background-size: 20px 20px;
	}

	canvas {
		display: block;
		image-rendering: pixelated;
		background: transparent;
		/*border: 1px solid #2a2f38;*/
	}

	.issues {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.issue-column {
		/*border-top: 1px solid var(--border);*/
		background: transparent;
		padding: 8px 0 0;
		min-height: 140px;
	}

	h2 {
		margin: 0 0 8px;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.issue {
		padding: 6px 8px;
		margin-top: 8px;
		border-left: 3px solid;
		background: #0f1217;
	}

	.issue.error {
		border-left-color: var(--err);
	}

	.issue.warning {
		border-left-color: var(--warn);
	}

	.path {
		color: var(--muted);
		font-family: 'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace;
		font-size: 12px;
		margin-bottom: 2px;
	}

	.hint {
		color: var(--muted);
		margin-top: 4px;
		font-size: 12px;
	}

	.empty {
		color: var(--muted);
		margin: 0;
	}

	@media (max-width: 1100px) {
		.workspace,
		.issues {
			grid-template-columns: 1fr;
		}
	}
</style>
