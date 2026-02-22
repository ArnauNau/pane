<script lang="ts">
	import { NOTATION_DOCS, type NotationDoc } from '$lib/core/docs';

	const primitives = NOTATION_DOCS.filter((doc) => doc.kind === 'primitive');
	const helpers = NOTATION_DOCS.filter((doc) => doc.kind === 'helper');
	const roots = NOTATION_DOCS.filter((doc) => doc.kind === 'root');

	let selectedId = $state(roots[0]?.id ?? primitives[0]?.id ?? '');
	const selectedDoc = $derived(
		NOTATION_DOCS.find((doc) => doc.id === selectedId) ?? NOTATION_DOCS[0]
	);

	function renderChipClass(doc: NotationDoc): string {
		if (selectedDoc?.id === doc.id) {
			return 'doc-chip active';
		}
		return 'doc-chip';
	}
</script>

<aside class="docs-sidebar">
	<div class="docs-header">
		<h2>PANEL Docs</h2>
		<p>Pixel Art Notation Language</p>
	</div>

	<div class="docs-groups">
		<div class="group">
			<h3>Root</h3>
			<div class="chip-grid">
				{#each roots as doc}
					<button type="button" class={renderChipClass(doc)} onclick={() => (selectedId = doc.id)}>
						{doc.title}
					</button>
				{/each}
			</div>
		</div>

		<div class="group">
			<h3>Primitives</h3>
			<div class="chip-grid">
				{#each primitives as doc}
					<button type="button" class={renderChipClass(doc)} onclick={() => (selectedId = doc.id)}>
						{doc.title}
					</button>
				{/each}
			</div>
		</div>

		<div class="group">
			<h3>Helpers</h3>
			<div class="chip-grid">
				{#each helpers as doc}
					<button type="button" class={renderChipClass(doc)} onclick={() => (selectedId = doc.id)}>
						{doc.title}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if selectedDoc}
		<div class="doc-detail">
			<div class="doc-top">
				<h4>{selectedDoc.title}</h4>
				<span class="kind kind-{selectedDoc.kind}">{selectedDoc.kind}</span>
			</div>
			<code class="signature">{selectedDoc.signature}</code>
			<p class="summary">{selectedDoc.summary}</p>

			<div class="fields">
				{#each selectedDoc.fields as field}
					<div class="field-row">
						<div class="field-name">
							{field.name}
							{#if field.required}
								<span class="required">*</span>
							{/if}
						</div>
						<div class="field-type">{field.type}</div>
						<div class="field-desc">{field.description}</div>
					</div>
				{/each}
			</div>

			{#if selectedDoc.notes?.length}
				<div class="notes">
					<h5>Notes</h5>
					<ul>
						{#each selectedDoc.notes as note}
							<li>{note}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.docs-sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border-color);
		min-width: 280px;
	}

	.docs-header {
		padding: 12px;
		border-bottom: 1px solid var(--border-color);
	}

	h2 {
		margin: 0;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-primary);
	}

	.docs-header p {
		margin: 3px 0 0;
		font-size: 12px;
		color: var(--text-secondary);
	}

	.docs-groups {
		padding: 12px;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.group h3 {
		margin: 0 0 6px;
		font-size: 11px;
		text-transform: uppercase;
		color: var(--text-tertiary);
		letter-spacing: 0.05em;
	}

	.chip-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
	}

	.doc-chip {
		padding: 6px 8px;
		font-size: 11px;
		line-height: 1;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-secondary);
		border-radius: 0;
		margin-right: -1px;
		margin-bottom: -1px;
	}

	.doc-chip:hover {
		border-color: var(--text-tertiary);
		color: var(--text-primary);
		background: var(--bg-tertiary);
		z-index: 2;
	}

	.doc-chip.active {
		background: var(--accent-color);
		border-color: var(--accent-color);
		color: #fff;
		z-index: 3;
	}

	.doc-detail {
		flex: 1;
		padding: 12px;
		overflow-y: auto;
	}

	.doc-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	h4 {
		margin: 0;
		font-size: 14px;
	}

	.kind {
		font-size: 10px;
		text-transform: uppercase;
		border: 1px solid var(--border-color);
		padding: 2px 6px;
		color: var(--text-secondary);
	}

	.signature {
		display: block;
		margin-top: 8px;
		padding: 8px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		font-size: 11px;
	}

	.summary {
		margin: 8px 0 10px;
		font-size: 12px;
		color: var(--text-secondary);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field-row {
		padding: 8px;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	.field-name {
		font-size: 11px;
		color: var(--text-primary);
		font-family: var(--font-mono);
	}

	.required {
		color: var(--error-color);
		margin-left: 4px;
	}

	.field-type {
		margin-top: 3px;
		font-size: 11px;
		color: var(--accent-color);
		font-family: var(--font-mono);
	}

	.field-desc {
		margin-top: 3px;
		font-size: 11px;
		color: var(--text-secondary);
	}

	.notes {
		margin-top: 10px;
		padding: 8px;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	h5 {
		margin: 0 0 6px;
		font-size: 11px;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.notes ul {
		margin: 0;
		padding-left: 16px;
	}

	.notes li {
		font-size: 11px;
		color: var(--text-secondary);
		margin: 2px 0;
	}
</style>
