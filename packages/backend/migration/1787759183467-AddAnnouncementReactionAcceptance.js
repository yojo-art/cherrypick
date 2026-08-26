/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddAnnouncementReactionAcceptance1787759183467 {
    name = 'AddAnnouncementReactionAcceptance1787759183467'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement" ADD "reactionAcceptance" character varying(64)`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "reactionAcceptance"`);
    }
}
