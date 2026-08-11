/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type XGeneratedSearchIndexItem = {
	id: string;
	parentId?: string;
	path?: string;
	label: string;
	keywords: string[];
	texts: string[];
	icon?: string;
	inlining?: string[];
};

declare module 'search-index' {
	export type GeneratedSearchIndexItem = XGeneratedSearchIndexItem;
}

declare module 'search-index:settings' {
	export const searchIndexes: XGeneratedSearchIndexItem[];
}

declare module 'search-index:admin' {
	export const searchIndexes: XGeneratedSearchIndexItem[];
}

declare module 'temml/dist/temml.mjs' {
	import type { Options } from 'temml';
	const temml: {
		render: (expression: string, baseNode: HTMLElement | MathMLElement, options?: Options) => void;
		renderToString: (expression: string, options?: Options) => string;
	};
	export default temml;
}
