/*
	content_scripts / Chrome拡張どちらも対応できるように変更
*/
(function () {
	var inChromeExtension = location.protocol === "chrome-extension:";
	var isBackgroundPage = inChromeExtension && window.chrome && chrome.extension && (chrome.extension.getBackgroundPage() === window);
	
	if (isBackgroundPage) {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (request.method === "search") {
				search(request.text, sender.tab.id);
			} else if (request.method === "copy") {
				copy(request.text);
			} else if (request.method === "open") {
				open(request.text, sender.tab.id);
			} else if (request.method === "open-background") {
				open(request.text, sender.tab.id, /* active = */ false);
			}
		});
		// 読み込み/更新時に既存のタブで実行する
		chrome.tabs.query({
			url: "*://*/*"
		}, function(result){
			result.forEach(function (tab){
				chrome.tabs.executeScript(tab.id, {
					file: "textDrag2Action.js",
					allFrames: true
				}, function (result) {
					if (typeof result === "undefined") {
						console.info("ページが読み込まれていません", tab);
					}
				});
			});
		});
	} else {
		var slectedText = "";
		var startPositionX = 0;
		var startPositionY = 0;

		document.body.addEventListener("dragover", function (evt) {
			evt.preventDefault();
		});

		document.body.addEventListener("dragstart", function (evt) {
			slectedText = window.getSelection().toString();
			startPositionX = evt.screenX;
			startPositionY = evt.screenY;
		});

		document.body.addEventListener("dragend", function (evt) {
			var movedDistanceToRight = evt.screenX - startPositionX;
			var movedDistanceToBottom = evt.screenY - startPositionY;
			
			var movedHorizontalDistance = Math.abs(movedDistanceToRight);
			var movedVerticalDistance = Math.abs(movedDistanceToBottom);
			
			if (movedVerticalDistance > movedHorizontalDistance) {
				// （水平方向より）垂直方向へ大きく動いた
				var target = evt.target;
				var anchor;
				if (movedDistanceToBottom > 0) {
					// 下へ動いた
					if (target instanceof Text) {
						// <a>内を選択して選択部分をドラッグした場合、targetはTextのNodeになる
						action("search", slectedText);
					} else if (anchor = getAnchor(target)) {
						action("open", anchor.href);
					} else if (target.tagName === "IMG") {
						action("open", target.src);
					} else if (/\S/.test(slectedText)) {
						action("search", slectedText);
					}
				} else {
					// 上へ動いた
					if (anchor = getAnchor(target)) {
						action("open-background", anchor.href);
					}
				}
			} else {
				if (movedDistanceToRight > 0) {
					// 右へ動いた
					var target = evt.target;
					var anchor;
					if (target instanceof Text) {
						action("copy", slectedText);
					} else if (anchor = getAnchor(target)) {
						action("copy", anchor.href);
					} else if (target.tagName === "IMG") {
						action("copy", target.src);
					} else if (/\S/.test(slectedText)) {
						action("copy", slectedText);
					}
				}
			}
		});

		function getAnchor(elem) {
			while(elem.parentNode) {
				if (elem.tagName === "A") {
					return elem;
				}
				elem = elem.parentNode;
			}
			return null;
		}

		function action(method, text) {
			if (inChromeExtension) {
				if (method === "search") {
					search(text);
				} else if (method === "copy") {
					copy(text);
				} else if (method === "open") {
					open(text);
				} else if (method === "open-background") {
					open(text, null, /* active = */ false);
				}
			} else {
				// 拡張が再読み込みされた場合エラーになるので捕捉
				try {
					chrome.runtime.sendMessage({
						method: method,
						text: text
					});
				} catch (e) {}
			}
		}
	}
	if (inChromeExtension) {
		function search(text, tabId) {
			var url = "https://www.google.co.jp/search?hl=ja&complete=0&q=" + encodeURIComponent(text);
			open(url, tabId);
		}
		function open(url, tabId, active = true) {
			if (typeof tabId !== "number") {
				chrome.tabs.getCurrent(function (tab) {
					chrome.tabs.create({
						url: url,
						active: !!active,
						openerTabId: tab.id
					});
				});
			} else {
				chrome.tabs.create({
					url: url,
					active: !!active,
					openerTabId: tabId
				});
			}
		}
		var textarea = document.createElement("textarea");
		// textareaを非表示にするとコピーできない
		textarea.style.position = "fixed";
		textarea.style.left = "-100px";
		textarea.style.top = "-100px";
		document.body.appendChild(textarea);
		function copy(text) {
			textarea.value = text;
			textarea.select();
			document.execCommand("copy");
		}
	}
})();