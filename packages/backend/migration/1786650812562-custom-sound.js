/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class CustomSound1786650812562 {
    name = 'CustomSound1786650812562'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "custom_sound" ("id" character varying(32) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE, "name" character varying(256) NOT NULL, "url" character varying(1024) NOT NULL, "fileId" character varying(1024), CONSTRAINT "PK_custom_sound" PRIMARY KEY ("id"))`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "custom_sound"`);
    }
}
