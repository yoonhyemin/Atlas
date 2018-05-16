define([
	'jquery',
	'knockout',
	'atlas-state',
	'text!./data-sources.html',
	'd3',
	'atlascharts',
	'colorbrewer',
	'lodash',
	'appConfig',
	'webapi/AuthAPI',
	'd3-tip',
	'services/http',
	'databindings',
	'access-denied',
	'./components/reports/dashboard',
	'./components/reports/datadensity',
	'./components/reports/person',
	'./components/reports/visit',
	'./components/reports/death'
	//'less!./data-sources.less'
], function (
	$,
	ko,
	sharedState,
	view,
	d3,
	atlascharts,
	colorbrewer,
	_,
	config,
	authApi,
	d3tip,
	httpService
) {
	function dataSources(params) {
		var self = this;

		// aggregate property descriptors
		var RecordsPerPersonProperty = {
			name: "recordsPerPerson",
			description: "Records per person"
		};
		var LengthOfEraProperty = {
			name: "lengthOfEra",
			description: "Length of era"
		};
		var width = 1000;
		var height = 250;

		const size4 = {
				width: 400,
				height: 280
			},
			size6 = {
				width: 500,
				height: 300
			},
			size12 = {
				width: 1000,
				height: 300
			};

		self.model = params.model;
		self.sources = sharedState.sources().filter(function (s) {
			return s.hasResults && s.hasCDM;
		});
		self.loadingReport = ko.observable(false);
		self.hasError = ko.observable(false);

		self.isAuthenticated = authApi.isAuthenticated;
		self.canViewCdmResults = ko.pureComputed(function () {
			return (config.userAuthenticationEnabled && self.isAuthenticated() && authApi.isPermittedViewCdmResults()) || !config.userAuthenticationEnabled;
		});
	/**
		 * Each report object may contain the following properties
		 *   name: displayed in report heading
		 *   path: CDMResultsService path for summary payload (e.g. tree map)
		 *   byType: true if summary contains a byType report, false otherwise
		 *   aggProperty: if tree map/table supported, describes the aggregate property to use (see descriptors above)
		 *   conceptDomain: true if concept-driven domain report (treemap and drilldown reports supported), false otherwise
		 */
		self.reports = [{
				name: "Dashboard",
				path: "dashboard",
				conceptDomain: false,
				summary: ko.observable()
			},
			{
				name: "Data Density",
				path: "datadensity",
				conceptDomain: false
			},
			{
				name: "Person",
				path: "person",
				conceptDomain: false
			},
			{
				name: "Visit",
				path: "visit",
				byType: false,
				byFrequency: false,
				aggProperty: RecordsPerPersonProperty,
				conceptDomain: true
			},
			{
				name: "Condition",
				path: "condition",
				byType: true,
				byFrequency: false,
				aggProperty: RecordsPerPersonProperty,
				conceptDomain: true
			},
			{
				name: "Condition Era",
				path: "conditionera",
				byType: false,
				byFrequency: false,
				aggProperty: LengthOfEraProperty,
				conceptDomain: true
			},
			{
				name: "Procedure",
				path: "procedure",
				byType: true,
				byFrequency: true,
				aggProperty: RecordsPerPersonProperty,
				conceptDomain: true
			},
			{
				name: "Drug",
				path: "drug",
				byType: true,
				byFrequency: true,
				aggProperty: RecordsPerPersonProperty,
				conceptDomain: true
			},
			{
				name: "Drug Era",
				path: "drugera",
				byType: false,
				byFrequency: false,
				aggProperty: LengthOfEraProperty,
				conceptDomain: true
			},
			{
				name: "Measurement",
				path: "measurement",
				byType: true,
				byFrequency: true,
				byUnit: true,
				aggProperty: RecordsPerPersonProperty,
				conceptDomain: true
			},
			{
				name: "Observation",
				path: "observation",
				byType: true,
				byFrequency: true,
				aggProperty: RecordsPerPersonProperty,
				conceptDomain: true
			},
			{
				name: "Death",
				path: "death",
				conceptDomain: false
			},
			{
				name: "Achilles Heel",
				path: "achillesheel",
				conceptDomain: false
			},
		];

		self.showSelectionArea = params.showSelectionArea == undefined ? true : params.showSelectionArea;
		self.currentSource = ko.observable(self.sources[0]);
		self.currentReport = ko.observable();
		self.currentConcept = ko.observable();

		self.loadSummary = function () {
			var currentReport = self.currentReport();
			var currentSource = self.currentSource();

			if (!currentReport) {
				return;
			}

			var url = config.api.url + 'cdmresults/' + currentSource.sourceKey + '/' + currentReport.path;
			self.loadingReport(true);
			self.hasError(false);

			if (currentReport.name == 'Achilles Heel') {
				$.ajax({
					url: url,
					error: function (error) {
						self.loadingReport(false);
						self.hasError(true);
						console.log(error);
					},
					success: function (data) {
						self.loadingReport(false);

						var table_data = [];
						for (var i = 0; i < data.messages.length; i++) {
							var temp = data.messages[i].attributeValue;
							var colon_index = temp.indexOf(':');
							var message_type = temp.substring(0, colon_index);
							var message_content = temp.substring(colon_index + 1);

							// RSD - A quick hack to put commas into large numbers.
							// Found the regexp at:
							// https://stackoverflow.com/questions/23104663/knockoutjs-format-numbers-with-commas
							message_content = message_content.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
							table_data.push({
								'type': message_type,
								'content': message_content
							});
						}

						$('#achillesheel_table').DataTable({
							dom: '<<"row vertical-align"<"col-xs-6"<"dt-btn"B>l><"col-xs-6 search"f>><"row vertical-align"<"col-xs-3"i><"col-xs-9"p>><t><"row vertical-align"<"col-xs-3"i><"col-xs-9"p>>>',
							buttons: ['colvis', 'copyHtml5', 'excelHtml5', 'csvHtml5', 'pdfHtml5'],
							autoWidth: false,
							data: table_data,
							columns: [{
									data: 'type',
									visible: true,
									width: 200
								},
								{
									data: 'content',
									visible: true
								}
							],
							pageLength: 15,
							lengthChange: false,
							deferRender: true,
							destroy: true
						});
					}
				});
			}
		};

		self.frequencyDistribution = function (data, selector, report) {
			if (!!data) {
				var freqData = self.normalizeArray(data.frequencyDistribution);
				if (!freqData.empty) {
					// Histogram
					var frequencyHistogram = new Object();
					var frequencyHistData = new Object();
					var totalCnt = 0;
					for (var i in freqData.yNumPersons) {
						totalCnt += freqData.yNumPersons[i];
					}
					frequencyHistData.countValue = freqData.yNumPersons.slice();
					frequencyHistData.intervalIndex = freqData.xCount.slice();
					frequencyHistData.percentValue = freqData.yNumPersons.map(function (value) {
						return (value / totalCnt) * 100;
					});
					frequencyHistogram.data = frequencyHistData;
					frequencyHistogram.min = 0;
					frequencyHistogram.max = 10;
					frequencyHistogram.intervals = 10;
					frequencyHistogram.intervalSize = 1;
					var yScaleMax = (Math.floor((Math.max.apply(null, freqData.yNumPersons) + 5) / 10) + 1) * 10;
					var freqHistData = self.mapHistogram(frequencyHistogram);
					var freqHistChart = new self.freqhistogram();
					freqHistChart.render(freqHistData, selector, size12.width, size12.height, {
						xFormat: d3.format('d'),
						xScale: d3.scaleLinear().domain([1, 10]),
						yScale: d3.scaleLinear().domain([0, 100]),
						yMax: yScaleMax,
						xLabel: 'Count (\'x\' or more ' + report + 's)',
						yLabel: '% of total number of persons'
					});
				}
			}
		};

    var filterByConcept = function(conceptId) {
      return function (d) {
        return d.conceptId === conceptId;
      };
    };

    self.pieChart = function (data, selector, conceptId) {
      var byUnit = new atlascharts.donut();
      var dataByUnit = data
        .filter(function(d){ return d.measurementConceptId === conceptId; })
        .map(function (d, i) {
        return {
          id: d.conceptName,
          label: d.conceptName,
          value: d.countValue,
        };
      }, data);
      dataByUnit.sort(function (a, b) {
        var nameA = a.label.toLowerCase(),
          nameB = b.label.toLowerCase();
        if (nameA < nameB) //sort string ascending
          return -1;
        if (nameA > nameB)
          return 1;
        return 0; //default return value (no sorting)
      });
      byUnit.render(dataByUnit, selector, size6.width, size6.height, {
        margin: {
          top: 5,
          left: 5,
          right: 200,
          bottom: 5
        }
      });
    };
		
		self.boxplotChart = function(data, selector, conceptId) {
		  var measurementValues = new atlascharts.boxplot();
		  var ndata = self.normalizeArray(data.filter(filterByConcept(conceptId)));
		  var bpdata = self.normalizeDataframe(ndata);
		  if (!bpdata.empty) {
        var bpseries = bpdata.category.map(function (v, i) {
          return {
            Category: ndata.category[i],
            min: ndata.minValue[i],
            max: ndata.maxValue[i],
            median: ndata.medianValue[i],
            LIF: ndata.p10Value[i],
            q1: ndata.p25Value[i],
            q3: ndata.p75Value[i],
            UIF: ndata.p90Value[i],
          };
        });
        measurementValues.render(bpseries, selector, 300, 200, {
          yMax: d3.max(data, function (d) {
            return d.p90Value;
          }) || bpdata.p90Value,
          xLabel: 'Unit',
          yLabel: 'Measurement Value',
        });
      }
    };

		//
		// Subscriptions
		//

		self.currentReport.subscribe(self.loadSummary);
		self.currentSource.subscribe(self.loadSummary);
		self.currentConcept.subscribe(self.loadDrilldown);

		//
		// Utility functions
		//

		self.normalizeDataframe = function (dataframe) {
			// rjson serializes dataframes with 1 row as single element properties.  This function ensures fields are always arrays.
			var keys = d3.keys(dataframe);
			keys.forEach(function (key) {
				if (!(dataframe[key] instanceof Array)) {
					dataframe[key] = [dataframe[key]];
				}
			});
			return dataframe;
		};

		self.normalizeArray = function (ary, numerify) {
			var obj = {};
			var keys;

			if (ary && ary.length > 0 && ary instanceof Array) {
				keys = d3.keys(ary[0]);

				$.each(keys, function () {
					obj[this] = [];
				});

				$.each(ary, function () {
					var thisAryObj = this;
					$.each(keys, function () {
						var val = thisAryObj[this];
						if (numerify) {
							if (_.isFinite(+val)) {
								val = (+val);
							}
						}
						obj[this].push(val);
					});
				});
			} else {
				obj.empty = true;
			}

			return obj;
		};

		self.mapMonthYearDataToSeries = function (data, options) {
			var defaults = {
				dateField: "x",
				yValue: "y",
				yPercent: "p"
			};

			var options = $.extend({}, defaults, options);

			var series = {};
			series.name = "All Time";
			series.values = [];
			if (data && !data.empty) {
				for (var i = 0; i < data[options.dateField].length; i++) {
					var dateInt = data[options.dateField][i];
					series.values.push({
						xValue: new Date(Math.floor(data[options.dateField][i] / 100), (data[options.dateField][i] % 100) - 1, 1),
						yValue: data[options.yValue][i],
						yPercent: data[options.yPercent][i]
					});
				}
				series.values.sort(function (a, b) {
					return a.xValue - b.xValue;
				});
			}
			return [series]; // return series wrapped in an array
		};

		self.mapConceptData = function (data) {
			var result;

			if (data instanceof Array) {
				result = [];
				$.each(data, function () {
					var datum = {}
					datum.id = (+this.conceptId || this.conceptName);
					datum.label = this.conceptName;
					datum.value = +this.countValue;
					result.push(datum);
				});
			} else if (data.countValue instanceof Array) // multiple rows, each value of each column is in the indexed properties.
			{
				result = data.countValue.map(function (d, i) {
					var datum = {}
					datum.id = (this.conceptId || this.conceptName)[i];
					datum.label = this.conceptName[i];
					datum.value = this.countValue[i];
					return datum;
				}, data);


			} else // the dataset is a single value result, so the properties are not arrays.
			{
				result = [{
					id: data.conceptId,
					label: data.conceptName,
					value: data.countValue
				}];
			}

			result = result.sort(function (a, b) {
				return b.label < a.label ? 1 : -1;
			});

			return result;
		};

		self.mapHistogram = function (histogramData) {
			// result is an array of arrays, each element in the array is another array containing information about each bar of the histogram.
			var result = new Array();
			if (!histogramData.data || histogramData.data.empty) {
				return result;
			}
			var minValue = histogramData.min;
			var intervalSize = histogramData.intervalSize;

			for (var i = 0; i <= histogramData.intervals; i++) {
				var target = new Object();
				target.x = minValue + 1.0 * i * intervalSize;
				target.dx = intervalSize;
				target.y = histogramData.data.countValue[histogramData.data.intervalIndex.indexOf(i)] || 0;
				result.push(target);
			}

			return result;
		};

		self.formatSI = function (d, p) {
			if (d < 1) {
				return d3.round(d, p);
			}
			var prefix = d3.formatPrefix(d);
			return d3.round(prefix.scale(d), p) + prefix.symbol;
		};

		function freq_defaultTooltip(xLabel, xFormat, xAccessor,
			yLabel, yFormat, yAccessor) {
			return function (d) {
				var tipText = "";
				tipText += xLabel + ": " + xFormat(xAccessor(d)) + "</br>";
				tipText += yLabel + ": " + yFormat(yAccessor(d));
				return tipText;
			};
		}


		self.freqhistogram = function () {
			var self = this;
			self.xScale = {}; // shared xScale for histogram and boxplot

			self.drawBoxplot = function (g, data, width, height) {
				var boxplot = g,
					x = self.xScale,
					whiskerHeight = height / 2;

				if (data.LIF != data.q1) // draw whisker
				{
					boxplot.append("line")
						.attr("class", "bar")
						.attr("x1", x(data.LIF))
						.attr("y1", (height / 2) - (whiskerHeight / 2))
						.attr("x2", x(data.LIF))
						.attr("y2", (height / 2) + (whiskerHeight / 2));

					boxplot.append("line")
						.attr("class", "whisker")
						.attr("x1", x(data.LIF))
						.attr("y1", height / 2)
						.attr("x2", x(data.q1))
						.attr("y2", height / 2)
				}

				boxplot.append("rect")
					.attr("class", "box")
					.attr("x", x(data.q1))
					.attr("width", x(data.q3) - x(data.q1))
					.attr("height", height);

				boxplot.append("line")
					.attr("class", "median")
					.attr("x1", x(data.median))
					.attr("y1", 0)
					.attr("x2", x(data.median))
					.attr("y2", height);

				if (data.UIF != data.q3) // draw whisker
				{
					boxplot.append("line")
						.attr("class", "bar")
						.attr("x1", x(data.UIF))
						.attr("y1", (height / 2) - (whiskerHeight / 2))
						.attr("x2", x(data.UIF))
						.attr("y2", (height / 2) + (whiskerHeight / 2));

					boxplot.append("line")
						.attr("class", "whisker")
						.attr("x1", x(data.q3))
						.attr("y1", height / 2)
						.attr("x2", x(data.UIF))
						.attr("y2", height / 2)
				}
			}

			self.render = function (data, target, w, h, options) {
				data = data || []; // default to empty set if null is passed in
				var defaults = {
					margin: {
						top: 5,
						right: 5,
						bottom: 5,
						left: 5
					},
					ticks: 10,
					xFormat: d3.format(',.0f'),
					yFormat: d3.format('r'),
					yScale: d3.scaleLinear(),
					boxplotHeight: 10
				};

				var options = $.extend({}, defaults, options);

				var tooltipBuilder = freq_defaultTooltip(options.xLabel || "x",
					options.xFormat,
					function (d) {
						return d.x;
					},
					options.yLabel || "y",
					options.yFormat,
					function (d) {
						return d.y;
					});

				// alocate the SVG container, only creating it if it doesn't exist using the selector
				var chart;
				var isNew = false; // this is a flag to determine if chart has already been ploted on this target.
				if (!$(target + " svg")[0]) {
					chart = d3.select(target).append("svg")
						.attr("width", w)
						.attr("height", h)
						.attr("viewBox", "0 0 " + w + " " + h);
					isNew = true;
				} else {
					chart = d3.select(target + " svg");
				}

				var tip = d3tip()
					.attr('class', 'd3-tip')
					.offset([-10, 0])
					.html(tooltipBuilder)
				chart.call(tip);

				var xAxisLabelHeight = 0;
				var yAxisLabelWidth = 0;
				var bboxNode, bbox;

				// apply labels (if specified) and offset margins accordingly
				if (options.xLabel) {
					var xAxisLabel = chart.append("g")
						.attr("transform", "translate(" + w / 2 + "," + (h - options.margin.bottom) + ")")

					xAxisLabel.append("text")
						.attr("class", "axislabel")
						.style("text-anchor", "middle")
						.text(options.xLabel);

					bboxNode = xAxisLabel.node();
					if (bboxNode) {
						bbox = bboxNode.getBBox();
						if (bbox) {
							xAxisLabelHeight = bbox.height;
						}
					}
				}

				if (options.yLabel) {
					var yAxisLabel = chart.append("g")
						.attr("transform", "translate(" + options.margin.left + "," + (((h - options.margin.bottom - options.margin.top) / 2) + options.margin.top) + ")");
					yAxisLabel.append("text")
						.attr("class", "axislabel")
						.attr("transform", "rotate(-90)")
						.attr("y", 0)
						.attr("x", 0)
						.attr("dy", "1em")
						.style("text-anchor", "middle")
						.text(options.yLabel);

					bboxNode = yAxisLabel.node();
					if (bboxNode) {
						bbox = bboxNode.getBBox();
						if (bbox) {
							yAxisLabelWidth = 1.5 * bbox.width; // width is calculated as 1.5 * box height due to rotation anomolies that cause the y axis label to appear shifted.
						}
					}
				}

				// calculate an intial width and height that does not take into account the tick text dimensions
				var width = w - options.margin.left - options.margin.right - yAxisLabelWidth;
				var height = h - options.margin.top - options.margin.bottom - xAxisLabelHeight;

				// define the intial scale (range will be updated after we determine the final dimensions)
				var x = self.xScale = d3.scaleLinear()
					.domain(options.xDomain || [d3.min(data, function (d) {
						return d.x + 0.5;
					}), d3.max(data, function (d) {
						return d.x + d.dx - 0.5;
					})])
					.range([0, width]);

				var xAxis = d3.axisBottom()
					.scale(x)
					.ticks(options.ticks)
					.tickFormat(options.xFormat);

				var y = options.yScale
					.domain([0, options.yMax || d3.max(data, function (d) {
						return d.y;
					})])
					.range([height, 0]);

				var yAxis = d3.axisLeft()
					.scale(y)
					.ticks(4)
					.tickFormat(options.yFormat);

				// create temporary x axis
				var tempXAxis = chart.append("g").attr("class", "axis");
				tempXAxis.call(xAxis);
				var yAxisWidth, xAxisHeight, xAxisWidth;

				if (tempXAxis.node() && tempXAxis.node().getBBox()) {
					// update width & height based on temp xaxis dimension and remove
					xAxisHeight = Math.round(tempXAxis.node().getBBox().height);
					xAxisWidth = Math.round(tempXAxis.node().getBBox().width);
					height = height - xAxisHeight;
					width = width - Math.max(0, (xAxisWidth - width)); // trim width if xAxisWidth bleeds over the allocated width.
					tempXAxis.remove();
				}

				// create temporary y axis
				var tempYAxis = chart.append("g").attr("class", "axis");
				tempYAxis.call(yAxis);

				if (tempYAxis.node() && tempYAxis.node().getBBox()) {
					// update height based on temp xaxis dimension and remove
					yAxisWidth = Math.round(tempYAxis.node().getBBox().width);
					width = width - yAxisWidth;
					tempYAxis.remove();
				}

				if (options.boxplot) {
					height -= 12; // boxplot takes up 12 vertical space
					var boxplotG = chart.append("g")
						.attr("class", "boxplot")
						.attr("transform", "translate(" + (options.margin.left + yAxisLabelWidth + yAxisWidth) + "," + (options.margin.top + height + xAxisHeight) + ")");
					self.drawBoxplot(boxplotG, options.boxplot, width, 8);
				}

				// reset axis ranges
				x.range([0, width]);
				y.range([height, 0]);

				var hist = chart.append("g")
					.attr("transform", "translate(" + (options.margin.left + yAxisLabelWidth + yAxisWidth) + "," + options.margin.top + ")");

				var bar = hist.selectAll(".bar")
					.data(data)
					.enter().append("g")
					.attr("class", "bar")
					.attr("transform", function (d) {
						return "translate(" + x(d.x - 0.5) + "," + y(d.y) + ")";
					})
					.on('mouseover', tip.show)
					.on('mouseout', tip.hide)

				bar.append("rect")
					.attr("x", 1)
					.attr("width", function (d) {
						return Math.max((x(d.x + d.dx) - x(d.x) - 1), .5);
					})
					.attr("height", function (d) {
						return height - y(d.y);
					});

				if (isNew) {
					hist.append("g")
						.attr("class", "x axis")
						.attr("transform", "translate(0," + height + ")")
						.call(xAxis);

					hist.append("g")
						.attr("class", "y axis")
						.attr("transform", "translate(0," + 0 + ")")
						.call(yAxis);

					$(window).on("resize", {
							container: $(target),
							chart: $(target + " svg"),
							aspect: w / h
						},
						function (event) {
							var targetWidth = event.data.container.width();
							event.data.chart.attr("width", targetWidth);
							event.data.chart.attr("height", Math.round(targetWidth / event.data.aspect));
						}).trigger("resize");
				}
			}
		}
	}

	var component = {
		viewModel: dataSources,
		template: view
	};

	ko.components.register('data-sources', component);
	return component;
});