export async function importEmojiMeta(emoji, host:string) {
	try {
		const json = await(await fetch('https://' + host + '/api/emoji?name=' + emoji.name)).json();
		console.log(json);
		const from_json = (key) => {
			try {
				if (json[key]) {
					emoji[key] = json[key];
				}
			} catch {
				//一部失敗したら転送せず空欄のままにしておく
			}
		};
		from_json('license');
		from_json('aliases');
		from_json('category');
		from_json('isSensitive');
	} catch (err) {
		console.log(err);
		//リモートから取得に失敗
	}
	return emoji;
}
