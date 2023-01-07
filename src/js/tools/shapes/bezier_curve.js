import app from './../../app.js';
import config from './../../config.js';
import Base_tools_class from './../../core/base-tools.js';
import Base_layers_class from './../../core/base-layers.js';
import Helper_class from './../../libs/helpers.js';

class Bezier_Curve_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.ctx = ctx;
		this.name = 'bezier_curve';
		this.layer = {};
		this.best_ratio = 1;
		this.snap_line_info = {x: null, y: null};
		this.params_hash = false;
		this.selected_obj_positions = {};
		this.mouse_lock = null;
		this.selected_object_drag_type = null;

		this.events();
	}

	load() {
		var _this = this;
		this.default_events();
		document.addEventListener('keydown', function (event) {
			if (config.TOOL.name != _this.name) {
				return;
			}
			var code = event.code;
			if (code == "Escape") {
				//escape
			}
		});
	}

	/**
	 * events for handling helping lines only
	 */
	events() {
		document.addEventListener('mousedown', (e) => {
			this.selected_object_actions(e);
		});
		document.addEventListener('mousemove', (e) => {
			this.selected_object_actions(e);
		});
		document.addEventListener('mouseup', (e) => {
			this.selected_object_actions(e);
		});

		// touch
		document.addEventListener('touchstart', (event) => {
			this.selected_object_actions(event);
		});
		document.addEventListener('touchmove', (event) => {
			this.selected_object_actions(event);
		}, {passive: false});
		document.addEventListener('touchend', (event) => {
			this.selected_object_actions(event);
		});
	}

	mousedown(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false) {
			return;
		}

		var params_hash = this.get_params_hash();

		var mouse_x = mouse.x;
		var mouse_y = mouse.y;

		//apply snap
		var snap_info = this.calc_snap_position(e, mouse_x, mouse_y);
		if(snap_info != null){
			if(snap_info.x != null) {
				mouse_x = snap_info.x;
			}
			if(snap_info.y != null) {
				mouse_y = snap_info.y;
			}
		}

		const data_clone = JSON.parse(JSON.stringify(config.layer.data));

		if (config.layer.type != this.name || params_hash != this.params_hash
			|| (data_clone != null && data_clone.cp2.x !== null)) {
			//register new object - current layer is not ours or params changed
			this.layer = {
				type: this.name,
				data: {
					start: {x: mouse_x, y: mouse_y},
					cp1: {x: null, y: null},
					cp2: {x: null, y: null},
					end: {x: null, y: null}
				},
				params: this.clone(this.getParams()),
				render_function: [this.name, 'render'],
				x: 0,
				y: 0,
				width: null,
				height: null,
				hide_selection_if_active: true,
				rotate: null,
				is_vector: true,
				color: config.COLOR,
				status: 'draft',
			};
			app.State.do_action(
				new app.Actions.Bundle_action('new_bezier_layer', 'New Bezier Layer', [
					new app.Actions.Insert_layer_action(this.layer)
				])
			);
			this.params_hash = params_hash;
		}
		else {
			//add more data
			const data_clone = JSON.parse(JSON.stringify(config.layer.data));
			data_clone.end.x = mouse_x;
			data_clone.end.y = mouse_y;

			app.State.do_action(
				new app.Actions.Bundle_action('update_bezier_layer', 'Update Bezier Layer', [
					new app.Actions.Update_layer_action(config.layer.id, {
						data: data_clone
					})
				])
			);
		}

		this.Base_layers.render();
	}

	mousemove(e) {
		var mouse = this.get_mouse_info(e);
		var mouse_x = Math.round(mouse.x);
		var mouse_y = Math.round(mouse.y);

		if (mouse.click_valid == false) {
			return;
		}
		if (mouse.is_drag == false) {
			return;
		}

		//apply snap
		var snap_info = this.calc_snap_position(e, mouse_x, mouse_y, config.layer.id);
		if(snap_info != null){
			if(snap_info.x != null) {
				mouse_x = snap_info.x;
			}
			if(snap_info.y != null) {
				mouse_y = snap_info.y;
			}
		}

		//add more data
		const data_clone = JSON.parse(JSON.stringify(config.layer.data));
		if(data_clone.end.x === null){
			//still first step
			data_clone.cp1.x = mouse_x;
			data_clone.cp1.y = mouse_y;
		}
		else{
			data_clone.cp2.x = mouse_x;
			data_clone.cp2.y = mouse_y;
		}

		app.State.do_action(
			new app.Actions.Bundle_action('update_bezier_layer', 'Update Bezier Layer', [
				new app.Actions.Update_layer_action(config.layer.id, {
					data: data_clone
				})
			])
		);

		this.Base_layers.render();
	}

	mouseup(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false) {
			return;
		}

		var mouse_x = Math.round(mouse.x);
		var mouse_y = Math.round(mouse.y);

		//apply snap
		var snap_info = this.calc_snap_position(e, mouse_x, mouse_y, config.layer.id);
		if(snap_info != null){
			if(snap_info.x != null) {
				mouse_x = snap_info.x;
			}
			if(snap_info.y != null) {
				mouse_y = snap_info.y;
			}
		}
		this.snap_line_info = {x: null, y: null};

		//add more data
		const data_clone = JSON.parse(JSON.stringify(config.layer.data));
		if(data_clone.end.x === null){
			//still first step
			data_clone.cp1.x = mouse_x;
			data_clone.cp1.y = mouse_y;
		}
		else{
			data_clone.cp2.x = mouse_x;
			data_clone.cp2.y = mouse_y;
			config.layer.status = null;
		}

		app.State.do_action(
			new app.Actions.Bundle_action('update_bezier_layer', 'Update Bezier Layer', [
				new app.Actions.Update_layer_action(config.layer.id, {
					data: data_clone
				})
			])
		);

		this.Base_layers.render();
	}

	render_overlay(ctx){
		var ctx = this.Base_layers.ctx;
		this.render_overlay_parent(ctx);

		//also draw control lines
		if(config.layer.type == this.name){
			var bezier = config.layer.data;
			this.selected_obj_positions = {};

			var x = config.layer.x;
			var y = config.layer.y;

			//draw corners
			if (bezier.start.x != null) {
				this.Helper.draw_special_line(
					this.ctx,
					x + bezier.start.x,
					y + bezier.start.y,
					x + bezier.cp1.x,
					y + bezier.cp1.y
				);
				this.selected_obj_positions.cp1_start = this.Helper.draw_control_point(
					this.ctx,
					x + bezier.start.x,
					y + bezier.start.y
				);
				this.selected_obj_positions.cp1_end = this.Helper.draw_control_point(
					this.ctx,
					x + bezier.cp1.x,
					y + bezier.cp1.y
				);
			}
			if (bezier.end.x != null) {
				this.Helper.draw_special_line(
					this.ctx,
					x + bezier.end.x,
					y + bezier.end.y,
					x + bezier.cp2.x,
					y + bezier.cp2.y
				);
				this.selected_obj_positions.cp2_start = this.Helper.draw_control_point(
					this.ctx,
					x + bezier.end.x,
					y + bezier.end.y
				);
				this.selected_obj_positions.cp2_end = this.Helper.draw_control_point(
					this.ctx,
					x + bezier.cp2.x,
					y + bezier.cp2.y
				);
			}
		}
	}

	select(ctx) {
		this.render_overlay(ctx);
	}

	demo(ctx, x, y, width, height) {
		var data = {
			start: {x: x, y: y},
			cp1: {x: x + width, y: y},
			cp2: {x: x, y: y + height},
			end: {x: x + width, y: y + height}
		};

		this.draw_bezier(ctx, 0, 0, data, 2, '#555', true, null);
	}

	render(ctx, layer) {
		var params = layer.params;
		this.draw_bezier(ctx, layer.x, layer.y, layer.data, params.size, layer.color, false, layer.id);
	}

	draw_bezier(ctx, x, y, data, lineWidth, color, is_demo, layer_id) {
		if(data.end.x == null){
			return;
		}

		//set styles
		ctx.fillStyle = color;
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth;
		ctx.lineCap = 'round';

		//draw bezier
		ctx.beginPath();
		ctx.moveTo(x + data.start.x, y + data.start.y);
		ctx.bezierCurveTo(
			x + data.cp1.x, y + data.cp1.y,
			x + data.cp2.x, y + data.cp2.y,
			x + data.end.x, y + data.end.y
		);
		ctx.stroke();
	}

	selected_object_actions(e) {
		if(config.TOOL.name != 'select' || config.layer.type != this.name || config.layer.status == 'draft'){
			return;
		}

		var ctx = this.Base_layers.ctx;
		var mouse = this.get_mouse_info(e);

		//simplify checks
		var event_type = e.type;
		if(event_type == 'touchstart') event_type = 'mousedown';
		if(event_type == 'touchmove') event_type = 'mousemove';
		if(event_type == 'touchend') event_type = 'mouseup';

		if (event_type == 'mouseup') {
			//reset
			this.mouse_lock = null;
			config.mouse_lock = null;
		}
		if (!mouse.is_drag && ['mousedown', 'mouseup'].includes(event_type)) {
			return;
		}

		const mainWrapper = document.getElementById('main_wrapper');
		const defaultCursor = 'default';
		if (mainWrapper.style.cursor != defaultCursor) {
			mainWrapper.style.cursor = defaultCursor;
		}
		if (event_type == 'mousedown' && config.mouse.valid == false) {
			return;
		}

		if (event_type == 'mousemove' && this.mouse_lock == 'move_point' && mouse.is_drag) {
			mainWrapper.style.cursor = "move";

			if (e.buttons == 1 || typeof e.buttons == "undefined") {
				var type = this.selected_object_drag_type;
				var bezier = config.layer.data;

				// Do transformations
				var dx = Math.round(mouse.x - mouse.click_x) - config.layer.x;
				var dy = Math.round(mouse.y - mouse.click_y) - config.layer.y;

				// Set values
				if(type == 'cp1_start') {
					bezier.start.x = mouse.click_x + dx;
					bezier.start.y = mouse.click_y + dy;
				}
				else if(type == 'cp1_end') {
					bezier.cp1.x = mouse.click_x + dx;
					bezier.cp1.y = mouse.click_y + dy;
				}
				else if(type == 'cp2_start') {
					bezier.end.x = mouse.click_x+ dx;
					bezier.end.y = mouse.click_y + dy;
				}
				else if(type == 'cp2_end') {
					bezier.cp2.x = mouse.click_x + dx;
					bezier.cp2.y = mouse.click_y + dy;
				}

				config.need_render = true;
			}
			return;
		}
		if (!this.mouse_lock) {
			for (let current_drag_type in this.selected_obj_positions) {
				const position = this.selected_obj_positions[current_drag_type];
				if (position && this.ctx.isPointInPath(position, mouse.x, mouse.y)) {
					// match
					if (event_type == 'mousedown') {
						if (e.buttons == 1 || typeof e.buttons == "undefined") {
							this.mouse_lock = 'move_point';
							this.selected_object_drag_type = current_drag_type;
						}
						config.mouse_lock = true;
					}
					if (event_type == 'mousemove') {
						mainWrapper.style.cursor = 'move';
					}
				}
			}
		}
	}

}

export default Bezier_Curve_class;
