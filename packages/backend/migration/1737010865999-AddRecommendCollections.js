/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev, cherrypick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddRecommendCollections1737010865999 {
    name = 'AddRecommendCollections1737010865999'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "recommendCollections" character varying(512)`);
			}

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "recommendCollections"`);
    }
}
