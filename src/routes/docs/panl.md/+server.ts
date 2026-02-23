import { buildPanlMarkdown } from '$lib/core/docs';

export const prerender = true;

export function GET() {
	return new Response(buildPanlMarkdown(), {
		headers: {
			'content-type': 'text/markdown; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
}
