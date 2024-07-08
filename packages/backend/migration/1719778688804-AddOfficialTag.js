/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev, cherrypick-project, kozakura, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddOfficialTag1719778688804 {
    name = 'AddOfficialTag1719778688804'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "official_tag" ("id" character varying(32) NOT NULL, "name" character varying(126) NOT NULL, "description" character varying(1024), "bannerUrl" character varying(1024), "priority" integer NOT NULL DEFAULT '100', CONSTRAINT "UQ_02b594db231f9de6b78672213ca" UNIQUE ("name"), CONSTRAINT "PK_035e22d7cca45df224154de8d8d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_02b594db231f9de6b78672213c" ON "official_tag" ("name") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "official_tag"`);
    }
}

