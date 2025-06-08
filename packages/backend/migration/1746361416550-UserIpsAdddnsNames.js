/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, noridev, cherrypick-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export class UserIpsAdddnsNames1746361416550 {
	name = 'UserIpsAdddnsNames1746361416550'
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_ip" ADD "dnsNames" character varying(512) array NOT NULL DEFAULT '{}'::varchar[]`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_ip" DROP COLUMN "dnsNames"`);
	}
}
