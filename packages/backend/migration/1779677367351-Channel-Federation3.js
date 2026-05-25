/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export class ChannelFederation31779677367351 {
    name = 'ChannelFederation31779677367351'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_89bccacdff1bc0e2dbcdc839b7"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_89bccacdff1bc0e2dbcdc839b7" ON "channel" ("actorId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c2877c905ce84099012e1f6aaf" ON "user" ("channelId") `);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_c2877c905ce84099012e1f6aaf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_89bccacdff1bc0e2dbcdc839b7"`);
        await queryRunner.query(`CREATE INDEX "IDX_89bccacdff1bc0e2dbcdc839b7" ON "channel" ("actorId") `);
    }
}
