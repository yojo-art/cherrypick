/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddIsIndexable1726205819617 {
    name = 'AddIsIndexable1726205819617'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "isIndexable" boolean NOT NULL DEFAULT true`);
			}

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isIndexable"`);
    }
}
