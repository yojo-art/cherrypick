/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddAnnouncementReaction1787365448671 {
    name = 'AddAnnouncementReaction1787365448671'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "announcement_reaction" ("id" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "announcementId" character varying(32) NOT NULL, "reaction" character varying(260) NOT NULL, CONSTRAINT "PK_8219ba57f520f3b8b31d4bc7050" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1cc26178eab91d50906a264a8f" ON "announcement_reaction" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_60b8d991a4c39d2cc84e1d7f50" ON "announcement_reaction" ("announcementId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e3490d163f000c3651b46a1936" ON "announcement_reaction" ("userId", "announcementId", "reaction") `);
        await queryRunner.query(`CREATE INDEX "IDX_02f07dbb3c2554be3501fdc0c5" ON "announcement_reaction" ("userId", "announcementId") `);
        await queryRunner.query(`ALTER TABLE "announcement_reaction" ADD CONSTRAINT "FK_1cc26178eab91d50906a264a8fa" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "announcement_reaction" ADD CONSTRAINT "FK_60b8d991a4c39d2cc84e1d7f500" FOREIGN KEY ("announcementId") REFERENCES "announcement"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement_reaction" DROP CONSTRAINT "FK_60b8d991a4c39d2cc84e1d7f500"`);
        await queryRunner.query(`ALTER TABLE "announcement_reaction" DROP CONSTRAINT "FK_1cc26178eab91d50906a264a8fa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_02f07dbb3c2554be3501fdc0c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3490d163f000c3651b46a1936"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_60b8d991a4c39d2cc84e1d7f50"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1cc26178eab91d50906a264a8f"`);
        await queryRunner.query(`DROP TABLE "announcement_reaction"`);
    }
}
