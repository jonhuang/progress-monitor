define([
	'jquery/nyt',
	'underscore/1.5'
], function($, _) {
	'use strict';

	/******
	 *  This class is used to specify certain regions or points in a range of numbers, and dispatches
	 *  custom events when boundries are crossed. Regions can overlap and respond appropriately with multiple events.
	 *  This class is internalized and used in the YMVP class. This class is an acceptable
	 *  changeListener type for SliderShow or other "index()" interfaces.
	 *
	 *  jon
	 *
	 * ****/

	var ProgressMonitorEvent = {};
	ProgressMonitorEvent.IN_REGION  = "NYTD.NYTMM.ProgressMonitorEvent:in";
	ProgressMonitorEvent.OUT_REGION = "NYTD.NYTMM.ProgressMonitorEvent:out";
	ProgressMonitorEvent.SKIPPED_REGION = "NYTD.NYTMM.ProgressMonitorEvent:skip";

	var ProgressMonitor = function (options) {

		options = options || {};

		this.$trigger = (options.target) ? $(options.target) : $(document); // where to dispatch events from

		this._last = null;
		this._max = options.max || 0;
		this.regions ( options.regions || [] );
		this.continuousMode ( options.continuousMode );

		this.onIn = options.onIn || function(d){};
		this.onOut = options.onOut || function(d){};
		this.onSkip = options.onSkip || function(d){};

	};

	/*****
	 * Adds a new response region
	 *
	 * @param i the start of the region
	 * @param o the end of the region. If not specified or set to NaN, assumed to be the same as in (point region)
	 * @param data an object, callback, or a string used to identify the region. Default string is assigned if left undefined.
	 * @param callbacks for convenience, this callback function is called with event object on enter, exit, or skip
	 *
	 * Can also call short version: (in, out, data);
	 * ***/
	ProgressMonitor.prototype.push = function(inOrConfig, outOptional, dataOptional) {

		var d = {
			i: undefined,
			o: undefined,
			data: undefined,
			enter: null,
			exit: null,
			skip: null
		};

		if (dataOptional !== undefined) {
			d = $.extend(d,{i:inOrConfig, o:outOptional, data:dataOptional});
		}
		else {
			d = $.extend(d,inOrConfig);
		}

		if (d.o === undefined || d.o === null || isNaN(d.o)) {
			d.o = d.i;
		}
		if (d.i > d.o) {
			throw new Error("ProgressMonitor: Can not create region with in > out");
		}

		if (d.data === undefined || d.data === null) {
			d.data = "region_"+this._regions.length;
		}

		this._regions.push(d);

		this._regions = _.sortBy(this._regions, function(n){return n.i;});

		// expand min and max if needed
		this._max = Math.max(this._max, d.o);

		if (this._continuousMode) {
			this.expandRegions();
		}

	};

	ProgressMonitor.prototype.filter = function(filterFunction) {
		this._regions = _.filter(this._regions, filterFunction);
//		this._regions = _.sortBy(this._regions, function(n){return n.i;});
	};
	ProgressMonitor.prototype.reject = function(rejectFunction) {
		this._regions = _.reject(this._regions, rejectFunction);
//		this._regions = _.sortBy(this._regions, function(n){return n.i;});
	};


	/*****
	 * You should call this function every time you want to check for changes. This is often linked into a onProgress, onChange, or onTimer type event.
	 *
	 * @param current the new position value
	 *
	 * ***/
		// call with the new number, checks for crossovers

	ProgressMonitor.prototype.update = function (current, dontCheck) {

		var that = this;
		var last = this._last;
		var backwards = (last > current);
		var triggers = [];

		if (current === undefined) {
			return last;
		}

		if (last === current) {
			return;
		}

		// the first setting does nothing
		if (last === null || dontCheck) {
			this._last = last = current;
			return;
		}


		//$.log("updating", current, last, this._last);

		// scan through every region -- *every* region, or you won't catch backwards movement.
		for (var j = 0; j<this._regions.length; j++) {
			var region = this._regions[j];
			var inPoint = region.i;
			var outPoint = region.o;
			var event = {data:region.data, previous:last, position:current, backwards:backwards};

			// if it's completely skipped over an entire region, issue events. Entering a point region counts as a skip
			if (((last < inPoint && current > outPoint) || (last > outPoint && current < inPoint)) ||
				(inPoint === outPoint && current === inPoint && last !== current)) {
				triggers.push({type:ProgressMonitorEvent.SKIPPED_REGION, e:event, region:region});
			}
			// enter
			else if ((inPoint <= current && current < outPoint) && (last < inPoint || last >= outPoint)) {
				triggers.push({type:ProgressMonitorEvent.IN_REGION, e:event, region:region});
			}
			// exit
			else if ((inPoint <= last && last < outPoint) && (current < inPoint || current >= outPoint)) {
				triggers.push({type:ProgressMonitorEvent.OUT_REGION, e:event, region:region});
			}
		}

		this._last = current;

		// Sort all the events as though it was a natural flow
		triggers = _(triggers).chain().
			sortBy(function(event, index){
				var order = 0;
				var region = event.region;

				if (event.type === ProgressMonitorEvent.OUT_REGION) {
					order = (backwards) ? region.i : region.o;
					order -= 0.0000000005;
				}
				else if (event.type === ProgressMonitorEvent.SKIPPED_REGION) {
					order = region.i;
				}
				else if (event.type === ProgressMonitorEvent.IN_REGION) {
					order = (backwards) ? region.o : region.i;
					order += 0.0000000005;
				}

				if (backwards) {
					order *= -1;
				}

				return order;
			})
			.each(function(event, index){

				var region = event.region;
				var e = event.e;

				if (event.type === ProgressMonitorEvent.OUT_REGION) {
					that.onOut(e);
					if (region.exit && $.isFunction(region.exit)) { region.exit(e); }
				}
				else if (event.type === ProgressMonitorEvent.SKIPPED_REGION) {
					that.onSkip(e);
					if (region.skip && $.isFunction(region.skip)) { region.skip(e);	}
				}
				else if (event.type === ProgressMonitorEvent.IN_REGION) {
					that.onIn(e);
					if (region.enter && $.isFunction(region.enter)) { region.enter(e); }
				}

				that.$trigger.trigger(event.type, event.e);

			})
			.value();

		return triggers; // useful for synchronous code

	};

	ProgressMonitor.prototype.index = ProgressMonitor.prototype.update; // alias


	/*****
	 *
	 * Helper to get the region at a particular data set
	 *
	 */

	ProgressMonitor.prototype.getRegionByData = function(data) {
		return _(this._regions).find(function(region){
			return region.data === data;
		});
	};


	/*****
	 * Helper function to check for regions present at a given timecode. Returns an array of Datas (may be empty)
	 *
	 * @param tc the timecode / position to check
	 * @return an array of region Data objects {data:, i:, o:} where i and o are the in and out points
	 *
	 * ***/
	ProgressMonitor.prototype.getRegionsAt = function(tc) {
		return (_.filter(this._regions, function(region) {
			var inPoint = region.i;
			var outPoint = region.o;
			return (inPoint <= tc && tc <= outPoint);
		}));
	};

	/*****
	 *
	 * reset everything
	 *
	 * ***/
	ProgressMonitor.prototype.clear = function() {
		this._regions = [];
		this._last = null;

	};

	/*****
	 * Expend all the regions to fill all available space. Works by discarding
	 *  the outPoints, except for the final one. Then expands each point's outpoint to the next one's inpoint.
	 *
	 * ***/
	ProgressMonitor.prototype.expandRegions = function() {

		for (var j = 0; j<this._regions.length - 1; j++) {
			this._regions[j].o = this._regions[j+1].i;
		}
		if (this._regions.length > 0) {
			this._regions[this._regions.length-1].o = this._max+0.001; // last one
		}
	};

	/*****
	 * The largest allowable value
	 *
	 * ***/
	ProgressMonitor.prototype.max = function(num){
		if (num === undefined) {
			return this._max;
		}
		else {
			this._max = num;
			if (this._continuousMode) {
				this.expandRegions();
			}
		}
	};

	/*****
	 * The regions array. If setting, use an array of {data:, i:, o:} where i and o are the in and out points
	 *
	 * ***/
	ProgressMonitor.prototype.regions = function(val) {

		if (val === undefined){
			return this._regions;
		}
		else {
			this._regions = val;
			this._regions = _.sortBy(this._regions, function(n){return n.i;});

			// check max
			this._max = _(this._regions).reduce(function(memo, region){
				return Math.max(memo, Math.max(region.o || 0, region.i || 0));
			},this._max);

			if (this._continuousMode) {
				this.expandRegions();
			}
		}
	};


	/*****
	 * Automatically expand regions
	 *
	 * ***/
	ProgressMonitor.prototype.continuousMode = function(bool) {
		if (bool === undefined) {
			return this._continuousMode;
		}
		else {
			this._continuousMode = bool;
			if (this._continuousMode) {
				this.expandRegions();
			}
		}
	};

	return ProgressMonitor;

}); // end require