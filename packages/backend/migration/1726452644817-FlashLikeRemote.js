/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class flashLikeRemote1726452644817 {
	name = 'flashLikeRemote1726452644817'

	async up(queryRunner) {
			await queryRunner.query(`CREATE TABLE "flash_like_remote" ("id" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "flashId" character varying(32) NOT NULL, "host" character varying(128) NOT NULL, "authorId" character varying(32) NOT NULL, CONSTRAINT "PK_840a074b84bd1663054e020e43" PRIMARY KEY ("id"))`);
			await queryRunner.query(`CREATE INDEX "IDX_ade312aad367a2902ed415abbc" ON "flash_like_remote" ("userId") `);
			await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f7c8a8fd916efed73a05bc1ea0" ON "flash_like_remote" ("userId", "flashId","host") `);
			await queryRunner.query(`ALTER TABLE "flash_like_remote" ADD CONSTRAINT "FK_8c14417c4cc57f04b4d7376707a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
			await queryRunner.query(`ALTER TABLE "flash_like_remote" ADD CONSTRAINT "FK_75f247337676468f6bd6f22eb24" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
			await queryRunner.query(`ALTER TABLE "flash_like_remote" DROP CONSTRAINT "FK_75f247337676468f6bd6f22eb24"`);
			await queryRunner.query(`ALTER TABLE "flash_like_remote" DROP CONSTRAINT "FK_8c14417c4cc57f04b4d7376707a"`);
			await queryRunner.query(`DROP INDEX "public"."IDX_f7c8a8fd916efed73a05bc1ea0"`);
			await queryRunner.query(`DROP INDEX "public"."IDX_ade312aad367a2902ed415abbc"`);
			await queryRunner.query(`DROP TABLE "flash_like_remote"`);
	}
}
