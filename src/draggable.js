(function (root, factory) {
    if (typeof exports === 'object') {
      module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
      define([], factory);
    } else {
      root.Draggable = factory();
    }
}(this, function () {

  'use strict';

  var defaults = {

    // settings
    grid: 0,                // grid cell size for snapping to on drag
    filterTarget: null,     // disallow drag when target passes this test
    limit: {                // limit the drag bounds
      x: null,              // [minimum position, maximum position] || position
      y: null               // [minimum position, maximum position] || position
    },
    threshold: 0,           // threshold to move before drag begins (in px)

    // flags
    setCursor: false,       // change cursor to reflect draggable?
    setPosition: true,      // change draggable position to absolute?
    smoothDrag: true,       // snap to grid when dropped, but not during
    useGPU: true,           // move graphics calculation/composition to the GPU

    // event hooks
    onDrag: noop,           // function(element, X, Y, event)
    onDragStart: noop,      // function(element, X, Y, event)
    onDragEnd: noop         // function(element, X, Y, event)

  };

  var env = {

    // CSS vendor-prefixed transform property
    transform: (function(){

      var prefixes = ' -o- -ms- -moz- -webkit-'.split(' ');
      var style = document.body.style;

      for (var n = prefixes.length; n--;) {
        var property = prefixes[n] + 'transform';
        if (property in style) {
          return property;
        }
      }

    })()

  };

  var util = {

    assign: function () {

      var obj = arguments[0];
      var count = arguments.length;

      for ( var n = 1; n < count; n++ ) {
        var argument = arguments[n];
        for ( var key in argument ) {
          obj[key] = argument[key];
        }
      }

      return obj;

    },

    bind: function (fn, context) {
      return function() {
        fn.apply(context, arguments);
      }
    },

    on: function (element, e, fn) {
      if (e && fn) {
        util.addEvent (element, e, fn);
      } else if (e) {
        for (var ee in e) {
          util.addEvent (element, ee, e[ee]);
        }
      }
    },

    off: function (element, e, fn) {
      if (e && fn) {
        util.removeEvent (element, e, fn);
      } else if (e) {
        for (var ee in e) {
          util.removeEvent (element, ee, e[ee]);
        }
      }
    },

    // Example:
    //
    //     util.limit(x, limit.x)
    limit: function (n, limit) {
      // {Array} limit.x
      if (isArray(limit)) {
        limit = [+limit[0], +limit[1]];
        if (n < limit[0]) n = limit[0];
        else if (n > limit[1]) n = limit[1];
      // {Number} limit.x
      } else {
        n = +limit;
      }

      return n;
    },

    addEvent: ('attachEvent' in Element.prototype)
      ? function (element, e, fn) { element.attachEvent('on'+e, fn) }
      : function (element, e, fn) { element.addEventListener(e, fn, false) },

    removeEvent: ('attachEvent' in Element.prototype)
      ? function (element, e, fn) { element.detachEvent('on'+e, fn) }
      : function (element, e, fn) { element.removeEventListener(e, fn) }

  };

  /*
    usage:

    new Draggable (element, options)
      - or -
    new Draggable (element)
  */

  function Draggable (element, options) {

    var me = this,
      start = util.bind(me.start, me),
      drag = util.bind(me.drag, me),
      stop = util.bind(me.stop, me);

    // sanity check
    if (!isElement(element)) {
      throw new TypeError('Draggable expects argument 0 to be an Element');
    }

    options = util.assign({}, defaults, options);

    // set instance properties
    util.assign(me, {

      // DOM element
      element: element,
      handle: (options.handle && isElement(options.handle))
              ? options.handle
              : element,

      // DOM event handlers
      handlers: {
        start: {
          mousedown: start,
          touchstart: start
        },
        move: {
          mousemove: drag,
          mouseup: stop,
          touchmove: drag,
          touchend: stop
        }
      },

      // options
      options: options

    });

    // initialize
    me.initialize();

  }

  util.assign (Draggable.prototype, {

    // public

    setOption: function (property, value) {

      var me = this;

      me.options[property] = value;
      me.initialize();

      return me;

    },

    get: function() {

      var dragEvent = this.dragEvent;

      return {
        x: dragEvent.x,
        y: dragEvent.y
      };

    },

    set: function (x, y) {

      var me = this,
        dragEvent = me.dragEvent;

      dragEvent.original = {
        x: dragEvent.x,
        y: dragEvent.y
      };

      me.move(x, y);

      return me;

    },

    // internal

    dragEvent: {
      started: false,
      x: 0,
      y: 0
    },

    initialize: function() {

      var me = this,
        element = me.element,
        handle = me.handle,
        style = element.style,
        compStyle = getStyle(element),
        options = me.options,
        transform = env.transform,
        oldTransform;

      // cache element dimensions (for performance)

      var _dimensions = me._dimensions = {
        height: element.offsetHeight,
        left: element.offsetLeft,
        top: element.offsetTop,
        width: element.offsetWidth
      };

      // shift compositing over to the GPU if the browser supports it (for performance)

      if (options.useGPU && transform) {

        // concatenate to any existing transform
        // so we don't accidentally override it
        oldTransform = compStyle[transform];

        if (oldTransform === 'none') {
          oldTransform = '';
        }

        style[transform] = oldTransform + ' translate3d(0,0,0)';
      }

      // optional styling

      if (options.setPosition) {
        style.display = 'block';
        style.left = _dimensions.left + 'px';
        style.top = _dimensions.top + 'px';
        style.width = _dimensions.width + 'px';
        style.height = _dimensions.height + 'px';
        style.bottom = style.right = 'auto';
        style.margin = 0;
        style.position = 'absolute';
      }

      if (options.setCursor) {
        style.cursor = 'move';
      }

      // set limit
      me.setLimit(options.limit);

      // set position in model
      util.assign(me.dragEvent, {
        x: _dimensions.left,
        y: _dimensions.top
      });

      // attach mousedown event
      util.on(me.handle, me.handlers.start);

    },

    start: function (e) {

      var me = this;
      var cursor = me.getCursor(e);
      var element = me.element;

      // filter the target?
      if (!me.useTarget(e.target || e.srcElement)) {
        return;
      }

      // prevent browsers from visually dragging the element's outline
      if (e.preventDefault && !e.target.getAttribute('contenteditable')) {
        e.preventDefault();
      } else if (!e.target.getAttribute('contenteditable')) {
        e.returnValue = false; // IE10
      }

      // set a high z-index, just in case
      me.dragEvent.oldZindex = element.style.zIndex;
      element.style.zIndex = 10000;

      // set initial position
      me.setCursor(cursor);
      me.setPosition();
      me.setZoom();

      // add event listeners
      util.on(document, me.handlers.move);

    },

    drag: function (e) {

      var me = this,
        dragEvent = me.dragEvent,
        element = me.element,
        initialCursor = me._cursor,
        initialPosition = me._dimensions,
        options = me.options,
        zoom = initialPosition.zoom,
        cursor = me.getCursor(e),
        threshold = options.threshold,
        x = (cursor.x - initialCursor.x)/zoom + initialPosition.left,
        y = (cursor.y - initialCursor.y)/zoom + initialPosition.top;

      // check threshold
      if (!dragEvent.started && threshold &&
        (Math.abs(initialCursor.x - cursor.x) < threshold) &&
        (Math.abs(initialCursor.y - cursor.y) < threshold)
      ) {
        return;
      }

      // save original position?
      if (!dragEvent.original) {
        dragEvent.original = { x: x, y: y };
      }

      // trigger start event?
      if (!dragEvent.started) {
        options.onDragStart(element, x, y, e);
        dragEvent.started = true;
      }

      // move the element
      if (me.move(x, y)) {

        // trigger drag event
        options.onDrag(element, dragEvent.x, dragEvent.y, e);
      }

    },

    move: function (x, y) {

      var me = this,
        dragEvent = me.dragEvent,
        options = me.options,
        grid = options.grid,
        style = me.element.style,
        pos = me.limit(x, y, dragEvent.original.x, dragEvent.original.y);

      // snap to grid?
      if (!options.smoothDrag && grid) {
        pos = me.round (pos, grid);
      }

      // move it
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
      util.off(document, me.handlers.move);

      // resent element's z-index
      element.style.zIndex = dragEvent.oldZindex;

      // snap to grid?
      if (options.smoothDrag && grid) {
        pos = me.round({ x: dragEvent.x, y: dragEvent.y }, grid);
        me.move(pos.x, pos.y);
        util.assign(me.dragEvent, pos);
      }

      // trigger dragend event
      if (me.dragEvent.started) {
        options.onDragEnd(element, dragEvent.x, dragEvent.y, e);
      }

      // clear temp vars
      me.reset();

    },

    reset: function() {

      this.dragEvent.started = false;

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
        x: (e.targetTouches ? e.targetTouches[0] : e).clientX,
        y: (e.targetTouches ? e.targetTouches[0] : e).clientY
      };

    },

    setCursor: function (xy) {

      this._cursor = xy;

    },

    setLimit: function (limit) {

      var me = this,
        _true = function (x, y) {
          return { x:x, y:y };
        };

      // limit is a function
      if (isFunction(limit)) {

        me.limit = limit;

      }

      // limit is an element
      else if (isElement(limit)) {

        var draggableSize = me._dimensions,
          height = limit.scrollHeight - draggableSize.height,
          width = limit.scrollWidth - draggableSize.width;

        me.limit = function (x, y) {
          return {
            x: util.limit(x, [0, width]),
            y: util.limit(y, [0, height])
          }
        };

      }

      // limit is defined
      else if (limit) {

        var defined = {
          x: isDefined(limit.x),
          y: isDefined(limit.y)
        };
        var _x, _y;

        // {Undefined} limit.x, {Undefined} limit.y
        if (!defined.x && !defined.y) {

          me.limit = _true;

        } else {

          me.limit = function (x, y) {
            return {
              x: defined.x ? util.limit(x, limit.x) : x,
              y: defined.y ? util.limit(y, limit.y) : y
            };
          };

        }
      }

      // limit is `null` or `undefined`
      else {

        me.limit = _true;

      }

    },

    setPosition: function() {

      var me = this,
        element = me.element,
        style = element.style;

      util.assign(me._dimensions, {
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

        if (z && z !== 'normal') {
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

    },

    destroy: function () {

      util.off(this.handle, this.handlers.start);
      util.off(document, this.handlers.move);

    }

  });

  // helpers

  function parse (string) {
    return parseInt(string, 10);
  }

  function getStyle (element) {
    return 'currentStyle' in element ? element.currentStyle : getComputedStyle(element);
  }

  function isArray (thing) {
    return thing instanceof Array; // HTMLElement
  }

  function isDefined (thing) {
    return thing !== void 0 && thing !== null;
  }

  function isElement (thing) {
    return thing instanceof Element || typeof HTMLDocument !== 'undefined' && thing instanceof HTMLDocument;
  }

  function isFunction (thing) {
    return thing instanceof Function;
  }

  function noop (){};

  return Draggable;

}));
