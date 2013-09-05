// IE8 polyfill
HTMLDocument.prototype.getElementsByClassName = 
Element.prototype.getElementsByClassName =
function getElementsByClassName (className) {
	for (var res = [], els = this.getElementsByTagName('*'), n = els.length; n--;) {
		if (els[n].className.indexOf(className) > -1) {
			res.push(els[n]);
		}
	}
	return res;
}

// prevent selection because it's annoying when dragging
document.onselectstart = function(){ return false; };
document.body.setAttribute('unselectable', 'on', 0);