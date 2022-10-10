/*
	content_scripts / Chrome拡張どちらも対応できるように変更
*/
(() => {
	const inChromeExtension = location.protocol === 'chrome-extension:';
	const isBackgroundPage = inChromeExtension && !!this?.registration?.scope;

	if (isBackgroundPage) {
		chrome.runtime.onMessage.addListener((request, sender) => {
			if (request.method === 'search') {
				functions.search(request.text, sender.tab.id);
			} else if (request.method === 'copy') {
				functions.copy(request.text);
			} else if (request.method === 'open') {
				functions.open(request.text, {
					currentTabId: sender.tab.id,
				});
			} else if (request.method === 'open-background') {
				functions.open(request.text, {
					currentTabId: sender.tab.id,
					active: false,
				});
			}
		});
		// 読み込み/更新時に既存のタブで実行する
		chrome.tabs.query({
			url: [
				'file:///*',
				'*://*/*',
			],
		}, tabs => {
			tabs.forEach(tab => {
				chrome.scripting.executeScript({
					files: [
						'textDrag2Action.js',
					],
					target: {
						tabId: tab.id,
						allFrames: true,
					},
				}, result => {
					if (typeof result === 'undefined') {
						console.info('ページが読み込まれていません', tab);
					} else {
						chrome.scripting.insertCSS({
							files: [
								'textDrag2Action.css',
							],
							target: {
								tabId: tab.id,
								allFrames: true,
							},
						});
					}
				});
			});
		});
	} else {
		let slectedText = '';
		let startPositionX = 0;
		let startPositionY = 0;

		document.addEventListener('dragover', evt => {
			evt.preventDefault();
		});

		document.addEventListener('dragstart', evt => {
			slectedText = window.getSelection().toString();
			startPositionX = evt.screenX;
			startPositionY = evt.screenY;
		});

		document.addEventListener('dragend', evt => {
			if (evt.clientX < 0
				|| evt.clientY < 0
				|| window.innerWidth < evt.clientX
				|| window.innerHeight < evt.clientY) {
				// ウィンドウ外
				return;
			}
			const movedDistanceToRight = evt.screenX - startPositionX;
			const movedDistanceToBottom = evt.screenY - startPositionY;

			const movedHorizontalDistance = Math.abs(movedDistanceToRight);
			const movedVerticalDistance = Math.abs(movedDistanceToBottom);

			if (movedVerticalDistance > movedHorizontalDistance) {
				// （水平方向より）垂直方向へ大きく動いた
				const target = evt.target;
				let anchor;
				if (movedDistanceToBottom > 0) {
					// 下へ動いた
					if (movedDistanceToBottom < 50) return;
					if (target instanceof Text) {
						// <a>内を選択して選択部分をドラッグした場合、targetはTextのNodeになる
						action('search', slectedText);
					} else if ((anchor = getAnchor(target)) && (anchor = checkAnchor(anchor))) {
						action('open', anchor.href);
					} else if (target.tagName?.toUpperCase() === 'IMG') {
						action('open', target.src);
					} else if (/\S/.test(slectedText)) {
						action('search', slectedText);
					}
				} else {
					// 上へ動いた
					if ((anchor = getAnchor(target)) && (anchor = checkAnchor(anchor))) {
						action('open-background', anchor.href);
					}
				}
			} else {
				if (movedDistanceToRight > 0) {
					// 右へ動いた
					if (movedDistanceToRight < 50) return;
					const target = evt.target;
					let anchor;
					if (target instanceof Text) {
						action('copy', slectedText);
					} else if ((anchor = getAnchor(target))) {
						action('copy', anchor.href);
					} else if (target.tagName?.toUpperCase() === 'IMG') {
						if (target.src.startsWith('data:image/')) {
							// Data URIは長すぎてコピーすると重いので何もしない
							return;
						}
						action('copy', target.src);
					} else if (/\S/.test(slectedText)) {
						action('copy', slectedText);
					}
				}
			}
		});

		const getAnchor = elem => {
			while(elem) {
				if (elem.tagName?.toUpperCase() === 'A' || elem.tagName?.toUpperCase() === 'AREA') {
					return elem;
				}
				elem = elem.parentNode;
			}
			return null;
		};

		const checkAnchor = anchor => {
			const href = anchor.getAttribute('href');
			if (href === '#') return null;
			if (/^\s*javascript\s*:/i.test(href)) return null;
			return anchor;
		};

		const action = (method, text) => {
			if (text === '') return;
			if (inChromeExtension) {
				if (method === 'search') {
					functions.search(text);
				} else if (method === 'copy') {
					functions.copy(text);
				} else if (method === 'open') {
					functions.open(text);
				} else if (method === 'open-background') {
					functions.open(text, {
						active: false,
					});
				}
			} else {
				// 拡張が再読み込みされた場合エラーになるので捕捉
				try {
					chrome.runtime.sendMessage({
						method,
						text,
					});
				} catch (e) {}
			}
		};
	}
	const functions = {};
	if (inChromeExtension) {
		const search = (text, currentTabId) => {
			const queryObject = {
				hl: 'ja',
				complete: 0,
				q: text,
			};
			const querys = Object.entries(queryObject).map(([key, value]) => {
				return `${key}=${encodeURIComponent(value)}`;
			});
			const queryString = querys.join('&');
			const url = `https://www.google.co.jp/search?${queryString}`;

			open(url, {currentTabId});
		};
		const open = (url, {
			currentTabId,
			active = true,
		} = {}) => {
			if (typeof currentTabId !== 'number') {
				chrome.tabs.getCurrent(tab => {
					chrome.tabs.create({
						url,
						active: !!active,
						openerTabId: tab.id,
					});
				});
			} else {
				chrome.tabs.create({
					url,
					active: !!active,
					openerTabId: currentTabId,
				});
			}
		};
		// FIXME: service worker では document が無い
		// const textarea = document.createElement('textarea');
		// // textareaを非表示にするとコピーできない
		// textarea.style.position = 'fixed';
		// textarea.style.left = '-100px';
		// textarea.style.top = '-100px';
		// document.body.appendChild(textarea);
		// const copy = (text) => {
		// 	// BOM (&#65279 = \uFEFF) 削除
		// 	text = text.replace(/\uFEFF/g, '');
		// 	// ノーブレークスペース (&#8288 = \u2060) 削除
		// 	text = text.replace(/\u2060/g, '');
		// 	textarea.value = text;
		// 	textarea.select();
		// 	document.execCommand('copy');

		// 	/** 通知を何秒後に削除するか [s] */
		// 	const notificationTimeoutSec = 5;
		// 	chrome.notifications.create({
		// 		title: 'コピー完了',
		// 		message: text,
		// 		type: 'basic',
		// 		iconUrl: '/icon/icon.png',
		// 	}, notificationId => {
		// 		setTimeout(() => {
		// 			chrome.notifications.clear(notificationId);
		// 		}, notificationTimeoutSec * 1000);
		// 	});
		// };
		// chrome.notifications.onClicked.addListener(notificationId => {
		// 	chrome.notifications.clear(notificationId);
		// });
		functions.search = search;
		functions.open = open;
		// functions.copy = copy;
	}
})();
