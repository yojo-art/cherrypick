/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev and cherryPick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// avatarUrl/bannerUrl にメディアプロキシのURLを保存しないようにしたため、既存のレコードを元ファイルのURLに正規化する
export class NormalizeUserAvatarBannerUrl1790435604498 {
    name = 'NormalizeUserAvatarBannerUrl1790435604498'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`UPDATE "user" SET "avatarUrl" = NULLIF(COALESCE("drive_file"."webpublicUrl", "drive_file"."url"), '') FROM "drive_file" WHERE "user"."avatarId" = "drive_file"."id"`);
        await queryRunner.query(`UPDATE "user" SET "bannerUrl" = NULLIF(COALESCE("drive_file"."webpublicUrl", "drive_file"."url"), '') FROM "drive_file" WHERE "user"."bannerId" = "drive_file"."id"`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        // プロキシURLは復元できないため何もしない (APIではpack時にプロキシURLを付与している)
    }
}
