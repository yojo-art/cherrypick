/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'cherrypick-js';

export interface PostFormProps {
	reply?: Misskey.entities.Note;
	renote?: Misskey.entities.Note;
	channel?: Misskey.entities.Channel; // TODO
	mention?: Misskey.entities.User;
	specified?: Misskey.entities.UserDetailed;
	initialText?: string;
	initialCw?: string;
	initialVisibility?: (typeof Misskey.noteVisibilities)[number];
	initialSearchableBy?: (typeof Misskey.noteSearchbility)[number];
	initialFiles?: Misskey.entities.DriveFile[];
	initialLocalOnly?: boolean;
	initialVisibleUsers?: Misskey.entities.UserDetailed[];
	initialNote?: Misskey.entities.Note & {
		isSchedule?: boolean,
	};
	instant?: boolean;
	updateMode?: boolean;
}
