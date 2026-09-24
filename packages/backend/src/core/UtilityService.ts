/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URL, domainToASCII } from 'node:url';
import { Inject, Injectable } from '@nestjs/common';
import ipaddr from 'ipaddr.js';
import RE2 from 're2';
import semver from 'semver';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { MiMeta, SoftwareSuspension } from '@/models/Meta.js';
import { MiInstance } from '@/models/Instance.js';

@Injectable()
export class UtilityService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,
	) {
	}

	@bindThis
	public getFullApAccount(username: string, host: string | null): string {
		return host ? `${username}@${this.toPuny(host)}` : `${username}@${this.toPuny(this.config.host)}`;
	}

	@bindThis
	public isSelfHost(host: string | null): boolean {
		if (host == null) return true;
		return this.toPuny(this.config.host) === this.toPuny(host);
	}

	@bindThis
	public isUriLocal(uri: string): boolean {
		return this.punyHost(uri) === this.toPuny(this.config.host);
	}

	@bindThis
	public includesSelfHost(ids: string[]): boolean {
		return ids.some(id => this.isUriLocal(id));
	}

	// メールアドレスのバリデーションを行う
	// https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
	@bindThis
	public validateEmailFormat(email: string): boolean {
		const regexp = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
		return regexp.test(email);
	}

	@bindThis
	public isBlockedHost(blockedHosts: string[], host: string | null): boolean {
		if (host == null) return false;
		return blockedHosts.some(x => `.${host.toLowerCase()}`.endsWith(`.${x}`));
	}

	/**
	 * `host` 部分にパス・クエリ・フラグメント・ユーザー情報が混入していないか、
	 * プライベート / ループバック / リンクローカル等の IP リテラルでないかを検証する。
	 * `config.allowedPrivateNetworks` に含まれる範囲は許可する。
	 */
	@bindThis
	public isValidRemoteHost(host: string): boolean {
		let url: URL;
		try {
			url = new URL('https://' + host);
		} catch {
			return false;
		}

		if (url.username !== '' || url.password !== '' || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
			return false;
		}

		let hostname = url.hostname;
		if (hostname.startsWith('[') && hostname.endsWith(']')) {
			hostname = hostname.slice(1, -1);
		}

		if (hostname === '') return false;

		if (ipaddr.isValid(hostname)) {
			const parsedIp = ipaddr.parse(hostname);

			for (const net of this.config.allowedPrivateNetworks ?? []) {
				const cidr = ipaddr.parseCIDR(net);
				if (cidr[0].kind() === parsedIp.kind() && parsedIp.match(cidr)) {
					return true;
				}
			}

			return parsedIp.range() === 'unicast';
		}

		return true;
	}

	@bindThis
	public isSilencedHost(silencedHosts: string[] | undefined, host: string | null): boolean {
		if (!silencedHosts || host == null) return false;
		return silencedHosts.some(x => `.${host.toLowerCase()}`.endsWith(`.${x}`));
	}

	@bindThis
	public isMediaSilencedHost(silencedHosts: string[] | undefined, host: string | null): boolean {
		if (!silencedHosts || host == null) return false;
		return silencedHosts.some(x => host.toLowerCase() === x);
	}

	@bindThis
	public concatNoteContentsForKeyWordCheck(content: {
		cw?: string | null;
		text?: string | null;
		pollChoices?: string[] | null;
		others?: string[] | null;
	}): string {
		/**
		 * ノートの内容を結合してキーワードチェック用の文字列を生成する
		 * cwとtextは内容が繋がっているかもしれないので間に何も入れずにチェックする
		 */
		return `${content.cw ?? ''}${content.text ?? ''}\n${(content.pollChoices ?? []).join('\n')}\n${(content.others ?? []).join('\n')}`;
	}

	@bindThis
	public isKeyWordIncluded(text: string, keyWords: string[]): boolean {
		if (keyWords.length === 0) return false;
		if (text === '') return false;

		const regexpregexp = /^\/(.+)\/(.*)$/;

		const matched = keyWords.some(filter => {
			// represents RegExp
			const regexp = filter.match(regexpregexp);
			// This should never happen due to input sanitisation.
			if (!regexp) {
				const words = filter.split(' ');
				return words.every(keyword => text.includes(keyword));
			}
			try {
				// TODO: RE2インスタンスをキャッシュ
				return new RE2(regexp[1], regexp[2]).test(text);
			} catch (_) {
				// This should never happen due to input sanitisation.
				return false;
			}
		});

		return matched;
	}

	@bindThis
	public extractDbHost(uri: string): string {
		const url = new URL(uri);
		return this.toPuny(url.host);
	}

	@bindThis
	public toPuny(host: string): string {
		return domainToASCII(host.toLowerCase());
	}

	@bindThis
	public toPunyNullable(host: string | null | undefined): string | null {
		if (host == null) return null;
		return domainToASCII(host.toLowerCase());
	}

	@bindThis
	public punyHost(url: string): string {
		const urlObj = new URL(url);
		const host = `${this.toPuny(urlObj.hostname)}${urlObj.port.length > 0 ? ':' + urlObj.port : ''}`;
		return host;
	}

	@bindThis
	public isFederationAllowedHost(host: string): boolean {
		if (this.isSelfHost(host)) return true;
		if (this.meta.federation === 'none') return false;
		if (this.meta.federation === 'specified' && !this.meta.federationHosts.some(x => `.${host.toLowerCase()}`.endsWith(`.${x}`))) return false;
		if (this.isBlockedHost(this.meta.blockedHosts, host)) return false;

		return true;
	}

	@bindThis
	public isFederationAllowedUri(uri: string): boolean {
		const host = this.extractDbHost(uri);
		return this.isFederationAllowedHost(host);
	}

	@bindThis
	public isDeliverSuspendedSoftware(software: Pick<MiInstance, 'softwareName' | 'softwareVersion'>): SoftwareSuspension | undefined {
		return this.isSoftwareSuspended(this.meta.deliverSuspendedSoftware, software);
	}

	@bindThis
	public isReceiveSuspendedSoftware(software: Pick<MiInstance, 'softwareName' | 'softwareVersion'>): SoftwareSuspension | undefined {
		return this.isSoftwareSuspended(this.meta.receiveSuspendedSoftware, software);
	}

	@bindThis
	public isSoftwareSuspended(suspendedSoftware: SoftwareSuspension[], software: Pick<MiInstance, 'softwareName' | 'softwareVersion'>): SoftwareSuspension | undefined {
		if (software.softwareName == null) return undefined;
		if (software.softwareVersion == null) {
			// software version is null; suspend iff versionRange is *
			return suspendedSoftware.find(x =>
				x.software === software.softwareName
				&& x.versionRange.trim() === '*');
		} else {
			const softwareVersion = software.softwareVersion;
			return suspendedSoftware.find(x =>
				x.software === software.softwareName
				&& semver.satisfies(softwareVersion, x.versionRange, { includePrerelease: true }));
		}
	}
}
