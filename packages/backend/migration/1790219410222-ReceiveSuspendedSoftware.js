/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ReceiveSuspendedSoftware1790219410222 {
    name = 'ReceiveSuspendedSoftware1790219410222'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "receiveSuspendedSoftware" jsonb NOT NULL DEFAULT '[]'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "receiveSuspendedSoftware"`);
    }
}
