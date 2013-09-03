#draggable.js

High performance drag and drop in a tiny package

## Usage

**HTML**
```html

<div id="id"></div>

```

**JavaScript**

*Using browser globals:*
```js
var element = document.getElementById('id');
var options = {};
new Draggable (element, options);
```

*Using AMD/CommonJS:*
**JavaScript**
```js
var Draggable = require ('Draggable');
var element = document.getElementById('id');
new Draggable (element);
```

## Dependencies

- **jQuery** or a $-namespaced shim for .on, .off, and .extend (included in the packaged version)

## Options

| Option 			| Type			| Default			| Description							|
|-------------------|---------------|-------------------|---------------------------------------|
| **grid**			| Number		| `0`				| grid cell size for snapping on drag 	|
| **filterTarget**	| Function(target)		| `null`			| disallow drag when target passes this test |
| **limit**			| Function(x, y, x0, y0) or Object | '{ x: null, y: null }' | limit x/y drag bounds		|
| **threshold**		| Number		| `0`				| threshold before drag begins (in px)	|
| **setCursor**		| Boolean (truthy) | `false`		| change cursor to `move`?				|
| **setPosition**	| Boolean (truthy) | `true`			| change draggable position to absolute? |
| **smoothDrag**	| Boolean (truthy) | `true`			| snap to grid only when dropped, not during drag |

## Events

| Event 			| Arguments				|
|-------------------|-----------------------|
| onDrag			| element, x, y, event	|
| onDragStart		| element, X, Y, event	|
| onDragEnd			| element, X, Y, event	|

## Notes

Options.limit accepts arguments in several forms:

```js

// no limit
limit: null

// limit x, but leave y unbounded
limit: {
	x: [1,10],
	y: null
}

// limit both axes
limit: {
	x: [1,10],
	y: [1,500]
}

// bound x, set y to a constant
limit: {
	x: [1,10],
	y: 5
}

// bound with a custom function
limit: function (
	x,	// current X coordinate
	y,	// current Y coordinate
	x0,	// original X coordinate (where drag was started)
	y0	// original Y coordinate (where drag was started)
) {
	
	var radius = 100,
		dx = x - x0,
		dy = y - y0

	// only allow dragging within a circle of radius 100
	return Math.sqrt(dx*dx + dy*dy) < radius
}

```