/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddReceiveAbuseReportIndicator1790390952061 {
    name = 'AddReceiveAbuseReportIndicator1790390952061'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" ADD "receiveAbuseReportIndicator" boolean NOT NULL DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "receiveAbuseReportIndicator"`);
    }
}
