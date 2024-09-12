/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev, cherrypick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class SizeLong1724223448551 {
    name = 'SizeLong1724223448551'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "drive_file" ADD "size_long" bigint`);
			}

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "drive_file" DROP COLUMN "size_long"`);
    }
}
