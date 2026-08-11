/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { nextTick, ref, defineAsyncComponent } from 'vue';
import getCaretCoordinates from 'textarea-caret';
import { toASCII } from 'punycode.js';
import type { Ref } from 'vue';
import type { CompleteInfo } from '@/components/MkAutocomplete.vue';
import { popup } from '@/os.js';

export type SuggestionType = 'user' | 'hashtag' | 'emoji' | 'mfmTag' | 'mfmParam' | 'htmlTag';

type CompleteProps<T extends keyof CompleteInfo> = {
	type: T;
	value: CompleteInfo[T]['payload'];
};

function isCompleteType<T extends keyof CompleteInfo>(expectedType: T, props: CompleteProps<keyof CompleteInfo>): props is CompleteProps<T> {
	return props.type === expectedType;
}

export class Autocomplete {
	private suggestion: {
		x: Ref<number>;
		y: Ref<number>;
		q: Ref<any>;
		close: () => void;
	} | null;
	private textarea: HTMLInputElement | HTMLTextAreaElement;
	private currentType: keyof CompleteInfo | undefined;
	private textRef: Ref<string | number | null>;
	private opening: boolean;
	private onlyType: SuggestionType[];

	private get text(): string {
		// Use raw .value to get the latest value
		// (Because v-model does not update while composition)
		return this.textarea.value;
	}

	private set text(text: string) {
		// Use ref value to notify other watchers
		// (Because .value setter never fires input/change events)
		this.textRef.value = text;
	}

	/**
	 * 対象のテキストエリアを与えてインスタンスを初期化します。
	 */
	constructor(textarea: HTMLInputElement | HTMLTextAreaElement, textRef: Ref<string | number | null>, onlyType?: SuggestionType[]) {
		//#region BIND
		this.onInput = this.onInput.bind(this);
		this.complete = this.complete.bind(this);
		this.close = this.close.bind(this);
		//#endregion

		this.suggestion = null;
		this.textarea = textarea;
		this.textRef = textRef;
		this.opening = false;
		this.onlyType = onlyType ?? ['user', 'hashtag', 'emoji', 'mfmTag', 'mfmParam', 'htmlTag'];

		this.attach();
	}

	/**
	 * このインスタンスにあるテキストエリアの入力のキャプチャを開始します。
	 */
	public attach() {
		this.textarea.addEventListener('input', this.onInput);
	}

	/**
	 * このインスタンスにあるテキストエリアの入力のキャプチャを解除します。
	 */
	public detach() {
		this.textarea.removeEventListener('input', this.onInput);
		this.close();
	}

