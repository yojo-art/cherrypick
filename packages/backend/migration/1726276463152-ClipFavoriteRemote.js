/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class clipFavoriteRemote1726276463152 {
	name = 'clipFavoriteRemote1726276463152'

	async up(queryRunner) {
			await queryRunner.query(`CREATE TABLE "clip_favorite_remote" ("id" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "clipId" character varying(32) NOT NULL, "host" character varying(128) NOT NULL, CONSTRAINT "PK_5cfc42c4522f5253fd759947ec" PRIMARY KEY ("id"))`);
			await queryRunner.query(`CREATE INDEX "IDX_99c7abefa295355f5725ce959f" ON "clip_favorite_remote" ("userId") `);
			await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7ca9b4f7544e2b2fdf959bc9f4" ON "clip_favorite_remote" ("userId", "clipId","host") `);
			await queryRunner.query(`ALTER TABLE "clip_favorite_remote" ADD CONSTRAINT "FK_99c7abefa295355f5725ce959f1" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
			await queryRunner.query(`ALTER TABLE "clip_favorite_remote" DROP CONSTRAINT "FK_99c7abefa295355f5725ce959f1"`);
			await queryRunner.query(`DROP INDEX "public"."IDX_7ca9b4f7544e2b2fdf959bc9f4"`);
			await queryRunner.query(`DROP INDEX "public"."IDX_99c7abefa295355f5725ce959f"`);
			await queryRunner.query(`DROP TABLE "clip_favorite_remote"`);
	}
}
