//*********************************************************************************
// LGraphCanvas: LGraph renderer CLASS
//*********************************************************************************

import { DragAndScale } from "./DragAndScale";
import { LiteGraph } from "./LiteGraph";

/* LGraphCanvas render */
var temp = new Float32Array(4);
var temp_vec2 = new Float32Array(2);
var tmp_area = new Float32Array(4);

var margin_area = new Float32Array(4);
var link_bounding = new Float32Array(4);
var tempA = new Float32Array(2);
var tempB = new Float32Array(2);


/**
 * This class is in charge of rendering one graph inside a canvas. And provides all the interaction required.
 * Valid callbacks are: onNodeSelected, onNodeDeselected, onShowNodePanel, onNodeDblClicked
 *
 * @class LGraphCanvas
 * @constructor
 * @param {HTMLCanvas} canvas the canvas where you want to render (it accepts a selector in string format or the canvas element itself)
 * @param {LGraph} graph [optional]
 * @param {Object} options [optional] { skip_rendering, autoresize }
 */
export class LGraphCanvas {

    static link_type_colors = {
        "-1": LiteGraph.EVENT_LINK_COLOR,
        number: "#AAA",
        node: "#DCA"
    };
    static gradients = {}; //cache of gradients

    constructor(canvas, graph, options) {
        options = options || {};

        //if(graph === undefined)
        //	throw ("No graph assigned");
        this.background_image =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQBJREFUeNrs1rEKwjAUhlETUkj3vP9rdmr1Ysammk2w5wdxuLgcMHyptfawuZX4pJSWZTnfnu/lnIe/jNNxHHGNn//HNbbv+4dr6V+11uF527arU7+u63qfa/bnmh8sWLBgwYJlqRf8MEptXPBXJXa37BSl3ixYsGDBMliwFLyCV/DeLIMFCxYsWLBMwSt4Be/NggXLYMGCBUvBK3iNruC9WbBgwYJlsGApeAWv4L1ZBgsWLFiwYJmCV/AK3psFC5bBggULloJX8BpdwXuzYMGCBctgwVLwCl7Be7MMFixYsGDBsu8FH1FaSmExVfAxBa/gvVmwYMGCZbBg/W4vAQYA5tRF9QYlv/QAAAAASUVORK5CYII=";

        if (canvas && canvas.constructor === String) {
            canvas = document.querySelector(canvas);
        }

        this.ds = new DragAndScale();
        this.zoom_modify_alpha = true; //otherwise it generates ugly patterns when scaling down too much

        this.title_text_font = "" + LiteGraph.NODE_TEXT_SIZE + "px Arial";
        this.inner_text_font =
            "normal " + LiteGraph.NODE_SUBTEXT_SIZE + "px Arial";
        this.node_title_color = LiteGraph.NODE_TITLE_COLOR;
        this.default_link_color = LiteGraph.LINK_COLOR;
        this.default_connection_color = {
            input_off: "#778",
            input_on: "#7F7",
            output_off: "#778",
            output_on: "#7F7"
        };

        this.highquality_render = true;
        this.use_gradients = false; //set to true to render titlebar with gradients
        this.editor_alpha = 1; //used for transition
        this.pause_rendering = false;
        this.clear_background = true;

        this.read_only = false; //if set to true users cannot modify the graph
        this.render_only_selected = true;
        this.live_mode = false;
        this.show_info = true;
        this.allow_dragcanvas = true;
        this.allow_dragnodes = true;
        this.allow_interaction = true; //allow to control widgets, buttons, collapse, etc
        this.allow_searchbox = true;
        this.allow_reconnect_links = false; //allows to change a connection with having to redo it again

        this.drag_mode = false;
        this.dragging_rectangle = null;

        this.filter = null; //allows to filter to only accept some type of nodes in a graph

        this.always_render_background = false;
        this.render_shadows = true;
        this.render_canvas_border = true;
        this.render_connections_shadows = false; //too much cpu
        this.render_connections_border = true;
        this.render_curved_connections = false;
        this.render_connection_arrows = false;
        this.render_collapsed_slots = true;
        this.render_execution_order = false;
        this.render_title_colored = true;
        this.render_link_tooltip = true;

        this.links_render_mode = LiteGraph.SPLINE_LINK;

        this.canvas_mouse = [0, 0]; //mouse in canvas graph coordinates, where 0,0 is the top-left corner of the blue rectangle

        //to personalize the search box
        this.onSearchBox = null;
        this.onSearchBoxSelection = null;

        //callbacks
        this.onMouse = null;
        this.onDrawBackground = null; //to render background objects (behind nodes and connections) in the canvas affected by transform
        this.onDrawForeground = null; //to render foreground objects (above nodes and connections) in the canvas affected by transform
        this.onDrawOverlay = null; //to render foreground objects not affected by transform (for GUIs)
        this.onDrawLinkTooltip = null; //called when rendering a tooltip
        this.onNodeMoved = null; //called after moving a node
        this.onSelectionChange = null; //called if the selection changes

        this.connections_width = 3;
        this.round_radius = 8;

        this.current_node = null;
        this.node_widget = null; //used for widgets
        this.over_link_center = null;
        this.last_mouse_position = [0, 0];
        this.visible_area = this.ds.visible_area;
        this.visible_links = [];

        //link canvas and graph
        if (graph) {
            graph.attachCanvas(this);
        }

        this.setCanvas(canvas);
        this.clear();

        if (!options.skip_render) {
            this.startRendering();
        }

        this.autoresize = options.autoresize;
    }

    /**
     * clears all the data inside
     *
     * @method clear
     */
    clear() {
        this.frame = 0;
        this.last_draw_time = 0;
        this.render_time = 0;
        this.fps = 0;

        //this.scale = 1;
        //this.offset = [0,0];

        this.dragging_rectangle = null;

        this.selected_nodes = {};
        this.selected_group = null;

        this.visible_nodes = [];
        this.node_dragged = null;
        this.node_over = null;
        this.node_capturing_input = null;
        this.connecting_node = null;
        this.highlighted_links = {};

        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
        this.dirty_area = null;

        this.node_in_panel = null;
        this.node_widget = null;

        this.last_mouse = [0, 0];
        this.last_mouseclick = 0;
        this.visible_area.set([0, 0, 0, 0]);

        if (this.onClear) {
            this.onClear();
        }
    };

    /**
     * assigns a graph, you can reassign graphs to the same canvas
     *
     * @method setGraph
     * @param {LGraph} graph
     */
    setGraph(graph, skip_clear) {
        if (this.graph == graph) {
            return;
        }

        if (!skip_clear) {
            this.clear();
        }

        if (!graph && this.graph) {
            this.graph.detachCanvas(this);
            return;
        }

        graph.attachCanvas(this);

        //remove the graph stack in case a subgraph was open
        if (this._graph_stack)
            this._graph_stack = null;

        this.setDirty(true, true);
    };

    /**
     * opens a graph contained inside a node in the current graph
     *
     * @method openSubgraph
     * @param {LGraph} graph
     */
    openSubgraph(graph) {
        if (!graph) {
            throw "graph cannot be null";
        }

        if (this.graph == graph) {
            throw "graph cannot be the same";
        }

        this.clear();

        if (this.graph) {
            if (!this._graph_stack) {
                this._graph_stack = [];
            }
            this._graph_stack.push(this.graph);
        }

        graph.attachCanvas(this);
        this.setDirty(true, true);
    };

    /**
     * closes a subgraph contained inside a node
     *
     * @method closeSubgraph
     * @param {LGraph} assigns a graph
     */
    closeSubgraph() {
        if (!this._graph_stack || this._graph_stack.length == 0) {
            return;
        }
        var subgraph_node = this.graph._subgraph_node;
        var graph = this._graph_stack.pop();
        this.selected_nodes = {};
        this.highlighted_links = {};
        graph.attachCanvas(this);
        this.setDirty(true, true);
        if (subgraph_node) {
            this.centerOnNode(subgraph_node);
            this.selectNodes([subgraph_node]);
        }
    };

    /**
     * returns the visualy active graph (in case there are more in the stack)
     * @method getCurrentGraph
     * @return {LGraph} the active graph
     */
    getCurrentGraph() {
        return this.graph;
    };

    /**
     * assigns a canvas
     *
     * @method setCanvas
     * @param {Canvas} assigns a canvas (also accepts the ID of the element (not a selector)
     */
    setCanvas(canvas, skip_events) {
        var that = this;

        if (canvas) {
            if (canvas.constructor === String) {
                canvas = document.getElementById(canvas);
                if (!canvas) {
                    throw "Error creating LiteGraph canvas: Canvas not found";
                }
            }
        }

        if (canvas === this.canvas) {
            return;
        }

        if (!canvas && this.canvas) {
            //maybe detach events from old_canvas
            if (!skip_events) {
                this.unbindEvents();
            }
        }

        this.canvas = canvas;
        this.ds.element = canvas;

        if (!canvas) {
            return;
        }

        //this.canvas.tabindex = "1000";
        canvas.className += " lgraphcanvas";
        canvas.data = this;
        canvas.tabindex = "1"; //to allow key events

        //bg canvas: used for non changing stuff
        this.bgcanvas = null;
        if (!this.bgcanvas) {
            this.bgcanvas = document.createElement("canvas");
            this.bgcanvas.width = this.canvas.width;
            this.bgcanvas.height = this.canvas.height;
        }

        if (canvas.getContext == null) {
            if (canvas.localName != "canvas") {
                throw "Element supplied for LGraphCanvas must be a <canvas> element, you passed a " +
                canvas.localName;
            }
            throw "This browser doesn't support Canvas";
        }

        var ctx = (this.ctx = canvas.getContext("2d"));
        if (ctx == null) {
            if (!canvas.webgl_enabled) {
                console.warn(
                    "This canvas seems to be WebGL, enabling WebGL renderer"
                );
            }
            this.enableWebGL();
        }

        //input:  (move and up could be unbinded)
        this._mousemove_callback = this.processMouseMove.bind(this);
        this._mouseup_callback = this.processMouseUp.bind(this);

        if (!skip_events) {
            this.bindEvents();
        }
    };

    //used in some events to capture them
    _doNothing doNothing(e) {
        e.preventDefault();
        return false;
    };
    _doReturnTrue doNothing(e) {
        e.preventDefault();
        return true;
    };

    /**
     * binds mouse, keyboard, touch and drag events to the canvas
     * @method bindEvents
     **/
    bindEvents() {
        if (this._events_binded) {
            console.warn("LGraphCanvas: events already binded");
            return;
        }

        var canvas = this.canvas;
        var ref_window = this.getCanvasWindow();
        var document = ref_window.document; //hack used when moving canvas between windows

        this._mousedown_callback = this.processMouseDown.bind(this);
        this._mousewheel_callback = this.processMouseWheel.bind(this);

        canvas.addEventListener("mousedown", this._mousedown_callback, true); //down do not need to store the binded
        canvas.addEventListener("mousemove", this._mousemove_callback);
        canvas.addEventListener("mousewheel", this._mousewheel_callback, false);

        canvas.addEventListener("contextmenu", this._doNothing);
        canvas.addEventListener(
            "DOMMouseScroll",
            this._mousewheel_callback,
            false
        );

        //touch events
        //if( 'touchstart' in document.documentElement )
        {
            canvas.addEventListener("touchstart", this.touchHandler, true);
            canvas.addEventListener("touchmove", this.touchHandler, true);
            canvas.addEventListener("touchend", this.touchHandler, true);
            canvas.addEventListener("touchcancel", this.touchHandler, true);
        }

        //Keyboard ******************
        this._key_callback = this.processKey.bind(this);

        canvas.addEventListener("keydown", this._key_callback, true);
        document.addEventListener("keyup", this._key_callback, true); //in document, otherwise it doesn't fire keyup

        //Dropping Stuff over nodes ************************************
        this._ondrop_callback = this.processDrop.bind(this);

        canvas.addEventListener("dragover", this._doNothing, false);
        canvas.addEventListener("dragend", this._doNothing, false);
        canvas.addEventListener("drop", this._ondrop_callback, false);
        canvas.addEventListener("dragenter", this._doReturnTrue, false);

        this._events_binded = true;
    };

    /**
     * unbinds mouse events from the canvas
     * @method unbindEvents
     **/
    unbindEvents() {
        if (!this._events_binded) {
            console.warn("LGraphCanvas: no events binded");
            return;
        }

        var ref_window = this.getCanvasWindow();
        var document = ref_window.document;

        this.canvas.removeEventListener("mousedown", this._mousedown_callback);
        this.canvas.removeEventListener(
            "mousewheel",
            this._mousewheel_callback
        );
        this.canvas.removeEventListener(
            "DOMMouseScroll",
            this._mousewheel_callback
        );
        this.canvas.removeEventListener("keydown", this._key_callback);
        document.removeEventListener("keyup", this._key_callback);
        this.canvas.removeEventListener("contextmenu", this._doNothing);
        this.canvas.removeEventListener("drop", this._ondrop_callback);
        this.canvas.removeEventListener("dragenter", this._doReturnTrue);

        this.canvas.removeEventListener("touchstart", this.touchHandler);
        this.canvas.removeEventListener("touchmove", this.touchHandler);
        this.canvas.removeEventListener("touchend", this.touchHandler);
        this.canvas.removeEventListener("touchcancel", this.touchHandler);

        this._mousedown_callback = null;
        this._mousewheel_callback = null;
        this._key_callback = null;
        this._ondrop_callback = null;

        this._events_binded = false;
    };

    static getFileExtension(url) {
        var question = url.indexOf("?");
        if (question != -1) {
            url = url.substr(0, question);
        }
        var point = url.lastIndexOf(".");
        if (point == -1) {
            return "";
        }
        return url.substr(point + 1).toLowerCase();
    };

    /**
     * this function allows to render the canvas using WebGL instead of Canvas2D
     * this is useful if you plant to render 3D objects inside your nodes, it uses litegl.js for webgl and canvas2DtoWebGL to emulate the Canvas2D calls in webGL
     * @method enableWebGL
     **/
    enableWebGL() {
        if (typeof GL === undefined) {
            throw "litegl.js must be included to use a WebGL canvas";
        }
        if (typeof enableWebGLCanvas === undefined) {
            throw "webglCanvas.js must be included to use this feature";
        }

        this.gl = this.ctx = enableWebGLCanvas(this.canvas);
        this.ctx.webgl = true;
        this.bgcanvas = this.canvas;
        this.bgctx = this.gl;
        this.canvas.webgl_enabled = true;

        /*
	GL.create({ canvas: this.bgcanvas });
	this.bgctx = enableWebGLCanvas( this.bgcanvas );
	window.gl = this.gl;
	*/
    };

    /**
     * marks as dirty the canvas, this way it will be rendered again
     *
     * @class LGraphCanvas
     * @method setDirty
     * @param {bool} fgcanvas if the foreground canvas is dirty (the one containing the nodes)
     * @param {bool} bgcanvas if the background canvas is dirty (the one containing the wires)
     */
    setDirty(fgcanvas, bgcanvas) {
        if (fgcanvas) {
            this.dirty_canvas = true;
        }
        if (bgcanvas) {
            this.dirty_bgcanvas = true;
        }
    };

    /**
     * Used to attach the canvas in a popup
     *
     * @method getCanvasWindow
     * @return {window} returns the window where the canvas is attached (the DOM root node)
     */
    getCanvasWindow() {
        if (!this.canvas) {
            return window;
        }
        var doc = this.canvas.ownerDocument;
        return doc.defaultView || doc.parentWindow;
    };

    /**
     * starts rendering the content of the canvas when needed
     *
     * @method startRendering
     */
    startRendering() {
        if (this.is_rendering) {
            return;
        } //already rendering

        this.is_rendering = true;
        renderFrame.call(this);

        function renderFrame() {
            if (!this.pause_rendering) {
                this.draw();
            }

            var window = this.getCanvasWindow();
            if (this.is_rendering) {
                window.requestAnimationFrame(renderFrame.bind(this));
            }
        }
    };

    /**
     * stops rendering the content of the canvas (to save resources)
     *
     * @method stopRendering
     */
    stopRendering() {
        this.is_rendering = false;
        /*
	if(this.rendering_timer_id)
	{
		clearInterval(this.rendering_timer_id);
		this.rendering_timer_id = null;
	}
	*/
    };

    /* LiteGraphCanvas input */

