/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class UrlKokonectToYojoart1741959929443 {
    name = 'UrlKokonectToYojoart1741959929443'

    async up(queryRunner) {
        await queryRunner.query(`UPDATE "meta" SET "repositoryUrl" = 'https://github.com/yojo-art/cherrypick' WHERE "repositoryUrl" = ''https://github.com/kokonect-link/cherrypick'`);
        await queryRunner.query(`UPDATE "meta" SET "feedbackUrl" = 'https://github.com/yojo-art/cherrypick' WHERE "feedbackUrl" = ''https://github.com/kokonect-link/cherrypick'`);
    }

    async down(queryRunner) {
        // no valid down migration
    }
}
