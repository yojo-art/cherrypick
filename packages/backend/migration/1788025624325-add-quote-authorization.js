/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddQuoteAuthorization1788025624325 {
    name = 'AddQuoteAuthorization1788025624325'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "quote_authorization" ("id" character varying(32) NOT NULL, "noteId" character varying(32) NOT NULL, "token" character varying(255) NOT NULL, "interactingObject" character varying(4096) NOT NULL, "requestedById" character varying(32) NOT NULL, CONSTRAINT "PK_quote_authorization_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4be92a3964ab9ff71665581050" ON "quote_authorization" ("noteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9e03fb8baad3833fdd5a734e7e" ON "quote_authorization" ("token") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f0f2acdced9cb1927b8c69821f" ON "quote_authorization" ("noteId", "interactingObject") `);
        await queryRunner.query(`COMMENT ON COLUMN "quote_authorization"."noteId" IS 'The note ID.'`);
        await queryRunner.query(`COMMENT ON COLUMN "quote_authorization"."token" IS 'The QuoteAuthorization token.'`);
        await queryRunner.query(`COMMENT ON COLUMN "quote_authorization"."interactingObject" IS 'The URI of the object interacting with the note (the quoting object).'`);
        await queryRunner.query(`COMMENT ON COLUMN "quote_authorization"."requestedById" IS 'The ID of the requesting actor.'`);
        await queryRunner.query(`ALTER TABLE "quote_authorization" ADD CONSTRAINT "FK_4be92a3964ab9ff716655810508" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quote_authorization" ADD CONSTRAINT "FK_8797a257bb157608d50a8ba9f3d" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "quote_authorization" DROP CONSTRAINT "FK_8797a257bb157608d50a8ba9f3d"`);
        await queryRunner.query(`ALTER TABLE "quote_authorization" DROP CONSTRAINT "FK_4be92a3964ab9ff716655810508"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f0f2acdced9cb1927b8c69821f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e03fb8baad3833fdd5a734e7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4be92a3964ab9ff71665581050"`);
        await queryRunner.query(`DROP TABLE "quote_authorization"`);
    }
}
