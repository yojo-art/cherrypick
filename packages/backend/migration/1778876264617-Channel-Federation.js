/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export class ChannelFederation1778876264617 {
    name = 'ChannelFederation1778876264617'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "channel" ADD "username" character varying(128)`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."username" IS 'The username of the Channel.'`);
        await queryRunner.query(`ALTER TABLE "channel" ADD "usernameLower" character varying(128)`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."usernameLower" IS 'The username (lowercased) of the Channel.'`);
        await queryRunner.query(`ALTER TABLE "channel" ADD "followersCount" integer NOT NULL DEFAULT '-1'`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."followersCount" IS 'The count of followers.'`);
        await queryRunner.query(`CREATE INDEX "IDX_260971d2e802c4ec79952830b0" ON "channel" ("usernameLower") `);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_260971d2e802c4ec79952830b0"`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."followersCount" IS 'The count of followers.'`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "followersCount"`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."usernameLower" IS 'The username (lowercased) of the Channel.'`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "usernameLower"`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."username" IS 'The username of the Channel.'`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "username"`);
    }
}
