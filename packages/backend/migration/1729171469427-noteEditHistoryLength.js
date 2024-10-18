/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export class noteEditHistoryLength1729171469427 {
	name = 'noteEditHistoryLength1729171469427';
	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "note" ALTER COLUMN "noteEditHistory" TYPE varchar(8192)[]');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "note" ALTER COLUMN "noteEditHistory" TYPE varchar(3000)[]');
	}
}
