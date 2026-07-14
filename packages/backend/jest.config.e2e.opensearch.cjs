/*
* For a detailed explanation regarding each configuration property and type check, visit:
* https://jestjs.io/docs/en/configuration.html
*/

const base = require('./jest.config.e2e.cjs');

module.exports = {
	...base,
	testMatch: [
		'<rootDir>/test/e2e/search-notes.ts',
		'<rootDir>/test/e2e/advanced-search.ts',
	],
};
