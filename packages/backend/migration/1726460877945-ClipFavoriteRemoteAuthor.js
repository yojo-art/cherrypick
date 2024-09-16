/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class clipFavoriteRemoteAuthor1726460877945 {
	name = 'clipFavoriteRemoteAuthor1726460877945'

	async up(queryRunner) {
			await queryRunner.query(`ALTER TABLE "clip_favorite_remote" ADD "authorId" character varying(32)`);
	}

	async down(queryRunner) {
			await queryRunner.query(`ALTER TABLE "clip_favorite_remote" DROP COLUMN "authorId"`);
	}
}
