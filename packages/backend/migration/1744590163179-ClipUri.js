/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev, cherrypick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ClipUri1744590163179 {
    name = 'ClipUri1737723774548'

    async up(queryRunner) {
      await queryRunner.query(`ALTER TABLE "clip" ADD "uri" character varying(1024)`);
      await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7c7e874432dc11ddc477d74dd9" ON "clip" ("uri") `);
      await queryRunner.query(`ALTER TABLE "user" ADD "clipsUri" character varying(512)`);
    }

    async down(queryRunner) {
      await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "clipsUri"`);
      await queryRunner.query(`DROP INDEX "IDX_7c7e874432dc11ddc477d74dd9"`);
      await queryRunner.query(`ALTER TABLE "clip" DROP COLUMN "uri"`);
    }
}