	/**
	 * テキスト入力時
	 */
	private onInput() {
		const caretPos = Number(this.textarea.selectionStart);
		const text = this.text.substring(0, caretPos).split('\n').pop()!;

		// メンションに含められる文字のみで構成された、最も末尾にある文字列を抽出
		const mentionCandidate = text.split(/[^a-zA-Z0-9_@.\-]+/).pop()!;

		const mentionIndex = mentionCandidate.lastIndexOf('@');
		const hashtagIndex = text.lastIndexOf('#');
		const emojiIndex = text.lastIndexOf(':');
		const mfmTagIndex = text.lastIndexOf('$');
		const mfmParamIndex = text.lastIndexOf('.');
		const htmlTagIndex = text.lastIndexOf('<');

		const max = Math.max(
			mentionIndex,
			hashtagIndex,
			emojiIndex,
			mfmTagIndex,
			htmlTagIndex);

		if (max === -1) {
			this.close();
			return;
		}

		const afterLastMfmParam = text.split(/\$\[[a-zA-Z]+/).pop();

		const maybeMention = mentionIndex !== -1;
		const isHashtag = hashtagIndex !== -1;
		const isMfmParam = mfmParamIndex !== -1 && afterLastMfmParam?.includes('.') && !afterLastMfmParam.includes(' ');
		const isMfmTag = mfmTagIndex !== -1 && !isMfmParam;
		const isHtmlTag = htmlTagIndex !== -1;
		const isEmoji = emojiIndex !== -1 && text.split(/:[a-z0-9_+\-]+:/).pop()!.includes(':');
		// :ok:などを🆗にするたいおぷ
		const isEmojiCompleteToUnicode = !isEmoji && emojiIndex === text.length - 1;

		let opened = false;

		if (maybeMention && this.onlyType.includes('user')) {
			// ユーザのサジェスト中に@を入力すると、その位置から新たにユーザ名を取りなおそうとしてしまう
			// この動きはリモートユーザのサジェストを阻害するので、@を検知したらその位置よりも前の@を探し、
			// ホスト名を含むリモートのユーザ名を全て拾えるようにする
			const mentionIndexAlt = mentionCandidate.lastIndexOf('@', mentionIndex - 1);

			// @が連続している場合、1つ目を無視する
			const mentionIndexLeft = (mentionIndexAlt !== -1 && mentionIndexAlt !== mentionIndex - 1) ? mentionIndexAlt : mentionIndex;

			// メンションを構成する条件を満たしているか確認する
			const isMention = mentionIndexLeft === 0 || '_@.-'.includes(mentionCandidate[mentionIndexLeft - 1]);

			if (isMention) {
				const username = mentionCandidate.substring(mentionIndexLeft + 1);
				if (username !== '' && username.match(/^[a-zA-Z0-9_@.\-]+$/)) {
					this.open('user', username);
					opened = true;
				} else if (username === '') {
					this.open('user', null);
					opened = true;
				}
			}
		}

		if (isHashtag && !opened && this.onlyType.includes('hashtag')) {
			const hashtag = text.substring(hashtagIndex + 1);
			if (!hashtag.includes(' ')) {
				this.open('hashtag', hashtag);
				opened = true;
			}
		}

		if (isEmoji && !opened && this.onlyType.includes('emoji')) {
			const emoji = text.substring(emojiIndex + 1);
			if (!emoji.includes(' ')) {
				this.open('emoji', emoji);
				opened = true;
			}
		}

		if (isEmojiCompleteToUnicode && !opened && this.onlyType.includes('emoji')) {
			const emoji = text.substring(text.lastIndexOf(':', text.length - 2) + 1, text.length - 1);
			if (!emoji.includes(' ')) {
				this.open('emojiComplete', emoji);
				opened = true;
			}
		}

		if (isMfmTag && !opened && this.onlyType.includes('mfmTag')) {
			const mfmTag = text.substring(mfmTagIndex + 1);
			if (!mfmTag.includes(' ')) {
				this.open('mfmTag', mfmTag.replace('[', ''));
				opened = true;
			}
		}

		if (isMfmParam && !opened && this.onlyType.includes('mfmParam')) {
			const mfmParam = text.substring(mfmParamIndex + 1);
			if (!mfmParam.includes(' ')) {
				this.open('mfmParam', {
					tag: text.substring(mfmTagIndex + 2, mfmParamIndex),
					params: mfmParam.split(','),
				});
				opened = true;
			}
		}

		if (isHtmlTag && !opened && this.onlyType.includes('htmlTag')) {
			const htmlTag = text.substring(htmlTagIndex + 1);
			if (!htmlTag.includes(' ')) {
				this.open('htmlTag', htmlTag.replace('<', ''));
				opened = true;
			}
		}

		if (!opened) {
			this.close();
		}
	}

	/**
	 * サジェストを提示します。
	 */
	private async open<T extends keyof CompleteInfo>(type: T, q: CompleteInfo[T]['query']) {
		if (type !== this.currentType) {
			this.close();
		}
		if (this.opening) return;
		this.opening = true;
		this.currentType = type;

		//#region サジェストを表示すべき位置を計算
		const caretPosition = getCaretCoordinates(this.textarea, this.textarea.selectionStart ?? 0);

		const rect = this.textarea.getBoundingClientRect();

		const x = rect.left + caretPosition.left - this.textarea.scrollLeft;
		const y = rect.top + caretPosition.top - this.textarea.scrollTop;
		//#endregion

		if (this.suggestion) {
			this.suggestion.x.value = x;
			this.suggestion.y.value = y;
			this.suggestion.q.value = q;

			this.opening = false;
		} else {
			const _x = ref(x);
			const _y = ref(y);
			const _q = ref(q);

			const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkAutocomplete.vue')), {
				textarea: this.textarea,
				close: this.close,
				type: type,
				//@ts-expect-error popupは今のところジェネリック型のコンポーネントに対応していない
				q: _q,
				x: _x,
				y: _y,
			}, {
				done: (res) => {
					this.complete(res);
				},
			});

			this.suggestion = {
				q: _q,
				x: _x,
				y: _y,
				close: () => dispose(),
			};

			this.opening = false;
		}
	}

	/**
	 * サジェストを閉じます。
	 */
	private close() {
		if (this.suggestion == null) return;

		this.suggestion.close();
		this.suggestion = null;

		this.textarea.focus();
	}

	/**
	 * オートコンプリートする
	 */
	private complete<T extends keyof CompleteInfo>(props: CompleteProps<T>) {
		this.close();

		const caret = Number(this.textarea.selectionStart);

		if (isCompleteType('user', props)) {
			const source = this.text;

			const before = source.substring(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf('@'));
			const after = source.substring(caret);

			const acct = props.value.host === null ? props.value.username : `${props.value.username}@${toASCII(props.value.host)}`;

			// 挿入
			this.text = `${trimmedBefore}@${acct} ${after}`;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (acct.length + 2);
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (isCompleteType('hashtag', props)) {
			const source = this.text;

			const before = source.substring(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf('#'));
			const after = source.substring(caret);

			// 挿入
			this.text = `${trimmedBefore}#${props.value} ${after}`;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (props.value.length + 2);
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (isCompleteType('emoji', props)) {
			const source = this.text;

			const before = source.substring(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf(':'));
			const after = source.substring(caret);

			// 挿入
			this.text = trimmedBefore + props.value + after;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + props.value.length;
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (isCompleteType('emojiComplete', props)) {
			const source = this.text;

			const before = source.substring(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf(':', before.length - 2));
			const after = source.substring(caret);

			// 挿入
			this.text = trimmedBefore + props.value + after;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + props.value.length;
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (isCompleteType('mfmTag', props)) {
			const source = this.text;

			const before = source.substring(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf('$'));
			const after = source.substring(caret);

			// 挿入
			this.text = `${trimmedBefore}$[${props.value} ]${after}`;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (props.value.length + 3);
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (isCompleteType('mfmParam', props)) {
			const source = this.text;

			const before = source.substring(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf('.'));
			const after = source.substring(caret);

			// 挿入
			this.text = `${trimmedBefore}.${props.value}${after}`;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (props.value.length + 1);
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (isCompleteType('htmlTag', props)) {
			const source = this.text;

			const before = source.substring(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf('<'));
			const after = source.substring(caret);

			// 挿入
			if (props.value === 'bold') this.text = `${trimmedBefore}<b>${after}</b>`;
			if (props.value === 'strike') this.text = `${trimmedBefore}~~${after}~~`;
			if (props.value === 'italic') this.text = `${trimmedBefore}<i>${after}</i>`;
			if (props.value === 'small') this.text = `${trimmedBefore}<small>${after}</small>`;
			if (props.value === 'center') this.text = `${trimmedBefore}<center>${after}</center>`;
			if (props.value === 'plain') this.text = `${trimmedBefore}<plain>${after}</plain>`;
			if (props.value === 'inlinecode') this.text = trimmedBefore + '`' + after + '`';
			if (props.value === 'blockcode') this.text = trimmedBefore + '```' + '\n' + after + '\n' + '```';
			if (props.value === 'mathinline') this.text = trimmedBefore + '\\(' + after + '\\)';
			if (props.value === 'mathblock') this.text = trimmedBefore + '\\(' + after + '\\\\ \\)';

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (props.value.length + (
					props.value.includes('bold')
						? -1
						: props.value.includes('strike')
							?	-4
							: props.value.includes('italic')
								? -3
								: props.value.includes('small') || props.value.includes('center') || props.value.includes('plain')
									? 2
									: props.value.includes('inlinecode')
										? -9
										: props.value.includes('blockcode')
											? -5
											: props.value.includes('mathinline')
												? -8
												: props.value.includes('mathblock')
													? -7
													: 3
				));
				this.textarea.setSelectionRange(pos, pos);
			});
		}
	}
}
