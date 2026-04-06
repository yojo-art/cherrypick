/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, jest } from '@jest/globals';
import { showMachineInfo } from '@/misc/show-machine-info.js';

describe('misc:show-machine-info', () => {
	test('calls logger.debug with machine info', async () => {
		const debugFn = jest.fn();
		const mockLogger = {
			createSubLogger: jest.fn().mockReturnValue({
				debug: debugFn,
			}),
		} as any;

		await showMachineInfo(mockLogger);

		expect(mockLogger.createSubLogger).toHaveBeenCalledWith('machine');
		expect(debugFn).toHaveBeenCalledTimes(3);
		expect(debugFn.mock.calls[0][0]).toMatch(/Hostname:/);
		expect(debugFn.mock.calls[1][0]).toMatch(/Platform:/);
		expect(debugFn.mock.calls[2][0]).toMatch(/CPU:/);
	});
});
