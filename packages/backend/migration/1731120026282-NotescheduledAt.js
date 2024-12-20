/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NotescheduledAt1731120026282 {
	name = 'NotescheduledAt1731120026282'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_schedule" RENAME COLUMN "expiresAt" TO "scheduledAt"`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_schedule" RENAME COLUMN "scheduledAt" TO "expiresAt"`);
	}
}
