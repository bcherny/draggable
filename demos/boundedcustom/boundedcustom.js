var element = document.getElementsByClassName('ball')[0],
	labelX = document.getElementsByClassName('coords-x')[0],
	labelY = document.getElementsByClassName('coords-y')[0];

// options
var options = {
	limit: limit,
	setCursor: true,
	onDrag: function (element, x, y) {
		labelX.innerHTML = x;
		labelY.innerHTML = y;
	}
};

// initialize drag
new Draggable(element, options);

// our custom limit function
function limit (
	x,	// current X coordinate
	y,	// current Y coordinate
	x0,	// original X coordinate (where drag was started)
	y0	// original Y coordinate (where drag was started)
) {
	
	var radius = 100,
		dx = x - x0,
		dy = y - y0,
		distance = Math.sqrt(dx*dx + dy*dy),
		outOfRange = distance > radius;

	// only allow dragging within a circle of radius 100.
	// if our point is outside of the circle, compute the
	// point on the circle's edge closest to our point.
	// see http://math.stackexchange.com/a/127615/93158
	
	if (outOfRange) {

		x = ( x0 + radius * (x - x0) / distance ).toPrecision(4);
		y = ( y0 + radius * (y - y0) / distance ).toPrecision(4);
		
	}

	return {
		x: x,
		y: y
	};

}