    processMouseDown(e) {
        if (!this.graph) {
            return;
        }

        this.adjustMouseEvent(e);

        var ref_window = this.getCanvasWindow();
        var document = ref_window.document;
        LGraphCanvas.active_canvas = this;
        var that = this;

        //move mouse move event to the window in case it drags outside of the canvas
        this.canvas.removeEventListener("mousemove", this._mousemove_callback);
        ref_window.document.addEventListener(
            "mousemove",
            this._mousemove_callback,
            true
        ); //catch for the entire window
        ref_window.document.addEventListener(
            "mouseup",
            this._mouseup_callback,
            true
        );

        var node = this.graph.getNodeOnPos(
            e.canvasX,
            e.canvasY,
            this.visible_nodes,
            5
        );
        var skip_dragging = false;
        var skip_action = false;
        var now = LiteGraph.getTime();
        var is_double_click = now - this.last_mouseclick < 300;

        this.canvas_mouse[0] = e.canvasX;
        this.canvas_mouse[1] = e.canvasY;
        this.canvas.focus();

        LiteGraph.closeAllContextMenus(ref_window);

        if (this.onMouse) {
            if (this.onMouse(e) == true) {
                return;
            }
        }

        if (e.which == 1) {
            //left button mouse
            if (e.ctrlKey) {
                this.dragging_rectangle = new Float32Array(4);
                this.dragging_rectangle[0] = e.canvasX;
                this.dragging_rectangle[1] = e.canvasY;
                this.dragging_rectangle[2] = 1;
                this.dragging_rectangle[3] = 1;
                skip_action = true;
            }

            var clicking_canvas_bg = false;

            //when clicked on top of a node
            //and it is not interactive
            if (node && this.allow_interaction && !skip_action && !this.read_only) {
                if (!this.live_mode && !node.flags.pinned) {
                    this.bringToFront(node);
                } //if it wasn't selected?

                //not dragging mouse to connect two slots
                if (
                    !this.connecting_node &&
                    !node.flags.collapsed &&
                    !this.live_mode
                ) {
                    //Search for corner for resize
                    if (
                        !skip_action &&
                        node.resizable !== false &&
                        isInsideRectangle(
                            e.canvasX,
                            e.canvasY,
                            node.pos[0] + node.size[0] - 5,
                            node.pos[1] + node.size[1] - 5,
                            10,
                            10
                        )
                    ) {
                        this.resizing_node = node;
                        this.canvas.style.cursor = "se-resize";
                        skip_action = true;
                    } else {
                        //search for outputs
                        if (node.outputs) {
                            for (
                                var i = 0, l = node.outputs.length;
                                i < l;
                                ++i
                            ) {
                                var output = node.outputs[i];
                                var link_pos = node.getConnectionPos(false, i);
                                if (
                                    isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20
                                    )
                                ) {
                                    this.connecting_node = node;
                                    this.connecting_output = output;
                                    this.connecting_pos = node.getConnectionPos(false, i);
                                    this.connecting_slot = i;

                                    if (e.shiftKey) {
                                        node.disconnectOutput(i);
                                    }

                                    if (is_double_click) {
                                        if (node.onOutputDblClick) {
                                            node.onOutputDblClick(i, e);
                                        }
                                    } else {
                                        if (node.onOutputClick) {
                                            node.onOutputClick(i, e);
                                        }
                                    }

                                    skip_action = true;
                                    break;
                                }
                            }
                        }

                        //search for inputs
                        if (node.inputs) {
                            for (
                                var i = 0, l = node.inputs.length;
                                i < l;
                                ++i
                            ) {
                                var input = node.inputs[i];
                                var link_pos = node.getConnectionPos(true, i);
                                if (
                                    isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20
                                    )
                                ) {
                                    if (is_double_click) {
                                        if (node.onInputDblClick) {
                                            node.onInputDblClick(i, e);
                                        }
                                    } else {
                                        if (node.onInputClick) {
                                            node.onInputClick(i, e);
                                        }
                                    }

                                    if (input.link !== null) {
                                        var link_info = this.graph.links[
                                            input.link
                                            ]; //before disconnecting
                                        node.disconnectInput(i);

                                        if (
                                            this.allow_reconnect_links ||
                                            e.shiftKey
                                        ) {
                                            this.connecting_node = this.graph._nodes_by_id[
                                                link_info.origin_id
                                                ];
                                            this.connecting_slot =
                                                link_info.origin_slot;
                                            this.connecting_output = this.connecting_node.outputs[
                                                this.connecting_slot
                                                ];
                                            this.connecting_pos = this.connecting_node.getConnectionPos(false, this.connecting_slot);
                                        }

                                        this.dirty_bgcanvas = true;
                                        skip_action = true;
                                    }
                                }
                            }
                        }
                    } //not resizing
                }

                //Search for corner for collapsing
                /*
				if( !skip_action && isInsideRectangle( e.canvasX, e.canvasY, node.pos[0], node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT ))
				{
					node.collapse();
					skip_action = true;
				}
				*/

                //it wasn't clicked on the links boxes
                if (!skip_action) {
                    var block_drag_node = false;

                    //widgets
                    var widget = this.processNodeWidgets(node, this.canvas_mouse, e);
                    if (widget) {
                        block_drag_node = true;
                        this.node_widget = [node, widget];
                    }

                    //double clicking
                    if (is_double_click && this.selected_nodes[node.id]) {
                        //double click node
                        if (node.onDblClick) {
                            node.onDblClick(e, [e.canvasX - node.pos[0], e.canvasY - node.pos[1]], this);
                        }
                        this.processNodeDblClicked(node);
                        block_drag_node = true;
                    }

                    //if do not capture mouse
                    if (node.onMouseDown && node.onMouseDown(e, [e.canvasX - node.pos[0], e.canvasY - node.pos[1]], this)) {
                        block_drag_node = true;
                    } else if (this.live_mode) {
                        clicking_canvas_bg = true;
                        block_drag_node = true;
                    }

                    if (!block_drag_node) {
                        if (this.allow_dragnodes) {
                            this.node_dragged = node;
                        }
                        if (!this.selected_nodes[node.id]) {
                            this.processNodeSelected(node, e);
                        }
                    }

                    this.dirty_canvas = true;
                }
            } //clicked outside of nodes
            else {
                //search for link connector
                if (!this.read_only)
                    for (var i = 0; i < this.visible_links.length; ++i) {
                        var link = this.visible_links[i];
                        var center = link._pos;
                        if (
                            !center ||
                            e.canvasX < center[0] - 4 ||
                            e.canvasX > center[0] + 4 ||
                            e.canvasY < center[1] - 4 ||
                            e.canvasY > center[1] + 4
                        ) {
                            continue;
                        }
                        //link clicked
                        this.showLinkMenu(link, e);
                        this.over_link_center = null; //clear tooltip
                        break;
                    }

                this.selected_group = this.graph.getGroupOnPos(e.canvasX, e.canvasY);
                this.selected_group_resizing = false;
                if (this.selected_group && !this.read_only) {
                    if (e.ctrlKey) {
                        this.dragging_rectangle = null;
                    }

                    var dist = distance([e.canvasX, e.canvasY], [this.selected_group.pos[0] + this.selected_group.size[0], this.selected_group.pos[1] + this.selected_group.size[1]]);
                    if (dist * this.ds.scale < 10) {
                        this.selected_group_resizing = true;
                    } else {
                        this.selected_group.recomputeInsideNodes();
                    }
                }

                if (is_double_click && !this.read_only && this.allow_searchbox) {
                    this.showSearchBox(e);
                }

                clicking_canvas_bg = true;
            }

