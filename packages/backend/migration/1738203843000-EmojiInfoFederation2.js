/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev and cherryPick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class EmojiInfoFederation1738203843000 {
    async up(queryRunner) {
			await queryRunner.query(`ALTER TABLE "emoji" ADD "importFrom" character varying(1024)`);
    }

    async down(queryRunner) {
			await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "importFrom"`);
    }
}
