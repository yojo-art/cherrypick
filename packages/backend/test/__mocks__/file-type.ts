/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';

function detectType(buffer: Uint8Array): { ext: string; mime: string } | undefined {
	if (buffer.length < 12) return undefined;

	// PNG / APNG
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
		// APNGはacTLチャンクを持つ (0x61 0x63 0x54 0x4C)
		const str = String.fromCharCode(...buffer.slice(0, Math.min(buffer.length, 1024)));
		if (str.includes('acTL')) {
			return { ext: 'apng', mime: 'image/apng' };
		}
		return { ext: 'png', mime: 'image/png' };
	}
	// JPEG
	if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
		return { ext: 'jpg', mime: 'image/jpeg' };
	}
	// GIF
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
		return { ext: 'gif', mime: 'image/gif' };
	}
	// WebP (RIFF....WEBP)
	if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
		buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
		return { ext: 'webp', mime: 'image/webp' };
	}
	// FLAC
	if (buffer[0] === 0x66 && buffer[1] === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43) {
		return { ext: 'flac', mime: 'audio/flac' };
	}
	// MP4 / M4A (ftyp box)
	if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
		// M4A has ftyp 'M4A ' or 'isom' etc.
		const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
		if (brand === 'M4A ') {
			return { ext: 'm4a', mime: 'audio/mp4' };
		}
		return { ext: 'mp4', mime: 'video/mp4' };
	}
	// WebM / Matroska (EBML header)
	if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
		// WebM is a subset of Matroska. Try to detect if it's audio-only later.
		// For simplicity, return video/webm (matches ffprobe behavior on most systems)
		return { ext: 'webm', mime: 'video/webm' };
	}
	// AAC (ADTS header: 0xFFF with layer=0)
	if (buffer[0] === 0xFF && (buffer[1] & 0xF6) === 0xF0) {
		return { ext: 'aac', mime: 'audio/aac' };
	}
	// MP3 (MPEG audio frame sync or ID3 tag)
	if ((buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) || (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)) {
		return { ext: 'mp3', mime: 'audio/mpeg' };
	}
	// WAV
	if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
		buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
		return { ext: 'wav', mime: 'audio/wav' };
	}
	// SVG (detect <?xml or <svg)
	const head = String.fromCharCode(...buffer.slice(0, 256)).toLowerCase();
	if (head.includes('<svg') || head.includes('<?xml')) {
		return { ext: 'svg', mime: 'image/svg+xml' };
	}

	return undefined;
}

export async function fileTypeFromBuffer(buffer: Uint8Array) {
	return detectType(buffer);
}

export async function fileTypeFromStream(stream: any) {
	return undefined;
}

export async function fileTypeFromFile(path: string) {
	try {
		const fd = fs.openSync(path, 'r');
		const buffer = Buffer.alloc(512);
		fs.readSync(fd, buffer, 0, 512, 0);
		fs.closeSync(fd);
		return detectType(buffer);
	} catch {
		return undefined;
	}
}
