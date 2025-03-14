/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RepositoryUrlKokonectToYojoart1741959929443 {
    name = 'RepositoryUrlKokonectToYojoart1741959929443'

    async up(queryRunner) {
        await queryRunner.query(`UPDATE "meta" SET "repositoryUrl" = 'https://github.com/yojo-art/cherrypick' WHERE "repositoryUrl" = ''https://github.com/kokonect-link/cherrypick'`);
    }

    async down(queryRunner) {
        // no valid down migration
    }
}
