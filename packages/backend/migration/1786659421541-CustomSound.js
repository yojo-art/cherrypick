/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class CustomSound1786659421541 {
    name = 'CustomSound1786659421541';

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "custom_sound" ("id" character varying(32) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE, "name" character varying(256) NOT NULL, "fileId" character varying(32), CONSTRAINT "PK_6354a679f9398db001ffa6e083e" PRIMARY KEY ("id"))`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "custom_sound"`);
    }
};
