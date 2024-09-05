/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ChartRangeUpscale1725547203459 {
    name = 'ChartRangeUpscale1725547203459'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "__chart__instance" ALTER COLUMN "___requests_failed" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "__chart__instance" ALTER COLUMN "___requests_succeeded" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "__chart__instance" ALTER COLUMN "___requests_received" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "__chart__instance" ALTER COLUMN "___notes_total" TYPE bigint`);
    }

    async down(queryRunner) {
			await queryRunner.query(`ALTER TABLE "__chart__instance" ALTER COLUMN "___requests_failed" TYPE smallint`);
			await queryRunner.query(`ALTER TABLE "__chart__instance" ALTER COLUMN "___requests_succeeded" TYPE smallint`);
			await queryRunner.query(`ALTER TABLE "__chart__instance" ALTER COLUMN "___requests_received" TYPE smallint`);
			await queryRunner.query(`ALTER TABLE "__chart__instance" ALTER COLUMN "___notes_total" TYPE integer`);
    }
}
