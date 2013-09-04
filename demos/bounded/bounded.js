var container = document.getElementById('container'),
	element = document.getElementsByClassName('ball')[0],
	labelX = document.getElementsByClassName('coords-x')[0],
	labelY = document.getElementsByClassName('coords-y')[0];

// options
var options = {
	limit: container,
	setCursor: true,
	onDrag: function (element, x, y) {
		labelX.innerHTML = x;
		labelY.innerHTML = y;
	}
};

// initialize drag
new Draggable(element, options);