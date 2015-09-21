/*
	
	Chrome拡張用に1ファイルにまとめた
	
*/
(function () {
	var slectedText = null;
	var startPositionX = 0;
	var startPositionY = 0;

	document.body.addEventListener("dragstart", function (evt) {
		slectedText = window.getSelection().toString();
		startPositionX = evt.screenX;
		startPositionY = evt.screenY;
	});

	document.body.addEventListener("dragend", function (evt) {
		if (slectedText === window.getSelection().toString()) {
			var movedDistanceToRight = evt.screenX - startPositionX;
			var movedDistanceToBottom = evt.screenY - startPositionY;
			if (movedDistanceToBottom > 0) {
				// 下へ動いた
				if ((movedDistanceToRight > 0) && (movedDistanceToRight > movedDistanceToBottom)) {
					// 右へ動いた かつ 右の方へ大きく動いた
					action("copy", slectedText);
				} else {
					action("search", slectedText);
				}
			}
		}
	});

	function action(method, text) {
		if (method === "search") {
			var text = text;
			var url = "https://www.google.co.jp/search?hl=ja&complete=0&q=" + encodeURIComponent(text);
			chrome.tabs.getCurrent(function (tab) {
				chrome.tabs.create({
					url: url,
					openerTabId: tab.id
				}, function (){});
			});
		} else if (method === "copy") {
			document.execCommand("copy");
		}
	}
})();