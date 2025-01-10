/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev and cherryPick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class EmojiInfoFederation1735299834220 {
    async up(queryRunner) {
			await queryRunner.query(`ALTER TABLE "emoji" ADD "usageInfo" character varying(512)`);
			await queryRunner.query(`ALTER TABLE "emoji" ADD "description" character varying(512)`);
			await queryRunner.query(`ALTER TABLE "emoji" ADD "author" character varying(128)`);
			await queryRunner.query(`ALTER TABLE "emoji" ADD "isBasedOn" character varying(1024)`);
			await queryRunner.query(`CREATE TYPE "public"."emoji_copypermission_enum" AS ENUM('allow', 'deny', 'conditional', 'null')`);
			await queryRunner.query(`ALTER TABLE "emoji" ADD "copyPermission" "public"."emoji_copypermission_enum"`);
    }

    async down(queryRunner) {
			await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "copyPermission"`);
			await queryRunner.query(`DROP TYPE "public"."emoji_copypermission_enum"`);
			await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "isBasedOn"`);
			await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "author"`);
			await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "description"`);
			await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "usageInfo"`);
    }
}
