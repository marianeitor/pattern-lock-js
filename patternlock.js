(function (factory) {
    var global = Function('return this')() || (0, eval)('this');
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], function($) {
            return factory($, global)
        });
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('jquery'), global);
    } else {
        // Browser globals (global is window)
        global.PatternLock = factory(global.jQuery, global);
    }
}(function ($, window) {
    var svgns = 'http://www.w3.org/2000/svg'
    var moveEvent = 'touchmove mousemove'

    var scrollKeys = {
        37: true, // left
        38: true, // up
        39: true, // right
        40: true, // down
        32: true, // spacebar
        38: true, // pageup
        34: true, // pagedown
        35: true, // end
        36: true, // home
    };

    function vibrate() {
        navigator.vibrate = navigator.vibrate || navigator.webkitVibrate || navigator.mozVibrate || navigator.msVibrate;
        if (navigator.vibrate) {
            window.navigator.vibrate(25)
        }
    }

    function PatternLock(element, options) {
        let svg = $(element)
        let self = this
        let root = svg[0]
        let dots = svg.find('.lock-dots circle')
        let lines = svg.find('.lock-lines')
        let actives = svg.find('.lock-actives')
        let arrows = svg.find('.lock-arrows')
        var pt = root.createSVGPoint();
        let code = []
        let currentline
        let currenthandler

        options = Object.assign(PatternLock.defaults, options || {})

        svg.on('touchstart mousedown', (e) => {
            clear()
            e.preventDefault()
            disableScroll()
            svg.on(moveEvent, discoverDot)
            let endEvent = e.type == 'touchstart' ? 'touchend' : 'mouseup';
            $(document).one(endEvent, (e) => {
                end()
            })
        })

        // Exported methods
        Object.assign(this, {
            clear,
            success,
            error,
            getPattern,
            setPattern,
        })

        function success() {
            svg.removeClass('error')
            svg.addClass('success')
        }

        function error() {
            svg.removeClass('success')
            svg.addClass('error')
        }

        function getPattern() {
            console.log(dots)
            return parseInt(code.map((i) => dots.index(i)+1).join(''))
        }

        function setPattern(_code) {
            clear();
            /*arrows.append(createNewArrow(35,20))*/
            let numbers = _code.toString().split('');
            let isFirst = true;
            let lastCords = {x: 0, y: 0};
            numbers.map(_num => {
                let counter = 1;
                for (_dotNum in dots) {
                    if (parseInt(_num) == counter) {
                        actives.append(createNewMarker(dots[_dotNum].getAttribute('cx'), dots[_dotNum].getAttribute('cy')))
                        console.log(lastCords)
                        if (!isFirst) {
                            let _points = {
                                x1: parseInt(lastCords.x),
                                y1: parseInt(lastCords.y),
                                x2: parseInt(dots[_dotNum].getAttribute('cx')),
                                y2: parseInt(dots[_dotNum].getAttribute('cy')),
                            }

                            console.log(_points);
                            lines.append(createNewLine(_points.x1, _points.y1, _points.x2, _points.y2))

                            let _rot = getArrowRot(_points.x1, _points.x2, _points.y1, _points.y2)
                            arrows.append(createNewArrow(_points.x1 + (_points.x2-_points.x1)/2,_points.y1 + (_points.y2-_points.y1)/2, _rot))
                        }
                        else {
                            isFirst = false;
                        }

                        lastCords.x = dots[_dotNum].getAttribute('cx')
                        lastCords.y = dots[_dotNum].getAttribute('cy')
                    }
                    counter++;
                }
            })

        }

        function end() {
            enableScroll()
            stopTrack(currentline)
            currentline && currentline.remove()
            svg.off(moveEvent, discoverDot)
            let val = options.onPattern.call(self, getPattern())
            if (val === true) {
                success()
            } else if (val === false) {
                error()
            }
        }

        function clear() {
            code = []
            currentline = undefined
            currenthandler = undefined
            svg.removeClass('success error')
            lines.empty()
            actives.empty()
            arrows.empty();
        }

        function preventDefault(e) {
            e = e || window.event;
            if (e.preventDefault)
                e.preventDefault();
            e.returnValue = false;
        }

        function preventDefaultForScrollKeys(e) {
            if (scrollKeys[e.keyCode]) {
                preventDefault(e);
                return false;
            }
        }

        function disableScroll() {
            if (window.addEventListener) // older FF
                window.addEventListener('DOMMouseScroll', preventDefault, false);
            window.onwheel = preventDefault; // modern standard
            window.onmousewheel = document.onmousewheel = preventDefault; // older browsers, IE
            window.ontouchmove = preventDefault; // mobile
            document.onkeydown = preventDefaultForScrollKeys;
        }

        function enableScroll() {
            if (window.removeEventListener)
                window.removeEventListener('DOMMouseScroll', preventDefault, false);
            window.onmousewheel = document.onmousewheel = null;
            window.onwheel = null;
            window.ontouchmove = null;
            document.onkeydown = null;
        }

        function isUsed(target) {
            for (let i = 0; i < code.length; i++) {
                if (code[i] === target) {
                    return true
                }
            }
            return false
        }

        function isAvailable(target) {
            for (let i = 0; i < dots.length; i++) {
                if (dots[i] === target) {
                    return true
                }
            }
            return false
        }

        function updateLine(line) {
            return function(e) {
                e.preventDefault()
                if (currentline !== line) return
                let pos = svgPosition(e.target, e)
                line.setAttribute('x2', pos.x)
                line.setAttribute('y2', pos.y)

                return false
            }
        }

        function discoverDot(e, target) {
            if (!target) {
                let {x, y} = getMousePos(e)
                target = document.elementFromPoint(x, y);
            }
            let cx = target.getAttribute('cx')
            let cy = target.getAttribute('cy')
            if (isAvailable(target) && !isUsed(target)) {
                stopTrack(currentline, target)
                currentline = beginTrack(target)
            }
        }

        function stopTrack(line, target) {
            if (line === undefined) return
            if (currenthandler) {
                svg.off('touchmove mousemove', currenthandler)
            }
            if (target === undefined) return
            let x = target.getAttribute('cx')
            let y = target.getAttribute('cy')
            line.setAttribute('x2', x)
            line.setAttribute('y2', y)

            let _pos = {
                x1: parseInt(line.getAttribute('x1')),
                y1: parseInt(line.getAttribute('y1')),
                x2: parseInt(line.getAttribute('x2')),
                y2: parseInt(line.getAttribute('y2')),
            }
            let _rot = getArrowRot(_pos.x1, _pos.x2, _pos.y1, _pos.y2)
            arrows.append(createNewArrow(_pos.x1 + (_pos.x2-_pos.x1)/2,_pos.y1 + (_pos.y2-_pos.y1)/2, _rot))
        }

        function getArrowRot(x1, x2, y1, y2) {
            //Dir x = 1 derecha, x = -1 Izq | y = 1 Abajo, y = -1 arriba
            let _dir = {
                x: 0,
                y: 0};

            _dir.x = x2 > x1 ? 1 : x2 < x1 ? -1 : 0;
            _dir.y = y2 > y1 ? 1 : y2 < y1 ? -1 : 0;

            if (_dir.x == 1 && _dir.y == 0)
                return 0;
            if (_dir.x == -1 && _dir.y == 0)
                return 180;
            if (_dir.x == 0 && _dir.y == 1)
                return 90;
            if (_dir.x == 0 && _dir.y == -1)
                return 270;
            if (_dir.x == 1 && _dir.y == 1)
                return 45;
            if (_dir.x == 1 && _dir.y == -1)
                return 315;
            if (_dir.x == -1 && _dir.y == 1)
                return 135;
            if (_dir.x == -1 && _dir.y == -1)
                return 225;
        }

        function beginTrack(target) {
            code.push(target)
            let x = target.getAttribute('cx')
            let y = target.getAttribute('cy')
            var line = createNewLine(x, y)
            var marker = createNewMarker(x, y)
            actives.append(marker)
            currenthandler = updateLine(line)
            svg.on('touchmove mousemove', currenthandler)
            lines.append(line);
            if(options.vibrate) vibrate()
            return line
        }

        function createNewMarker(x, y) {
            var marker = document.createElementNS(svgns, "circle")
            marker.setAttribute('cx', x)
            marker.setAttribute('cy', y)
            marker.setAttribute('r', 6)
            return marker
        }

        function createNewLine(x1, y1, x2, y2) {
            var line = document.createElementNS(svgns, "line")
            line.setAttribute('x1', x1)
            line.setAttribute('y1', y1)
            if (x2 === undefined || y2 == undefined) {
                line.setAttribute('x2', x1)
                line.setAttribute('y2', y1)
            } else {
                line.setAttribute('x2', x2)
                line.setAttribute('y2', y2)
            }
            return line
        }

        function createNewArrow(x, y, rot) {

            var arrow = document.createElementNS(svgns, "polygon");
            const w = 4;
            const h = 3;

            let p1 = {x: x-w/2, y: y-h/2};
            let p2 = {x: x-w/2, y: y+h/2};
            let p3 = {x: x+w/2, y: y};

            arrow.setAttribute('points', `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p1.x},${p1.y}`)
            arrow.setAttribute('transform', `rotate(${rot},${x},${y})`)
            return arrow;
        }

        function getMousePos(e) {
            return {
                x: e.clientX || e.originalEvent.touches[0].clientX,
                y :e.clientY || e.originalEvent.touches[0].clientY
            }
        }

        function svgPosition(element, e) {
            let {x, y} = getMousePos(e)
            pt.x = x; pt.y = y;
            return pt.matrixTransform(element.getScreenCTM().inverse());
        }
    }


    PatternLock.defaults = {
        onPattern: () => {},
        vibrate: true,
    }


    return PatternLock
}));
