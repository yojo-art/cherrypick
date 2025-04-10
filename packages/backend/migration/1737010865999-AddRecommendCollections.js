/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev, cherrypick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddFeaturedCollections1737010865999 {
    name = 'AddFeaturedCollections1737010865999'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "featuredCollections" character varying(512)`);
			}

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "featuredCollections"`);
    }
}
