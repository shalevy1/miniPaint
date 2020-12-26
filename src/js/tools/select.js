import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import Base_selection_class from './../core/base-selection.js';
import Helper_class from './../libs/helpers.js';
import Dialog_class from './../libs/popup.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';

class Select_tool_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.Base_layers = new Base_layers_class();
		this.POP = new Dialog_class();
		this.Helper = new Helper_class();
		this.ctx = ctx;
		this.name = 'select';
		this.saved = false;
		this.mousedown_dimensions = { x: null, y: null, width: null, height: null };
		this.keyboard_move_start_position = null;
		this.moving = false;
		this.resizing = false;
		this.ctrl_pressed = false;
		this.snap_line_info = {x: null, y: null};

		var sel_config = {
			enable_background: false,
			enable_borders: true,
			enable_controls: true,
			keep_ratio: true,
			data_function: function () {
				return config.layer;
			},
		};
		this.Base_selection = new Base_selection_class(ctx, sel_config, this.name);
	}

	on_params_update() {
		var params = this.getParams();
		if (params.auto_snap == true && config.SNAP == false) {
			alertify.error('Snap is disabled on settings.');
		}
	}

	dragStart(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousedown(event);
	}

	dragMove(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousemove(event);
	}

	dragEnd(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mouseup(event);
		this.Base_layers.render();
	}

	load() {
		var _this = this;

		//mouse events
		document.addEventListener('mousedown', function (event) {
			_this.dragStart(event);
		});
		document.addEventListener('mousemove', function (event) {
			_this.dragMove(event);
		});
		document.addEventListener('mouseup', function (event) {
			_this.dragEnd(event);
		});

		// collect touch events
		document.addEventListener('touchstart', function (event) {
			_this.dragStart(event);
		});
		document.addEventListener('touchmove', function (event) {
			_this.dragMove(event);
		});
		document.addEventListener('touchend', function (event) {
			_this.dragEnd(event);
		});

		//keyboard actions
		document.addEventListener('keydown', (event) => {
			if (config.TOOL.name != this.name)
				return;
			if (this.POP.active == true)
				return;
			if (this.Helper.is_input(event.target))
				return;
			var k = event.key;

			if (k == "ArrowUp") {
				this.move(0, -1, event);
			}
			else if (k == "ArrowDown") {
				this.move(0, 1, event);
			}
			else if (k == "ArrowRight") {
				this.move(1, 0, event);
			}
			else if (k == "ArrowLeft") {
				this.move(-1, 0, event);
			}
			if (k == "Delete") {
				if (config.TOOL.name == this.name) {
					app.State.do_action(
						new app.Actions.Delete_layer_action(config.layer.id)
					);
				}
			}
		});
		document.addEventListener('keyup', (event) => {
			if (config.TOOL.name != this.name)
				return;
			if (this.POP.active == true)
				return;
			if (this.Helper.is_input(event.target))
				return;
			var k = event.key;
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
				if (this.keyboard_move_start_position) {
					let x = config.layer.x;
					let y = config.layer.y;
					config.layer.x = this.keyboard_move_start_position.x;
					config.layer.y = this.keyboard_move_start_position.y;
					app.State.do_action(
						new app.Actions.Update_layer_action(config.layer.id, { x, y })
					);
					this.keyboard_move_start_position = null;
				}
			}
		});
	}

	async mousedown(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.valid == false || mouse.click_valid == false)
			return;

		if (this.Base_selection.mouse_lock != null) {
			this.resizing = true;
			this.Base_selection.find_settings().keep_ratio = config.layer.type === 'image';
			if (config.layer.type === 'text' && config.layer.params && config.layer.params.boundary === 'dynamic') {
				config.layer.params.boundary = 'box';
			}
		}
		else {
			this.moving = true;
			await this.auto_select_object(e);
			this.Base_selection.find_settings().keep_ratio = config.layer.type === 'image';
			this.saved = false;
		}

		this.mousedown_dimensions = {
			x: Math.round(config.layer.x),
			y: Math.round(config.layer.y),
			width: Math.round(config.layer.width),
			height: Math.round(config.layer.height)
		};
	}

	mousemove(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false)
			return;
		if (mouse.valid == false || mouse.click_valid == false) {
			return;
		}
		if (this.resizing) {
			return;
		}
		else if (this.moving) {
			//move object
			config.layer.x = Math.round(mouse.x - mouse.click_x + this.mousedown_dimensions.x);
			config.layer.y = Math.round(mouse.y - mouse.click_y + this.mousedown_dimensions.y);
			config.need_render = true;
		}
	}

	mouseup(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.valid == false || mouse.click_valid == false) {
			return;
		}
		if (this.resizing) {
			this.apply_snap(e, config.layer);
			let x = config.layer.x;
			let y = config.layer.y;
			let width = config.layer.width;
			let height = config.layer.height;
			config.layer.x = this.mousedown_dimensions.x;
			config.layer.y = this.mousedown_dimensions.y;
			config.layer.width = this.mousedown_dimensions.width;
			config.layer.height = this.mousedown_dimensions.height;
			if (
				this.mousedown_dimensions.x !== x || this.mousedown_dimensions.y !== y ||
				this.mousedown_dimensions.width !== width || this.mousedown_dimensions.height !== height
			) {
				app.State.do_action(
					new app.Actions.Bundle_action('resize_layer', 'Resize Layer', [
						new app.Actions.Update_layer_action(config.layer.id, {
							x, y, width, height
						})
					])
				);
			}
		}
		else if (this.moving) {
			this.apply_snap(e, config.layer);
			const new_x = Math.round(mouse.x - mouse.click_x + this.mousedown_dimensions.x);
			const new_y = Math.round(mouse.y - mouse.click_y + this.mousedown_dimensions.y);
			config.layer.x = this.mousedown_dimensions.x;
			config.layer.y = this.mousedown_dimensions.y;
			if (this.mousedown_dimensions.x !== new_x || this.mousedown_dimensions.y !== new_y) {
				app.State.do_action(
					new app.Actions.Bundle_action('move_layer', 'Move Layer', [
						new app.Actions.Update_layer_action(config.layer.id, {
							x: new_x,
							y: new_y
						})
					])
				);
			}
		}
		this.moving = false;
		this.resizing = false;
	}

	render_overlay(ctx){
		var ctx = this.Base_layers.ctx;
		var mouse = this.get_mouse_info(event);

		if (mouse.is_drag == false)
			return;

		//x
		if(this.snap_line_info.x !== null) {
			this.Helper.draw_special_line(
				ctx,
				this.snap_line_info.x.start_x,
				this.snap_line_info.x.start_y,
				this.snap_line_info.x.end_x,
				this.snap_line_info.x.end_y
			);
		}

		//y
		if(this.snap_line_info.y !== null) {
			this.Helper.draw_special_line(
				ctx,
				this.snap_line_info.y.start_x,
				this.snap_line_info.y.start_y,
				this.snap_line_info.y.end_x,
				this.snap_line_info.y.end_y
			);
		}
	}

	apply_snap(event, layer) {
		var params = this.getParams();

		if(config.SNAP === false || params.auto_snap !== true || event.ctrlKey == true || event.metaKey == true){
			this.snap_line_info = {x: null, y: null};
			return;
		}

		//settings
		var sensitivity = 0.01;
		var max_distance = (config.WIDTH + config.HEIGHT) / 2 * sensitivity / config.ZOOM;

		//collect snap positions
		var snap_positions = {
			x: [
				0,
				config.WIDTH/2,
				config.WIDTH,
			],
			y: [
				0,
				config.HEIGHT/2,
				config.HEIGHT,
			],
		};
		for(var i in config.layers){
			if(config.layer.id == config.layers[i].id || config.layers[i].visible == false
				|| config.layers[i].x === null || config.layers[i].y === null
				|| config.layers[i].width === null || config.layers[i].height === null){
				continue;
			}

			//x
			snap_positions.x.push(config.layers[i].x);
			snap_positions.x.push(config.layers[i].x + config.layers[i].width/2);
			snap_positions.x.push(config.layers[i].x + config.layers[i].width);

			//y
			snap_positions.y.push(config.layers[i].y);
			snap_positions.y.push(config.layers[i].y + config.layers[i].height/2);
			snap_positions.y.push(config.layers[i].y + config.layers[i].height);
		}

		//find closest snap positions
		var min_group = {
			x: {
				start: null,
				center: null,
				end: null,
			},
			y: {
				start: null,
				center: null,
				end: null,
			},
		};
		var min_group_distance = {
			x: {
				start: null,
				center: null,
				end: null,
			},
			y: {
				start: null,
				center: null,
				end: null,
			},
		};
		//x
		for(var i in snap_positions.x){
			var distance = Math.abs(config.layer.x - snap_positions.x[i]);
			if(distance < max_distance && (distance < min_group_distance.x.start || min_group_distance.x.start === null)){
				min_group_distance.x.start = distance;
				min_group.x.start = snap_positions.x[i];
			}

			var distance = Math.abs(config.layer.x + config.layer.width/2 - snap_positions.x[i]);
			if(distance < max_distance && (distance < min_group_distance.x.center || min_group_distance.x.center === null)){
				min_group_distance.x.center = distance;
				min_group.x.center = snap_positions.x[i];
			}

			var distance = Math.abs(config.layer.x + config.layer.width - snap_positions.x[i]);
			if(distance < max_distance && (distance < min_group_distance.x.end || min_group_distance.x.end === null)){
				min_group_distance.x.end = distance;
				min_group.x.end = snap_positions.x[i];
			}
		}
		//y
		for(var i in snap_positions.y){
			var distance = Math.abs(config.layer.y - snap_positions.y[i]);
			if(distance < max_distance && (distance < min_group_distance.y.start || min_group_distance.y.start === null)){
				min_group_distance.y.start = distance;
				min_group.y.start = snap_positions.y[i];
			}

			var distance = Math.abs(config.layer.y + config.layer.height/2 - snap_positions.y[i]);
			if(distance < max_distance && (distance < min_group_distance.y.center || min_group_distance.y.center === null)){
				min_group_distance.y.center = distance;
				min_group.y.center = snap_positions.y[i];
			}

			var distance = Math.abs(config.layer.y + config.layer.height - snap_positions.y[i]);
			if(distance < max_distance && (distance < min_group_distance.y.end || min_group_distance.y.end === null)){
				min_group_distance.y.end = distance;
				min_group.y.end = snap_positions.y[i];
			}
		}

		//find best begin, center, end
		var min_distance = {
			x: null,
			y: null,
		};
		//x
		if(min_group_distance.x.start != null)
			min_distance.x = min_group_distance.x.start;
		if(min_group_distance.x.center != null && (min_group_distance.x.center < min_distance.x || min_distance.x === null))
			min_distance.x = min_group_distance.x.center;
		if(min_group_distance.x.end != null && (min_group_distance.x.end < min_distance.x || min_distance.x === null))
			min_distance.x = min_group_distance.x.end;
		//y
		if(min_group_distance.y.start != null)
			min_distance.y = min_group_distance.y.start;
		if(min_group_distance.y.center != null && (min_group_distance.y.center < min_distance.y || min_distance.y === null))
			min_distance.y = min_group_distance.y.center;
		if(min_group_distance.y.end != null && (min_group_distance.y.end < min_distance.y || min_distance.y === null))
			min_distance.y = min_group_distance.y.end;

		//apply snap
		//x
		if(min_group.x.start != null && min_group_distance.x.start == min_distance.x) {
			config.layer.x = Math.round(min_group.x.start);
			this.snap_line_info.x = {
				start_x: min_group.x.start,
				start_y: 0,
				end_x: min_group.x.start,
				end_y: config.HEIGHT,
			};
		}
		else if(min_group.x.center != null && min_group_distance.x.center == min_distance.x) {
			config.layer.x = Math.round(min_group.x.center - config.layer.width / 2);
			this.snap_line_info.x = {
				start_x: min_group.x.center,
				start_y: 0,
				end_x: min_group.x.center,
				end_y: config.HEIGHT
			};
		}
		else if(min_group.x.end != null && min_group_distance.x.end == min_distance.x) {
			config.layer.x = Math.round(min_group.x.end - config.layer.width);
			this.snap_line_info.x = {
				start_x: min_group.x.end,
				start_y: 0,
				end_x: min_group.x.end,
				end_y: config.HEIGHT
			};
		}
		else{
			this.snap_line_info.x = null;
		}
		//y
		if(min_group.y.start != null && min_group_distance.y.start == min_distance.y) {
			config.layer.y = Math.round(min_group.y.start);
			this.snap_line_info.y = {
				start_x: 0,
				start_y: min_group.y.start,
				end_x: config.WIDTH,
				end_y: min_group.y.start,
			};
		}
		else if(min_group.y.center != null && min_group_distance.y.center == min_distance.y) {
			config.layer.y = Math.round(min_group.y.center - config.layer.height / 2);
			this.snap_line_info.y = {
				start_x: 0,
				start_y: min_group.y.center,
				end_x: config.WIDTH,
				end_y: min_group.y.center,
			};
		}
		else if(min_group.y.end != null && min_group_distance.y.end == min_distance.y) {
			config.layer.y = Math.round(min_group.y.end - config.layer.height);
			this.snap_line_info.y = {
				start_x: 0,
				start_y: min_group.y.end,
				end_x: config.WIDTH,
				end_y: min_group.y.end,
			};
		}
		else{
			this.snap_line_info.y = null;
		}
	}

	move(direction_x, direction_y, event) {
		if (!this.keyboard_move_start_position) {
			this.keyboard_move_start_position = {
				x: config.layer.x,
				y: config.layer.y
			}
		}
		var power = 10;
		if (event.ctrlKey == true || event.metaKey)
			power = 50;
		if (event.shiftKey == true)
			power = 1;

		config.layer.x += direction_x * power;
		config.layer.y += direction_y * power;
		config.need_render = true;
	}

	async auto_select_object(e) {
		var params = this.getParams();
		if (params.auto_select == false)
			return;

		var layers_sorted = this.Base_layers.get_sorted_layers();

		//render main canvas
		for (var i = 0; i < layers_sorted.length; i++) {
			var value = layers_sorted[i];
			var canvas = this.Base_layers.convert_layer_to_canvas(value.id, null, false);

			if (this.check_hit_region(e, canvas.getContext("2d")) == true) {
				await app.State.do_action(
					new app.Actions.Select_layer_action(value.id)
				);
				break;
			}
		}
	}

	check_hit_region(e, ctx) {
		var mouse = this.get_mouse_info(e);
		var data = ctx.getImageData(mouse.x, mouse.y, 1, 1).data;

		var blank = [0, 0, 0, 0];
		if (config.TRANSPARENCY == false) {
			blank = [0, 0, 0, 0];
		}

		if (data[0] != blank[0] || data[1] != blank[1] || data[2] != blank[2]
			|| data[3] != blank[3]) {
			//hit
			return true;
		}

		return false;
	}

}

export default Select_tool_class;
