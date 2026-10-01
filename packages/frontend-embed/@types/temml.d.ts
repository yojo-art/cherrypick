/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

declare module 'temml/dist/temml.mjs' {
	import type { Options } from 'temml';
	const temml: {
		render: (expression: string, baseNode: HTMLElement | MathMLElement, options?: Options) => void;
		renderToString: (expression: string, options?: Options) => string;
	};
	export default temml;
}
