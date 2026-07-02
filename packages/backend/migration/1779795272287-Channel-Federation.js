/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export class ChannelFederation1779795272287 {
    name = 'ChannelFederation1779795272287'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "channel" ADD "host" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "channel" ADD "actorId" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "channel" ADD CONSTRAINT "UQ_89bccacdff1bc0e2dbcdc839b72" UNIQUE ("actorId")`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."actorId" IS 'Ap Actor ID.'`);
        await queryRunner.query(`ALTER TABLE "user" ADD "channelId" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_c2877c905ce84099012e1f6aafc" UNIQUE ("channelId")`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."channelId" IS 'Whether the User is channel.'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_89bccacdff1bc0e2dbcdc839b7" ON "channel" ("actorId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c2877c905ce84099012e1f6aaf" ON "user" ("channelId") `);
        await queryRunner.query(`ALTER TABLE "channel" ADD CONSTRAINT "FK_89bccacdff1bc0e2dbcdc839b72" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_c2877c905ce84099012e1f6aafc" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c2877c905ce84099012e1f6aafc"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP CONSTRAINT "FK_89bccacdff1bc0e2dbcdc839b72"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c2877c905ce84099012e1f6aaf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_89bccacdff1bc0e2dbcdc839b7"`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."channelId" IS 'Whether the User is channel.'`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_c2877c905ce84099012e1f6aafc"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "channelId"`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."actorId" IS 'Ap Actor ID.'`);
        await queryRunner.query(`ALTER TABLE "channel" DROP CONSTRAINT "UQ_89bccacdff1bc0e2dbcdc839b72"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "actorId"`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "host"`);
    }
}
