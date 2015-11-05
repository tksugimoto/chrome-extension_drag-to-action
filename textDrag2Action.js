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
			}
		});
	} else {
		var slectedText = "";
		var startPositionX = 0;
		var startPositionY = 0;

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
				if (movedDistanceToBottom > 0) {
					// 下へ動いた
					var anchor = getAnchor(evt.target);
					if (anchor) {
						action("open", anchor.href);
					} else if (evt.target.tagName === "IMG") {
						action("open", evt.target.src);
					} else if (/\S/.test(slectedText) && slectedText === window.getSelection().toString()) {
						action("search", slectedText);
					}
				}
			} else {
				if (movedDistanceToRight > 0) {
					// 右へ動いた
					var anchor = getAnchor(evt.target);
					if (anchor) {
						action("copy", anchor.href);
					} else if (evt.target.tagName === "IMG") {
						action("copy", evt.target.src);
					} else if (/\S/.test(slectedText) && slectedText === window.getSelection().toString()) {
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
				}
			} else {
				chrome.runtime.sendMessage({
					method: method,
					text: text
				});
			}
		}
	}
	if (inChromeExtension) {
		function search(text, tabId) {
			var url = "https://www.google.co.jp/search?hl=ja&complete=0&q=" + encodeURIComponent(text);
			open(url, tabId);
		}
		function open(url, tabId) {
			if (typeof tabId === "undefined") {
				chrome.tabs.getCurrent(function (tab) {
					chrome.tabs.create({
						url: url,
						openerTabId: tab.id
					});
				});
			} else {
				chrome.tabs.create({
					url: url,
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