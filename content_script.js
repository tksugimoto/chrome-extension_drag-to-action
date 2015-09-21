
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
	chrome.runtime.sendMessage({
		method: method,
		text: text
	}, function (response) {
		
	});
}