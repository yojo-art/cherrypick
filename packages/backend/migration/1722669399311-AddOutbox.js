/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev, cherrypick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddOutbox1722669399311 {
    name = 'AddOutbox1722669399311'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "outbox" character varying(512)`);
			}

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "outbox"`);
    }
}
