/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev and cherryPick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// リモートのアバターデコレーションの url にメディアプロキシのURLを保存しないようにしたため、既存のレコードを元のURLに正規化する
export class NormalizeRemoteAvatarDecorationUrl1790452186192 {
    name = 'NormalizeRemoteAvatarDecorationUrl1790452186192'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`UPDATE "avatar_decoration" SET "url" = "rawUrl" WHERE "host" IS NOT NULL AND "rawUrl" IS NOT NULL AND "rawUrl" <> ''`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        // プロキシURLは復元できないため何もしない (APIではpack時にプロキシURLを付与している)
    }
}
