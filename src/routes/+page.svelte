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

	const DOCS_TOGGLE_WIDTH = 40;
	const MIN_DOCS_CONTENT_WIDTH = 300;
	const MIN_DOCS_WIDTH = DOCS_TOGGLE_WIDTH + MIN_DOCS_CONTENT_WIDTH;
	const MAX_DOCS_WIDTH = 620;
	const CLOSED_DOCS_WIDTH = DOCS_TOGGLE_WIDTH + 1;
	const WORKSPACE_HANDLE_WIDTH = 1;
	const MIN_EDITOR_WIDTH = 300;
	const MIN_PREVIEW_WIDTH = 280;

	let editorValue = $state(DEFAULT_SPEC_JSON);
	let persistTimeoutId = 0;
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

	let docsOpen = $state(true);
	let docsWidth = $state(360);
	let editorPaneWidth = $state(560);
	let isDraggingDocs = $state(false);
	let isDraggingWorkspace = $state(false);
	let mainContentEl: HTMLDivElement | undefined;
	let workspaceEl: HTMLElement | undefined;
	let docsBodyEl = $state<HTMLDivElement | undefined>(undefined);
	let docsResizeLeft = 0;
	let docsResizeMin = MIN_DOCS_WIDTH;
	let docsResizeMax = MAX_DOCS_WIDTH;
	let workspaceResizeLeft = 0;
	let workspaceResizeMaxEditor = MIN_EDITOR_WIDTH;

	const allErrors = $derived([...parseErrors, ...renderErrors]);
	const allWarnings = $derived([...parseWarnings, ...renderWarnings]);
	const workspaceColumns = $derived(
		`${editorPaneWidth}px ${WORKSPACE_HANDLE_WIDTH}px minmax(${MIN_PREVIEW_WIDTH}px,1fr)`
	);
	const docsShellWidth = $derived(docsOpen ? docsWidth : CLOSED_DOCS_WIDTH);

	onMount(() => {
		void import('$lib/components/CodeEditor.svelte').then((module) => {
			CodeEditorComponent = module.default;
		});

		if (browser) {
			const persisted = localStorage.getItem(STORAGE_KEY);
			if (persisted) {
				editorValue = persisted;
			}
			window.addEventListener('resize', clampLayoutWidths);
		}
		applySpec();
		clampLayoutWidths();
	});

	onDestroy(() => {
		if (persistTimeoutId) {
			clearTimeout(persistTimeoutId);
			persistToStorage(editorValue);
		}
		stopDocsResize();
		stopWorkspaceResize();
		if (browser) {
			window.removeEventListener('resize', clampLayoutWidths);
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

	function startDocsResize(event: MouseEvent): void {
		if (!browser || window.innerWidth <= 1080 || !mainContentEl) {
			return;
		}
		event.preventDefault();
		const rect = mainContentEl.getBoundingClientRect();
		docsResizeLeft = rect.left;
		docsResizeMin = getMinDocsWidth();
		docsResizeMax = getMaxDocsWidth(rect.width);
		isDraggingDocs = true;
		window.addEventListener('mousemove', handleDocsResize);
		window.addEventListener('mouseup', stopDocsResize);
	}

	function handleDocsResize(event: MouseEvent): void {
		if (!isDraggingDocs) {
			return;
		}
		docsWidth = clamp(event.clientX - docsResizeLeft, docsResizeMin, docsResizeMax);
	}

	function stopDocsResize(): void {
		isDraggingDocs = false;
		if (!browser) {
			return;
		}
		window.removeEventListener('mousemove', handleDocsResize);
		window.removeEventListener('mouseup', stopDocsResize);
	}

	function startWorkspaceResize(event: MouseEvent): void {
		if (!browser || window.innerWidth <= 1080 || !workspaceEl) {
			return;
		}
		event.preventDefault();
		const rect = workspaceEl.getBoundingClientRect();
		workspaceResizeLeft = rect.left;
		workspaceResizeMaxEditor = Math.max(
			MIN_EDITOR_WIDTH,
			rect.width - MIN_PREVIEW_WIDTH - WORKSPACE_HANDLE_WIDTH
		);
		isDraggingWorkspace = true;
		window.addEventListener('mousemove', handleWorkspaceResize);
		window.addEventListener('mouseup', stopWorkspaceResize);
	}

	function handleWorkspaceResize(event: MouseEvent): void {
		if (!isDraggingWorkspace) {
			return;
		}
		editorPaneWidth = clamp(event.clientX - workspaceResizeLeft, MIN_EDITOR_WIDTH, workspaceResizeMaxEditor);
	}

	function stopWorkspaceResize(): void {
		isDraggingWorkspace = false;
		if (!browser) {
			return;
		}
		window.removeEventListener('mousemove', handleWorkspaceResize);
		window.removeEventListener('mouseup', stopWorkspaceResize);
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	function getMinDocsWidth(): number {
		if (!browser || !docsBodyEl) {
			return MIN_DOCS_WIDTH;
		}
		const sidebarEl = docsBodyEl.firstElementChild as HTMLElement | null;
		if (!sidebarEl) {
			return MIN_DOCS_WIDTH;
		}
		const rawMinWidth = Number.parseFloat(window.getComputedStyle(sidebarEl).minWidth);
		const contentMinWidth =
			Number.isFinite(rawMinWidth) && rawMinWidth > 0
				? Math.ceil(rawMinWidth)
				: MIN_DOCS_CONTENT_WIDTH;
		return DOCS_TOGGLE_WIDTH + Math.max(MIN_DOCS_CONTENT_WIDTH, contentMinWidth);
	}

	function getMaxDocsWidth(mainContentWidth: number): number {
		const reserveForWork = MIN_EDITOR_WIDTH + MIN_PREVIEW_WIDTH + WORKSPACE_HANDLE_WIDTH + 24;
		const maxByLayout = mainContentWidth - reserveForWork;
		const minDocsWidth = getMinDocsWidth();
		return Math.max(minDocsWidth, Math.min(MAX_DOCS_WIDTH, maxByLayout));
	}

	function clampLayoutWidths(): void {
		if (!browser || !mainContentEl) {
			return;
		}
		const mainRect = mainContentEl.getBoundingClientRect();
		const minDocsWidth = getMinDocsWidth();
		const maxDocsWidth = getMaxDocsWidth(mainRect.width);
		docsWidth = clamp(docsWidth, minDocsWidth, maxDocsWidth);

		const availableWorkWidth = mainRect.width - (docsOpen ? docsWidth : CLOSED_DOCS_WIDTH);
		const maxEditor = Math.max(
			MIN_EDITOR_WIDTH,
			availableWorkWidth - MIN_PREVIEW_WIDTH - WORKSPACE_HANDLE_WIDTH
		);
		editorPaneWidth = clamp(editorPaneWidth, MIN_EDITOR_WIDTH, maxEditor);
	}

	function toggleDocsPanel(): void {
		docsOpen = !docsOpen;
		if (docsOpen) {
			clampLayoutWidths();
		}
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

	<div
		class="main-content"
		bind:this={mainContentEl}
		class:dragging={isDraggingDocs || isDraggingWorkspace}
	>
		<div class="docs-shell" class:open={docsOpen} style={`--docs-shell-width:${docsShellWidth}px;`}>
			<button
				type="button"
				class="panel-toggle"
				onclick={toggleDocsPanel}
				aria-label={docsOpen ? 'Hide docs panel' : 'Show docs panel'}
			>
				<span class="toggle-icon">{docsOpen ? '◀' : '▶'}</span>
				<span class="toggle-text">{docsOpen ? 'Hide' : 'Docs'}</span>
			</button>

			{#if docsOpen}
				<div class="docs-body" bind:this={docsBodyEl}>
					<NotationDocsSidebar />
				</div>
				<button
					type="button"
					class="resizer-handle docs"
					onmousedown={startDocsResize}
					aria-label="Resize docs panel"
				></button>
			{/if}
		</div>

		<div class="work-column">
			<section class="workspace" bind:this={workspaceEl} style={`--workspace-cols:${workspaceColumns};`}>
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

				<button
					type="button"
					class="resizer-handle workspace"
					onmousedown={startWorkspaceResize}
					aria-label="Resize editor and preview panes"
				></button>

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
		display: flex;
		min-height: 0;
	}

	.main-content.dragging {
		user-select: none;
		cursor: col-resize;
	}

	.docs-shell {
		display: flex;
		align-items: stretch;
		flex: 0 0 auto;
		inline-size: var(--docs-shell-width);
		min-inline-size: var(--docs-shell-width);
		max-inline-size: var(--docs-shell-width);
		background: var(--bg-secondary);
		border-right: none;
		position: relative;
		transition: inline-size 0.2s ease;
		overflow: hidden;
		z-index: 2;
		--docs-toggle-width: 40px;
	}

	.docs-shell:not(.open) {
		border-right: 1px solid var(--border-color);
	}

	.main-content.dragging .docs-shell {
		transition: none;
	}

	.panel-toggle {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.5rem;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		align-self: stretch;
		border-right: 1px solid transparent;
		flex: 0 0 var(--docs-toggle-width);
		inline-size: var(--docs-toggle-width);
		min-inline-size: var(--docs-toggle-width);
		max-inline-size: var(--docs-toggle-width);
		block-size: 100%;
		min-block-size: 100%;
		overflow: hidden;
		white-space: nowrap;
	}

	.panel-toggle:hover {
		color: var(--text-primary);
		background: var(--bg-tertiary);
	}

	.docs-shell.open .panel-toggle {
		border-right-color: var(--border-color);
	}

	.toggle-icon {
		font-size: 0.7rem;
		line-height: 1;
		order: 2;
	}

	.toggle-text {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		writing-mode: vertical-rl;
		text-orientation: mixed;
		order: 1;
	}

	.docs-body {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.work-column {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
	}

	.workspace {
		min-height: 0;
		display: grid;
		grid-template-columns: var(--workspace-cols);
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.panel {
		min-height: 0;
		background: var(--bg-secondary);
		display: flex;
		flex-direction: column;
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

	.resizer-handle {
		background: transparent;
		border: none;
		padding: 0;
		position: relative;
		z-index: 20;
	}

	.resizer-handle.docs {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 1px;
		cursor: col-resize;
		background: var(--border-color);
	}

	.resizer-handle.docs::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0;
		width: 12px;
	}

	.resizer-handle.docs:hover,
	.resizer-handle.docs:active {
		background: rgba(74, 158, 255, 0.75);
	}

	.resizer-handle.workspace {
		width: 100%;
		height: 100%;
		cursor: col-resize;
		background: var(--border-color);
		border: none;
		position: relative;
	}

	.resizer-handle.workspace::before {
		content: none;
	}

	.resizer-handle.workspace::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 12px;
		transform: translateX(-50%);
	}

	.resizer-handle.workspace:hover,
	.resizer-handle.workspace:active {
		background: rgba(74, 158, 255, 0.75);
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

	@media (max-width: 1080px) {
		.main-content {
			flex-direction: column;
		}

		.docs-shell {
			width: 100% !important;
			min-width: 100% !important;
			max-width: 100% !important;
			inline-size: 100% !important;
			min-inline-size: 100% !important;
			max-inline-size: 100% !important;
			border-right: none;
			border-bottom: 1px solid var(--border-color);
		}

		.panel-toggle {
			flex-direction: row;
			justify-content: flex-start;
			inline-size: 100%;
			min-inline-size: 100%;
			max-inline-size: 100%;
			block-size: auto;
			min-block-size: 0;
			flex-basis: auto;
			padding: 8px 10px;
			border-right: none;
			border-bottom: 1px solid var(--border-color);
		}

		.toggle-text {
			writing-mode: horizontal-tb;
			text-orientation: initial;
		}

		.docs-shell.open .panel-toggle {
			border-right-color: transparent;
		}

		.resizer-handle.docs,
		.resizer-handle.workspace {
			display: none;
		}

		.workspace,
		.issues {
			grid-template-columns: 1fr !important;
		}

		.workspace {
			grid-template-rows: minmax(360px, 1fr) minmax(360px, 1fr);
		}

		.issue-column + .issue-column {
			border-left: none;
			border-top: 1px solid var(--border-color);
		}
	}
</style>
