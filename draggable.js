(function (root, factory) {
    if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory(require('$'));
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['$'], factory);
    } else {
        // Browser globals (root is window)
        root.Draggable = factory(root.$);
    }
}(this, function ($) {

	'use strict';

	var defaults = {

		// settings
		grid: 0,					// grid cell size for snapping to on drag
		filterTarget: null,			// disallow drag when target passes this test
		limit: {					// limit the drag bounds
			x: null,				// [minimum position, maximum position] || position
			y: null					// [minimum position, maximum position] || position
		},
		threshold: 0,				// threshold to move before drag begins (in px)

		// flags
		setCursor: false,			// change cursor to reflect draggable?
		setPosition: true,			// change draggable position to absolute?
		smoothDrag: true,			// snap to grid when dropped, but not during drag

		// event hooks
		onDrag: noop,				// function(element, X, Y, event)
		onDragStart: noop,			// function(element, X, Y, event)
		onDragEnd: noop				// function(element, X, Y, event)

	};

	var hasTouch = ('ontouchstart' in window) || ('DocumentTouch' in window && document instanceof DocumentTouch), // this breaks Firefox
		isIE = navigator.appName === 'Microsoft Internet Explorer',
		$document = $(document);

	/*
		usage:

		new Draggable (element, options)
			- or -
		new Draggable (element)
	*/

	var Draggable = function (element, options) {

		var me = this,
			start = bind(me.start, me),
			drag = bind(me.drag, me),
			stop = bind(me.stop, me);

		// sanity check
		if (!isElement(element)) {
			throw new TypeError('Draggable expects argument 0 to be an Element');
		}

		// set instance properties
		$.extend(me, {

			// DOM element
			element: element,

			// DOM event handlers
			handlers: {

				start: hasTouch
					? { touchstart: start }
					: { mousedown: start },

				move: hasTouch
					? { touchmove: drag, touchend: stop }
					: { mousemove: drag, mouseup: stop }

			},

			// options
			options: $.extend({}, defaults, options)

		});

		// initialize
		me.initialize();

	}

	$.extend (Draggable.prototype, {

		dragEvent: {
			started: false,
			x: 0,
			y: 0
		},

		initialize: function() {

			var me = this,
				style = me.element.style,
				options = me.options;

			// cache element dimensions (for performance)

			var _dimensions = me._dimensions = {
				height: element.offsetHeight,
				left: element.offsetLeft,
				top: element.offsetTop,
				width: element.offsetWidth
			};

			// optional styling
			
			if (options.setPosition) {
				style.left = _dimensions.left + 'px';
				style.top = _dimensions.top + 'px';
				style.right = 'auto';
				style.bottom = 'auto';
				style.position = 'absolute';
			}

			if (options.setCursor) {
				style.cursor = 'move';
			}

			// attach mousedown event
			$document.on(me.handlers.start);

		},

		start: function (e) {

			var me = this;
			var cursor = me.getCursor(e);
			var element = me.element;

			// filter the target?
			if (!me.useTarget(e.target)) {
				return;
			}

			// prevent browsers from visually dragging the element's outline
			e.preventDefault();

			// set a high z-index, just in case
			me.dragEvent.oldZindex = element.style.zIndex;
			element.style.zIndex = 10000;

			// set initial position
			me.setCursor(cursor);
			me.setPosition();
			me.setZoom();

			// add event listeners
			$document.on(me.handlers.move);

		},

		drag: function (e) {

			var me = this;
			var dragEvent = me.dragEvent;
			var element = me.element;
			var initialCursor = me._cursor;
			var initialPosition = me._dimensions;
			var initialX = initialCursor.x;
			var initialY = initialCursor.y;
			var options = me.options;
			var zoom = initialPosition.zoom;

			// prevent race condition where this stuff isn't computed yet
			//if (isDefined(initialX) && isDefined(initialPosition.left)) {

				var cursor = me.getCursor(e);
				var threshold = options.threshold;
				var x = (cursor.x - initialX)/zoom + initialPosition.left;
				var y = (cursor.y - initialY)/zoom + initialPosition.top;

				// check threshold
				if (!dragEvent.started && threshold &&
					(Math.abs(initialX - cursor.x) < threshold) &&
					(Math.abs(initialY - cursor.y) < threshold)
				) {
					return;
				}

				// trigger start event?
				if (!dragEvent.started) {
					options.onDragStart(element, initialX, initialY, e);
					$.extend(dragEvent, {
						original: {
							x: x,
							y: y
						},
						started: true
					});
				}

				// move the element
				if (me.move(x, y)) {

					// trigger drag event
					options.onDrag(element, x, y, e);
				}
			//}

		},

		move: function (x, y) {

			var me = this,
				dimensions = me._dimensions,
				dragEvent = me.dragEvent,
				options = me.options,
				grid = options.grid,
				limit = options.limit,
				limitExists = isDefined(limit),
				style = element.style,
				lowIsOk_x,
				highIsOk_x,
				lowIsOk_y,
				highIsOk_y,
				coords;

			if (!(limit instanceof Function)) {
				if (limitExists && limit.x !== null) {
					if (limit.x[1]) {
						lowIsOk_x  = x > limit.x[0];
						highIsOk_x = x + dimensions.width <= limit.x[1];
					} else {
						x = limit.x;
						lowIsOk_x = highIsOk_x = 1;
					}
				} else lowIsOk_x = highIsOk_x = 1;

				if (limitExists && limit.y !== null) {
					if (limit.y[1]) {
						lowIsOk_y  = y > limit.y[0],
						highIsOk_y = y + dimensions.height <= limit.y[1];
					} else {
						y = limit.y;
						lowIsOk_y = highIsOk_y = 1;
					}
				} else lowIsOk_y = highIsOk_y = 1;

			} else {

				coords = limit(x, y, dragEvent.original.x, dragEvent.original.y);
				if (!coords) return;
				x = coords[0];
				y = coords[1];
				lowIsOk_x = highIsOk_x = lowIsOk_y = highIsOk_y = 1;

			}

			// compute final coords
			var pos = {
				x: lowIsOk_x && highIsOk_x ? x : (!lowIsOk_x ? 0 : (limit.x[1]-dimensions.width)),
				y: lowIsOk_y && highIsOk_y ? y : (!lowIsOk_y ? 0 : (limit.y[1]-dimensions.height))
			};

			// snap to grid?
			if (!options.smoothDrag && grid) {
				pos = me.round (pos, grid);
			}

			if (pos.x !== dragEvent.x || pos.y !== dragEvent.y) {

				dragEvent.x = pos.x;
				dragEvent.y = pos.y;

				style.left = pos.x + 'px';
				style.top = pos.y + 'px';

				return true;
			}

			return false;

		},

		stop: function (e) {

			var me = this,
				dragEvent = me.dragEvent,
				element = me.element,
				options = me.options,
				grid = options.grid,
				pos;

			// remove event listeners
			$document.off(me.handlers.move);

			// resent element's z-index
			element.style.zIndex = dragEvent.oldZindex;

			// snap to grid?
			if (options.smoothDrag && grid) {
				pos = me.round({ x: dragEvent.x, y: dragEvent.y }, grid);
				me.move(pos.x, pos.y);
			}

			// trigger dragend event
			if (me.dragEvent.started) {
				options.onDragEnd(element, dragEvent.x, dragEvent.y, e);
			}

			// clear temp vars
			me.reset();

		},

		reset: function() {

			var me = this,
				dragEvent = me.dragEvent;

			dragEvent = {
				started: false,
				x: 0,
				y: 0
			};

		},

		round: function (pos) {

			var grid = this.options.grid;

			return {
				x: grid * Math.round(pos.x/grid),
				y: grid * Math.round(pos.y/grid)
			};

		},

		getCursor: function (e) {

			return {
				x: (hasTouch ? e.targetTouches[0] : e).clientX,
				y: (hasTouch ? e.targetTouches[0] : e).clientY
			};

		},

		setCursor: function (xy) {

			this._cursor = xy;

		},

		setPosition: function() {

			var me = this,
				element = me.element,
				style = element.style;

			$.extend(me._dimensions, {
				left: parse(style.left) || element.offsetLeft,
				top: parse(style.top) || element.offsetTop
			});

		},

		setZoom: function() {

			var me = this;
			var element = me.element;
			var zoom = 1;

			while (element = element.offsetParent) {

				var z = getStyle(element).zoom;

				if (z) {
					zoom = z;
					break;
				}

			}

			me._dimensions.zoom = zoom;

		},

		useTarget: function (element) {

			var filterTarget = this.options.filterTarget;

			if (filterTarget instanceof Function) {
				return filterTarget(element);
			}

			return true;

		}

	});

	// helpers

	function bind (fn, context) {
		return function() {
			fn.apply(context, arguments);
		}
	}

	function parse (string) {
		return parseInt(string, 10);
	}

	function getStyle (element) {
		return isIE ? element.currentStyle : getComputedStyle(element);
	}

	function isDefined (something) {
		return something !== void 0;
	}

	function isElement (o) {
		return o instanceof Node; // HTMLElement
	}

	function noop (){};

	return Draggable;

}));