/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { reactive, ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import { v4 as uuid } from 'uuid';
import { readAndCompressImage } from '@misskey-dev/browser-image-resizer';
import { getCompressionConfig } from './upload/compress-config.js';
import { defaultStore } from '@/store.js';
import { apiUrl } from '@/config.js';
import { $i } from '@/account.js';
import { alert } from '@/os.js';
import { i18n } from '@/i18n.js';

type Uploading = {
	id: string;
	name: string;
	progressMax: number | undefined;
	progressValue: number | undefined;
	img: string;
};
export const uploads = ref<Uploading[]>([]);

const mimeTypeMap = {
	'image/webp': 'webp',
	'image/jpeg': 'jpg',
	'image/png': 'png',
} as const;

export function uploadFile(
	file: File,
	folder?: any,
	name?: string,
	keepOriginal: boolean = defaultStore.state.keepOriginalUploading,
): Promise<Misskey.entities.DriveFile> {
	if ($i == null) throw new Error('Not logged in');

	if (folder && typeof folder === 'object') folder = folder.id;

	if (file.size > 20 * 1024 * 1024) {
		const id = uuid();
		const filename = name ?? file.name ?? 'untitled';
		const extension = filename.split('.').length > 1 ? '.' + filename.split('.').pop() : '';
		const ctx = reactive<Uploading>({
			id,
			name: defaultStore.state.keepOriginalFilename ? filename : id + extension,
			progressMax: undefined,
			progressValue: undefined,
			img: '',
		});

		uploads.value.push(ctx);

		return new Promise(async (resolve) => {
			console.log(file);
			if ($i == null) throw new Error('Not logged in');
			const driveFile = await uploadMultipart(
				file,
				$i.token,
				false,
				folder,
				null,
				true,
				ctx,
			);
			uploads.value = uploads.value.filter(x => x.id !== id);
			resolve(driveFile);
		});
	}

	return new Promise(async (resolve, reject) => {
		const id = uuid();

		const reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			const filename = name ?? file.name ?? 'untitled';
			const extension = filename.split('.').length > 1 ? '.' + filename.split('.').pop() : '';
			const ctx = reactive<Uploading>({
				id,
				name: defaultStore.state.keepOriginalFilename ? filename : id + extension,
				progressMax: undefined,
				progressValue: undefined,
				img: window.URL.createObjectURL(file),
			});

			uploads.value.push(ctx);

			if ($i == null) throw new Error('Not logged in');

			const config = !keepOriginal ? await getCompressionConfig(file) : undefined;
			let resizedImage: Blob | undefined;
			if (config) {
				try {
					const resized = await readAndCompressImage(file, config);
					if (resized.size < file.size || file.type === 'image/webp') {
						// The compression may not always reduce the file size
						// (and WebP is not browser safe yet)
						resizedImage = resized;
					}
					if (_DEV_) {
						const saved = ((1 - resized.size / file.size) * 100).toFixed(2);
						console.log(`Image compression: before ${file.size} bytes, after ${resized.size} bytes, saved ${saved}%`);
					}

					ctx.name = file.type !== config.mimeType ? `${ctx.name}.${mimeTypeMap[config.mimeType]}` : ctx.name;
				} catch (err) {
					console.error('Failed to resize image', err);
				}
			}

			const formData = new FormData();
			formData.append('i', $i.token);
			formData.append('force', 'true');
			formData.append('file', resizedImage ?? file);
			formData.append('name', ctx.name);
			if (folder) formData.append('folderId', folder);

			const xhr = new XMLHttpRequest();
			xhr.open('POST', apiUrl + '/drive/files/create', true);
			xhr.onload = ((ev: ProgressEvent<XMLHttpRequest>) => {
				if (xhr.status !== 200 || ev.target == null || ev.target.response == null) {
					// TODO: 消すのではなくて(ネットワーク的なエラーなら)再送できるようにしたい
					uploads.value = uploads.value.filter(x => x.id !== id);

					if (xhr.status === 413) {
						alert({
							type: 'error',
							title: i18n.ts.failedToUpload,
							text: i18n.ts.cannotUploadBecauseExceedsFileSizeLimit,
						});
					} else if (ev.target?.response) {
						const res = JSON.parse(ev.target.response);
						if (res.error?.id === 'bec5bd69-fba3-43c9-b4fb-2894b66ad5d2') {
							alert({
								type: 'error',
								title: i18n.ts.failedToUpload,
								text: i18n.ts.cannotUploadBecauseInappropriate,
							});
						} else if (res.error?.id === 'd08dbc37-a6a9-463a-8c47-96c32ab5f064') {
							alert({
								type: 'error',
								title: i18n.ts.failedToUpload,
								text: i18n.ts.cannotUploadBecauseNoFreeSpace,
							});
						} else {
							alert({
								type: 'error',
								title: i18n.ts.failedToUpload,
								text: `${res.error?.message}\n${res.error?.code}\n${res.error?.id}`,
							});
						}
					} else {
						alert({
							type: 'error',
							title: 'Failed to upload',
							text: `${JSON.stringify(ev.target?.response)}, ${JSON.stringify(xhr.response)}`,
						});
					}

					reject();
					return;
				}

				const driveFile = JSON.parse(ev.target.response);

				resolve(driveFile);

				uploads.value = uploads.value.filter(x => x.id !== id);
			}) as (ev: ProgressEvent<EventTarget>) => any;

			xhr.upload.onprogress = ev => {
				if (ev.lengthComputable) {
					ctx.progressMax = ev.total;
					ctx.progressValue = ev.loaded;
				}
			};

			xhr.send(formData);
		};
		reader.readAsArrayBuffer(file);
	});
}