            if (!skip_action && clicking_canvas_bg && this.allow_dragcanvas) {
                this.dragging_canvas = true;
            }
        } else if (e.which == 2) {
            //middle button
        } else if (e.which == 3) {
            //right button
            if (!this.read_only)
                this.processContextMenu(node, e);
        }

        //TODO
        //if(this.node_selected != prev_selected)
        //	this.onNodeSelectionChange(this.node_selected);

        this.last_mouse[0] = e.localX;
        this.last_mouse[1] = e.localY;
        this.last_mouseclick = LiteGraph.getTime();
        this.last_mouse_dragging = true;

        /*
	if( (this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null)
		this.draw();
	*/

        this.graph.change();

        //this is to ensure to defocus(blur) if a text input element is on focus
        if (
            !ref_window.document.activeElement ||
            (ref_window.document.activeElement.nodeName.toLowerCase() !=
                "input" &&
                ref_window.document.activeElement.nodeName.toLowerCase() !=
                "textarea")
        ) {
            e.preventDefault();
        }
        e.stopPropagation();

        if (this.onMouseDown) {
            this.onMouseDown(e);
        }

        return false;
    };

    /**
     * Called when a mouse move event has to be processed
     * @method processMouseMove
     **/
    processMouseMove(e) {
        if (this.autoresize) {
            this.resize();
        }

        if (!this.graph) {
            return;
        }

        LGraphCanvas.active_canvas = this;
        this.adjustMouseEvent(e);
        var mouse = [e.localX, e.localY];
        var delta = [
            mouse[0] - this.last_mouse[0],
            mouse[1] - this.last_mouse[1]
        ];
        this.last_mouse = mouse;
        this.canvas_mouse[0] = e.canvasX;
        this.canvas_mouse[1] = e.canvasY;
        e.dragging = this.last_mouse_dragging;

        if (this.node_widget) {
            this.processNodeWidgets(
                this.node_widget[0],
                this.canvas_mouse,
                e,
                this.node_widget[1]
            );
            this.dirty_canvas = true;
        }

        if (this.dragging_rectangle) {
            this.dragging_rectangle[2] = e.canvasX - this.dragging_rectangle[0];
            this.dragging_rectangle[3] = e.canvasY - this.dragging_rectangle[1];
            this.dirty_canvas = true;
        } else if (this.selected_group && !this.read_only) {
            //moving/resizing a group
            if (this.selected_group_resizing) {
                this.selected_group.size = [
                    e.canvasX - this.selected_group.pos[0],
                    e.canvasY - this.selected_group.pos[1]
                ];
            } else {
                var deltax = delta[0] / this.ds.scale;
                var deltay = delta[1] / this.ds.scale;
                this.selected_group.move(deltax, deltay, e.ctrlKey);
                if (this.selected_group._nodes.length) {
                    this.dirty_canvas = true;
                }
            }
            this.dirty_bgcanvas = true;
        } else if (this.dragging_canvas) {
            this.ds.offset[0] += delta[0] / this.ds.scale;
            this.ds.offset[1] += delta[1] / this.ds.scale;
            this.dirty_canvas = true;
            this.dirty_bgcanvas = true;
        } else if (this.allow_interaction && !this.read_only) {
            if (this.connecting_node) {
                this.dirty_canvas = true;
            }

            //get node over
            var node = this.graph.getNodeOnPos(
                e.canvasX,
                e.canvasY,
                this.visible_nodes
            );

            //remove mouseover flag
            for (var i = 0, l = this.graph._nodes.length; i < l; ++i) {
                if (
                    this.graph._nodes[i].mouseOver &&
                    node != this.graph._nodes[i]
                ) {
                    //mouse leave
                    this.graph._nodes[i].mouseOver = false;
                    if (this.node_over && this.node_over.onMouseLeave) {
                        this.node_over.onMouseLeave(e);
                    }
                    this.node_over = null;
                    this.dirty_canvas = true;
                }
            }

            //mouse over a node
            if (node) {
                //this.canvas.style.cursor = "move";
                if (!node.mouseOver) {
                    //mouse enter
                    node.mouseOver = true;
                    this.node_over = node;
                    this.dirty_canvas = true;

                    if (node.onMouseEnter) {
                        node.onMouseEnter(e);
                    }
                }

                //in case the node wants to do something
                if (node.onMouseMove) {
                    node.onMouseMove(
                        e,
                        [e.canvasX - node.pos[0], e.canvasY - node.pos[1]],
                        this
                    );
                }

                //if dragging a link
                if (this.connecting_node) {
                    var pos = this._highlight_input || [0, 0]; //to store the output of isOverNodeInput

                    //on top of input
                    if (this.isOverNodeBox(node, e.canvasX, e.canvasY)) {
                        //mouse on top of the corner box, don't know what to do
                    } else {
                        //check if I have a slot below de mouse
                        var slot = this.isOverNodeInput(
                            node,
                            e.canvasX,
                            e.canvasY,
                            pos
                        );
                        if (slot != -1 && node.inputs[slot]) {
                            var slot_type = node.inputs[slot].type;
                            if (
                                LiteGraph.isValidConnection(
                                    this.connecting_output.type,
                                    slot_type
                                )
                            ) {
                                this._highlight_input = pos;
                            }
                        } else {
                            this._highlight_input = null;
                        }
                    }
                }

                //Search for corner
                if (this.canvas) {
                    if (
                        isInsideRectangle(
                            e.canvasX,
                            e.canvasY,
                            node.pos[0] + node.size[0] - 5,
                            node.pos[1] + node.size[1] - 5,
                            5,
                            5
                        )
                    ) {
                        this.canvas.style.cursor = "se-resize";
                    } else {
                        this.canvas.style.cursor = "crosshair";
                    }
                }
            } else { //outside

                //search for link connector
                var over_link = null;
                for (var i = 0; i < this.visible_links.length; ++i) {
                    var link = this.visible_links[i];
                    var center = link._pos;
                    if (
                        !center ||
                        e.canvasX < center[0] - 4 ||
                        e.canvasX > center[0] + 4 ||
                        e.canvasY < center[1] - 4 ||
                        e.canvasY > center[1] + 4
                    ) {
                        continue;
                    }
                    over_link = link;
                    break;
                }
                if (over_link != this.over_link_center) {
                    this.over_link_center = over_link;
                    this.dirty_canvas = true;
                }

                if (this.canvas) {
                    this.canvas.style.cursor = "";
                }
            }

            if (this.node_capturing_input && this.node_capturing_input != node && this.node_capturing_input.onMouseMove) {
                this.node_capturing_input.onMouseMove(e, [e.canvasX - this.node_capturing_input.pos[0], e.canvasY - this.node_capturing_input.pos[1]], this);
            }

            if (this.node_dragged && !this.live_mode) {
                for (var i in this.selected_nodes) {
                    var n = this.selected_nodes[i];
                    n.pos[0] += delta[0] / this.ds.scale;
                    n.pos[1] += delta[1] / this.ds.scale;
                }

                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
            }

            if (this.resizing_node && !this.live_mode) {
                //convert mouse to node space
                this.resizing_node.size[0] = e.canvasX - this.resizing_node.pos[0];
                this.resizing_node.size[1] = e.canvasY - this.resizing_node.pos[1];

                //constraint size
                var max_slots = Math.max(
                    this.resizing_node.inputs ? this.resizing_node.inputs.length : 0,
                    this.resizing_node.outputs ? this.resizing_node.outputs.length : 0
                );

                var nodeWidgetHeight = 0;
                if (this.resizing_node.widgets) {
                    this.resizing_node.widgets.forEach(w => {
                        nodeWidgetHeight += LiteGraph.NODE_WIDGET_HEIGHT * w.options.heightScale;
                    });
                }

                var min_height =
                    max_slots * LiteGraph.NODE_SLOT_HEIGHT +
                    (nodeWidgetHeight + 4) + 4;
                if (this.resizing_node.size[1] < min_height) {
                    this.resizing_node.size[1] = min_height;
                }
                if (this.resizing_node.size[0] < LiteGraph.NODE_MIN_WIDTH) {
                    this.resizing_node.size[0] = LiteGraph.NODE_MIN_WIDTH;
                }

                if (this.resizing_node.onResize) {
                    this.resizing_node.onResize(this.resizing_node.size);
                }

                this.canvas.style.cursor = "se-resize";
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
            }
        }

        e.preventDefault();
        return false;
    };

    /**
     * Called when a mouse up event has to be processed
     * @method processMouseUp
     **/
    processMouseUp(e) {
        if (!this.graph) {
            return;
        }

        var window = this.getCanvasWindow();
        var document = window.document;
        LGraphCanvas.active_canvas = this;

        //restore the mousemove event back to the canvas
        document.removeEventListener("mousemove", this._mousemove_callback, true);
        this.canvas.addEventListener("mousemove", this._mousemove_callback, true);
        document.removeEventListener("mouseup", this._mouseup_callback, true);

        this.adjustMouseEvent(e);
        var now = LiteGraph.getTime();
        e.click_time = now - this.last_mouseclick;
        this.last_mouse_dragging = false;

        if (e.which == 1) {

            if (this.node_widget) {
                this.processNodeWidgets(this.node_widget[0], this.canvas_mouse, e);
            }

            //left button
            this.node_widget = null;

            if (this.selected_group) {
                var diffx =
                    this.selected_group.pos[0] -
                    Math.round(this.selected_group.pos[0]);
                var diffy =
                    this.selected_group.pos[1] -
                    Math.round(this.selected_group.pos[1]);
                this.selected_group.move(diffx, diffy, e.ctrlKey);
                this.selected_group.pos[0] = Math.round(
                    this.selected_group.pos[0]
                );
                this.selected_group.pos[1] = Math.round(
                    this.selected_group.pos[1]
                );
                if (this.selected_group._nodes.length) {
                    this.dirty_canvas = true;
                }
                this.selected_group = null;
            }
            this.selected_group_resizing = false;

            if (this.dragging_rectangle) {
                if (this.graph) {
                    var nodes = this.graph._nodes;
                    var node_bounding = new Float32Array(4);
                    this.deselectAllNodes();
                    //compute bounding and flip if left to right
                    var w = Math.abs(this.dragging_rectangle[2]);
                    var h = Math.abs(this.dragging_rectangle[3]);
                    var startx =
                        this.dragging_rectangle[2] < 0
                            ? this.dragging_rectangle[0] - w
                            : this.dragging_rectangle[0];
                    var starty =
                        this.dragging_rectangle[3] < 0
                            ? this.dragging_rectangle[1] - h
                            : this.dragging_rectangle[1];
                    this.dragging_rectangle[0] = startx;
                    this.dragging_rectangle[1] = starty;
                    this.dragging_rectangle[2] = w;
                    this.dragging_rectangle[3] = h;

                    //test against all nodes (not visible because the rectangle maybe start outside
                    var to_select = [];
                    for (var i = 0; i < nodes.length; ++i) {
                        var node = nodes[i];
                        node.getBounding(node_bounding);
                        if (
                            !overlapBounding(
                                this.dragging_rectangle,
                                node_bounding
                            )
                        ) {
                            continue;
                        } //out of the visible area
                        to_select.push(node);
                    }
                    if (to_select.length) {
                        this.selectNodes(to_select);
                    }
                }
                this.dragging_rectangle = null;
            } else if (this.connecting_node) {
                //dragging a connection
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;

                var node = this.graph.getNodeOnPos(
                    e.canvasX,
                    e.canvasY,
                    this.visible_nodes
                );

                //node below mouse
                if (node) {
                    if (
                        this.connecting_output.type == LiteGraph.EVENT &&
                        this.isOverNodeBox(node, e.canvasX, e.canvasY)
                    ) {
                        this.connecting_node.connect(
                            this.connecting_slot,
                            node,
                            LiteGraph.EVENT
                        );
                    } else {
                        //slot below mouse? connect
                        var slot = this.isOverNodeInput(
                            node,
                            e.canvasX,
                            e.canvasY
                        );
                        if (slot != -1) {
                            this.connecting_node.connect(
                                this.connecting_slot,
                                node,
                                slot
                            );
                        } else {
                            //not on top of an input
                            var input = node.getInputInfo(0);
                            //auto connect
                            if (
                                this.connecting_output.type == LiteGraph.EVENT
                            ) {
                                this.connecting_node.connect(
                                    this.connecting_slot,
                                    node,
                                    LiteGraph.EVENT
                                );
                            } else if (
                                input &&
                                !input.link &&
                                LiteGraph.isValidConnection(
                                    input.type && this.connecting_output.type
                                )
                            ) {
                                this.connecting_node.connect(
                                    this.connecting_slot,
                                    node,
                                    0
                                );
                            }
                        }
                    }
                }

                this.connecting_output = null;
                this.connecting_pos = null;
                this.connecting_node = null;
                this.connecting_slot = -1;
            } //not dragging connection
            else if (this.resizing_node) {
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
                this.resizing_node = null;
            } else if (this.node_dragged) {
                //node being dragged?
                var node = this.node_dragged;
                if (
                    node &&
                    e.click_time < 300 &&
                    isInsideRectangle(e.canvasX, e.canvasY, node.pos[0], node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT)
                ) {
                    node.collapse();
                }

                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
                this.node_dragged.pos[0] = Math.round(this.node_dragged.pos[0]);
                this.node_dragged.pos[1] = Math.round(this.node_dragged.pos[1]);
                if (this.graph.config.align_to_grid) {
                    this.node_dragged.alignToGrid();
                }
                if (this.onNodeMoved)
                    this.onNodeMoved(this.node_dragged);
                this.node_dragged = null;
            } //no node being dragged
            else {
                //get node over
                var node = this.graph.getNodeOnPos(
                    e.canvasX,
                    e.canvasY,
                    this.visible_nodes
                );

                if (!node && e.click_time < 300) {
                    this.deselectAllNodes();
                }

                this.dirty_canvas = true;
                this.dragging_canvas = false;

                if (this.node_over && this.node_over.onMouseUp) {
                    this.node_over.onMouseUp(e, [e.canvasX - this.node_over.pos[0], e.canvasY - this.node_over.pos[1]], this);
                }
                if (
                    this.node_capturing_input &&
                    this.node_capturing_input.onMouseUp
                ) {
                    this.node_capturing_input.onMouseUp(e, [
                        e.canvasX - this.node_capturing_input.pos[0],
                        e.canvasY - this.node_capturing_input.pos[1]
                    ]);
                }
            }
        } else if (e.which == 2) {
            //middle button
            //trace("middle");
            this.dirty_canvas = true;
            this.dragging_canvas = false;
        } else if (e.which == 3) {
            //right button
            //trace("right");
            this.dirty_canvas = true;
            this.dragging_canvas = false;
        }

        /*
	if((this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null)
		this.draw();
	*/

        this.graph.change();

        e.stopPropagation();
        e.preventDefault();
        return false;
    };

    /**
     * Called when a mouse wheel event has to be processed
     * @method processMouseWheel
     **/
    processMouseWheel(e) {
        if (!this.graph || !this.allow_dragcanvas) {
            return;
        }

        var delta = e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60;

        this.adjustMouseEvent(e);

        var scale = this.ds.scale;

        if (delta > 0) {
            scale *= 1.1;
        } else if (delta < 0) {
            scale *= 1 / 1.1;
        }

        //this.setZoom( scale, [ e.localX, e.localY ] );
        this.ds.changeScale(scale, [e.localX, e.localY]);

        this.graph.change();

        e.preventDefault();
        return false; // prevent default
    };

    /**
     * returns true if a position (in graph space) is on top of a node little corner box
     * @method isOverNodeBox
     **/
    isOverNodeBox(node, canvasx, canvasy) {
        var title_height = LiteGraph.NODE_TITLE_HEIGHT;
        if (
            isInsideRectangle(
                canvasx,
                canvasy,
                node.pos[0] + 2,
                node.pos[1] + 2 - title_height,
                title_height - 4,
                title_height - 4
            )
        ) {
            return true;
        }
        return false;
    };

    /**
     * returns true if a position (in graph space) is on top of a node input slot
     * @method isOverNodeInput
     **/
    isOverNodeInput(
        node,
        canvasx,
        canvasy,
        slot_pos
    ) {
        if (node.inputs) {
            for (var i = 0, l = node.inputs.length; i < l; ++i) {
                var input = node.inputs[i];
                var link_pos = node.getConnectionPos(true, i);
                var is_inside = false;
                if (node.horizontal) {
                    is_inside = isInsideRectangle(
                        canvasx,
                        canvasy,
                        link_pos[0] - 5,
                        link_pos[1] - 10,
                        10,
                        20
                    );
                } else {
                    is_inside = isInsideRectangle(
                        canvasx,
                        canvasy,
                        link_pos[0] - 10,
                        link_pos[1] - 5,
                        40,
                        10
                    );
                }
                if (is_inside) {
                    if (slot_pos) {
                        slot_pos[0] = link_pos[0];
                        slot_pos[1] = link_pos[1];
                    }
                    return i;
                }
            }
        }
        return -1;
    };

    /**
     * process a key event
     * @method processKey
     **/
    processKey(e) {
        if (!this.graph) {
            return;
        }

        var block_default = false;
        //console.log(e); //debug

        if (e.target.localName == "input") {
            return;
        }

        if (e.type == "keydown") {
            if (e.keyCode == 32) {
                //esc
                this.dragging_canvas = true;
                block_default = true;
            }

            //select all Control A
            if (e.keyCode == 65 && e.ctrlKey) {
                this.selectNodes();
                block_default = true;
            }

            if (e.code == "KeyC" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                //copy
                if (this.selected_nodes) {
                    this.copyToClipboard();
                    block_default = true;
                }
            }

            if (e.code == "KeyV" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                //paste
                this.pasteFromClipboard();
            }

            //delete or backspace
            if (e.keyCode == 46 || e.keyCode == 8) {
                if (
                    e.target.localName != "input" &&
                    e.target.localName != "textarea"
                ) {
                    this.deleteSelectedNodes();
                    block_default = true;
                }
            }

            //collapse
            //...

            //TODO
            if (this.selected_nodes) {
                for (var i in this.selected_nodes) {
                    if (this.selected_nodes[i].onKeyDown) {
                        this.selected_nodes[i].onKeyDown(e);
                    }
                }
            }
        } else if (e.type == "keyup") {
            if (e.keyCode == 32) {
                this.dragging_canvas = false;
            }

            if (this.selected_nodes) {
                for (var i in this.selected_nodes) {
                    if (this.selected_nodes[i].onKeyUp) {
                        this.selected_nodes[i].onKeyUp(e);
                    }
                }
            }
        }

        this.graph.change();

        if (block_default) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }
    };

    copyToClipboard() {
        var clipboard_info = {
            nodes: [],
            links: []
        };
        var index = 0;
        var selected_nodes_array = [];
        for (var i in this.selected_nodes) {
            var node = this.selected_nodes[i];
            node._relative_id = index;
            selected_nodes_array.push(node);
            index += 1;
        }

        for (var i = 0; i < selected_nodes_array.length; ++i) {
            var node = selected_nodes_array[i];
            var cloned = node.clone();
            if (!cloned) {
                console.warn("node type not found: " + node.type);
                continue;
            }
            clipboard_info.nodes.push(cloned.serialize());
            if (node.inputs && node.inputs.length) {
                for (var j = 0; j < node.inputs.length; ++j) {
                    var input = node.inputs[j];
                    if (!input || input.link == null) {
                        continue;
                    }
                    var link_info = this.graph.links[input.link];
                    if (!link_info) {
                        continue;
                    }
                    var target_node = this.graph.getNodeById(
                        link_info.origin_id
                    );
                    if (!target_node || !this.selected_nodes[target_node.id]) {
                        //improve this by allowing connections to non-selected nodes
                        continue;
                    } //not selected
                    clipboard_info.links.push([
                        target_node._relative_id,
                        link_info.origin_slot, //j,
                        node._relative_id,
                        link_info.target_slot
                    ]);
                }
            }
        }
        localStorage.setItem(
            "litegrapheditor_clipboard",
            JSON.stringify(clipboard_info)
        );
    };

    pasteFromClipboard() {
        var data = localStorage.getItem("litegrapheditor_clipboard");
        if (!data) {
            return;
        }

        //create nodes
        var clipboard_info = JSON.parse(data);
        var nodes = [];
        for (var i = 0; i < clipboard_info.nodes.length; ++i) {
            var node_data = clipboard_info.nodes[i];
            var node = LiteGraph.createNode(node_data.type);
            if (node) {
                node.configure(node_data);
                node.pos[0] += 5;
                node.pos[1] += 5;
                this.graph.add(node);
                nodes.push(node);
            }
        }

        //create links
        for (var i = 0; i < clipboard_info.links.length; ++i) {
            var link_info = clipboard_info.links[i];
            var origin_node = nodes[link_info[0]];
            var target_node = nodes[link_info[2]];
            if (origin_node && target_node)
                origin_node.connect(link_info[1], target_node, link_info[3]);
            else
                console.warn("Warning, nodes missing on pasting");
        }

        this.selectNodes(nodes);
    };

    /**
     * process a item drop event on top the canvas
     * @method processDrop
     **/
    processDrop(e) {
        e.preventDefault();
        this.adjustMouseEvent(e);

        var pos = [e.canvasX, e.canvasY];
        var node = this.graph.getNodeOnPos(pos[0], pos[1]);

        if (!node) {
            var r = null;
            if (this.onDropItem) {
                r = this.onDropItem(event);
            }
            if (!r) {
                this.checkDropItem(e);
            }
            return;
        }

        if (node.onDropFile || node.onDropData) {
            var files = e.dataTransfer.files;
            if (files && files.length) {
                for (var i = 0; i < files.length; i++) {
                    var file = e.dataTransfer.files[0];
                    var filename = file.name;
                    var ext = LGraphCanvas.getFileExtension(filename);
                    //console.log(file);

                    if (node.onDropFile) {
                        node.onDropFile(file);
                    }

                    if (node.onDropData) {
                        //prepare reader
                        var reader = new FileReader();
                        reader.onload(event) {
                            //console.log(event.target);
                            var data = event.target.result;
                            node.onDropData(data, filename, file);
                        };

                        //read data
                        var type = file.type.split("/")[0];
                        if (type == "text" || type == "") {
                            reader.readAsText(file);
                        } else if (type == "image") {
                            reader.readAsDataURL(file);
                        } else {
                            reader.readAsArrayBuffer(file);
                        }
                    }
                }
            }
        }

        if (node.onDropItem) {
            if (node.onDropItem(event)) {
                return true;
            }
        }

        if (this.onDropItem) {
            return this.onDropItem(event);
        }

        return false;
    };

    //called if the graph doesn't have a default drop item behaviour
    checkDropItem(e) {
        if (e.dataTransfer.files.length) {
            var file = e.dataTransfer.files[0];
            var ext = LGraphCanvas.getFileExtension(file.name).toLowerCase();
            var nodetype = LiteGraph.node_types_by_file_extension[ext];
            if (nodetype) {
                var node = LiteGraph.createNode(nodetype.type);
                node.pos = [e.canvasX, e.canvasY];
                this.graph.add(node);
                if (node.onDropFile) {
                    node.onDropFile(file);
                }
            }
        }
    };

    processNodeDblClicked(n) {
        if (this.onShowNodePanel) {
            this.onShowNodePanel(n);
        }

        if (this.onNodeDblClicked) {
            this.onNodeDblClicked(n);
        }

        this.setDirty(true);
    };

    processNodeSelected(node, e) {
        this.selectNode(node, e && e.shiftKey);
        if (this.onNodeSelected) {
            this.onNodeSelected(node);
        }
    };

    /**
     * selects a given node (or adds it to the current selection)
     * @method selectNode
     **/
    selectNode(
        node,
        add_to_current_selection
    ) {
        if (node == null) {
            this.deselectAllNodes();
        } else {
            this.selectNodes([node], add_to_current_selection);
        }
    };

    /**
     * selects several nodes (or adds them to the current selection)
     * @method selectNodes
     **/
    selectNodes(
        nodes,
        add_to_current_selection
    ) {
        if (!add_to_current_selection) {
            this.deselectAllNodes();
        }

        nodes = nodes || this.graph._nodes;
        for (var i = 0; i < nodes.length; ++i) {
            var node = nodes[i];
            if (node.is_selected) {
                continue;
            }

            if (!node.is_selected && node.onSelected) {
                node.onSelected();
            }
            node.is_selected = true;
            this.selected_nodes[node.id] = node;

            if (node.inputs) {
                for (var j = 0; j < node.inputs.length; ++j) {
                    this.highlighted_links[node.inputs[j].link] = true;
                }
            }
            if (node.outputs) {
                for (var j = 0; j < node.outputs.length; ++j) {
                    var out = node.outputs[j];
                    if (out.links) {
                        for (var k = 0; k < out.links.length; ++k) {
                            this.highlighted_links[out.links[k]] = true;
                        }
                    }
                }
            }
        }

        if (this.onSelectionChange)
            this.onSelectionChange(this.selected_nodes);

        this.setDirty(true);
    };

    /**
     * removes a node from the current selection
     * @method deselectNode
     **/
    deselectNode(node) {
        if (!node.is_selected) {
            return;
        }
        if (node.onDeselected) {
            node.onDeselected();
        }
        node.is_selected = false;

        if (this.onNodeDeselected) {
            this.onNodeDeselected(node);
        }

        //remove highlighted
        if (node.inputs) {
            for (var i = 0; i < node.inputs.length; ++i) {
                delete this.highlighted_links[node.inputs[i].link];
            }
        }
        if (node.outputs) {
            for (var i = 0; i < node.outputs.length; ++i) {
                var out = node.outputs[i];
                if (out.links) {
                    for (var j = 0; j < out.links.length; ++j) {
                        delete this.highlighted_links[out.links[j]];
                    }
                }
            }
        }
    };

    /**
     * removes all nodes from the current selection
     * @method deselectAllNodes
     **/
    deselectAllNodes() {
        if (!this.graph) {
            return;
        }
        var nodes = this.graph._nodes;
        for (var i = 0, l = nodes.length; i < l; ++i) {
            var node = nodes[i];
            if (!node.is_selected) {
                continue;
            }
            if (node.onDeselected) {
                node.onDeselected();
            }
            node.is_selected = false;
            if (this.onNodeDeselected) {
                this.onNodeDeselected(node);
            }
        }
        this.selected_nodes = {};
        this.current_node = null;
        this.highlighted_links = {};
        if (this.onSelectionChange)
            this.onSelectionChange(this.selected_nodes);
        this.setDirty(true);
    };

    /**
     * deletes all nodes in the current selection from the graph
     * @method deleteSelectedNodes
     **/
    deleteSelectedNodes() {
        for (var i in this.selected_nodes) {
            var node = this.selected_nodes[i];
            //autoconnect when possible (very basic, only takes into account first input-output)
            if (node.inputs && node.inputs.length && node.outputs && node.outputs.length && LiteGraph.isValidConnection(node.inputs[0].type, node.outputs[0].type) && node.inputs[0].link && node.outputs[0].links && node.outputs[0].links.length) {
                var input_link = node.graph.links[node.inputs[0].link];
                var output_link = node.graph.links[node.outputs[0].links[0]];
                var input_node = node.getInputNode(0);
                var output_node = node.getOutputNodes(0)[0];
                if (input_node && output_node)
                    input_node.connect(input_link.origin_slot, output_node, output_link.target_slot);
            }
            this.graph.remove(node);
            if (this.onNodeDeselected) {
                this.onNodeDeselected(node);
            }
        }
        this.selected_nodes = {};
        this.current_node = null;
        this.highlighted_links = {};
        this.setDirty(true);
    };

    /**
     * centers the camera on a given node
     * @method centerOnNode
     **/
    centerOnNode(node) {
        this.ds.offset[0] =
            -node.pos[0] -
            node.size[0] * 0.5 +
            (this.canvas.width * 0.5) / this.ds.scale;
        this.ds.offset[1] =
            -node.pos[1] -
            node.size[1] * 0.5 +
            (this.canvas.height * 0.5) / this.ds.scale;
        this.setDirty(true, true);
    };

    /**
     * adds some useful properties to a mouse event, like the position in graph coordinates
     * @method adjustMouseEvent
     **/
    adjustMouseEvent(e) {
        if (this.canvas) {
            var b = this.canvas.getBoundingClientRect();
            e.localX = e.clientX - b.left;
            e.localY = e.clientY - b.top;
        } else {
            e.localX = e.clientX;
            e.localY = e.clientY;
        }

        e.deltaX = e.localX - this.last_mouse_position[0];
        e.deltaY = e.localY - this.last_mouse_position[1];

        this.last_mouse_position[0] = e.localX;
        this.last_mouse_position[1] = e.localY;

        e.canvasX = e.localX / this.ds.scale - this.ds.offset[0];
        e.canvasY = e.localY / this.ds.scale - this.ds.offset[1];
    };

    /**
     * changes the zoom level of the graph (default is 1), you can pass also a place used to pivot the zoom
     * @method setZoom
     **/
    setZoom(value, zooming_center) {
        this.ds.changeScale(value, zooming_center);
        /*
	if(!zooming_center && this.canvas)
		zooming_center = [this.canvas.width * 0.5,this.canvas.height * 0.5];

	var center = this.convertOffsetToCanvas( zooming_center );

	this.ds.scale = value;

	if(this.scale > this.max_zoom)
		this.scale = this.max_zoom;
	else if(this.scale < this.min_zoom)
		this.scale = this.min_zoom;

	var new_center = this.convertOffsetToCanvas( zooming_center );
	var delta_offset = [new_center[0] - center[0], new_center[1] - center[1]];

	this.offset[0] += delta_offset[0];
	this.offset[1] += delta_offset[1];
	*/

        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
    };

    /**
     * converts a coordinate from graph coordinates to canvas2D coordinates
     * @method convertOffsetToCanvas
     **/
    convertOffsetToCanvas(pos, out) {
        return this.ds.convertOffsetToCanvas(pos, out);
    };

    /**
     * converts a coordinate from Canvas2D coordinates to graph space
     * @method convertCanvasToOffset
     **/
    convertCanvasToOffset(pos, out) {
        return this.ds.convertCanvasToOffset(pos, out);
    };

    //converts event coordinates from canvas2D to graph coordinates
    convertEventToCanvasOffset(e) {
        var rect = this.canvas.getBoundingClientRect();
        return this.convertCanvasToOffset([
            e.clientX - rect.left,
            e.clientY - rect.top
        ]);
    };

    /**
     * brings a node to front (above all other nodes)
     * @method bringToFront
     **/
    bringToFront(node) {
        var i = this.graph._nodes.indexOf(node);
        if (i == -1) {
            return;
        }

        this.graph._nodes.splice(i, 1);
        this.graph._nodes.push(node);
    };

    /**
     * sends a node to the back (below all other nodes)
     * @method sendToBack
     **/
    sendToBack(node) {
        var i = this.graph._nodes.indexOf(node);
        if (i == -1) {
            return;
        }

        this.graph._nodes.splice(i, 1);
        this.graph._nodes.unshift(node);
    };


    /**
     * checks which nodes are visible (inside the camera area)
     * @method computeVisibleNodes
     **/
    computeVisibleNodes(nodes, out) {
        var visible_nodes = out || [];
        visible_nodes.length = 0;
        nodes = nodes || this.graph._nodes;
        for (var i = 0, l = nodes.length; i < l; ++i) {
            var n = nodes[i];

            //skip rendering nodes in live mode
            if (this.live_mode && !n.onDrawBackground && !n.onDrawForeground) {
                continue;
            }

            if (!overlapBounding(this.visible_area, n.getBounding(temp))) {
                continue;
            } //out of the visible area

            visible_nodes.push(n);
        }
        return visible_nodes;
    };

    /**
     * renders the whole canvas content, by rendering in two separated canvas, one containing the background grid and the connections, and one containing the nodes)
     * @method draw
     **/
    draw(force_canvas, force_bgcanvas) {
        if (!this.canvas) {
            return;
        }

        //fps counting
        var now = LiteGraph.getTime();
        this.render_time = (now - this.last_draw_time) * 0.001;
        this.last_draw_time = now;

        if (this.graph) {
            this.ds.computeVisibleArea();
        }

        if (
            this.dirty_bgcanvas ||
            force_bgcanvas ||
            this.always_render_background ||
            (this.graph &&
                this.graph._last_trigger_time &&
                now - this.graph._last_trigger_time < 1000)
        ) {
            this.drawBackCanvas();
        }

        if (this.dirty_canvas || force_canvas) {
            this.drawFrontCanvas();
        }

        this.fps = this.render_time ? 1.0 / this.render_time : 0;
        this.frame += 1;
    };

    /**
     * draws the front canvas (the one containing all the nodes)
     * @method drawFrontCanvas
     **/
    drawFrontCanvas() {
        this.dirty_canvas = false;

        if (!this.ctx) {
            this.ctx = this.bgcanvas.getContext("2d");
        }
        var ctx = this.ctx;
        if (!ctx) {
            //maybe is using webgl...
            return;
        }

        if (ctx.start2D) {
            ctx.start2D();
        }

        var canvas = this.canvas;

        //reset in case of error
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        //clip dirty area if there is one, otherwise work in full canvas
        if (this.dirty_area) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(
                this.dirty_area[0],
                this.dirty_area[1],
                this.dirty_area[2],
                this.dirty_area[3]
            );
            ctx.clip();
        }

        //clear
        //canvas.width = canvas.width;
        if (this.clear_background) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        //draw bg canvas
        if (this.bgcanvas == this.canvas) {
            this.drawBackCanvas();
        } else {
            ctx.drawImage(this.bgcanvas, 0, 0);
        }

        //rendering
        if (this.onRender) {
            this.onRender(canvas, ctx);
        }

        //info widget
        if (this.show_info) {
            this.renderInfo(ctx);
        }

        if (this.graph) {
            //apply transformations
            ctx.save();
            this.ds.toCanvasContext(ctx);

            //draw nodes
            var drawn_nodes = 0;
            var visible_nodes = this.computeVisibleNodes(
                null,
                this.visible_nodes
            );

            for (var i = 0; i < visible_nodes.length; ++i) {
                var node = visible_nodes[i];

                //transform coords system
                ctx.save();
                ctx.translate(node.pos[0], node.pos[1]);

                //Draw
                this.drawNode(node, ctx);
                drawn_nodes += 1;

                //Restore
                ctx.restore();
            }

            //on top (debug)
            if (this.render_execution_order) {
                this.drawExecutionOrder(ctx);
            }

            //connections ontop?
            if (this.graph.config.links_ontop) {
                if (!this.live_mode) {
                    this.drawConnections(ctx);
                }
            }

            //current connection (the one being dragged by the mouse)
            if (this.connecting_pos != null) {
                ctx.lineWidth = this.connections_width;
                var link_color = null;

                switch (this.connecting_output.type) {
                    case LiteGraph.EVENT:
                        link_color = LiteGraph.EVENT_LINK_COLOR;
                        break;
                    default:
                        link_color = LiteGraph.CONNECTING_LINK_COLOR;
                }

                //the connection being dragged by the mouse
                this.renderLink(
                    ctx,
                    this.connecting_pos,
                    [this.canvas_mouse[0], this.canvas_mouse[1]],
                    null,
                    false,
                    null,
                    link_color,
                    this.connecting_output.dir ||
                    (this.connecting_node.horizontal
                        ? LiteGraph.DOWN
                        : LiteGraph.RIGHT),
                    LiteGraph.CENTER
                );

                ctx.beginPath();
                if (
                    this.connecting_output.type === LiteGraph.EVENT ||
                    this.connecting_output.shape === LiteGraph.BOX_SHAPE
                ) {
                    ctx.rect(
                        this.connecting_pos[0] - 6 + 0.5,
                        this.connecting_pos[1] - 5 + 0.5,
                        14,
                        10
                    );
                } else {
                    ctx.arc(
                        this.connecting_pos[0],
                        this.connecting_pos[1],
                        4,
                        0,
                        Math.PI * 2
                    );
                }
                ctx.fill();

                ctx.fillStyle = "#ffcc00";
                if (this._highlight_input) {
                    ctx.beginPath();
                    ctx.arc(
                        this._highlight_input[0],
                        this._highlight_input[1],
                        6,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            }

            //the selection rectangle
            if (this.dragging_rectangle) {
                ctx.strokeStyle = "#FFF";
                ctx.strokeRect(
                    this.dragging_rectangle[0],
                    this.dragging_rectangle[1],
                    this.dragging_rectangle[2],
                    this.dragging_rectangle[3]
                );
            }

            //on top of link center
            if (this.over_link_center && this.render_link_tooltip)
                this.drawLinkTooltip(ctx, this.over_link_center);
            else if (this.onDrawLinkTooltip) //to remove
                this.onDrawLinkTooltip(ctx, null);

            //custom info
            if (this.onDrawForeground) {
                this.onDrawForeground(ctx, this.visible_rect);
            }

            ctx.restore();
        }

        if (this.onDrawOverlay) {
            this.onDrawOverlay(ctx);
        }

        if (this.dirty_area) {
            ctx.restore();
            //this.dirty_area = null;
        }

        if (ctx.finish2D) {
            //this is a function I use in webgl renderer
            ctx.finish2D();
        }
    };

    /**
     * draws some useful stats in the corner of the canvas
     * @method renderInfo
     **/
    renderInfo(ctx, x, y) {
        x = x || 0;
        y = y || 0;

        ctx.save();
        ctx.translate(x, y);

        ctx.font = "10px Arial";
        ctx.fillStyle = "#888";
        if (this.graph) {
            ctx.fillText("T: " + this.graph.globaltime.toFixed(2) + "s", 5, 13 * 1);
            ctx.fillText("I: " + this.graph.iteration, 5, 13 * 2);
            ctx.fillText("N: " + this.graph._nodes.length + " [" + this.visible_nodes.length + "]", 5, 13 * 3);
            ctx.fillText("V: " + this.graph._version, 5, 13 * 4);
            ctx.fillText("FPS:" + this.fps.toFixed(2), 5, 13 * 5);
        } else {
            ctx.fillText("No graph selected", 5, 13 * 1);
        }
        ctx.restore();
    };

    /**
     * draws the back canvas (the one containing the background and the connections)
     * @method drawBackCanvas
     **/
    drawBackCanvas() {
        var canvas = this.bgcanvas;
        if (
            canvas.width != this.canvas.width ||
            canvas.height != this.canvas.height
        ) {
            canvas.width = this.canvas.width;
            canvas.height = this.canvas.height;
        }

        if (!this.bgctx) {
            this.bgctx = this.bgcanvas.getContext("2d");
        }
        var ctx = this.bgctx;
        if (ctx.start) {
            ctx.start();
        }

        //clear
        if (this.clear_background) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        if (this._graph_stack && this._graph_stack.length) {
            ctx.save();
            var parent_graph = this._graph_stack[this._graph_stack.length - 1];
            var subgraph_node = this.graph._subgraph_node;
            ctx.strokeStyle = subgraph_node.bgcolor;
            ctx.lineWidth = 10;
            ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
            ctx.lineWidth = 1;
            ctx.font = "40px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = subgraph_node.bgcolor || "#AAA";
            var title = "";
            for (var i = 1; i < this._graph_stack.length; ++i) {
                title +=
                    this._graph_stack[i]._subgraph_node.getTitle() + " >> ";
            }
            ctx.fillText(
                title + subgraph_node.getTitle(),
                canvas.width * 0.5,
                40
            );
            ctx.restore();
        }

        var bg_already_painted = false;
        if (this.onRenderBackground) {
            bg_already_painted = this.onRenderBackground(canvas, ctx);
        }

        //reset in case of error
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.visible_links.length = 0;

        if (this.graph) {
            //apply transformations
            ctx.save();
            this.ds.toCanvasContext(ctx);

            //render BG
            if (
                this.background_image &&
                this.ds.scale > 0.5 &&
                !bg_already_painted
            ) {
                if (this.zoom_modify_alpha) {
                    ctx.globalAlpha =
                        (1.0 - 0.5 / this.ds.scale) * this.editor_alpha;
                } else {
                    ctx.globalAlpha = this.editor_alpha;
                }
                ctx.imageSmoothingEnabled = ctx.mozImageSmoothingEnabled = ctx.imageSmoothingEnabled = false;
                if (
                    !this._bg_img ||
                    this._bg_img.name != this.background_image
                ) {
                    this._bg_img = new Image();
                    this._bg_img.name = this.background_image;
                    this._bg_img.src = this.background_image;
                    var that = this;
                    this._bg_img.onload() {
                        that.draw(true, true);
                    };
                }

                var pattern = null;
                if (this._pattern == null && this._bg_img.width > 0) {
                    pattern = ctx.createPattern(this._bg_img, "repeat");
                    this._pattern_img = this._bg_img;
                    this._pattern = pattern;
                } else {
                    pattern = this._pattern;
                }
                if (pattern) {
                    ctx.fillStyle = pattern;
                    ctx.fillRect(
                        this.visible_area[0],
                        this.visible_area[1],
                        this.visible_area[2],
                        this.visible_area[3]
                    );
                    ctx.fillStyle = "transparent";
                }

                ctx.globalAlpha = 1.0;
                ctx.imageSmoothingEnabled = ctx.mozImageSmoothingEnabled = ctx.imageSmoothingEnabled = true;
            }

            //groups
            if (this.graph._groups.length && !this.live_mode) {
                this.drawGroups(canvas, ctx);
            }

            if (this.onDrawBackground) {
                this.onDrawBackground(ctx, this.visible_area);
            }
            if (this.onBackgroundRender) {
                //LEGACY
                console.error(
                    "WARNING! onBackgroundRender deprecated, now is named onDrawBackground "
                );
                this.onBackgroundRender = null;
            }

            //DEBUG: show clipping area
            //ctx.fillStyle = "red";
            //ctx.fillRect( this.visible_area[0] + 10, this.visible_area[1] + 10, this.visible_area[2] - 20, this.visible_area[3] - 20);

            //bg
            if (this.render_canvas_border) {
                ctx.strokeStyle = "#235";
                ctx.strokeRect(0, 0, canvas.width, canvas.height);
            }

            if (this.render_connections_shadows) {
                ctx.shadowColor = "#000";
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.shadowBlur = 6;
            } else {
                ctx.shadowColor = "rgba(0,0,0,0)";
            }

            //draw connections
            if (!this.live_mode) {
                this.drawConnections(ctx);
            }

            ctx.shadowColor = "rgba(0,0,0,0)";

            //restore state
            ctx.restore();
        }

        if (ctx.finish) {
            ctx.finish();
        }

        this.dirty_bgcanvas = false;
        this.dirty_canvas = true; //to force to repaint the front canvas with the bgcanvas
    };


    /**
     * draws the given node inside the canvas
     * @method drawNode
     **/
    drawNode(node, ctx) {
        var glow = false;
        this.current_node = node;

        var color =
            node.color ||
            node.constructor.color ||
            LiteGraph.NODE_DEFAULT_COLOR;
        var bgcolor =
            node.bgcolor ||
            node.constructor.bgcolor ||
            LiteGraph.NODE_DEFAULT_BGCOLOR;

        //shadow and glow
        if (node.mouseOver) {
            glow = true;
        }

        var low_quality = this.ds.scale < 0.6; //zoomed out

        //only render if it forces it to do it
        if (this.live_mode) {
            if (!node.flags.collapsed) {
                ctx.shadowColor = "transparent";
                if (node.onDrawForeground) {
                    node.onDrawForeground(ctx, this, this.canvas);
                }
            }
            return;
        }

        var editor_alpha = this.editor_alpha;
        ctx.globalAlpha = editor_alpha;

        if (this.render_shadows && !low_quality) {
            ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR;
            ctx.shadowOffsetX = 2 * this.ds.scale;
            ctx.shadowOffsetY = 2 * this.ds.scale;
            ctx.shadowBlur = 3 * this.ds.scale;
        } else {
            ctx.shadowColor = "transparent";
        }

        //custom draw collapsed method (draw after shadows because they are affected)
        if (
            node.flags.collapsed &&
            node.onDrawCollapsed &&
            node.onDrawCollapsed(ctx, this) == true
        ) {
            return;
        }

        //clip if required (mask)
        var shape = node._shape || LiteGraph.BOX_SHAPE;
        var size = temp_vec2;
        temp_vec2.set(node.size);
        var horizontal = node.horizontal; // || node.flags.horizontal;

        if (node.flags.collapsed) {
            ctx.font = this.inner_text_font;
            var title = node.getTitle ? node.getTitle() : node.title;
            if (title != null) {
                node._collapsed_width = Math.min(
                    node.size[0],
                    ctx.measureText(title).width +
                    LiteGraph.NODE_TITLE_HEIGHT * 2
                ); //LiteGraph.NODE_COLLAPSED_WIDTH;
                size[0] = node._collapsed_width;
                size[1] = 0;
            }
        }

        if (node.clip_area) {
            //Start clipping
            ctx.save();
            ctx.beginPath();
            if (shape == LiteGraph.BOX_SHAPE) {
                ctx.rect(0, 0, size[0], size[1]);
            } else if (shape == LiteGraph.ROUND_SHAPE) {
                ctx.roundRect(0, 0, size[0], size[1], 10);
            } else if (shape == LiteGraph.CIRCLE_SHAPE) {
                ctx.arc(
                    size[0] * 0.5,
                    size[1] * 0.5,
                    size[0] * 0.5,
                    0,
                    Math.PI * 2
                );
            }
            ctx.clip();
        }

        //draw shape
        if (node.has_errors) {
            bgcolor = "red";
        }
        this.drawNodeShape(
            node,
            ctx,
            size,
            color,
            bgcolor,
            node.is_selected,
            node.mouseOver
        );
        ctx.shadowColor = "transparent";

        //draw foreground
        if (node.onDrawForeground) {
            node.onDrawForeground(ctx, this, this.canvas);
        }

        //connection slots
        ctx.textAlign = horizontal ? "center" : "left";
        ctx.font = this.inner_text_font;

        var render_text = !low_quality;

        var out_slot = this.connecting_output;
        ctx.lineWidth = 1;

        var max_y = 0;
        var slot_pos = new Float32Array(2); //to reuse

        //render inputs and outputs
        if (!node.flags.collapsed) {
            //input connection slots
            if (node.inputs) {
                for (var i = 0; i < node.inputs.length; i++) {
                    var slot = node.inputs[i];

                    ctx.globalAlpha = editor_alpha;
                    //change opacity of incompatible slots when dragging a connection
                    if (this.connecting_node && !LiteGraph.isValidConnection(slot.type, out_slot.type)) {
                        ctx.globalAlpha = 0.4 * editor_alpha;
                    }

                    ctx.fillStyle =
                        slot.link != null
                            ? slot.color_on ||
                            this.default_connection_color.input_on
                            : slot.color_off ||
                            this.default_connection_color.input_off;

                    var pos = node.getConnectionPos(true, i, slot_pos);
                    pos[0] -= node.pos[0];
                    pos[1] -= node.pos[1];
                    if (max_y < pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5) {
                        max_y = pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5;
                    }

                    ctx.beginPath();

                    if (
                        slot.type === LiteGraph.EVENT ||
                        slot.shape === LiteGraph.BOX_SHAPE
                    ) {
                        if (horizontal) {
                            ctx.rect(
                                pos[0] - 5 + 0.5,
                                pos[1] - 8 + 0.5,
                                10,
                                14
                            );
                        } else {
                            ctx.rect(
                                pos[0] - 6 + 0.5,
                                pos[1] - 5 + 0.5,
                                14,
                                10
                            );
                        }
                    } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
                        ctx.moveTo(pos[0] + 8, pos[1] + 0.5);
                        ctx.lineTo(pos[0] - 4, pos[1] + 6 + 0.5);
                        ctx.lineTo(pos[0] - 4, pos[1] - 6 + 0.5);
                        ctx.closePath();
                    } else {
                        if (low_quality)
                            ctx.rect(pos[0] - 4, pos[1] - 4, 8, 8); //faster
                        else
                            ctx.arc(pos[0], pos[1], 4, 0, Math.PI * 2);
                    }
                    ctx.fill();

                    //render name
                    if (render_text) {
                        var text = slot.label != null ? slot.label : slot.name;
                        if (text) {
                            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
                            if (horizontal || slot.dir == LiteGraph.UP) {
                                ctx.fillText(text, pos[0], pos[1] - 10);
                            } else {
                                ctx.fillText(text, pos[0] + 10, pos[1] + 5);
                            }
                        }
                    }
                }
            }

            //output connection slots
            if (this.connecting_node) {
                ctx.globalAlpha = 0.4 * editor_alpha;
            }

            ctx.textAlign = horizontal ? "center" : "right";
            ctx.strokeStyle = "black";
            if (node.outputs) {
                for (var i = 0; i < node.outputs.length; i++) {
                    var slot = node.outputs[i];

                    var pos = node.getConnectionPos(false, i, slot_pos);
                    pos[0] -= node.pos[0];
                    pos[1] -= node.pos[1];
                    if (max_y < pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5) {
                        max_y = pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5;
                    }

                    ctx.fillStyle =
                        slot.links && slot.links.length
                            ? slot.color_on ||
                            this.default_connection_color.output_on
                            : slot.color_off ||
                            this.default_connection_color.output_off;
                    ctx.beginPath();
                    //ctx.rect( node.size[0] - 14,i*14,10,10);

                    if (
                        slot.type === LiteGraph.EVENT ||
                        slot.shape === LiteGraph.BOX_SHAPE
                    ) {
                        if (horizontal) {
                            ctx.rect(
                                pos[0] - 5 + 0.5,
                                pos[1] - 8 + 0.5,
                                10,
                                14
                            );
                        } else {
                            ctx.rect(
                                pos[0] - 6 + 0.5,
                                pos[1] - 5 + 0.5,
                                14,
                                10
                            );
                        }
                    } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
                        ctx.moveTo(pos[0] + 8, pos[1] + 0.5);
                        ctx.lineTo(pos[0] - 4, pos[1] + 6 + 0.5);
                        ctx.lineTo(pos[0] - 4, pos[1] - 6 + 0.5);
                        ctx.closePath();
                    } else {
                        if (low_quality)
                            ctx.rect(pos[0] - 4, pos[1] - 4, 8, 8);
                        else
                            ctx.arc(pos[0], pos[1], 4, 0, Math.PI * 2);
                    }

                    //trigger
                    //if(slot.node_id != null && slot.slot == -1)
                    //	ctx.fillStyle = "#F85";

                    //if(slot.links != null && slot.links.length)
                    ctx.fill();
                    if (!low_quality)
                        ctx.stroke();

                    //render output name
                    if (render_text) {
                        var text = slot.label != null ? slot.label : slot.name;
                        if (text) {
                            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
                            if (horizontal || slot.dir == LiteGraph.DOWN) {
                                ctx.fillText(text, pos[0], pos[1] - 8);
                            } else {
                                ctx.fillText(text, pos[0] - 10, pos[1] + 5);
                            }
                        }
                    }
                }
            }

            ctx.textAlign = "left";
            ctx.globalAlpha = 1;

            if (node.widgets) {
                var widgets_y = max_y;
                if (horizontal || node.widgets_up) {
                    widgets_y = 2;
                }
                if (node.widgets_start_y != null)
                    widgets_y = node.widgets_start_y;
                this.drawNodeWidgets(
                    node,
                    widgets_y,
                    ctx,
                    this.node_widget && this.node_widget[0] == node
                        ? this.node_widget[1]
                        : null
                );
            }
        } else if (this.render_collapsed_slots) {
            //if collapsed
            var input_slot = null;
            var output_slot = null;

            //get first connected slot to render
            if (node.inputs) {
                for (var i = 0; i < node.inputs.length; i++) {
                    var slot = node.inputs[i];
                    if (slot.link == null) {
                        continue;
                    }
                    input_slot = slot;
                    break;
                }
            }
            if (node.outputs) {
                for (var i = 0; i < node.outputs.length; i++) {
                    var slot = node.outputs[i];
                    if (!slot.links || !slot.links.length) {
                        continue;
                    }
                    output_slot = slot;
                }
            }

            if (input_slot) {
                var x = 0;
                var y = LiteGraph.NODE_TITLE_HEIGHT * -0.5; //center
                if (horizontal) {
                    x = node._collapsed_width * 0.5;
                    y = -LiteGraph.NODE_TITLE_HEIGHT;
                }
                ctx.fillStyle = "#686";
                ctx.beginPath();
                if (
                    slot.type === LiteGraph.EVENT ||
                    slot.shape === LiteGraph.BOX_SHAPE
                ) {
                    ctx.rect(x - 7 + 0.5, y - 4, 14, 8);
                } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
                    ctx.moveTo(x + 8, y);
                    ctx.lineTo(x + -4, y - 4);
                    ctx.lineTo(x + -4, y + 4);
                    ctx.closePath();
                } else {
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                }
                ctx.fill();
            }

            if (output_slot) {
                var x = node._collapsed_width;
                var y = LiteGraph.NODE_TITLE_HEIGHT * -0.5; //center
                if (horizontal) {
                    x = node._collapsed_width * 0.5;
                    y = 0;
                }
                ctx.fillStyle = "#686";
                ctx.strokeStyle = "black";
                ctx.beginPath();
                if (
                    slot.type === LiteGraph.EVENT ||
                    slot.shape === LiteGraph.BOX_SHAPE
                ) {
                    ctx.rect(x - 7 + 0.5, y - 4, 14, 8);
                } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
                    ctx.moveTo(x + 6, y);
                    ctx.lineTo(x - 6, y - 4);
                    ctx.lineTo(x - 6, y + 4);
                    ctx.closePath();
                } else {
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                }
                ctx.fill();
                //ctx.stroke();
            }
        }

        if (node.clip_area) {
            ctx.restore();
        }

        ctx.globalAlpha = 1.0;
    };

    //used by this.over_link_center
    drawLinkTooltip(ctx, link) {
        var pos = link._pos;
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2);
        ctx.fill();

        if (link.data == null)
            return;

        if (this.onDrawLinkTooltip)
            if (this.onDrawLinkTooltip(ctx, link, this) == true)
                return;

        var data = link.data;
        var text = null;

        if (data.constructor === Number)
            text = data.toFixed(2);
        else if (data.constructor === String)
            text = "\"" + data + "\"";
        else if (data.constructor === Boolean)
            text = String(data);
        else if (data.toToolTip)
            text = data.toToolTip();
        else
            text = "[" + data.constructor.name + "]";

        if (text == null)
            return;
        text = text.substr(0, 30); //avoid weird

        ctx.font = "14px Courier New";
        var info = ctx.measureText(text);
        var w = info.width + 20;
        var h = 24;
        ctx.shadowColor = "black";
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 3;
        ctx.fillStyle = "#454";
        ctx.beginPath();
        ctx.roundRect(pos[0] - w * 0.5, pos[1] - 15 - h, w, h, 3, 3);
        ctx.moveTo(pos[0] - 10, pos[1] - 15);
        ctx.lineTo(pos[0] + 10, pos[1] - 15);
        ctx.lineTo(pos[0], pos[1] - 5);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.textAlign = "center";
        ctx.fillStyle = "#CEC";
        ctx.fillText(text, pos[0], pos[1] - 15 - h * 0.3);
    };

    /**
     * draws the shape of the given node in the canvas
     * @method drawNodeShape
     **/


    drawNodeShape(
        node,
        ctx,
        size,
        fgcolor,
        bgcolor,
        selected,
        mouse_over
    ) {
        //bg rect
        ctx.strokeStyle = fgcolor;
        ctx.fillStyle = bgcolor;

        var title_height = LiteGraph.NODE_TITLE_HEIGHT;
        var low_quality = this.ds.scale < 0.5;

        //render node area depending on shape
        var shape =
            node._shape || node.constructor.shape || LiteGraph.ROUND_SHAPE;

        var title_mode = node.constructor.title_mode;

        var render_title = true;
        if (title_mode == LiteGraph.TRANSPARENT_TITLE) {
            render_title = false;
        } else if (title_mode == LiteGraph.AUTOHIDE_TITLE && mouse_over) {
            render_title = true;
        }

        var area = tmp_area;
        area[0] = 0; //x
        area[1] = render_title ? -title_height : 0; //y
        area[2] = size[0] + 1; //w
        area[3] = render_title ? size[1] + title_height : size[1]; //h

        var old_alpha = ctx.globalAlpha;

        //full node shape
        //if(node.flags.collapsed)
        {
            ctx.beginPath();
            if (shape == LiteGraph.BOX_SHAPE || low_quality) {
                ctx.fillRect(area[0], area[1], area[2], area[3]);
            } else if (
                shape == LiteGraph.ROUND_SHAPE ||
                shape == LiteGraph.CARD_SHAPE
            ) {
                ctx.roundRect(
                    area[0],
                    area[1],
                    area[2],
                    area[3],
                    this.round_radius,
                    shape == LiteGraph.CARD_SHAPE ? 0 : this.round_radius
                );
            } else if (shape == LiteGraph.CIRCLE_SHAPE) {
                ctx.arc(
                    size[0] * 0.5,
                    size[1] * 0.5,
                    size[0] * 0.5,
                    0,
                    Math.PI * 2
                );
            }
            ctx.fill();

            //separator
            if (!node.flags.collapsed) {
                ctx.shadowColor = "transparent";
                ctx.fillStyle = "rgba(0,0,0,0.2)";
                ctx.fillRect(0, -1, area[2], 2);
            }
        }
        ctx.shadowColor = "transparent";

        if (node.onDrawBackground) {
            node.onDrawBackground(ctx, this, this.canvas);
        }

        //title bg (remember, it is rendered ABOVE the node)
        if (render_title || title_mode == LiteGraph.TRANSPARENT_TITLE) {
            //title bar
            if (node.onDrawTitleBar) {
                node.onDrawTitleBar(
                    ctx,
                    title_height,
                    size,
                    this.ds.scale,
                    fgcolor
                );
            } else if (
                title_mode != LiteGraph.TRANSPARENT_TITLE &&
                (node.constructor.title_color || this.render_title_colored)
            ) {
                var title_color = node.constructor.title_color || fgcolor;

                if (node.flags.collapsed) {
                    ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR;
                }

                //* gradient test
                if (this.use_gradients) {
                    var grad = LGraphCanvas.gradients[title_color];
                    if (!grad) {
                        grad = LGraphCanvas.gradients[title_color] = ctx.createLinearGradient(0, 0, 400, 0);
                        grad.addColorStop(0, title_color);
                        grad.addColorStop(1, "#000");
                    }
                    ctx.fillStyle = grad;
                } else {
                    ctx.fillStyle = title_color;
                }

                //ctx.globalAlpha = 0.5 * old_alpha;
                ctx.beginPath();
                if (shape == LiteGraph.BOX_SHAPE || low_quality) {
                    ctx.rect(0, -title_height, size[0] + 1, title_height);
                } else if (shape == LiteGraph.ROUND_SHAPE || shape == LiteGraph.CARD_SHAPE) {
                    ctx.roundRect(
                        0,
                        -title_height,
                        size[0] + 1,
                        title_height,
                        this.round_radius,
                        node.flags.collapsed ? this.round_radius : 0
                    );
                }
                ctx.fill();
                ctx.shadowColor = "transparent";
            }

            //title box
            var box_size = 10;
            if (node.onDrawTitleBox) {
                node.onDrawTitleBox(ctx, title_height, size, this.ds.scale);
            } else if (
                shape == LiteGraph.ROUND_SHAPE ||
                shape == LiteGraph.CIRCLE_SHAPE ||
                shape == LiteGraph.CARD_SHAPE
            ) {
                if (low_quality) {
                    ctx.fillStyle = "black";
                    ctx.beginPath();
                    ctx.arc(
                        title_height * 0.5,
                        title_height * -0.5,
                        box_size * 0.5 + 1,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }

                ctx.fillStyle = node.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
                if (low_quality)
                    ctx.fillRect(title_height * 0.5 - box_size * 0.5, title_height * -0.5 - box_size * 0.5, box_size, box_size);
                else {
                    ctx.beginPath();
                    ctx.arc(
                        title_height * 0.5,
                        title_height * -0.5,
                        box_size * 0.5,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            } else {
                if (low_quality) {
                    ctx.fillStyle = "black";
                    ctx.fillRect(
                        (title_height - box_size) * 0.5 - 1,
                        (title_height + box_size) * -0.5 - 1,
                        box_size + 2,
                        box_size + 2
                    );
                }
                ctx.fillStyle = node.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
                ctx.fillRect(
                    (title_height - box_size) * 0.5,
                    (title_height + box_size) * -0.5,
                    box_size,
                    box_size
                );
            }
            ctx.globalAlpha = old_alpha;

            //title text
            if (node.onDrawTitleText) {
                node.onDrawTitleText(
                    ctx,
                    title_height,
                    size,
                    this.ds.scale,
                    this.title_text_font,
                    selected
                );
            }
            if (!low_quality) {
                ctx.font = this.title_text_font;
                var title = String(node.getTitle());
                if (title) {
                    if (selected) {
                        ctx.fillStyle = "white";
                    } else {
                        ctx.fillStyle =
                            node.constructor.title_text_color ||
                            this.node_title_color;
                    }
                    if (node.flags.collapsed) {
                        ctx.textAlign = "left";
                        var measure = ctx.measureText(title);
                        ctx.fillText(
                            title.substr(0, 20), //avoid urls too long
                            title_height,// + measure.width * 0.5,
                            LiteGraph.NODE_TITLE_TEXT_Y - title_height
                        );
                        ctx.textAlign = "left";
                    } else {
                        ctx.textAlign = "left";
                        ctx.fillText(
                            title,
                            title_height,
                            LiteGraph.NODE_TITLE_TEXT_Y - title_height
                        );
                    }
                }
            }

            if (node.onDrawTitle) {
                node.onDrawTitle(ctx);
            }
        }

        //render selection marker
        if (selected) {
            if (node.onBounding) {
                node.onBounding(area);
            }

            if (title_mode == LiteGraph.TRANSPARENT_TITLE) {
                area[1] -= title_height;
                area[3] += title_height;
            }
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            if (shape == LiteGraph.BOX_SHAPE) {
                ctx.rect(
                    -6 + area[0],
                    -6 + area[1],
                    12 + area[2],
                    12 + area[3]
                );
            } else if (
                shape == LiteGraph.ROUND_SHAPE ||
                (shape == LiteGraph.CARD_SHAPE && node.flags.collapsed)
            ) {
                ctx.roundRect(
                    -6 + area[0],
                    -6 + area[1],
                    12 + area[2],
                    12 + area[3],
                    this.round_radius * 2
                );
            } else if (shape == LiteGraph.CARD_SHAPE) {
                ctx.roundRect(
                    -6 + area[0],
                    -6 + area[1],
                    12 + area[2],
                    12 + area[3],
                    this.round_radius * 2,
                    2
                );
            } else if (shape == LiteGraph.CIRCLE_SHAPE) {
                ctx.arc(
                    size[0] * 0.5,
                    size[1] * 0.5,
                    size[0] * 0.5 + 6,
                    0,
                    Math.PI * 2
                );
            }
            ctx.strokeStyle = "#FFF";
            ctx.stroke();
            ctx.strokeStyle = fgcolor;
            ctx.globalAlpha = 1;
        }
    };

    /**
     * draws every connection visible in the canvas
     * OPTIMIZE THIS: pre-catch connections position instead of recomputing them every time
     * @method drawConnections
     **/
    drawConnections(ctx) {
        var now = LiteGraph.getTime();
        var visible_area = this.visible_area;
        margin_area[0] = visible_area[0] - 20;
        margin_area[1] = visible_area[1] - 20;
        margin_area[2] = visible_area[2] + 40;
        margin_area[3] = visible_area[3] + 40;

        //draw connections
        ctx.lineWidth = this.connections_width;

        ctx.fillStyle = "#AAA";
        ctx.strokeStyle = "#AAA";
        ctx.globalAlpha = this.editor_alpha;
        //for every node
        var nodes = this.graph._nodes;
        for (var n = 0, l = nodes.length; n < l; ++n) {
            var node = nodes[n];
            //for every input (we render just inputs because it is easier as every slot can only have one input)
            if (!node.inputs || !node.inputs.length) {
                continue;
            }

            for (var i = 0; i < node.inputs.length; ++i) {
                var input = node.inputs[i];
                if (!input || input.link == null) {
                    continue;
                }
                var link_id = input.link;
                var link = this.graph.links[link_id];
                if (!link) {
                    continue;
                }

                //find link info
                var start_node = this.graph.getNodeById(link.origin_id);
                if (start_node == null) {
                    continue;
                }
                var start_node_slot = link.origin_slot;
                var start_node_slotpos = null;
                if (start_node_slot == -1) {
                    start_node_slotpos = [
                        start_node.pos[0] + 10,
                        start_node.pos[1] + 10
                    ];
                } else {
                    start_node_slotpos = start_node.getConnectionPos(
                        false,
                        start_node_slot,
                        tempA
                    );
                }
                var end_node_slotpos = node.getConnectionPos(true, i, tempB);

                //compute link bounding
                link_bounding[0] = start_node_slotpos[0];
                link_bounding[1] = start_node_slotpos[1];
                link_bounding[2] = end_node_slotpos[0] - start_node_slotpos[0];
                link_bounding[3] = end_node_slotpos[1] - start_node_slotpos[1];
                if (link_bounding[2] < 0) {
                    link_bounding[0] += link_bounding[2];
                    link_bounding[2] = Math.abs(link_bounding[2]);
                }
                if (link_bounding[3] < 0) {
                    link_bounding[1] += link_bounding[3];
                    link_bounding[3] = Math.abs(link_bounding[3]);
                }

                //skip links outside of the visible area of the canvas
                if (!overlapBounding(link_bounding, margin_area)) {
                    continue;
                }

                var start_slot = start_node.outputs[start_node_slot];
                var end_slot = node.inputs[i];
                if (!start_slot || !end_slot) {
                    continue;
                }
                var start_dir =
                    start_slot.dir ||
                    (start_node.horizontal ? LiteGraph.DOWN : LiteGraph.RIGHT);
                var end_dir =
                    end_slot.dir ||
                    (node.horizontal ? LiteGraph.UP : LiteGraph.LEFT);

                this.renderLink(
                    ctx,
                    start_node_slotpos,
                    end_node_slotpos,
                    link,
                    false,
                    0,
                    null,
                    start_dir,
                    end_dir
                );

                //event triggered rendered on top
                if (link && link._last_time && now - link._last_time < 1000) {
                    var f = 2.0 - (now - link._last_time) * 0.002;
                    var tmp = ctx.globalAlpha;
                    ctx.globalAlpha = tmp * f;
                    this.renderLink(
                        ctx,
                        start_node_slotpos,
                        end_node_slotpos,
                        link,
                        true,
                        f,
                        "white",
                        start_dir,
                        end_dir
                    );
                    ctx.globalAlpha = tmp;
                }
            }
        }
        ctx.globalAlpha = 1;
    };

    /**
     * draws a link between two points
     * @method renderLink
     * @param {vec2} a start pos
     * @param {vec2} b end pos
     * @param {Object} link the link object with all the link info
     * @param {boolean} skip_border ignore the shadow of the link
     * @param {boolean} flow show flow animation (for events)
     * @param {string} color the color for the link
     * @param {number} start_dir the direction enum
     * @param {number} end_dir the direction enum
     * @param {number} num_sublines number of sublines (useful to represent vec3 or rgb)
     **/
    renderLink(
        ctx,
        a,
        b,
        link,
        skip_border,
        flow,
        color,
        start_dir,
        end_dir,
        num_sublines
    ) {
        if (link) {
            this.visible_links.push(link);
        }

        //choose color
        if (!color && link) {
            color = link.color || LGraphCanvas.link_type_colors[link.type];
        }
        if (!color) {
            color = this.default_link_color;
        }
        if (link != null && this.highlighted_links[link.id]) {
            color = "#FFF";
        }

        start_dir = start_dir || LiteGraph.RIGHT;
        end_dir = end_dir || LiteGraph.LEFT;

        var dist = distance(a, b);

        if (this.render_connections_border && this.ds.scale > 0.6) {
            ctx.lineWidth = this.connections_width + 4;
        }
        ctx.lineJoin = "round";
        num_sublines = num_sublines || 1;
        if (num_sublines > 1) {
            ctx.lineWidth = 0.5;
        }

        //begin line shape
        ctx.beginPath();
        for (var i = 0; i < num_sublines; i += 1) {
            var offsety = (i - (num_sublines - 1) * 0.5) * 5;

            if (this.links_render_mode == LiteGraph.SPLINE_LINK) {
                ctx.moveTo(a[0], a[1] + offsety);
                var start_offset_x = 0;
                var start_offset_y = 0;
                var end_offset_x = 0;
                var end_offset_y = 0;
                switch (start_dir) {
                    case LiteGraph.LEFT:
                        start_offset_x = dist * -0.25;
                        break;
                    case LiteGraph.RIGHT:
                        start_offset_x = dist * 0.25;
                        break;
                    case LiteGraph.UP:
                        start_offset_y = dist * -0.25;
                        break;
                    case LiteGraph.DOWN:
                        start_offset_y = dist * 0.25;
                        break;
                }
                switch (end_dir) {
                    case LiteGraph.LEFT:
                        end_offset_x = dist * -0.25;
                        break;
                    case LiteGraph.RIGHT:
                        end_offset_x = dist * 0.25;
                        break;
                    case LiteGraph.UP:
                        end_offset_y = dist * -0.25;
                        break;
                    case LiteGraph.DOWN:
                        end_offset_y = dist * 0.25;
                        break;
                }
                ctx.bezierCurveTo(
                    a[0] + start_offset_x,
                    a[1] + start_offset_y + offsety,
                    b[0] + end_offset_x,
                    b[1] + end_offset_y + offsety,
                    b[0],
                    b[1] + offsety
                );
            } else if (this.links_render_mode == LiteGraph.LINEAR_LINK) {
                ctx.moveTo(a[0], a[1] + offsety);
                var start_offset_x = 0;
                var start_offset_y = 0;
                var end_offset_x = 0;
                var end_offset_y = 0;
                switch (start_dir) {
                    case LiteGraph.LEFT:
                        start_offset_x = -1;
                        break;
                    case LiteGraph.RIGHT:
                        start_offset_x = 1;
                        break;
                    case LiteGraph.UP:
                        start_offset_y = -1;
                        break;
                    case LiteGraph.DOWN:
                        start_offset_y = 1;
                        break;
                }
                switch (end_dir) {
                    case LiteGraph.LEFT:
                        end_offset_x = -1;
                        break;
                    case LiteGraph.RIGHT:
                        end_offset_x = 1;
                        break;
                    case LiteGraph.UP:
                        end_offset_y = -1;
                        break;
                    case LiteGraph.DOWN:
                        end_offset_y = 1;
                        break;
                }
                var l = 15;
                ctx.lineTo(
                    a[0] + start_offset_x * l,
                    a[1] + start_offset_y * l + offsety
                );
                ctx.lineTo(
                    b[0] + end_offset_x * l,
                    b[1] + end_offset_y * l + offsety
                );
                ctx.lineTo(b[0], b[1] + offsety);
            } else if (this.links_render_mode == LiteGraph.STRAIGHT_LINK) {
                ctx.moveTo(a[0], a[1]);
                var start_x = a[0];
                var start_y = a[1];
                var end_x = b[0];
                var end_y = b[1];
                if (start_dir == LiteGraph.RIGHT) {
                    start_x += 10;
                } else {
                    start_y += 10;
                }
                if (end_dir == LiteGraph.LEFT) {
                    end_x -= 10;
                } else {
                    end_y -= 10;
                }
                ctx.lineTo(start_x, start_y);
                ctx.lineTo((start_x + end_x) * 0.5, start_y);
                ctx.lineTo((start_x + end_x) * 0.5, end_y);
                ctx.lineTo(end_x, end_y);
                ctx.lineTo(b[0], b[1]);
            } else {
                return;
            } //unknown
        }

        //rendering the outline of the connection can be a little bit slow
        if (
            this.render_connections_border &&
            this.ds.scale > 0.6 &&
            !skip_border
        ) {
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.stroke();
        }

        ctx.lineWidth = this.connections_width;
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.stroke();
        //end line shape

        var pos = this.computeConnectionPoint(a, b, 0.5, start_dir, end_dir);
        if (link && link._pos) {
            link._pos[0] = pos[0];
            link._pos[1] = pos[1];
        }

        //render arrow in the middle
        if (
            this.ds.scale >= 0.6 &&
            this.highquality_render &&
            end_dir != LiteGraph.CENTER
        ) {
            //render arrow
            if (this.render_connection_arrows) {
                //compute two points in the connection
                var posA = this.computeConnectionPoint(
                    a,
                    b,
                    0.25,
                    start_dir,
                    end_dir
                );
                var posB = this.computeConnectionPoint(
                    a,
                    b,
                    0.26,
                    start_dir,
                    end_dir
                );
                var posC = this.computeConnectionPoint(
                    a,
                    b,
                    0.75,
                    start_dir,
                    end_dir
                );
                var posD = this.computeConnectionPoint(
                    a,
                    b,
                    0.76,
                    start_dir,
                    end_dir
                );

                //compute the angle between them so the arrow points in the right direction
                var angleA = 0;
                var angleB = 0;
                if (this.render_curved_connections) {
                    angleA = -Math.atan2(posB[0] - posA[0], posB[1] - posA[1]);
                    angleB = -Math.atan2(posD[0] - posC[0], posD[1] - posC[1]);
                } else {
                    angleB = angleA = b[1] > a[1] ? 0 : Math.PI;
                }

                //render arrow
                ctx.save();
                ctx.translate(posA[0], posA[1]);
                ctx.rotate(angleA);
                ctx.beginPath();
                ctx.moveTo(-5, -3);
                ctx.lineTo(0, +7);
                ctx.lineTo(+5, -3);
                ctx.fill();
                ctx.restore();
                ctx.save();
                ctx.translate(posC[0], posC[1]);
                ctx.rotate(angleB);
                ctx.beginPath();
                ctx.moveTo(-5, -3);
                ctx.lineTo(0, +7);
                ctx.lineTo(+5, -3);
                ctx.fill();
                ctx.restore();
            }

            //circle
            ctx.beginPath();
            ctx.arc(pos[0], pos[1], 5, 0, Math.PI * 2);
            ctx.fill();
        }

        //render flowing points
        if (flow) {
            ctx.fillStyle = color;
            for (var i = 0; i < 5; ++i) {
                var f = (LiteGraph.getTime() * 0.001 + i * 0.2) % 1;
                var pos = this.computeConnectionPoint(
                    a,
                    b,
                    f,
                    start_dir,
                    end_dir
                );
                ctx.beginPath();
                ctx.arc(pos[0], pos[1], 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    };

    //returns the link center point based on curvature
    computeConnectionPoint(
        a,
        b,
        t,
        start_dir,
        end_dir
    ) {
        start_dir = start_dir || LiteGraph.RIGHT;
        end_dir = end_dir || LiteGraph.LEFT;

        var dist = distance(a, b);
        var p0 = a;
        var p1 = [a[0], a[1]];
        var p2 = [b[0], b[1]];
        var p3 = b;

        switch (start_dir) {
            case LiteGraph.LEFT:
                p1[0] += dist * -0.25;
                break;
            case LiteGraph.RIGHT:
                p1[0] += dist * 0.25;
                break;
            case LiteGraph.UP:
                p1[1] += dist * -0.25;
                break;
            case LiteGraph.DOWN:
                p1[1] += dist * 0.25;
                break;
        }
        switch (end_dir) {
            case LiteGraph.LEFT:
                p2[0] += dist * -0.25;
                break;
            case LiteGraph.RIGHT:
                p2[0] += dist * 0.25;
                break;
            case LiteGraph.UP:
                p2[1] += dist * -0.25;
                break;
            case LiteGraph.DOWN:
                p2[1] += dist * 0.25;
                break;
        }

        var c1 = (1 - t) * (1 - t) * (1 - t);
        var c2 = 3 * ((1 - t) * (1 - t)) * t;
        var c3 = 3 * (1 - t) * (t * t);
        var c4 = t * t * t;

        var x = c1 * p0[0] + c2 * p1[0] + c3 * p2[0] + c4 * p3[0];
        var y = c1 * p0[1] + c2 * p1[1] + c3 * p2[1] + c4 * p3[1];
        return [x, y];
    };

    drawExecutionOrder(ctx) {
        ctx.shadowColor = "transparent";
        ctx.globalAlpha = 0.25;

        ctx.textAlign = "center";
        ctx.strokeStyle = "white";
        ctx.globalAlpha = 0.75;

        var visible_nodes = this.visible_nodes;
        for (var i = 0; i < visible_nodes.length; ++i) {
            var node = visible_nodes[i];
            ctx.fillStyle = "black";
            ctx.fillRect(
                node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT,
                node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
                LiteGraph.NODE_TITLE_HEIGHT,
                LiteGraph.NODE_TITLE_HEIGHT
            );
            if (node.order == 0) {
                ctx.strokeRect(
                    node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
                    node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
                    LiteGraph.NODE_TITLE_HEIGHT,
                    LiteGraph.NODE_TITLE_HEIGHT
                );
            }
            ctx.fillStyle = "#FFF";
            ctx.fillText(
                node.order,
                node.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * -0.5,
                node.pos[1] - 6
            );
        }
        ctx.globalAlpha = 1;
    };

    /**
     * draws the widgets stored inside a node
     * @method drawNodeWidgets
     **/
    drawNodeWidgets(
        node,
        posY,
        ctx,
        active_widget
    ) {
        if (!node.widgets || !node.widgets.length) {
            return 0;
        }
        var width = node.size[0];
        var widgets = node.widgets;
        posY += 2;
        var H = LiteGraph.NODE_WIDGET_HEIGHT;
        var show_text = this.ds.scale > 0.5;
        ctx.save();
        ctx.globalAlpha = this.editor_alpha;
        var outline_color = LiteGraph.WIDGET_OUTLINE_COLOR;
        var background_color = LiteGraph.WIDGET_BGCOLOR;
        var text_color = LiteGraph.WIDGET_TEXT_COLOR;
        var secondary_text_color = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
        var margin = 15;

        for (var i = 0; i < widgets.length; ++i) {
            var w = widgets[i];
            var y = posY;
            if (w.y) {
                y = w.y;
            }
            w.last_y = y;
            if (w.options.heightScale) {
                H = LiteGraph.NODE_WIDGET_HEIGHT * w.options.heightScale;
            }
            ctx.strokeStyle = outline_color;
            ctx.fillStyle = "#222";
            ctx.textAlign = "left";
            if (w.disabled)
                ctx.globalAlpha *= 0.5;


            switch (w.type) {
                case "button":
                    if (w.clicked) {
                        ctx.fillStyle = "#AAA";
                        w.clicked = false;
                        this.dirty_canvas = true;
                    }
                    ctx.fillRect(margin, y, width - margin * 2, H);
                    if (show_text)
                        ctx.strokeRect(margin, y, width - margin * 2, H);
                    if (show_text) {
                        ctx.textAlign = "center";
                        ctx.fillStyle = text_color;
                        ctx.fillText(w.name, width * 0.5, y + H * 0.7);
                    }
                    break;
                case "toggle":
                    ctx.textAlign = "left";
                    ctx.strokeStyle = outline_color;
                    ctx.fillStyle = background_color;
                    ctx.beginPath();
                    if (show_text)
                        ctx.roundRect(margin, posY, width - margin * 2, H, H * 0.5);
                    else
                        ctx.rect(margin, posY, width - margin * 2, H);
                    ctx.fill();
                    if (show_text)
                        ctx.stroke();
                    ctx.fillStyle = w.value ? "#89A" : "#333";
                    ctx.beginPath();
                    ctx.arc(width - margin * 2, y + H * 0.5, H * 0.36, 0, Math.PI * 2);
                    ctx.fill();
                    if (show_text) {
                        ctx.fillStyle = secondary_text_color;
                        if (w.name != null) {
                            ctx.fillText(w.name, margin * 2, y + H * 0.7);
                        }
                        ctx.fillStyle = w.value ? text_color : secondary_text_color;
                        ctx.textAlign = "right";
                        ctx.fillText(
                            w.value
                                ? w.options.on || "true"
                                : w.options.off || "false",
                            width - 40,
                            y + H * 0.7
                        );
                    }
                    break;
                case "slider":
                    ctx.fillStyle = background_color;
                    ctx.fillRect(margin, y, width - margin * 2, H);
                    var range = w.options.max - w.options.min;
                    var nvalue = (w.value - w.options.min) / range;
                    ctx.fillStyle = active_widget == w ? "#89A" : "#678";
                    ctx.fillRect(margin, y, nvalue * (width - margin * 2), H);
                    if (show_text)
                        ctx.strokeRect(margin, y, width - margin * 2, H);
                    if (w.marker) {
                        var marker_nvalue = (w.marker - w.options.min) / range;
                        ctx.fillStyle = "#AA9";
                        ctx.fillRect(margin + marker_nvalue * (width - margin * 2), y, 2, H);
                    }
                    if (show_text) {
                        ctx.textAlign = "center";
                        ctx.fillStyle = text_color;
                        ctx.fillText(
                            w.name + "  " + Number(w.value).toFixed(3),
                            width * 0.5,
                            y + H * 0.7
                        );
                    }
                    break;
                case "number":
                case "combo":
                    ctx.textAlign = "left";
                    ctx.strokeStyle = outline_color;
                    ctx.fillStyle = background_color;
                    ctx.beginPath();
                    if (show_text)
                        ctx.roundRect(margin, posY, width - margin * 2, H, H * 0.5);
                    else
                        ctx.rect(margin, posY, width - margin * 2, H);
                    ctx.fill();
                    if (show_text) {
                        ctx.stroke();
                        ctx.fillStyle = text_color;
                        ctx.beginPath();
                        ctx.moveTo(margin + 16, posY + 5);
                        ctx.lineTo(margin + 6, posY + H * 0.5);
                        ctx.lineTo(margin + 16, posY + H - 5);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.moveTo(width - margin - 16, posY + 5);
                        ctx.lineTo(width - margin - 6, posY + H * 0.5);
                        ctx.lineTo(width - margin - 16, posY + H - 5);
                        ctx.fill();
                        ctx.fillStyle = secondary_text_color;
                        ctx.fillText(w.name, margin * 2 + 5, y + H * 0.7);
                        ctx.fillStyle = text_color;
                        ctx.textAlign = "right";
                        if (w.type == "number") {
                            ctx.fillText(
                                Number(w.value).toFixed(
                                    w.options.precision !== undefined
                                        ? w.options.precision
                                        : 3
                                ),
                                width - margin * 2 - 20,
                                y + H * 0.7
                            );
                        } else {
                            var v = w.value;
                            if (w.options.values) {
                                var values = w.options.values;
                                if (values.constructor === Function)
                                    values = values();
                                if (values && values.constructor !== Array)
                                    v = values[w.value];
                            }
                            ctx.fillText(
                                v,
                                width - margin * 2 - 20,
                                y + H * 0.7
                            );
                        }
                    }
                    break;
                case "string":
                case "text":
                    ctx.textAlign = "left";
                    ctx.strokeStyle = outline_color;
                    ctx.fillStyle = background_color;
                    ctx.beginPath();
                    if (show_text)
                        ctx.roundRect(margin, posY, width - margin * 2, H, H * 0.5);
                    else
                        ctx.rect(margin, posY, width - margin * 2, H);
                    ctx.fill();
                    if (show_text) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(margin, posY, width - margin * 2, H);
                        ctx.clip();

                        ctx.stroke();
                        ctx.fillStyle = secondary_text_color;
                        if (w.name != null) {
                            ctx.fillText(w.name, margin * 2, y + H * 0.7);
                        }
                        ctx.fillStyle = text_color;
                        ctx.textAlign = "right";
                        ctx.fillText(String(w.value).substr(0, 30), width - margin * 2, y + H * 0.7); //30 chars max
                        ctx.restore();
                    }
                    break;
                case "textarea":
                    ctx.textAlign = "left";
                    ctx.strokeStyle = outline_color;
                    ctx.fillStyle = background_color;
                    ctx.beginPath();

                    var height = H;
                    if (show_text)
                        ctx.roundRect(margin, posY, width - margin * 2, height, LiteGraph.NODE_WIDGET_HEIGHT * 0.5);
                    else
                        ctx.rect(margin, posY, width - margin * 2, height);
                    ctx.fill();
                    if (show_text) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(margin, posY, width - margin * 2, height);
                        ctx.clip();

                        ctx.stroke();
                        ctx.fillStyle = secondary_text_color;
                        // TODO: make labels have own line
                        if (w.name != null) {
                            ctx.fillText(w.name + ":", margin * 2, y + LiteGraph.NODE_WIDGET_HEIGHT * 0.7);
                        }
                        ctx.fillStyle = text_color;
                        ctx.textAlign = "left";
                        //start typing into second line
                        ctx.fillText(String(w.value).substr(0, 30), margin * 2, y + (LiteGraph.NODE_WIDGET_HEIGHT * 2) * 0.7); //30 chars max
                        ctx.restore();
                    }
                    break;
                default:
                    if (w.draw) {
                        w.draw(ctx, node, w, y, H);
                    }
                    break;
            }
            posY += H + 4;
            ctx.globalAlpha = this.editor_alpha;

        }
        ctx.restore();
        ctx.textAlign = "left";
    };

    /**
     * process an event on widgets
     * @method processNodeWidgets
     **/
    processNodeWidgets(
        node,
        pos,
        event,
        active_widget
    ) {
        if (!node.widgets || !node.widgets.length) {
            return null;
        }

        var x = pos[0] - node.pos[0];
        var y = pos[1] - node.pos[1];
        var width = node.size[0];
        var that = this;
        var ref_window = this.getCanvasWindow();

        for (var i = 0; i < node.widgets.length; ++i) {
            var w = node.widgets[i];
            if (!w || w.disabled)
                continue;
            if (w == active_widget || (x > 6 && x < width - 12 && y > w.last_y && y < w.last_y + (LiteGraph.NODE_WIDGET_HEIGHT * w.options.heightScale))) {
                //inside widget
                switch (w.type) {
                    case "button":
                        if (event.type === "mousemove") {
                            break;
                        }
                        if (w.callback) {
                            setTimeout(function() {
                                w.callback(w, that, node, pos, event);
                            }, 20);
                        }
                        w.clicked = true;
                        this.dirty_canvas = true;
                        break;
                    case "slider":
                        var range = w.options.max - w.options.min;
                        var nvalue = Math.clamp((x - 10) / (width - 20), 0, 1);
                        w.value =
                            w.options.min +
                            (w.options.max - w.options.min) * nvalue;
                        if (w.callback) {
                            setTimeout(function() {
                                inner_value_change(w, w.value);
                            }, 20);
                        }
                        this.dirty_canvas = true;
                        break;
                    case "number":
                    case "combo":
                        var old_value = w.value;
                        if (event.type == "mousemove" && w.type == "number") {
                            w.value += event.deltaX * 0.1 * (w.options.step || 1);
                            if (w.options.min != null && w.value < w.options.min) {
                                w.value = w.options.min;
                            }
                            if (w.options.max != null && w.value > w.options.max) {
                                w.value = w.options.max;
                            }
                        } else if (event.type == "mousedown") {
                            var values = w.options.values;
                            if (values && values.constructor === Function) {
                                values = w.options.values(w, node);
                            }
                            var values_list = null;

                            if (w.type != "number")
                                values_list = values.constructor === Array ? values : Object.keys(values);

                            var delta = x < 40 ? -1 : x > width - 40 ? 1 : 0;
                            if (w.type == "number") {
                                w.value += delta * 0.1 * (w.options.step || 1);
                                if (w.options.min != null && w.value < w.options.min) {
                                    w.value = w.options.min;
                                }
                                if (w.options.max != null && w.value > w.options.max) {
                                    w.value = w.options.max;
                                }
                            } else if (delta) { //clicked in arrow, used for combos 
                                var index = -1;
                                if (values.constructor === Object)
                                    index = values_list.indexOf(String(w.value)) + delta;
                                else
                                    index = values_list.indexOf(w.value) + delta;
                                if (index >= values_list.length) {
                                    index = values_list.length - 1;
                                }
                                if (index < 0) {
                                    index = 0;
                                }
                                if (values.constructor === Array)
                                    w.value = values[index];
                                else
                                    w.value = index;
                            } else { //combo clicked 
                                var text_values = values != values_list ? Object.values(values) : values;
                                var menu = new LiteGraph.ContextMenu(text_values, {
                                        scale: Math.max(1, this.ds.scale),
                                        event: event,
                                        className: "dark",
                                        callback: inner_clicked.bind(w)
                                    },
                                    ref_window);

                                function inner_clicked(v, option, event) {
                                    if (values != values_list)
                                        v = text_values.indexOf(v);
                                    this.value = v;
                                    inner_value_change(this, v);
                                    that.dirty_canvas = true;
                                    return false;
                                }
                            }
                        } //end mousedown
                        else if (event.type == "mouseup" && w.type == "number") {
                            var delta = x < 40 ? -1 : x > width - 40 ? 1 : 0;
                            if (event.click_time < 200 && delta == 0) {
                                this.prompt("Value", w.value, function(v) {
                                        this.value = Number(v);
                                        inner_value_change(this, this.value);
                                    }.bind(w),
                                    event);
                            }
                        }

                        if (old_value != w.value)
                            setTimeout(
                                function() {
                                    inner_value_change(this, this.value);
                                }.bind(w),
                                20
                            );
                        this.dirty_canvas = true;
                        break;
                    case "toggle":
                        if (event.type == "mousedown") {
                            w.value = !w.value;
                            setTimeout(function() {
                                inner_value_change(w, w.value);
                            }, 20);
                        }
                        break;
                    case "string":
                    case "text":
                        if (event.type == "mousedown") {
                            this.prompt("Value", w.value, function(v) {
                                    this.value = v;
                                    inner_value_change(this, v);
                                }.bind(w),
                                event);
                        }
                        break;
                    case "textarea":
                        if (event.type == "mousedown") {
                            this.prompt("Value", w.value, function(v) {
                                    this.value = v;
                                    inner_value_change(this, v);
                                }.bind(w),
                                event);
                        }
                        break;
                    default:
                        if (w.mouse) {
                            w.mouse(ctx, event, [x, y], node);
                        }
                        break;
                } //end switch

                return w;
            }
        }

        function inner_value_change(widget, value) {
            widget.value = value;
            if (widget.options && widget.options.property && node.properties[widget.options.property] !== undefined) {
                node.setProperty(widget.options.property, value);
            }
            if (widget.callback) {
                widget.callback(widget.value, that, node, pos, event);
            }
        }

        return null;
    };

    /**
     * draws every group area in the background
     * @method drawGroups
     **/
    drawGroups(canvas, ctx) {
        if (!this.graph) {
            return;
        }

        var groups = this.graph._groups;

        ctx.save();
        ctx.globalAlpha = 0.5 * this.editor_alpha;

        for (var i = 0; i < groups.length; ++i) {
            var group = groups[i];

            if (!overlapBounding(this.visible_area, group._bounding)) {
                continue;
            } //out of the visible area

            ctx.fillStyle = group.color || "#335";
            ctx.strokeStyle = group.color || "#335";
            var pos = group._pos;
            var size = group._size;
            ctx.globalAlpha = 0.25 * this.editor_alpha;
            ctx.beginPath();
            ctx.rect(pos[0] + 0.5, pos[1] + 0.5, size[0], size[1]);
            ctx.fill();
            ctx.globalAlpha = this.editor_alpha;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pos[0] + size[0], pos[1] + size[1]);
            ctx.lineTo(pos[0] + size[0] - 10, pos[1] + size[1]);
            ctx.lineTo(pos[0] + size[0], pos[1] + size[1] - 10);
            ctx.fill();

            var font_size =
                group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE;
            ctx.font = font_size + "px Arial";
            ctx.fillText(group.title, pos[0] + 4, pos[1] + font_size);
        }

        ctx.restore();
    };

    adjustNodesSize() {
        var nodes = this.graph._nodes;
        for (var i = 0; i < nodes.length; ++i) {
            nodes[i].size = nodes[i].computeSize();
        }
        this.setDirty(true, true);
    };

    /**
     * resizes the canvas to a given size, if no size is passed, then it tries to fill the parentNode
     * @method resize
     **/
    resize(width, height) {
        if (!width && !height) {
            var parent = this.canvas.parentNode;
            width = parent.offsetWidth;
            height = parent.offsetHeight;
        }

        if (this.canvas.width == width && this.canvas.height == height) {
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.bgcanvas.width = this.canvas.width;
        this.bgcanvas.height = this.canvas.height;
        this.setDirty(true, true);
    };

    /**
     * switches to live mode (node shapes are not rendered, only the content)
     * this feature was designed when graphs where meant to create user interfaces
     * @method switchLiveMode
     **/
    switchLiveMode(transition) {
        if (!transition) {
            this.live_mode = !this.live_mode;
            this.dirty_canvas = true;
            this.dirty_bgcanvas = true;
            return;
        }

        var self = this;
        var delta = this.live_mode ? 1.1 : 0.9;
        if (this.live_mode) {
            this.live_mode = false;
            this.editor_alpha = 0.1;
        }

        var t = setInterval(function() {
            self.editor_alpha *= delta;
            self.dirty_canvas = true;
            self.dirty_bgcanvas = true;

            if (delta < 1 && self.editor_alpha < 0.01) {
                clearInterval(t);
                if (delta < 1) {
                    self.live_mode = true;
                }
            }
            if (delta > 1 && self.editor_alpha > 0.99) {
                clearInterval(t);
                self.editor_alpha = 1;
            }
        }, 1);
    };

    onNodeSelectionChange(node) {
        return; //disabled
    };

    touchHandler(event) {
        //alert("foo");
        var touches = event.changedTouches,
            first = touches[0],
            type = "";

        switch (event.type) {
            case "touchstart":
                type = "mousedown";
                break;
            case "touchmove":
                type = "mousemove";
                break;
            case "touchend":
                type = "mouseup";
                break;
            default:
                return;
        }

        //initMouseEvent(type, canBubble, cancelable, view, clickCount,
        //           screenX, screenY, clientX, clientY, ctrlKey,
        //           altKey, shiftKey, metaKey, button, relatedTarget);

        var window = this.getCanvasWindow();
        var document = window.document;

        var simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(
            type,
            true,
            true,
            window,
            1,
            first.screenX,
            first.screenY,
            first.clientX,
            first.clientY,
            false,
            false,
            false,
            false,
            0 /*left*/,
            null
        );
        first.target.dispatchEvent(simulatedEvent);
        event.preventDefault();
    };

    /* CONTEXT MENU ********************/

    static onGroupAdd(info, entry, mouse_event) {
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var group = new LiteGraph.LGraphGroup();
        group.pos = canvas.convertEventToCanvasOffset(mouse_event);
        canvas.graph.add(group);
    };

    static onMenuAdd(node, options, e, prev_menu, callback) {
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var values = LiteGraph.getNodeTypesCategories(canvas.filter);
        var entries = [];
        for (var i in values) {
            if (values[i]) {
                entries.push({ value: values[i], content: values[i], has_submenu: true });
            }
        }

        //show categories
        var menu = new LiteGraph.ContextMenu(entries, {
            event: e,
            callback: inner_clicked,
            parentMenu: prev_menu
        }, ref_window);

        function inner_clicked(v, option, e) {
            var category = v.value;
            var node_types = LiteGraph.getNodeTypesInCategory(category, canvas.filter);
            var values = [];
            for (var i in node_types) {
                if (!node_types[i].skip_list) {
                    values.push({
                        content: node_types[i].title,
                        value: node_types[i].type
                    });
                }
            }

            new LiteGraph.ContextMenu(values, { event: e, callback: inner_create, parentMenu: menu }, ref_window);
            return false;
        }

        function inner_create(v, e) {
            var first_event = prev_menu.getFirstEvent();
            var node = LiteGraph.createNode(v.value);
            if (node) {
                node.pos = canvas.convertEventToCanvasOffset(first_event);
                canvas.graph.add(node);
            }
            if (callback)
                callback(node);
        }

        return false;
    };

    static onMenuCollapseAll() {
    };

    static onMenuNodeEdit() {
    };

    static showMenuNodeOptionalInputs(
        v,
        options,
        e,
        prev_menu,
        node
    ) {
        if (!node) {
            return;
        }

        var that = this;
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var options = node.optional_inputs;
        if (node.onGetInputs) {
            options = node.onGetInputs();
        }

        var entries = [];
        if (options) {
            for (var i in options) {
                var entry = options[i];
                if (!entry) {
                    entries.push(null);
                    continue;
                }
                var label = entry[0];
                if (entry[2] && entry[2].label) {
                    label = entry[2].label;
                }
                var data = { content: label, value: entry };
                if (entry[1] == LiteGraph.ACTION) {
                    data.className = "event";
                }
                entries.push(data);
            }
        }

        if (this.onMenuNodeInputs) {
            entries = this.onMenuNodeInputs(entries);
        }

        if (!entries.length) {
            return;
        }

        var menu = new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                node: node
            },
            ref_window
        );

        function inner_clicked(v, e, prev) {
            if (!node) {
                return;
            }

            if (v.callback) {
                v.callback.call(that, node, v, e, prev);
            }

            if (v.value) {
                node.addInput(v.value[0], v.value[1], v.value[2]);
                node.setDirtyCanvas(true, true);
            }
        }

        return false;
    };

    static showMenuNodeOptionalOutputs(
        v,
        options,
        e,
        prev_menu,
        node
    ) {
        if (!node) {
            return;
        }

        var that = this;
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var options = node.optional_outputs;
        if (node.onGetOutputs) {
            options = node.onGetOutputs();
        }

        var entries = [];
        if (options) {
            for (var i in options) {
                var entry = options[i];
                if (!entry) {
                    //separator?
                    entries.push(null);
                    continue;
                }

                if (
                    node.flags &&
                    node.flags.skip_repeated_outputs &&
                    node.findOutputSlot(entry[0]) != -1
                ) {
                    continue;
                } //skip the ones already on
                var label = entry[0];
                if (entry[2] && entry[2].label) {
                    label = entry[2].label;
                }
                var data = { content: label, value: entry };
                if (entry[1] == LiteGraph.EVENT) {
                    data.className = "event";
                }
                entries.push(data);
            }
        }

        if (this.onMenuNodeOutputs) {
            entries = this.onMenuNodeOutputs(entries);
        }

        if (!entries.length) {
            return;
        }

        var menu = new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                node: node
            },
            ref_window
        );

        function inner_clicked(v, e, prev) {
            if (!node) {
                return;
            }

            if (v.callback) {
                v.callback.call(that, node, v, e, prev);
            }

            if (!v.value) {
                return;
            }

            var value = v.value[1];

            if (
                value &&
                (value.constructor === Object || value.constructor === Array)
            ) {
                //submenu why?
                var entries = [];
                for (var i in value) {
                    entries.push({ content: i, value: value[i] });
                }
                new LiteGraph.ContextMenu(entries, {
                    event: e,
                    callback: inner_clicked,
                    parentMenu: prev_menu,
                    node: node
                });
                return false;
            } else {
                node.addOutput(v.value[0], v.value[1], v.value[2]);
                node.setDirtyCanvas(true, true);
            }
        }

        return false;
    };

    static onShowMenuNodeProperties(
        value,
        options,
        e,
        prev_menu,
        node
    ) {
        if (!node || !node.properties) {
            return;
        }

        var that = this;
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var entries = [];
        for (var i in node.properties) {
            var value = node.properties[i] !== undefined ? node.properties[i] : " ";
            if (typeof value == "object")
                value = JSON.stringify(value);
            //value could contain invalid html characters, clean that
            value = LGraphCanvas.decodeHTML(value);
            entries.push({
                content:
                    "<span class='property_name'>" +
                    i +
                    "</span>" +
                    "<span class='property_value'>" +
                    value +
                    "</span>",
                value: i
            });
        }
        if (!entries.length) {
            return;
        }

        var menu = new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                allow_html: true,
                node: node
            },
            ref_window
        );

        function inner_clicked(v, options, e, prev) {
            if (!node) {
                return;
            }
            var rect = this.getBoundingClientRect();
            canvas.showEditPropertyValue(node, v.value, {
                position: [rect.left, rect.top]
            });
        }

        return false;
    };

    static decodeHTML(str) {
        var e = document.createElement("div");
        e.innerText = str;
        return e.innerHTML;
    };

    static onResizeNode(value, options, e, menu, node) {
        if (!node) {
            return;
        }
        node.size = node.computeSize();
        node.setDirtyCanvas(true, true);
    };


    showLinkMenu(link, e) {
        var that = this;
        console.log(link);
        var options = ["Add Node", null, "Delete"];
        var menu = new LiteGraph.ContextMenu(options, {
            event: e,
            title: link.data != null ? link.data.constructor.name : null,
            callback: inner_clicked
        });

        function inner_clicked(v, options, e) {
            switch (v) {
                case "Add Node":
                    LGraphCanvas.onMenuAdd(null, null, e, menu, function(node) {
                        console.log("node autoconnect");
                        var node_left = that.graph.getNodeById(link.origin_id);
                        var node_right = that.graph.getNodeById(link.target_id);
                        if (!node.inputs || !node.inputs.length || !node.outputs || !node.outputs.length)
                            return;
                        if (node_left.outputs[link.origin_slot].type == node.inputs[0].type && node.outputs[0].type == node_right.inputs[0].type) {
                            node_left.connect(link.origin_slot, node, 0);
                            node.connect(0, node_right, link.target_slot);
                            node.pos[0] -= node.size[0] * 0.5;
                        }
                    });
                    break;
                case "Delete":
                    that.graph.removeLink(link.id);
                    break;
                default:
            }
        }

        return false;
    };

   static onShowPropertyEditor(item, options, e, menu, node) {
        var input_html = "";
        var property = item.property || "title";
        var value = node[property];

        var dialog = document.createElement("div");
        dialog.className = "graphdialog";
        dialog.innerHTML =
            "<span class='name'></span><input autofocus type='text' class='value'/><button>OK</button>";
        var title = dialog.querySelector(".name");
        title.innerText = property;
        var input = dialog.querySelector("input");
        if (input) {
            input.value = value;
            input.addEventListener("blur", function(e) {
                this.focus();
            });
            input.addEventListener("keydown", function(e) {
                if (e.keyCode != 13) {
                    return;
                }
                inner();
                e.preventDefault();
                e.stopPropagation();
            });
        }

        var graphcanvas = LGraphCanvas.active_canvas;
        var canvas = graphcanvas.canvas;

        var rect = canvas.getBoundingClientRect();
        var offsetx = -20;
        var offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        if (event) {
            dialog.style.left = event.clientX + offsetx + "px";
            dialog.style.top = event.clientY + offsety + "px";
        } else {
            dialog.style.left = canvas.width * 0.5 + offsetx + "px";
            dialog.style.top = canvas.height * 0.5 + offsety + "px";
        }

        var button = dialog.querySelector("button");
        button.addEventListener("click", inner);
        canvas.parentNode.appendChild(dialog);

        function inner() {
            setValue(input.value);
        }

        function setValue(value) {
            if (item.type == "Number") {
                value = Number(value);
            } else if (item.type == "Boolean") {
                value = Boolean(value);
            }
            node[property] = value;
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
            node.setDirtyCanvas(true, true);
        }
    };

    prompt(title, value, callback, event) {
        var that = this;
        var input_html = "";
        title = title || "";

        var modified = false;

        var dialog = document.createElement("div");
        dialog.className = "graphdialog rounded";
        dialog.innerHTML =
            "<span class='name'></span> <input autofocus type='text' class='value'/><button class='rounded'>OK</button>";
        dialog.close() {
            that.prompt_box = null;
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        };

        if (this.ds.scale > 1) {
            dialog.style.transform = "scale(" + this.ds.scale + ")";
        }

        dialog.addEventListener("mouseleave", function(e) {
            if (!modified) {
                dialog.close();
            }
        });

        if (that.prompt_box) {
            that.prompt_box.close();
        }
        that.prompt_box = dialog;

        var first = null;
        var timeout = null;
        var selected = null;

        var name_element = dialog.querySelector(".name");
        name_element.innerText = title;
        var value_element = dialog.querySelector(".value");
        value_element.value = value;

        var input = dialog.querySelector("input");
        input.addEventListener("keydown", function(e) {
            modified = true;
            if (e.keyCode == 27) {
                //ESC
                dialog.close();
            } else if (e.keyCode == 13) {
                if (callback) {
                    callback(this.value);
                }
                dialog.close();
            } else {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
        });

        var button = dialog.querySelector("button");
        button.addEventListener("click", function(e) {
            if (callback) {
                callback(input.value);
            }
            that.setDirty(true);
            dialog.close();
        });

        var graphcanvas = LGraphCanvas.active_canvas;
        var canvas = graphcanvas.canvas;

        var rect = canvas.getBoundingClientRect();
        var offsetx = -20;
        var offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        if (event) {
            dialog.style.left = event.clientX + offsetx + "px";
            dialog.style.top = event.clientY + offsety + "px";
        } else {
            dialog.style.left = canvas.width * 0.5 + offsetx + "px";
            dialog.style.top = canvas.height * 0.5 + offsety + "px";
        }

        canvas.parentNode.appendChild(dialog);
        setTimeout(function() {
            input.focus();
        }, 10);

        return dialog;
    };

    static search_limit = -1;
    showSearchBox(event) {
        var that = this;
        var input_html = "";
        var graphcanvas = LGraphCanvas.active_canvas;
        var canvas = graphcanvas.canvas;
        var root_document = canvas.ownerDocument || document;

        var dialog = document.createElement("div");
        dialog.className = "litegraph litesearchbox graphdialog rounded";
        dialog.innerHTML =
            "<span class='name'>Search</span> <input autofocus type='text' class='value rounded'/><div class='helper'></div>";
        dialog.close() {
            that.search_box = null;
            root_document.body.focus();
            root_document.body.style.overflow = "";

            setTimeout(function() {
                that.canvas.focus();
            }, 20); //important, if canvas loses focus keys wont be captured
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        };

        var timeout_close = null;

        if (this.ds.scale > 1) {
            dialog.style.transform = "scale(" + this.ds.scale + ")";
        }

        dialog.addEventListener("mouseenter", function(e) {
            if (timeout_close) {
                clearTimeout(timeout_close);
                timeout_close = null;
            }
        });

        dialog.addEventListener("mouseleave", function(e) {
            //dialog.close();
            timeout_close = setTimeout(function() {
                dialog.close();
            }, 500);
        });

        if (that.search_box) {
            that.search_box.close();
        }
        that.search_box = dialog;

        var helper = dialog.querySelector(".helper");

        var first = null;
        var timeout = null;
        var selected = null;

        var input = dialog.querySelector("input");
        if (input) {
            input.addEventListener("blur", function(e) {
                this.focus();
            });
            input.addEventListener("keydown", function(e) {
                if (e.keyCode == 38) {
                    //UP
                    changeSelection(false);
                } else if (e.keyCode == 40) {
                    //DOWN
                    changeSelection(true);
                } else if (e.keyCode == 27) {
                    //ESC
                    dialog.close();
                } else if (e.keyCode == 13) {
                    if (selected) {
                        select(selected.innerHTML);
                    } else if (first) {
                        select(first);
                    } else {
                        dialog.close();
                    }
                } else {
                    if (timeout) {
                        clearInterval(timeout);
                    }
                    timeout = setTimeout(refreshHelper, 10);
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return true;
            });
        }

        if (root_document.fullscreenElement)
            root_document.fullscreenElement.appendChild(dialog);
        else {
            root_document.body.appendChild(dialog);
            root_document.body.style.overflow = "hidden";
        }

        //compute best position
        var rect = canvas.getBoundingClientRect();

        var left = (event ? event.clientX : (rect.left + rect.width * 0.5)) - 80;
        var top = (event ? event.clientY : (rect.top + rect.height * 0.5)) - 20;
        dialog.style.left = left + "px";
        dialog.style.top = top + "px";

        //To avoid out of screen problems
        if (event.layerY > (rect.height - 200))
            helper.style.maxHeight = (rect.height - event.layerY - 20) + "px";

        /*
        var offsetx = -20;
        var offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        if (event) {
            dialog.style.left = event.clientX + offsetx + "px";
            dialog.style.top = event.clientY + offsety + "px";
        } else {
            dialog.style.left = canvas.width * 0.5 + offsetx + "px";
            dialog.style.top = canvas.height * 0.5 + offsety + "px";
        }
        canvas.parentNode.appendChild(dialog);
        */

        input.focus();

        function select(name) {
            if (name) {
                if (that.onSearchBoxSelection) {
                    that.onSearchBoxSelection(name, event, graphcanvas);
                } else {
                    var extra = LiteGraph.searchbox_extras[name.toLowerCase()];
                    if (extra) {
                        name = extra.type;
                    }

                    var node = LiteGraph.createNode(name);
                    if (node) {
                        node.pos = graphcanvas.convertEventToCanvasOffset(
                            event
                        );
                        graphcanvas.graph.add(node);
                    }

                    if (extra && extra.data) {
                        if (extra.data.properties) {
                            for (var i in extra.data.properties) {
                                node.addProperty(i, extra.data.properties[i]);
                            }
                        }
                        if (extra.data.inputs) {
                            node.inputs = [];
                            for (var i in extra.data.inputs) {
                                node.addOutput(
                                    extra.data.inputs[i][0],
                                    extra.data.inputs[i][1]
                                );
                            }
                        }
                        if (extra.data.outputs) {
                            node.outputs = [];
                            for (var i in extra.data.outputs) {
                                node.addOutput(
                                    extra.data.outputs[i][0],
                                    extra.data.outputs[i][1]
                                );
                            }
                        }
                        if (extra.data.title) {
                            node.title = extra.data.title;
                        }
                        if (extra.data.json) {
                            node.configure(extra.data.json);
                        }
                    }
                }
            }

            dialog.close();
        }

        function changeSelection(forward) {
            var prev = selected;
            if (selected) {
                selected.classList.remove("selected");
            }
            if (!selected) {
                selected = forward
                    ? helper.childNodes[0]
                    : helper.childNodes[helper.childNodes.length];
            } else {
                selected = forward
                    ? selected.nextSibling
                    : selected.previousSibling;
                if (!selected) {
                    selected = prev;
                }
            }
            if (!selected) {
                return;
            }
            selected.classList.add("selected");
            selected.scrollIntoView({ block: "end", behavior: "smooth" });
        }

        function refreshHelper() {
            timeout = null;
            var str = input.value;
            first = null;
            helper.innerHTML = "";
            if (!str) {
                return;
            }

            if (that.onSearchBox) {
                var list = that.onSearchBox(helper, str, graphcanvas);
                if (list) {
                    for (var i = 0; i < list.length; ++i) {
                        addResult(list[i]);
                    }
                }
            } else {
                var c = 0;
                str = str.toLowerCase();
                var filter = graphcanvas.filter || graphcanvas.graph.filter;

                //extras
                for (var i in LiteGraph.searchbox_extras) {
                    var extra = LiteGraph.searchbox_extras[i];
                    if (extra.desc.toLowerCase().indexOf(str) === -1) {
                        continue;
                    }
                    var ctor = LiteGraph.registered_node_types[extra.type];
                    if (ctor && ctor.filter && ctor.filter != filter)
                        continue;
                    addResult(extra.desc, "searchbox_extra");
                    if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit) {
                        break;
                    }
                }

                var filtered = null;
                if (Array.prototype.filter) { //filter supported
                    var keys = Object.keys(LiteGraph.registered_node_types); //types
                    var filtered = keys.filter(inner_test_filter);
                } else {
                    filtered = [];
                    for (var i in LiteGraph.registered_node_types) {
                        if (inner_test_filter(i))
                            filtered.push(i);
                    }
                }

                for (var i = 0; i < filtered.length; i++) {
                    addResult(filtered[i]);
                    if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit) {
                        break;
                    }
                }

                function inner_test_filter(type) {
                    var ctor = LiteGraph.registered_node_types[type];
                    if (filter && ctor.filter != filter)
                        return false;
                    return type.toLowerCase().indexOf(str) !== -1;
                }
            }

            function addResult(type, className) {
                var help = document.createElement("div");
                if (!first) {
                    first = type;
                }
                help.innerText = type;
                help.dataset["type"] = escape(type);
                help.className = "litegraph lite-search-item";
                if (className) {
                    help.className += " " + className;
                }
                help.addEventListener("click", function(e) {
                    select(unescape(this.dataset["type"]));
                });
                helper.appendChild(help);
            }
        }

        return dialog;
    };

    showEditPropertyValue(node, property, options) {
        if (!node || node.properties[property] === undefined) {
            return;
        }

        options = options || {};
        var that = this;

        var info = node.getPropertyInfo(property);
        var type = info.type;

        var input_html = "";

        if (type == "string" || type == "number" || type == "array" || type == "object") {
            input_html = "<input autofocus type='text' class='value'/>";
        } else if (type == "enum" && info.values) {
            input_html = "<select autofocus type='text' class='value'>";
            for (var i in info.values) {
                var v = info.values.constructor === Array ? info.values[i] : i;
                input_html +=
                    "<option value='" +
                    v +
                    "' " +
                    (v == node.properties[property] ? "selected" : "") +
                    ">" +
                    info.values[i] +
                    "</option>";
            }
            input_html += "</select>";
        } else if (type == "boolean") {
            input_html =
                "<input autofocus type='checkbox' class='value' " +
                (node.properties[property] ? "checked" : "") +
                "/>";
        } else {
            console.warn("unknown type: " + type);
            return;
        }

        var dialog = this.createDialog(
            "<span class='name'>" +
            property +
            "</span>" +
            input_html +
            "<button>OK</button>",
            options
        );

        if (type == "enum" && info.values) {
            var input = dialog.querySelector("select");
            input.addEventListener("change", function(e) {
                setValue(e.target.value);
                //var index = e.target.value;
                //setValue( e.options[e.selectedIndex].value );
            });
        } else if (type == "boolean") {
            var input = dialog.querySelector("input");
            if (input) {
                input.addEventListener("click", function(e) {
                    setValue(!!input.checked);
                });
            }
        } else {
            var input = dialog.querySelector("input");
            if (input) {
                input.addEventListener("blur", function(e) {
                    this.focus();
                });
                var v = node.properties[property] !== undefined ? node.properties[property] : "";
                v = JSON.stringify(v);
                input.value = v;
                input.addEventListener("keydown", function(e) {
                    if (e.keyCode != 13) {
                        return;
                    }
                    inner();
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
        }

        var button = dialog.querySelector("button");
        button.addEventListener("click", inner);

        function inner() {
            setValue(input.value);
        }

        function setValue(value) {
            if (typeof node.properties[property] == "number") {
                value = Number(value);
            }
            if (type == "array" || type == "object") {
                value = JSON.parse(value);
            }
            node.properties[property] = value;
            if (node._graph) {
                node._graph._version++;
            }
            if (node.onPropertyChanged) {
                node.onPropertyChanged(property, value);
            }
            if (options.onclose)
                options.onclose();
            dialog.close();
            node.setDirtyCanvas(true, true);
        }

        return dialog;
    };

    createDialog(html, options) {
        options = options || {};

        var dialog = document.createElement("div");
        dialog.className = "graphdialog";
        dialog.innerHTML = html;

        var rect = this.canvas.getBoundingClientRect();
        var offsetx = -20;
        var offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        if (options.position) {
            offsetx += options.position[0];
            offsety += options.position[1];
        } else if (options.event) {
            offsetx += options.event.clientX;
            offsety += options.event.clientY;
        } //centered
        else {
            offsetx += this.canvas.width * 0.5;
            offsety += this.canvas.height * 0.5;
        }

        dialog.style.left = offsetx + "px";
        dialog.style.top = offsety + "px";

        this.canvas.parentNode.appendChild(dialog);

        dialog.close() {
            if (this.parentNode) {
                this.parentNode.removeChild(this);
            }
        };

        return dialog;
    };

    static onMenuNodeCollapse(value, options, e, menu, node) {
        node.collapse();
    };

    static onMenuNodePin(value, options, e, menu, node) {
        node.pin();
    };

    static onMenuNodeMode(value, options, e, menu, node) {
        new LiteGraph.ContextMenu(
            ["Always", "On Event", "On Trigger", "Never"],
            { event: e, callback: inner_clicked, parentMenu: menu, node: node }
        );

        function inner_clicked(v) {
            if (!node) {
                return;
            }
            switch (v) {
                case "On Event":
                    node.mode = LiteGraph.ON_EVENT;
                    break;
                case "On Trigger":
                    node.mode = LiteGraph.ON_TRIGGER;
                    break;
                case "Never":
                    node.mode = LiteGraph.NEVER;
                    break;
                case "Always":
                default:
                    node.mode = LiteGraph.ALWAYS;
                    break;
            }
        }

        return false;
    };

    static onMenuNodeColors(value, options, e, menu, node) {
        if (!node) {
            throw "no node for color";
        }

        var values = [];
        values.push({
            value: null,
            content:
                "<span style='display: block; padding-left: 4px;'>No color</span>"
        });

        for (var i in LGraphCanvas.node_colors) {
            var color = LGraphCanvas.node_colors[i];
            var value = {
                value: i,
                content:
                    "<span style='display: block; color: #999; padding-left: 4px; border-left: 8px solid " +
                    color.color +
                    "; background-color:" +
                    color.bgcolor +
                    "'>" +
                    i +
                    "</span>"
            };
            values.push(value);
        }
        new LiteGraph.ContextMenu(values, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node: node
        });

        function inner_clicked(v) {
            if (!node) {
                return;
            }

            var color = v.value ? LGraphCanvas.node_colors[v.value] : null;
            if (color) {
                if (node.constructor === LiteGraph.LGraphGroup) {
                    node.color = color.groupcolor;
                } else {
                    node.color = color.color;
                    node.bgcolor = color.bgcolor;
                }
            } else {
                delete node.color;
                delete node.bgcolor;
            }
            node.setDirtyCanvas(true, true);
        }

        return false;
    };

    static onMenuNodeShapes(value, options, e, menu, node) {
        if (!node) {
            throw "no node passed";
        }

        new LiteGraph.ContextMenu(LiteGraph.VALID_SHAPES, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node: node
        });

        function inner_clicked(v) {
            if (!node) {
                return;
            }
            node.shape = v;
            node.setDirtyCanvas(true);
        }

        return false;
    };

    static onMenuNodeRemove(value, options, e, menu, node) {
        if (!node) {
            throw "no node passed";
        }

        if (node.removable === false) {
            return;
        }

        node.graph.remove(node);
        node.setDirtyCanvas(true, true);
    };

    static onMenuNodeClone(value, options, e, menu, node) {
        if (node.clonable == false) {
            return;
        }
        var newnode = node.clone();
        if (!newnode) {
            return;
        }
        newnode.pos = [node.pos[0] + 5, node.pos[1] + 5];
        node.graph.add(newnode);
        node.setDirtyCanvas(true, true);
    };

    static node_colors = {
        red: { color: "#322", bgcolor: "#533", groupcolor: "#A88" },
        brown: { color: "#332922", bgcolor: "#593930", groupcolor: "#b06634" },
        green: { color: "#232", bgcolor: "#353", groupcolor: "#8A8" },
        blue: { color: "#223", bgcolor: "#335", groupcolor: "#88A" },
        pale_blue: {
            color: "#2a363b",
            bgcolor: "#3f5159",
            groupcolor: "#3f789e"
        },
        cyan: { color: "#233", bgcolor: "#355", groupcolor: "#8AA" },
        purple: { color: "#323", bgcolor: "#535", groupcolor: "#a1309b" },
        yellow: { color: "#432", bgcolor: "#653", groupcolor: "#b58b2a" },
        black: { color: "#222", bgcolor: "#000", groupcolor: "#444" }
    };

    getCanvasMenuOptions() {
        var options = null;
        if (this.getMenuOptions) {
            options = this.getMenuOptions();
        } else {
            options = [
                {
                    content: "Add Node",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuAdd
                },
                { content: "Add Group", callback: LGraphCanvas.onGroupAdd }
                //{content:"Collapse All", callback: LGraphCanvas.onMenuCollapseAll }
            ];

            if (this._graph_stack && this._graph_stack.length > 0) {
                options.push(null, {
                    content: "Close subgraph",
                    callback: this.closeSubgraph.bind(this)
                });
            }
        }

        if (this.getExtraMenuOptions) {
            var extra = this.getExtraMenuOptions(this, options);
            if (extra) {
                options = options.concat(extra);
            }
        }

        return options;
    };

    //called by processContextMenu to extract the menu list
    getNodeMenuOptions(node) {
        var options = null;

        if (node.getMenuOptions) {
            options = node.getMenuOptions(this);
        } else {
            options = [
                {
                    content: "Inputs",
                    has_submenu: true,
                    disabled: true,
                    callback: LGraphCanvas.showMenuNodeOptionalInputs
                },
                {
                    content: "Outputs",
                    has_submenu: true,
                    disabled: true,
                    callback: LGraphCanvas.showMenuNodeOptionalOutputs
                },
                null,
                {
                    content: "Properties",
                    has_submenu: true,
                    callback: LGraphCanvas.onShowMenuNodeProperties
                },
                null,
                {
                    content: "Title",
                    callback: LGraphCanvas.onShowPropertyEditor
                },
                {
                    content: "Mode",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeMode
                },
                { content: "Resize", callback: LGraphCanvas.onResizeNode },
                {
                    content: "Collapse",
                    callback: LGraphCanvas.onMenuNodeCollapse
                },
                { content: "Pin", callback: LGraphCanvas.onMenuNodePin },
                {
                    content: "Colors",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeColors
                },
                {
                    content: "Shapes",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeShapes
                },
                null
            ];
        }

        if (node.onGetInputs) {
            var inputs = node.onGetInputs();
            if (inputs && inputs.length) {
                options[0].disabled = false;
            }
        }

        if (node.onGetOutputs) {
            var outputs = node.onGetOutputs();
            if (outputs && outputs.length) {
                options[1].disabled = false;
            }
        }

        if (node.getExtraMenuOptions) {
            var extra = node.getExtraMenuOptions(this);
            if (extra) {
                extra.push(null);
                options = extra.concat(options);
            }
        }

        if (node.clonable !== false) {
            options.push({
                content: "Clone",
                callback: LGraphCanvas.onMenuNodeClone
            });
        }
        if (node.removable !== false) {
            options.push(null, {
                content: "Remove",
                callback: LGraphCanvas.onMenuNodeRemove
            });
        }

        if (node.graph && node.graph.onGetNodeMenuOptions) {
            node.graph.onGetNodeMenuOptions(options, node);
        }

        return options;
    };

    getGroupMenuOptions(node) {
        var o = [
            { content: "Title", callback: LGraphCanvas.onShowPropertyEditor },
            {
                content: "Color",
                has_submenu: true,
                callback: LGraphCanvas.onMenuNodeColors
            },
            {
                content: "Font size",
                property: "font_size",
                type: "Number",
                callback: LGraphCanvas.onShowPropertyEditor
            },
            null,
            { content: "Remove", callback: LGraphCanvas.onMenuNodeRemove }
        ];

        return o;
    };

    processContextMenu(node, event) {
        var that = this;
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var menu_info = null;
        var options = {
            event: event,
            callback: inner_option_clicked,
            extra: node
        };

        if (node)
            options.title = node.type;

        //check if mouse is in input
        var slot = null;
        if (node) {
            slot = node.getSlotInPosition(event.canvasX, event.canvasY);
            LGraphCanvas.active_node = node;
        }

        if (slot) {
            //on slot
            menu_info = [];
            if (node.getSlotMenuOptions) {
                menu_info = node.getSlotMenuOptions(slot);
            } else {
                if (
                    slot &&
                    slot.output &&
                    slot.output.links &&
                    slot.output.links.length
                ) {
                    menu_info.push({ content: "Disconnect Links", slot: slot });
                }
                var _slot = slot.input || slot.output;
                menu_info.push(
                    _slot.locked
                        ? "Cannot remove"
                        : { content: "Remove Slot", slot: slot }
                );
                menu_info.push(
                    _slot.nameLocked
                        ? "Cannot rename"
                        : { content: "Rename Slot", slot: slot }
                );

            }
            options.title =
                (slot.input ? slot.input.type : slot.output.type) || "*";
            if (slot.input && slot.input.type == LiteGraph.ACTION) {
                options.title = "Action";
            }
            if (slot.output && slot.output.type == LiteGraph.EVENT) {
                options.title = "Event";
            }
        } else {
            if (node) {
                //on node
                menu_info = this.getNodeMenuOptions(node);
            } else {
                menu_info = this.getCanvasMenuOptions();
                var group = this.graph.getGroupOnPos(
                    event.canvasX,
                    event.canvasY
                );
                if (group) {
                    //on group
                    menu_info.push(null, {
                        content: "Edit Group",
                        has_submenu: true,
                        submenu: {
                            title: "Group",
                            extra: group,
                            options: this.getGroupMenuOptions(group)
                        }
                    });
                }
            }
        }

        //show menu
        if (!menu_info) {
            return;
        }

        var menu = new LiteGraph.ContextMenu(menu_info, options, ref_window);

        function inner_option_clicked(v, options, e) {
            if (!v) {
                return;
            }

            if (v.content == "Remove Slot") {
                var info = v.slot;
                if (info.input) {
                    node.removeInput(info.slot);
                } else if (info.output) {
                    node.removeOutput(info.slot);
                }
                return;
            } else if (v.content == "Disconnect Links") {
                var info = v.slot;
                if (info.output) {
                    node.disconnectOutput(info.slot);
                } else if (info.input) {
                    node.disconnectInput(info.slot);
                }
                return;
            } else if (v.content == "Rename Slot") {
                var info = v.slot;
                var slot_info = info.input
                    ? node.getInputInfo(info.slot)
                    : node.getOutputInfo(info.slot);
                var dialog = that.createDialog(
                    "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
                    options
                );
                var input = dialog.querySelector("input");
                if (input && slot_info) {
                    input.value = slot_info.label || "";
                }
                dialog
                    .querySelector("button")
                    .addEventListener("click", function(e) {
                        if (input.value) {
                            if (slot_info) {
                                slot_info.label = input.value;
                            }
                            that.setDirty(true);
                        }
                        dialog.close();
                    });
            }

            //if(v.callback)
            //	return v.callback.call(that, node, options, e, menu, that, event );
        }
    };

}