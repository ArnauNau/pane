<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import NotationDocsSidebar from '$lib/components/NotationDocsSidebar.svelte';
	import { DEFAULT_SPEC_JSON, EXAMPLE_SPECS } from '$lib/core/examples';
	import { parseSpec } from '$lib/core/parser';
	import { renderSpecToCanvas } from '$lib/core/renderer';
	import type { Issue } from '$lib/core/types';

	const STORAGE_KEY = 'pane-playground';
	const PERSIST_DEBOUNCE_MS = 400;
	const ZOOM_MIN = 0.5;
	const ZOOM_MAX = 32;
	const ZOOM_SENSITIVITY = 0.002;

	let editorValue = $state(DEFAULT_SPEC_JSON);
	let persistTimeoutId = 0;
	let selectedExample = $state(EXAMPLE_SPECS[0].id);
	let zoom = $state(4);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let panStartX = 0;
	let panStartY = 0;
	let panOriginX = 0;
	let panOriginY = 0;
	let canvasWidth = $state(256);
	let canvasHeight = $state(256);
	let hasRendered = $state(false);
	let parseErrors = $state<Issue[]>([]);
	let parseWarnings = $state<Issue[]>([]);
	let renderErrors = $state<Issue[]>([]);
	let renderWarnings = $state<Issue[]>([]);
	let canvasEl: HTMLCanvasElement | undefined;
	let previewSurfaceEl: HTMLDivElement | undefined;
	let CodeEditorComponent = $state<null | typeof import('$lib/components/CodeEditor.svelte').default>(
		null
	);

	const allErrors = $derived([...parseErrors, ...renderErrors]);
	const allWarnings = $derived([...parseWarnings, ...renderWarnings]);
	const zoomDisplay = $derived(
		zoom === Math.round(zoom) ? `${zoom}x` : `${zoom.toFixed(1)}x`
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

	onDestroy(() => {
		if (persistTimeoutId) {
			clearTimeout(persistTimeoutId);
			persistToStorage(editorValue);
		}
		if (browser) {
			window.removeEventListener('mousemove', onPanMove);
			window.removeEventListener('mouseup', onPanEnd);
		}
	});

	function persistToStorage(value: string): void {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, value);
		}
	}

	function onEditorChange(nextValue: string): void {
		editorValue = nextValue;
		if (browser) {
			if (persistTimeoutId) {
				clearTimeout(persistTimeoutId);
			}
			persistTimeoutId = setTimeout(() => {
				persistToStorage(editorValue);
				persistTimeoutId = 0;
			}, PERSIST_DEBOUNCE_MS);
		}
	}

	function loadExample(id: string): void {
		const example = EXAMPLE_SPECS.find((item) => item.id === id);
		if (!example) {
			return;
		}

		if (persistTimeoutId) {
			clearTimeout(persistTimeoutId);
			persistTimeoutId = 0;
		}
		selectedExample = id;
		editorValue = example.json;
		persistToStorage(example.json);
		parseErrors = [];
		renderErrors = [];
		parseWarnings = [];
		renderWarnings = [];
		hasRendered = false;
		[panX, panY] = clampPan(panX, panY, zoom);
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
		[panX, panY] = clampPan(panX, panY, zoom);
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

	function clampPan(x: number, y: number, z: number): [number, number] {
		if (!previewSurfaceEl) return [x, y];
		const vw = previewSurfaceEl.clientWidth;
		const vh = previewSurfaceEl.clientHeight;
		const sw = canvasWidth * z;
		const sh = canvasHeight * z;

		if (sw <= vw) {
			x = (vw - sw) / 2;
		} else {
			x = Math.min(0, Math.max(vw - sw, x));
		}
		if (sh <= vh) {
			y = (vh - sh) / 2;
		} else {
			y = Math.min(0, Math.max(vh - sh, y));
		}
		return [x, y];
	}

	function onPanStart(e: MouseEvent): void {
		if (e.button !== 0) return;
		isPanning = true;
		panStartX = e.clientX;
		panStartY = e.clientY;
		panOriginX = panX;
		panOriginY = panY;
		window.addEventListener('mousemove', onPanMove);
		window.addEventListener('mouseup', onPanEnd);
	}

	function onPanMove(e: MouseEvent): void {
		[panX, panY] = clampPan(
			panOriginX + (e.clientX - panStartX),
			panOriginY + (e.clientY - panStartY),
			zoom
		);
	}

	function onPanEnd(): void {
		isPanning = false;
		window.removeEventListener('mousemove', onPanMove);
		window.removeEventListener('mouseup', onPanEnd);
	}

	function onZoomWheel(e: WheelEvent): void {
		e.preventDefault();
		if (!previewSurfaceEl) return;
		const rect = previewSurfaceEl.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		const oldZoom = zoom;
		const factor = Math.exp(-e.deltaY * ZOOM_SENSITIVITY);
		const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldZoom * factor));

		const rawX = mx - (mx - panX) * (newZoom / oldZoom);
		const rawY = my - (my - panY) * (newZoom / oldZoom);
		[panX, panY] = clampPan(rawX, rawY, newZoom);
		zoom = newZoom;
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
				<span class="zoom-display">{zoomDisplay}</span>
				<select
					onchange={(event) => {
						const target = event.currentTarget as HTMLSelectElement;
						zoom = Number(target.value);
						[panX, panY] = clampPan(panX, panY, zoom);
						target.value = '';
					}}
				>
					<option value="" disabled selected>Presets</option>
					<option value={1}>1x</option>
					<option value={2}>2x</option>
					<option value={4}>4x</option>
					<option value={8}>8x</option>
					<option value={16}>16x</option>
				</select>
			</label>
			<button type="button" class="btn-primary" onclick={applySpec}>Apply</button>
			<button type="button" class="btn-secondary" onclick={exportPng} disabled={!hasRendered}
				>Export PNG</button
			>
		</div>
	</header>

	<div class="main-content">
		<div class="docs-column">
			<NotationDocsSidebar />
		</div>

		<div class="work-column">
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
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="preview-surface"
						class:panning={isPanning}
						bind:this={previewSurfaceEl}
						onmousedown={onPanStart}
						onwheel={onZoomWheel}
					>
						<div
							class="canvas-bounds"
							style={`width:${canvasWidth}px;height:${canvasHeight}px;transform-origin:0 0;transform:translate(${panX}px,${panY}px) scale(${zoom});box-shadow:0 0 0 ${1 / zoom}px rgba(255,255,255,0.12), 0 0 0 9999px rgba(0,0,0,0.15);`}
						>
							<canvas
								bind:this={canvasEl}
								width={canvasWidth}
								height={canvasHeight}
							></canvas>
						</div>
					</div>
				</div>
			</section>

			<section class="issues">
				<div class="issue-column">
					<h2>Errors</h2>
					{#if allErrors.length === 0}
						<p class="empty">No errors.</p>
					{:else}
						{#each allErrors as issue}
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
					{#if allWarnings.length === 0}
						<p class="empty">No warnings.</p>
					{:else}
						{#each allWarnings as issue}
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
		</div>
	</div>
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

	.zoom-display {
		color: var(--text-primary) !important;
		font-family: var(--font-mono);
		font-size: 12px !important;
		text-transform: none !important;
		letter-spacing: 0 !important;
		min-width: 3ch;
		text-align: right;
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

	.docs-column {
		min-width: 0;
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
		overflow: hidden;
		padding: 14px;
		background-color: #111111;
		background-image: repeating-conic-gradient(#181818 0deg 90deg, #111111 90deg 180deg);
		background-size: 20px 20px;
		cursor: grab;
	}

	.preview-surface.panning {
		cursor: grabbing;
	}

	.canvas-bounds {
		overflow: hidden;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
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
