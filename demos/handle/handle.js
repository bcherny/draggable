// find our elements
var elements = document.getElementsByClassName('ball'),
  handles = document.querySelectorAll('.ball p'),
	labelsX = document.getElementsByClassName('coords-x'),
	labelsY = document.getElementsByClassName('coords-y');

// loop over the 3 balls...
for (var n = elements.length; n--;) {

	// ... augment our default options with individual `onDrag` handlers
	var opts = {
		onDrag: onDragFactory(n),
		setCursor: true,
		handle: elements[n].getElementsByTagName('p')[0]
	};

	// ... and initialize drag for each
	new Draggable(elements[n], opts);

}

// bind `n` to its value at iteration time
function onDragFactory (n) {

	return function (element, x, y) {
		labelsX[n].innerHTML = x;
		labelsY[n].innerHTML = y;
	}

}