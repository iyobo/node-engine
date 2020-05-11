import { LiteGraph } from "./classes/LiteGraph";
import { LGraph } from "./classes/LGraph";
import { LGraphNode } from "./classes/LGraphNode";
import { LLink } from "./classes/LLink";
import { LGraphGroup } from "./classes/LGraphGroup";
import { DragAndScale } from "./classes/DragAndScale";
import { LGraphCanvas } from "./classes/LGraphCanvas";
import {
    compareObjects,
    distance,
    getLastItem,
    colorToString,
    growBounding,
    hex2num,
    isInsideBounding,
    isInsideRectangle,
    num2hex,
    overlapBounding
} from "./utils";

//timer that works everywhere
if (typeof performance != "undefined") {
    LiteGraph.getTime = performance.now.bind(performance);
} else if (typeof Date != "undefined" && Date.now) {
    LiteGraph.getTime = Date.now.bind(Date);
} else if (typeof process != "undefined") {
    LiteGraph.getTime = function() {
        var t = process.hrtime();
        return t[0] * 0.001 + t[1] * 1e-6;
    };
} else {
    LiteGraph.getTime = function getTime() {
        return new Date().getTime();
    };
}

//*********************************************************************************
// LGraph CLASS
//*********************************************************************************

/**
 * LGraph is the class that contain a full graph. We instantiate one and add nodes to it, and then we can run the execution loop.
 *
 * @class LGraph
 * @constructor
 * @param {Object} o data from previous serialization [optional]
 */


global.LGraph = LiteGraph.LGraph = LGraph;
LiteGraph.LLink = LLink;
global.LGraphNode = LiteGraph.LGraphNode = LGraphNode;

global.LGraphGroup = LiteGraph.LGraphGroup = LGraphGroup;


//****************************************

//Scale and Offset
LiteGraph.DragAndScale = DragAndScale;

global.LGraphCanvas = LiteGraph.LGraphCanvas = LGraphCanvas;


/* Interaction */


//API *************************************************
//like rect but rounded corners
if (typeof (window) != "undefined" && window.CanvasRenderingContext2D) {
    window.CanvasRenderingContext2D.prototype.roundRect = function(
        x,
        y,
        width,
        height,
        radius,
        radius_low
    ) {
        if (radius === undefined) {
            radius = 5;
        }

        if (radius_low === undefined) {
            radius_low = radius;
        }

        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);

        this.lineTo(x + width, y + height - radius_low);
        this.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius_low,
            y + height
        );
        this.lineTo(x + radius_low, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius_low);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
    };
}

LiteGraph.compareObjects = compareObjects;

LiteGraph.distance = distance;


LiteGraph.colorToString = colorToString;

LiteGraph.isInsideRectangle = isInsideRectangle;

LiteGraph.growBounding = growBounding;

LiteGraph.isInsideBounding = isInsideBounding;


LiteGraph.overlapBounding = overlapBounding;


LiteGraph.hex2num = hex2num;


LiteGraph.num2hex = num2hex;

/* LiteGraph GUI elements used for canvas editing *************************************/


LiteGraph.ContextMenu = ContextMenu;



//used by some widgets to render a curve editor
function CurveEditor(points) {
    this.points = points;
    this.selected = -1;
    this.nearest = -1;
    this.size = null; //stores last size used
    this.must_update = true;
    this.margin = 5;
}

LiteGraph.CurveEditor = CurveEditor;



Math.clamp = function(v, a, b) {
    return a > v ? a : b < v ? b : v;
};

if (typeof window != "undefined" && !window["requestAnimationFrame"]) {
    window.requestAnimationFrame =
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(callback) {
            window.setTimeout(callback, 1000 / 60);
        };
}