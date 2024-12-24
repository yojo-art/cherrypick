/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddQuarantineLimited1734500881453 {
    name = 'AddQuarantineLimited1734500881453'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "instance" ADD "quarantineLimited" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "instance" DROP COLUMN "quarantineLimited"`);
    }
}
