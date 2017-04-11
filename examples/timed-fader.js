
define([
	'jquery/nyt',
	'underscore/nyt',
	'foundation/views/base-view',
	'node_modules/nytg-common-jon/util/progress-monitor'
], function ($, _, BaseView, ProgressMonitor) {


	var TimedFader = BaseView.extend({

		defaults: {
			timings: null, // in seconds, sequential
			activeClass: 'g-active',
			selector: 'img',
			activeCallback: function($active) {
				return;
			}
		},

		events: {
		},

		initialize: function (options) {
			var that = this;
			this.options = $.extend(true, {}, this.defaults, options);

			this.$el.addClass('g-timed-fader');
			this.$items = this.$el.find(this.options.selector);

			if (!this.options.timings) {
				this.options.timings = [];
				this.$items.each(function(){
					that.options.timings.push(Number($(this).data('tc')));
				})
			}

			// expand data
			var regions = _(this.options.timings).map(function(tc, index) {
				return {
					i: Math.max(0, Math.round(tc*1000)),
					data: {
						id: 'g-tf-'+index,
						index: index
					}
				}
			});

			// hacks to expand out.
			regions[0].i = -1;


			this.monitor = new ProgressMonitor({
				target: this.$el,
				regions: regions,
				continuousMode: true,
				onIn: function(e) {
					var data = e.data;
					that.activate(data.index);
				},
				onOut: function(e) {
					var data = e.data;
					that.deactivate(data.index);
				}
			});


			// for the last item
			this.monitor.max( this.monitor.max() + 10000 );


		},

		handleDomReady: function () {

		},

		render: function() {
		},



		// pushes up the text an appropriate amount of space by expanding the element's 'height', then types it out
		// over _duration_. After the model exceeds the timeofdeath, deletes/removes the line.

		activate: function(index) {

			var that = this;

			// only one active at a time
			this.$items.removeClass('g-active');
			this.$items.eq(index).addClass('g-active');

			this.options.activeCallback(this.$items.eq(index));

		},

		clear: function() {
			this.$items.removeClass('g-active');
		},

		deactivate: function(index) {
//			this.$items.eq(index).removeClass('g-active');

		},


		update: function(timeStamp) {
			this.monitor.update(timeStamp);
		}


	});

	return TimedFader;
});




