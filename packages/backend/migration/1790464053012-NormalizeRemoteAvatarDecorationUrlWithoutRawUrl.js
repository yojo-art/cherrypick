/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev and cherryPick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// rawUrl の無いリモートのアバターデコレーションは 1790452186192 で正規化できず url にメディアプロキシのURLが残るため、
// プロキシURLの url パラメータから元のURLを取り出して url と rawUrl に保存する
// migration からは mediaProxy の設定を読めないため、メディアプロキシのURLの形 (/{avatar|image|static}.webp?url=...) で判定する
export class NormalizeRemoteAvatarDecorationUrlWithoutRawUrl1790464053012 {
    name = 'NormalizeRemoteAvatarDecorationUrlWithoutRawUrl1790464053012'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        const decorations = await queryRunner.query(`SELECT "id", "url" FROM "avatar_decoration" WHERE "host" IS NOT NULL AND ("rawUrl" IS NULL OR "rawUrl" = '') AND "url" ~ '/(avatar|image|static)\\.webp\\?'`);

        for (const decoration of decorations) {
            let rawUrl;
            try {
                rawUrl = new URL(decoration.url).searchParams.get('url');
            } catch {
                continue;
            }
            if (!rawUrl) continue;

            await queryRunner.query(`UPDATE "avatar_decoration" SET "url" = $1, "rawUrl" = $1 WHERE "id" = $2`, [rawUrl, decoration.id]);
        }
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        // プロキシURLは復元できないため何もしない (APIではpack時にプロキシURLを付与している)
    }
}
