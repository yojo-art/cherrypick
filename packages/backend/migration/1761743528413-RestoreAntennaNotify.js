/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RestoreAntennaNotify1761743528413 {
    name = 'RestoreAntennaNotify1761743528413'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "antenna" ADD "notify" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "antenna" DROP COLUMN "notify"`);
    }
}
