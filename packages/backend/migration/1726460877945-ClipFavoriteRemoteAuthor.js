/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class flashLikeRemote1726452644817 {
	name = 'flashLikeRemote1726452644817'

	async up(queryRunner) {
			await queryRunner.query(`ALTER TABLE "flash_like_remote" ADD "authorId" character varying(32)`);
	}

	async down(queryRunner) {
			await queryRunner.query(`ALTER TABLE "flash_like_remote" DROP COLUMN "reversiVersion"`);
	}
}
