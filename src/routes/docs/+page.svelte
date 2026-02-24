<script lang="ts">
	import {
		buildPanlSpecDocument,
		getNotationDocsByKind,
		PANL_JSON_URL,
		PANL_LANGUAGE_NAME,
		PANL_MARKDOWN_URL,
		PANL_SHORT_NAME,
		PANL_VERSION
	} from '$lib/core/docs';

	const spec = buildPanlSpecDocument();
	const rootDocs = getNotationDocsByKind('root');
	const primitiveDocs = getNotationDocsByKind('primitive');
	const helperDocs = getNotationDocsByKind('helper');
	const firstExample = spec.examples[0]?.spec;
</script>

<svelte:head>
	<title>{PANL_SHORT_NAME} Docs</title>
</svelte:head>

<main class="docs-page">
	<header class="docs-header">
		<div>
			<p class="eyebrow">Specification</p>
			<h1>{PANL_LANGUAGE_NAME}</h1>
			<p class="subtitle">Version {PANL_VERSION} · Deterministic JSON notation for pixel-perfect assets.</p>
		</div>
		<div class="header-links">
			<a href="/">Open Playground</a>
			<a href={PANL_JSON_URL}>JSON</a>
			<a href={PANL_MARKDOWN_URL}>Markdown</a>
		</div>
	</header>

	<section class="panel">
		<h2>Overview</h2>
		<p>
			PANL defines single-asset render specs with integer-only coordinates, hex/palette colors, strict schema
			validation, and deterministic raster rendering.
		</p>
	</section>

	<section class="panel">
		<h2>Root Structure</h2>
		{#each rootDocs as doc}
			<article class="doc-card">
				<h3>{doc.title}</h3>
				<code>{doc.signature}</code>
				<p>{doc.summary}</p>
				<table>
					<thead>
						<tr>
							<th>Field</th>
							<th>Type</th>
							<th>Required</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						{#each doc.fields as field}
							<tr>
								<td>{field.name}</td>
								<td><code>{field.type}</code></td>
								<td>{field.required ? 'yes' : 'no'}</td>
								<td>{field.description}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</article>
		{/each}
	</section>

	<section class="panel">
		<h2>Commands</h2>
		<div class="command-grid">
			<div>
				<h3>Primitives</h3>
				{#each primitiveDocs as doc}
					<article class="command-row">
						<div class="row-head">
							<strong>{doc.title}</strong>
							<code>{doc.signature}</code>
						</div>
						<p>{doc.summary}</p>
					</article>
				{/each}
			</div>
			<div>
				<h3>Helpers</h3>
				{#each helperDocs as doc}
					<article class="command-row">
						<div class="row-head">
							<strong>{doc.title}</strong>
							<code>{doc.signature}</code>
						</div>
						<p>{doc.summary}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="panel">
		<h2>Example</h2>
		{#if firstExample}
			<pre>{JSON.stringify(firstExample, null, 2)}</pre>
		{:else}
			<p>No example available.</p>
		{/if}
	</section>
</main>

<style>
	.docs-page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.docs-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		padding: 14px;
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.eyebrow {
		margin: 0;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	h1 {
		margin: 4px 0;
		font-size: 24px;
	}

	.subtitle {
		margin: 0;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.header-links {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.header-links a {
		display: inline-flex;
		align-items: center;
		height: 28px;
		padding: 0 10px;
		font-size: 12px;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.header-links a:hover {
		background: var(--bg-tertiary);
	}

	.panel {
		padding: 14px;
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	h2 {
		margin: 0 0 8px;
		font-size: 16px;
	}

	h3 {
		margin: 0 0 8px;
		font-size: 14px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	th,
	td {
		text-align: left;
		padding: 6px;
		border: 1px solid var(--border-color);
		vertical-align: top;
	}

	th {
		color: var(--text-secondary);
		font-weight: 600;
	}

	.doc-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.doc-card code,
	.command-row code {
		display: inline-block;
		padding: 2px 6px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		font-size: 11px;
	}

	.command-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 12px;
	}

	.command-row {
		padding: 8px;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.command-row p {
		margin: 0;
		font-size: 12px;
		color: var(--text-secondary);
	}

	.row-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}

	pre {
		margin: 0;
		overflow-x: auto;
		padding: 10px;
		font-size: 11px;
		line-height: 1.45;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	@media (max-width: 760px) {
		.docs-header {
			flex-direction: column;
		}

		.row-head {
			flex-direction: column;
		}
	}
</style>
