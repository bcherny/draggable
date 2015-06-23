(function (root, factory) {
    if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory(require('jQuery'));
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jQuery'], factory);
    } else {
        // Browser globals (root is window)
        root.Draggable = factory(root.jQuery);
    }
}(this, function ($) {

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

    // touch support flag
    touch: ('ontouchstart' in window) || ('DocumentTouch' in window && document instanceof DocumentTouch),

    // internet explorer flag
    ie: navigator.appName === 'Microsoft Internet Explorer',

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

  var $document = $(document);

  /*
    usage:

    new Draggable (element, options)
      - or -
    new Draggable (element)
  */

  function Draggable (element, options) {

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
      $element: $(element),

      // DOM event handlers
      handlers: {

        start: env.touch
          ? { touchstart: start }
          : { mousedown: start },

        move: env.touch
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
      $.extend(me.dragEvent, {
        x: _dimensions.left,
        y: _dimensions.top
      });

      // attach mousedown event
      me.$element.on(me.handlers.start);

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
      if (e.preventDefault) {
        e.preventDefault();
      } else {
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
      $document.on(me.handlers.move);

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
      $document.off(me.handlers.move);

      // resent element's z-index
      element.style.zIndex = dragEvent.oldZindex;

      // snap to grid?
      if (options.smoothDrag && grid) {
        pos = me.round({ x: dragEvent.x, y: dragEvent.y }, grid);
        me.move(pos.x, pos.y);
        $.extend(me.dragEvent, pos);
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
        x: (env.touch ? e.targetTouches[0] : e).clientX,
        y: (env.touch ? e.targetTouches[0] : e).clientY
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

          if (x < 0) x = 0;
          else if (x > width) x = width;

          if (y < 0) y = 0;
          else if (y > height) y = height;

          return {
            x: x,
            y: y
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

        }

        // {Undefined} limit.y
        else if (defined.x && !defined.y) {

          // {Array} limit.x, {Undefined} limit.y
          if (isArray(limit.x)) {

            _x = [
              +limit.x[0],
              +limit.x[1]
            ];

            me.limit = function (x, y) {

              if (x < _x[0]) x = _x[0];
              else if (x > _x[1]) x = _x[1];

              return {
                x: x,
                y: y
              };

            };

          }

          // {Number} limit.x, {Undefined} limit.y
          else {

            _x = +limit.x;

            me.limit = function (x, y) {
              return {
                x: _x,
                y: y
              };
            };

          }

        }

        // {Undefined} limit.x
        else if (!defined.x && defined.y) {

          // {Undefined} limit.x, {Array} limit.y
          if (isArray(limit.y)) {

            _y = [
              +limit.y[0],
              +limit.y[1]
            ];

            me.limit = function (x, y) {

              if (y < _y[0]) y = _y[0];
              else if (y > _y[1]) y = _y[1];

              return {
                x: x,
                y: y
              };

            };

          }

          // {Undefined} limit.x, {Number} limit.y
          else {

            _y = +limit.y;

            me.limit = function (x, y) {
              return {
                x: x,
                y: _y
              };
            };

          }

        } else {

          // {Array} limit.x, {Array} limit.y
          if (isArray(limit.x) && isArray(limit.y)) {

            _x = [
              +limit.x[0],
              +limit.x[1]
            ];
            _y = [
              +limit.y[0],
              +limit.y[1]
            ];

            me.limit = function (x, y) {

              if (x < _x[0]) x = _x[0];
              else if (x > _x[1]) x = _x[1];

              if (y < _y[0]) y = _y[0];
              else if (y > _y[1]) y = _y[1];

              return {
                x: x,
                y: y
              };

            };

          }

          // {Array} limit.x, {Number} limit.y
          else if (isArray(limit.x)) {

            _x = [
              +limit.x[0],
              +limit.x[1]
            ];
            _y = +limit.y;

            me.limit = function (x, y) {

              if (x < _x[0]) x = _x[0];
              else if (x > _x[1]) x = _x[1];

              return {
                x: x,
                y: _y
              };

            };

          }

          // {Number} limit.x, {Array} limit.y
          else if (isArray(limit.y)) {

            _x = +limit.x;
            _y = [
              +limit.y[0],
              +limit.y[1]
            ];

            me.limit = function (x, y) {

              if (y < _y[0]) y = _y[0];
              else if (y > _y[1]) y = _y[1];

              return {
                x: _x,
                y: y
              };

            };

          }

          // {Number} limit.x, {Number} limit.y
          else {

            _x = +limit.x;
            _y = +limit.y;

            me.limit = function (x, y) {

              return {
                x: _x,
                y: _y
              };

            };
          }
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

      this.$element.off(this.handlers.start);
      $document.off(this.handlers.move);

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
    return env.ie ? element.currentStyle : getComputedStyle(element);
  }

  function isArray (thing) {
    return thing instanceof Array; // HTMLElement
  }

  function isDefined (thing) {
    return thing !== void 0 && thing !== null;
  }

  function isElement (thing) {
    return thing instanceof Element || thing instanceof HTMLDocument;
  }

  function isFunction (thing) {
    return thing instanceof Function;
  }

  function noop (){};

  return Draggable;

}));