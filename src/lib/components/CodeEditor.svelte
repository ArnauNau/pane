<script lang="ts">
	import { onMount } from 'svelte';
	import { basicSetup, EditorView } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { json } from '@codemirror/lang-json';

	interface Props {
		value: string;
		onChange: (nextValue: string) => void;
	}

	let { value, onChange }: Props = $props();

	let container: HTMLDivElement | undefined;
	let view: EditorView | undefined;
	let syncing = false;

	onMount(() => {
		if (!container) {
			return;
		}

		view = new EditorView({
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					json(),
					EditorView.theme(
						{
							'&': {
								backgroundColor: 'var(--bg-secondary)',
								color: 'var(--text-primary)'
							},
							'.cm-content': {
								caretColor: 'var(--accent-color)'
							},
							'.cm-cursor, .cm-dropCursor': {
								borderLeftColor: 'var(--accent-color)'
							},
							'.cm-gutters': {
								backgroundColor: 'var(--bg-secondary)',
								color: 'var(--text-secondary)',
								border: 'none'
							},
							'.cm-activeLineGutter': {
								backgroundColor: 'var(--bg-tertiary)'
							},
							'.cm-activeLine': {
								backgroundColor: 'rgba(255,255,255,0.035)'
							},
							'.cm-selectionBackground, .cm-content ::selection': {
								backgroundColor: 'rgba(74,158,255,0.24)'
							}
						},
						{ dark: true }
					),
					EditorView.updateListener.of((update) => {
						if (!update.docChanged || syncing) {
							return;
						}
						onChange(update.state.doc.toString());
					})
				]
			}),
			parent: container
		});

		return () => {
			view?.destroy();
		};
	});

	$effect(() => {
		if (!view) {
			return;
		}
		const current = view.state.doc.toString();
		if (current === value) {
			return;
		}

		syncing = true;
		view.dispatch({
			changes: {
				from: 0,
				to: current.length,
				insert: value
			}
		});
		syncing = false;
	});
</script>

<div class="editor-shell">
	<div bind:this={container} class="editor-root"></div>
</div>

<style>
	.editor-shell {
		height: 100%;
		min-height: 420px;
		background: var(--bg-secondary);
		border: 0;
	}

	.editor-root {
		height: 100%;
	}

	:global(.cm-editor) {
		height: 100%;
		background: transparent;
	}

	:global(.cm-scroller) {
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.4;
	}

</style>
