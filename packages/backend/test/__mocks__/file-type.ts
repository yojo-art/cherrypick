export async function fileTypeFromBuffer(buffer: Uint8Array) {
	// PNG magic bytes
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
		return { ext: 'png', mime: 'image/png' };
	}
	// JPEG magic bytes
	if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
		return { ext: 'jpg', mime: 'image/jpeg' };
	}
	// GIF magic bytes
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
		return { ext: 'gif', mime: 'image/gif' };
	}
	// WebP
	if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57) {
		return { ext: 'webp', mime: 'image/webp' };
	}
	return undefined;
}

export async function fileTypeFromStream(stream: any) {
	return undefined;
}

export async function fileTypeFromFile(path: string) {
	return undefined;
}
