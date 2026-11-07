/**
 * DESIGN §13.1: components and routes take colours, sizes, radii, shadows, fonts, z-index and
 * timings from tokens, never raw values. The token layer (src/lib/design) is where raw values live.
 */
const TOKEN_ONLY = [
	'/color/',
	'background-color',
	'border-color',
	'outline-color',
	'fill',
	'stroke',
	'/^gap$/',
	'/^row-gap$/',
	'/^column-gap$/',
	'/^margin/',
	'/^padding/',
	'border-radius',
	'box-shadow',
	'font-size',
	'font-weight',
	'font-family',
	'z-index',
	'transition-duration',
	'animation-duration'
];

export default {
	customSyntax: 'postcss-html',
	plugins: ['stylelint-declaration-strict-value'],
	rules: {
		'color-no-hex': true,
		'scale-unlimited/declaration-strict-value': [
			TOKEN_ONLY,
			{
				ignoreValues: [
					'0',
					'auto',
					'none',
					'inherit',
					'currentcolor',
					'transparent',
					'/^calc[(]/',
					'/^env[(]/',
					'/^-?var[(]/'
				],
				disableFix: true
			}
		],
		'declaration-property-value-disallowed-list': {
			'/^--/': ['/var[(]--palette-/']
		}
	},
	overrides: [
		{
			files: ['src/lib/design/**/*.css'],
			rules: {
				'color-no-hex': null,
				'scale-unlimited/declaration-strict-value': null,
				'declaration-property-value-disallowed-list': null
			}
		}
	],
	ignoreFiles: ['build/**', '.svelte-kit/**', 'node_modules/**', 'coverage/**']
};
