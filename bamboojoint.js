"use strict";

// BambooJoint.Js
// HTML5 Canvas Goban Renderer
//
// Copyright (c) 2011 Stack Exchange, Inc.
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is furnished
// to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// -----------------------------------------------------------------------------
//
// Contains lyfe.js, Copyright (c) 2011 Benjamin Dumke-von der Ehe
// Also licensed under the MIT license
// https://bitbucket.org/balpha/lyfe
//
// -----------------------------------------------------------------------------
//
// Usage:
//
// var result = BambooJoint.render(source);
//
// If source is not legal board markup, or if the browser doesn't support the HTML5 canvas, returns null.
// Otherwise, returns an object with a property result.canvas, which is a <canvas> DOM element,
// properties result.width and result.height that give the dimensions of the canvas in pixels,
// and optionally -- if given in the source -- a property result.caption.
//
// -----------------------------------------------------------------------------

window.BambooJoint = (function () {
    
    if (!document.createElement("canvas").getContext)
        return { render: function () { return null; }};
    
    function parse(text) {
        text = text.replace(/\r/g, "\n");
        var lines = Generator(text.split(/\n+/)).filter(function (l) { return /\S/.test(l); }).evaluated(),
            result = { board: [] },
            board = result.board;
        
        if (lines.any(function (line) { return !/^\$\$/.test(line); })) {
            return null;
        }
        
        var firstLine = lines.first(),
            coordinates;
            
        if (!firstLine)
            return null;

        result.moveDelta = 0;
        
        // check the first line for options and/or caption
        // note that we're not actually replacing (and not storing the result), and that the function gets called at most once
        firstLine.replace(/^\$\$(([BW]?)(c?)(\d*)(?:m(\d+))?)(?:\s+(.*)|)$/, function (whole, options, color, coord, size, firstMove, caption) {
            
            caption = (caption || "").replace(/\s+$/, "");
            if (!options.length) { // no options -- is this a regular board markup line, or is there a caption?
                
                if (!caption.length) // no caption at all -- we're outta here
                    return;
                
                if (!/[^\sOW@QPXB#YZCSTM\d?a-z,*+|_-]/.test(caption)) { // all characters are legal markup
                    if (!/\w{2} \w{2}/.test(caption)) // doesn't seem to be words
                        return;
                }
            }
            
            result.whiteFirst = color === "W";
            coordinates = coord === "c";
            
            var sizeInt = parseInt(size, 10);
            if (isFinite(sizeInt))
                result.boardSize = sizeInt;
                
            var firstMoveInt = parseInt(firstMove, 10);
            if (isFinite(firstMoveInt))
                result.moveDelta = firstMoveInt - 1;
                
            result.caption = caption;
            
            lines = lines.skip(1);
        });
        
        var lastRow;
        
        lines.forEach(function (line) {
            if (/^\$\$\s(?:[|+-]\s*){2,}$/.test(line)) { // currently, only full horizontal edges are considered
                if (lastRow)
                    lastRow.bottom = true;
                if (!board.length || board[board.length - 1].length) {
                    lastRow = [];
                    board.push(lastRow);
                }
                board[board.length - 1].top = true;
                return;
            }
            if (!board.length || board[board.length - 1].length) {
                lastRow = [];
                board.push(lastRow);
            }
            var pieces = Generator(function () {
                var l = line.length, c;
                for (var i = 0; i < l; i++) {
                    c = line.charAt(i);
                    if (!/[$\s]/.test(c))
                        this.yield(c);
                }
            });
                    
            var lastField,
                nextIsLeft = false;
            
            pieces.forEach(function (piece) {
                if (/[|+-]/.test(piece)) {
                    if (lastField)
                        lastField.right = true;
                    nextIsLeft = true;
                    return;
                }
                var field = { piece: piece };
                if (nextIsLeft)
                    field.left = true;
                nextIsLeft = false;
                lastRow.push(field);
                lastField = field;
            });
           
        });
        
        // last row is empty
        if (board.length && ! board[board.length - 1].length)
            board.pop();
        
        var width = 0, height = 0;
        if (!board.length) {
            //console.log("empty")
            return null;
        } else {
            var diff = false,
                
            width = Generator(board).map(function (r) { return r.length; }).reduce(function (a, b) {
                diff = diff || (a !== b);
                return Math.max(a, b);
            })
            height = board.length;
            if (diff) {
                return null; // the rows don't have equal widths
            }
        }
        
        if (coordinates) {
            var leftEdge = board[0][0].left,
                rightEdge = board[0][width - 1].right,
                topEdge = board[0].top,
                bottomEdge = board[height - 1].bottom;
                
            var boardSize = result.boardSize;
            if (!boardSize) {
                boardSize = 19;
                if (leftEdge && rightEdge)
                    boardSize = width;
                else if (topEdge && bottomEdge)
                    boardSize = height;
            }
            if (leftEdge)
                result.leftCoordinate = 0;
            else if (rightEdge)
                result.leftCoordinate = boardSize - width;
            else
                coordinates = false;
                
            if (topEdge)
                result.topCoordinate = boardSize - 1;
            else if (bottomEdge)
                result.topCoordinate = height - 1;
            else
                coordinates = false;
                
            if (coordinates)
                result.coordinates = true;
        }
        
        result.width = width;
        result.height = height;
        return result;
    }

    var stoneImages;
    
    function createStoneImages() {
        return {
            white: createStoneImage("white"),
            black: createStoneImage("black"),
            both: createStoneImage("both")
        };
    }

    function createStoneImage(color) {
        var stone, actualColor, angle1, angle2;
        if (color === "both") {
            stone = createStoneImage("black");
            actualColor = "white";
            angle1 = 0.5 * Math.PI;
            angle2 = 1.5 * Math.PI;
        } else {
            stone = document.createElement("canvas");
            stone.width = 29;
            stone.height = 29;
            actualColor = color;
            angle1 = 0;
            angle2 = 2 * Math.PI;
        }
        var ctx = stone.getContext("2d");
        
        ctx.save();
        ctx.fillStyle = actualColor;
        if (color !== "both") {
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.shadowBlur = 3;
            ctx.shadowColor = "rgba(0,0,0,.7)";
        }
       
        ctx.beginPath();
        ctx.arc(14.5, 14.5, 10, angle1, angle2, false);
        ctx.fill();
        ctx.restore();

        // we're doing this in two steps because of a bug in the android browser
        // http://code.google.com/p/android/issues/detail?id=21813
        ctx.save();
        var gradient = ctx.createRadialGradient(14.5, 14.5, 10, 7.5, 7.5, 2);
        var c1 = actualColor === "white" ? "#e0e0e0" : "black";
        var c2 = actualColor === "black" ? "#404040" : "white";
        gradient.addColorStop(0, c1);
        gradient.addColorStop(.25, c1);
        gradient.addColorStop(1, c2);
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.arc(14.5, 14.5, 10, angle1, angle2, false);
        ctx.fill();
        ctx.restore();
        return stone;
    }
    
    function renderParsed(parsed) {
        
        stoneImages = stoneImages || createStoneImages();
        
        var pixWidth = (parsed.width + 1) * 22,
            pixHeight = (parsed.height + 1) * 22,
            bgColor = '#d3823b';
        
        if (parsed.coordinates) {
            pixWidth += 6;
            pixHeight += 6;
        }
        
        var canvas = document.createElement("canvas");
        canvas.width = pixWidth;
        canvas.height = pixHeight;

        var ctx = canvas.getContext("2d");
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, pixWidth, pixHeight);
        
        function stone(x, y, color) {
            ctx.drawImage(stoneImages[color], x - 14.5, y - 14.5)
        }
        
        function putlines(x, y, top, right, bottom, left) {
            ctx.beginPath();
            ctx.moveTo(x - (left ? 0 : 11), y);
            ctx.lineTo(x + (right ? 0 : 11), y);
            ctx.moveTo(x, y - (top ? 0 : 11));
            ctx.lineTo(x, y + (bottom ? 0 : 11));
            ctx.stroke();
        }
        
        function mark_circle(x, y) {
            ctx.save();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.restore();
        }
        function mark_square(x, y) {
            ctx.save();
            ctx.fillStyle = "red";
            ctx.fillRect(x - 5, y - 5, 10, 10);
            ctx.restore();
        }
        function mark_triangle(x, y) {
            ctx.save();
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.moveTo(x, y - 6);
            ctx.lineTo(x + 6, y + 4);
            ctx.lineTo(x - 6, y + 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        function mark_x(x, y) {
            ctx.save();
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 5, y - 5);
            ctx.lineTo(x + 5, y + 5);
            ctx.moveTo(x + 5, y - 5);
            ctx.lineTo(x - 5, y + 5);
            ctx.stroke();
            ctx.restore();
        }
        
        var edge = parsed.coordinates ? 28.5 : 22.5;
        
        Generator(parsed.board).forEach(function (line, row) {
            
            Generator(line).forEach(function (field, col) {
                var x = col * 22 + edge,
                    y = row * 22 + edge,
                    piece = field.piece;
                    
                if (piece !== "_")
                    putlines(x, y, line.top, field.right, line.bottom, field.left);
                ctx.save();
                
                if (/[OW@QP]/.test(piece))
                    stone(x, y, "white");
                else if (/[XB#YZ]/.test(piece))
                    stone(x, y, "black");
                    
                if (/[BWC]/.test(piece))
                    mark_circle(x, y);
                else if (/[#@S]/.test(piece))
                    mark_square(x, y);
                else if (/[YQT]/.test(piece))
                    mark_triangle(x, y);
                else if (/[ZPM]/.test(piece))
                    mark_x(x, y);
                else if (piece === "*")
                    stone(x, y, "both");
                else if (/^\d$/.test(piece)) {
                    var val = parseInt(piece, 10);
                    if (val === 0)
                        val = 10;
                    var isBlack = (val % 2 === 1) ^ parsed.whiteFirst;
                    stone(x, y, isBlack ? "black" : "white");
                    ctx.font = "12px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillStyle = isBlack ? "white" : "black";
                    ctx.fillText(val + parsed.moveDelta, x, y + 4);
                } else if (piece === "?") {
                    ctx.fillStyle = "rgba(255,255,255,0.5)";
                    
                    // using integer coordinates here to avoid seeing very thin lines between adjacent shaded points
                    ctx.fillRect(x - 11.5, y - 11.5, 22, 22);
                } else if (/^[a-z]$/.test(piece)) {
                    ctx.font = "bold 15px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillStyle = "black";
                    ctx.lineWidth = 6;
                    ctx.strokeStyle = bgColor;
                    ctx.strokeText(piece, x, y + 5);
                    ctx.fillText(piece, x, y + 5);
                    ctx.lineWidth = 1;
                } else if (piece === ",") {
                    ctx.fillStyle = "black";
                    ctx.beginPath();
                    ctx.arc(x, y, 2.5, 0, 2 * Math.PI, false);
                    ctx.fill();
                }
                ctx.restore();
            });
        });
        
        if (parsed.coordinates) {
            ctx.save();
            ctx.fillStyle = "#6b421e";
            ctx.font = "10px sans-serif";

            for (var row = 0; row < parsed.height; row++) {
                ctx.textAlign = "right";
                ctx.fillText(parsed.topCoordinate - row + 1, 16, row * 22 + 31.5);
            }
            for (var col = 0; col < parsed.width; col++) {
                ctx.textAlign = "center";
                
                var letter = parsed.leftCoordinate + col + 1;
                if (letter >= 9) // skip "I"
                    letter++;
                
                ctx.fillText(String.fromCharCode(64 + letter), col * 22 + 28.5, 12);
            }
            ctx.restore();
        }
        
        return {
            canvas: canvas,
            width: pixWidth,
            height: pixHeight
        };
    }
    
    return {
        render: function (source) {
            var parsed = parse(source);
            
            if (!parsed)
                return null;
                
            var result = renderParsed(parsed);
                
            if (parsed.caption && parsed.caption.length)
                result.caption = parsed.caption;
            
            return result;
        }
    }
})();

// lyfe.js
(function(){var k;k=Array.prototype.indexOf?function(a,b){return a.indexOf(b)}:function(a,b){for(var c=a.length,d=0;d<c;d++)if(d in a&&a[d]===b)return d;return-1};var h={},e=function(a){if(!(this instanceof e))return new e(a);this.forEach=typeof a==="function"?i(a):a.constructor===Array?p(a):q(a)},l=function(){throw h;},j=function(a){this.message=a;this.name="IterationError"};j.prototype=Error.prototype;var i=function(a){return function(b,c){var d=!1,f=0,m={yield:function(a){if(d)throw new j("yield after end of iteration");
a=b.call(c,a,f,l);f++;return a},yieldMany:function(a){(a instanceof e?a:new e(a)).forEach(function(a){m.yield(a)})},stop:l};try{a.call(m)}catch(g){if(g!==h)throw g;}finally{d=!0}}},p=function(a){return i(function(){for(var b=a.length,c=0;c<b;c++)c in a&&this.yield(a[c])})},q=function(a){return i(function(){for(var b in a)a.hasOwnProperty(b)&&this.yield([b,a[b]])})};e.prototype={toArray:function(){var a=[];this.forEach(function(b){a.push(b)});return a},filter:function(a,b){var c=this;return new e(function(){var d=
this;c.forEach(function(c){a.call(b,c)&&d.yield(c)})})},take:function(a){var b=this;return new e(function(){var c=this;b.forEach(function(b,f){f>=a&&c.stop();c.yield(b)})})},skip:function(a){var b=this;return new e(function(){var c=this;b.forEach(function(b,f){f>=a&&c.yield(b)})})},map:function(a,b){var c=this;return new e(function(){var d=this;c.forEach(function(c){d.yield(a.call(b,c))})})},zipWithArray:function(a,b){typeof b==="undefined"&&(b=function(a,b){return[a,b]});var c=this;return new e(function(){var d=
a.length,f=this;c.forEach(function(c,e){e>=d&&f.stop();f.yield(b(c,a[e]))})})},reduce:function(a,b){var c,d;arguments.length<2?c=!0:(c=!1,d=b);this.forEach(function(b){c?(d=b,c=!1):d=a(d,b)});return d},and:function(a){var b=this;return new e(function(){this.yieldMany(b);this.yieldMany(a)})},takeWhile:function(a){var b=this;return new e(function(){var c=this;b.forEach(function(b){a(b)?c.yield(b):c.stop()})})},skipWhile:function(a){var b=this;return new e(function(){var c=this,d=!0;b.forEach(function(b){(d=
d&&a(b))||c.yield(b)})})},all:function(a){var b=!0;this.forEach(function(c,d,e){if(!(a?a(c):c))b=!1,e()});return b},any:function(a){var b=!1;this.forEach(function(c,d,e){if(a?a(c):c)b=!0,e()});return b},first:function(){var a;this.forEach(function(b,c,d){a=b;d()});return a},groupBy:function(a){var b=this;return new e(function(){var c=[],d=[];b.forEach(function(b){var e=a(b),g=k(c,e);g===-1?(c.push(e),d.push([b])):d[g].push(b)});this.yieldMany((new e(c)).zipWithArray(d,function(a,b){var c=new e(b);
c.key=a;return c}))})},evaluated:function(){return new e(this.toArray())},except:function(a){return this.filter(function(b){return b!==a})},sortBy:function(a){var b=this;return new e(function(){var c=b.toArray(),d=n(0,c.length).toArray(),f=this;d.sort(function(b,e){var d=a(c[b]),f=a(c[e]);if(typeof d===typeof f){if(d===f)return b<e?-1:1;if(d<f)return-1;if(d>f)return 1}throw new TypeError("cannot compare "+d+" and "+f);});(new e(d)).forEach(function(a){f.yield(c[a])})})}};var o=function(a,b){var c=
a;typeof b==="undefined"&&(b=1);return new e(function(){for(;;)this.yield(c),c+=b})},n=function(a,b){return o(a,1).take(b)};window.Generator=e;e.BreakIteration=h;e.Count=o;e.Range=n;e.IterationError=j})();
