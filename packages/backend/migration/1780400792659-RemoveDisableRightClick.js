/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export class RemoveDisableRightClick1780400792659 {
    name = 'RemoveDisableRightClick1780400792659'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "disableRightClick"`);
        await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "disableRightClick"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note_draft" ADD "disableRightClick" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "note" ADD "disableRightClick" boolean NOT NULL DEFAULT false`);
    }
}
