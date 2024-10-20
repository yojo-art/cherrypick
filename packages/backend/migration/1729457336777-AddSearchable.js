/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export class AddSearchable1729457336777 {
	name = 'AddSearchable1729457336777';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user" ADD "searchableBy" "public"."user_searchableby_enum"');
		await queryRunner.query('CREATE TYPE "public"."note_searchableby_enum" AS ENUM(\'public\', \'followersAndReacted\', \'reactedOnly\', \'private\')');
		await queryRunner.query('ALTER TABLE "note" ADD "searchableBy" "public"."note_searchableby_enum"');
		await queryRunner.query('CREATE INDEX "IDX_3932b42da4cf440203d2013649" ON "user" ("searchableBy") ');
			    }

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "note" DROP COLUMN "searchableBy"');
		await queryRunner.query('DROP TYPE "public"."note_searchableby_enum"');
		await queryRunner.query('ALTER TABLE "user" DROP COLUMN "searchableBy"');
	}
};
