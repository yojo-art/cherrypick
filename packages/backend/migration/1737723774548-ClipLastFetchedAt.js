/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev, cherrypick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ClipLastFetchedAt1737723774548 {
    name = 'ClipLastFetchedAt1737723774548'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "clip" ADD "lastFetchedAt" TIMESTAMP WITH TIME ZONE`);
			}

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "clip" DROP COLUMN "lastFetchedAt"`);
    }
}
