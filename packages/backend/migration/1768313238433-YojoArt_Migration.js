/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev and cherryPick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class YojoArtMigration1768313238433 {
    name = 'YojoArtMigration1768313238433'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" DROP CONSTRAINT "FK_99c7abefa295355f5725ce959f1"`);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" DROP CONSTRAINT "FK_e306e7566fd6101e9767702980c"`);
        await queryRunner.query(`ALTER TABLE "flash_like_remote" DROP CONSTRAINT "FK_8c14417c4cc57f04b4d7376707a"`);
        await queryRunner.query(`ALTER TABLE "flash_like_remote" DROP CONSTRAINT "FK_75f247337676468f6bd6f22eb24"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c7e874432dc11ddc477d74dd9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_99c7abefa295355f5725ce959f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7ca9b4f7544e2b2fdf959bc9f4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ade312aad367a2902ed415abbc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7c8a8fd916efed73a05bc1ea0"`);
        await queryRunner.query(`CREATE TYPE "public"."note_draft_searchableby_enum" AS ENUM('public', 'followersAndReacted', 'reactedOnly', 'private')`);
        await queryRunner.query(`ALTER TABLE "note_draft" ADD "searchableBy" "public"."note_draft_searchableby_enum"`);
        await queryRunner.query(`ALTER TABLE "channel" ALTER COLUMN "color" SET DEFAULT '#86b300'`);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" ALTER COLUMN "authorId" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_e74020bacf28b80bed9ace40d7" ON "user" ("isIndexable") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0523a7e1a5be183ef05e10b833" ON "clip" ("uri") `);
        await queryRunner.query(`CREATE INDEX "IDX_3240e1047771eef1d7cbdaf545" ON "clip_favorite_remote" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1ba49939ff04cb1f4b2522a98e" ON "clip_favorite_remote" ("userId", "clipId", "host") `);
        await queryRunner.query(`CREATE INDEX "IDX_b032d7c6692ddab6c50c068198" ON "flash_like_remote" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bf063251bfe6c91824f866b2dc" ON "flash_like_remote" ("userId", "flashId", "host") `);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" ADD CONSTRAINT "FK_3240e1047771eef1d7cbdaf5457" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" ADD CONSTRAINT "FK_0dde8aaf9335ca74cd37ab503f2" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "flash_like_remote" ADD CONSTRAINT "FK_b032d7c6692ddab6c50c0681984" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "flash_like_remote" ADD CONSTRAINT "FK_9529c5fe87057b115b8f755021b" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reversi_game" ALTER COLUMN "federationId" TYPE character varying(36)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "flash_like_remote" DROP CONSTRAINT "FK_9529c5fe87057b115b8f755021b"`);
        await queryRunner.query(`ALTER TABLE "flash_like_remote" DROP CONSTRAINT "FK_b032d7c6692ddab6c50c0681984"`);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" DROP CONSTRAINT "FK_0dde8aaf9335ca74cd37ab503f2"`);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" DROP CONSTRAINT "FK_3240e1047771eef1d7cbdaf5457"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf063251bfe6c91824f866b2dc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b032d7c6692ddab6c50c068198"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1ba49939ff04cb1f4b2522a98e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3240e1047771eef1d7cbdaf545"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0523a7e1a5be183ef05e10b833"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e74020bacf28b80bed9ace40d7"`);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" ALTER COLUMN "authorId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "channel" ALTER COLUMN "color" SET DEFAULT '#ffbcdc'`);
        await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "searchableBy"`);
        await queryRunner.query(`DROP TYPE "public"."note_draft_searchableby_enum"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f7c8a8fd916efed73a05bc1ea0" ON "flash_like_remote" ("flashId", "host", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ade312aad367a2902ed415abbc" ON "flash_like_remote" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7ca9b4f7544e2b2fdf959bc9f4" ON "clip_favorite_remote" ("clipId", "host", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_99c7abefa295355f5725ce959f" ON "clip_favorite_remote" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7c7e874432dc11ddc477d74dd9" ON "clip" ("uri") `);
        await queryRunner.query(`ALTER TABLE "flash_like_remote" ADD CONSTRAINT "FK_75f247337676468f6bd6f22eb24" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "flash_like_remote" ADD CONSTRAINT "FK_8c14417c4cc57f04b4d7376707a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" ADD CONSTRAINT "FK_e306e7566fd6101e9767702980c" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clip_favorite_remote" ADD CONSTRAINT "FK_99c7abefa295355f5725ce959f1" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reversi_game" ALTER COLUMN "federationId" TYPE character varying`);
    }
}
