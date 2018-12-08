/*
	content_scripts / Chrome拡張どちらも対応できるように変更
*/
(() => {
	const inChromeExtension = location.protocol === 'chrome-extension:';
	const isBackgroundPage = inChromeExtension && window.chrome && chrome.extension && (chrome.extension.getBackgroundPage() === window);

	if (isBackgroundPage) {
		chrome.runtime.onMessage.addListener((request, sender) => {
			if (request.method === 'search') {
				search(request.text, sender.tab.id);
			} else if (request.method === 'copy') {
				copy(request.text);
			} else if (request.method === 'open') {
				open(request.text, {
					currentTabId: sender.tab.id,
				});
			} else if (request.method === 'open-background') {
				open(request.text, {
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
				chrome.tabs.executeScript(tab.id, {
					file: 'textDrag2Action.js',
					allFrames: true,
				}, result => {
					if (typeof result === 'undefined') {
						console.info('ページが読み込まれていません', tab);
					} else {
						chrome.tabs.insertCSS(tab.id, {
							file: 'textDrag2Action.css',
							allFrames: true,
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
					} else if (target.tagName === 'IMG') {
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
					} else if (anchor = getAnchor(target)) {
						action('copy', anchor.href);
					} else if (target.tagName === 'IMG') {
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
				if (elem.tagName === 'A' || elem.tagName === 'AREA') {
					return elem;
				}
				elem = elem.parentNode;
			}
			return null;
		};

		const checkAnchor = anchor => {
			const href = anchor.getAttribute('href');
			if (href === '#') return null;
			if (/^\s*javascript\s*:\s*void/i.test(href)) return null;
			return anchor;
		};

		const action = (method, text) => {
			if (text === '') return;
			if (inChromeExtension) {
				if (method === 'search') {
					search(text);
				} else if (method === 'copy') {
					copy(text);
				} else if (method === 'open') {
					open(text);
				} else if (method === 'open-background') {
					open(text, {
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
	if (inChromeExtension) {
		function search(text, currentTabId) {
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
		}
		function open(url, {
			currentTabId,
			active = true,
		} = {}) {
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
		}
		const textarea = document.createElement('textarea');
		// textareaを非表示にするとコピーできない
		textarea.style.position = 'fixed';
		textarea.style.left = '-100px';
		textarea.style.top = '-100px';
		document.body.appendChild(textarea);
		function copy(text) {
			// BOM (&#65279 = \uFEFF) 削除
			text = text.replace(/\uFEFF/g, '');
			// ノーブレークスペース (&#8288 = \u2060) 削除
			text = text.replace(/\u2060/g, '');
			textarea.value = text;
			textarea.select();
			document.execCommand('copy');

			chrome.notifications.create({
				title: 'コピー完了',
				message: text,
				type: 'basic',
				iconUrl: '/icon/icon.png',
			});
		}
		chrome.notifications.onClicked.addListener(notificationId => {
			chrome.notifications.clear(notificationId);
		});
	}
})();
