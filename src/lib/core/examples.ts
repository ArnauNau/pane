export interface ExampleSpec {
	id: string;
	label: string;
	json: string;
}

const EXAMPLES: { id: string; label: string; value: unknown }[] = [
	{
		id: 'grass_block',
		label: 'Grass Block',
		value: {
			version: '0.1',
			canvas: { width: 256, height: 256 },
			palette: {
				colors: {
					grassTop: '#7EC850',
					grassLeft: '#5A9E34',
					grassRight: '#3D6622',
					outline: '#20252E'
				}
			},
			asset: {
				id: 'grass_block',
				commands: [
					{
						type: 'iso_prism',
						x: 128,
						y: 72,
						w: 32,
						h: 16,
						depth: 16,
						topFill: '@grassTop',
						leftFill: '@grassLeft',
						rightFill: '@grassRight',
						outline: '@outline'
					}
				]
			}
		}
	},
	{
		id: 'road_tile',
		label: 'Road Tile',
		value: {
			version: '0.1',
			canvas: { width: 256, height: 256 },
			palette: {
				colors: {
					road: '#555F6E',
					edge: '#2A3240',
					lane: '#CFD6E5'
				}
			},
			seed: 42,
			asset: {
				id: 'road_tile',
				commands: [
					{
						type: 'iso_tile',
						x: 128,
						y: 100,
						w: 64,
						h: 32,
						fill: '@road',
						outline: '@edge'
					},
					{
						type: 'line',
						x1: 128,
						y1: 112,
						x2: 128,
						y2: 120,
						color: '@lane',
						width: 1
					}
				]
			}
		}
	},
	{
		id: 'office_massing',
		label: 'Office Massing (use + overrides)',
		value: {
			version: '0.1',
			canvas: { width: 256, height: 256 },
			palette: {
				colors: {
					baseTop: '#B7C1CC',
					baseLeft: '#93A1B0',
					baseRight: '#7E8D9E',
					glass: '#9CC7F5',
					outline: '#253040'
				}
			},
			seed: 15,
			definitions: {
				block: {
					type: 'iso_prism',
					x: 128,
					y: 72,
					w: 48,
					h: 24,
					depth: 20,
					topFill: '@baseTop',
					leftFill: '@baseLeft',
					rightFill: '@baseRight',
					outline: '@outline'
				}
			},
			asset: {
				id: 'office_massing',
				commands: [
					{ type: 'use', ref: 'block' },
					{
						type: 'use',
						ref: 'block',
						transform: { translateX: 0, translateY: -20 },
						overrides: {
							colors: {
								topFill: '@glass',
								leftFill: '#6E89A8',
								rightFill: '#5F7997'
							}
						}
					}
				]
			}
		}
	}
];

export const EXAMPLE_SPECS: ExampleSpec[] = EXAMPLES.map((example) => ({
	id: example.id,
	label: example.label,
	json: JSON.stringify(example.value, null, 2)
}));

export const DEFAULT_SPEC_JSON = EXAMPLE_SPECS[0].json;