async function uploadMultipart(
	upload_target:Blob,
	i:string,
	isSensitive:boolean,
	folderId:string | null,
	comment:string|null,
	force:boolean,
	ctx: {
		id: string;
		name: string;
		progressMax: number | undefined;
		progressValue: number | undefined;
		img: string;
	},
) {
	const request_split_size = 10 * 1024 * 1024;//10MB
	const content_length = upload_target.size;
	const preflight_status = await fetch(apiUrl + '/drive/files/multipart/preflight', {
		method: 'POST',
		body: JSON.stringify({
			content_length,
			i,
			folderId,
			name: ctx.name,
			isSensitive,
			comment,
			force,
		}),
	});
	const json = await preflight_status.json();
	const allow_upload = json.allow_upload;//この要求が承認されたか否か。trueが返ってきた後で取り消す場合はabortリクエストする
	if (!allow_upload) return;
	const min_split_size = json.min_split_size;
	const max_split_size = json.max_split_size;
	let split_size = request_split_size;
	if (split_size > max_split_size) {
		split_size = max_split_size;
	}
	if (split_size < min_split_size) {
		split_size = min_split_size;
	}
	const session_id = json.session_id;//upload-serviceサーバーが処理を管理するためのID。S3側とは無関係に振られる
	let part_number = -1;//part_numberは0から振る
	let offset = 0;//ファイルのどこから送信するべきか
	ctx.progressMax = content_length;
	while (offset < content_length) {
		part_number++;
		const part_blob = upload_target.slice(offset, offset + split_size);
		const upload_status_code:number = await new Promise((resolve) => {
			const xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4) {
					resolve(xhr.status);
				}
			};
			xhr.open('POST', apiUrl + '/drive/files/multipart/partial-upload?partnumber=' + part_number, true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + session_id);
			xhr.upload.onprogress = ev => {
				if (ev.lengthComputable) {
					ctx.progressValue = offset + ev.loaded;
				}
			};
			xhr.send(part_blob);
		});
		if (upload_status_code < 200 || upload_status_code >= 300) {
			const wip = await fetch(apiUrl + '/drive/files/multipart/abort', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer ' + session_id,
				},
				body: JSON.stringify({
					part_length: part_number,
					i,
				}),
			});
			alert({
				type: 'error',
				title: i18n.ts.failedToUpload,
				text: `multipart part${part_number}`,
			});
			break;
		}
		offset += split_size;
	}
	const drive_file = await fetch(apiUrl + '/drive/files/multipart/finish-upload', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer ' + session_id,
		},
		body: JSON.stringify({
			i,
		}),
	});
	return await drive_file.json();
}
