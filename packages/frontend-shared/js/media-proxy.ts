/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';
import { query } from './url.js';

export class MediaProxy {
	private serverMetadata: Misskey.entities.MetaDetailed;
	private url: string;

	constructor(serverMetadata: Misskey.entities.MetaDetailed, url: string) {
		this.serverMetadata = serverMetadata;
		this.url = url;
	}

	public getProxiedImageUrl(imageUrl: string, type?: 'preview' | 'emoji' | 'avatar', mustOrigin = false, noFallback = false): string {
		const localProxy = `${this.url}/proxy`;
		let _imageUrl = imageUrl;

		if (imageUrl.startsWith(this.serverMetadata.mediaProxy + '/') || imageUrl.startsWith('/proxy/') || imageUrl.startsWith(localProxy + '/')) {
			// もう既にproxyっぽそうだったらurlを取り出す
			_imageUrl = (new URL(imageUrl)).searchParams.get('url') ?? imageUrl;
		}

		return `${mustOrigin ? localProxy : this.serverMetadata.mediaProxy}/${
			type === 'preview' ? 'preview.webp'
			: 'image.webp'
		}?${query({
			url: _imageUrl,
			...(!noFallback ? { 'fallback': '1' } : {}),
			...(type ? { [type]: '1' } : {}),
			...(mustOrigin ? { origin: '1' } : {}),
		})}`;
	}

	public getProxiedImageUrlNullable(imageUrl: string | null | undefined, type?: 'preview'): string | null {
		if (imageUrl == null) return null;
		return this.getProxiedImageUrl(imageUrl, type);
	}

	private resolveAbsoluteUrl(imageUrl: string): string {
		return imageUrl.startsWith('http') ? imageUrl : new URL(imageUrl, this.url).href;
	}

	private isLocalAvatarEndpoint(imageUrl: string): boolean {
		try {
			const u = new URL(this.resolveAbsoluteUrl(imageUrl));
			const base = new URL(this.url);

			if (u.origin !== base.origin) return false;

			return u.pathname.startsWith('/identicon/')
				|| u.pathname.startsWith('/avatar/')
				|| u.pathname.startsWith('/static-assets/');
		} catch {
			return false;
		}
	}

	public getAvatarUrl(avatarUrl: string, isStatic = false): string {
		if (this.isLocalAvatarEndpoint(avatarUrl)) {
			return this.resolveAbsoluteUrl(avatarUrl);
		}

		// /files/... など相対パスはプロキシ前に絶対URL化する
		const resolved = avatarUrl.startsWith('/')
			? this.resolveAbsoluteUrl(avatarUrl)
			: avatarUrl;

		if (isStatic) {
			return this.getStaticImageUrl(resolved);
		}

		return this.getProxiedImageUrl(resolved, 'avatar');
	}

	public getAvatarUrlNullable(avatarUrl: string | null | undefined, isStatic = false): string | null {
		if (avatarUrl == null) return null;
		return this.getAvatarUrl(avatarUrl, isStatic);
	}

	public getStaticImageUrl(baseUrl: string): string {
		const u = baseUrl.startsWith('http') ? new URL(baseUrl) : new URL(baseUrl, this.url);

		if (u.href.startsWith(`${this.url}/emoji/`)) {
			// もう既にemojiっぽそうだったらsearchParams付けるだけ
			u.searchParams.set('static', '1');
			return u.href;
		}

		if (u.href.startsWith(this.serverMetadata.mediaProxy + '/')) {
			// もう既にproxyっぽそうだったらsearchParams付けるだけ
			u.searchParams.set('static', '1');
			return u.href;
		}

		return `${this.serverMetadata.mediaProxy}/static.webp?${query({
			url: u.href,
			static: '1',
		})}`;
	}
}
