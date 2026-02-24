import { json } from '@sveltejs/kit';
import { buildPanlSpecDocument } from '$lib/core/docs';

export const prerender = true;

export function GET() {
	return json(buildPanlSpecDocument(), {
		headers: {
			'cache-control': 'public, max-age=3600'
		}
	});
}
