/**
 * Copyright (c) 2017 NAVER Corp.
 * billboard.js project is licensed under the MIT license
 */
import {
	set as d3Set,
	min as d3Min,
	max as d3Max,
	merge as d3Merge
} from "d3";
import CLASS from "../config/classes";
import ChartInternal from "../internals/ChartInternal";
import {
	extend,
	hasValue,
	isArray,
	isBoolean,
	isDefined,
	isFunction,
	isObjectType,
	isString,
	isUndefined,
	isValue,
	notEmpty
} from "../internals/util";

extend(ChartInternal.prototype, {
	isX(key) {
		const $$ = this;
		const config = $$.config;
		const dataKey = config.data_x && key === config.data_x;
		const existValue = notEmpty(config.data_xs) && hasValue(config.data_xs, key);

		return (dataKey) || (existValue);
	},

	isNotX(key) {
		return !this.isX(key);
	},

	getXKey(id) {
		const $$ = this;
		const config = $$.config;

		return config.data_x ?
			config.data_x : (notEmpty(config.data_xs) ? config.data_xs[id] : null);
	},

	getXValuesOfXKey(key, targets) {
		const $$ = this;
		const ids = targets && notEmpty(targets) ? $$.mapToIds(targets) : [];
		let xValues;

		ids.forEach(id => {
			if ($$.getXKey(id) === key) {
				xValues = $$.data.xs[id];
			}
		});
		return xValues;
	},

	getIndexByX(x) {
		const $$ = this;
		const data = $$.filterByX($$.data.targets, x);

		return data.length ? data[0].index : null;
	},

	getXValue(id, i) {
		const $$ = this;

		return id in $$.data.xs &&
			$$.data.xs[id] &&
			isValue($$.data.xs[id][i]) ? $$.data.xs[id][i] : i;
	},

	getOtherTargetXs() {
		const $$ = this;
		const idsForX = Object.keys($$.data.xs);

		return idsForX.length ? $$.data.xs[idsForX[0]] : null;
	},

	getOtherTargetX(index) {
		const xs = this.getOtherTargetXs();

		return xs && index < xs.length ? xs[index] : null;
	},

	addXs(xs) {
		const $$ = this;

		Object.keys(xs).forEach(id => {
			$$.config.data_xs[id] = xs[id];
		});
	},

	hasMultipleX(xs) {
		// https://github.com/d3/d3-collection
		return d3Set(Object.keys(xs).map(id => xs[id])).size() > 1;
	},

	isMultipleX() {
		return notEmpty(this.config.data_xs) ||
			!this.config.data_xSort ||
			this.hasType("bubble") ||
			this.hasType("scatter");
	},

	addName(data) {
		const $$ = this;
		let name;

		if (data) {
			name = $$.config.data_names[data.id];
			data.name = name !== undefined ? name : data.id;
		}

		return data;
	},

	getValueOnIndex(values, index) {
		const valueOnIndex = values.filter(v => v.index === index);

		return valueOnIndex.length ? valueOnIndex[0] : null;
	},

	updateTargetX(targets, x) {
		const $$ = this;

		targets.forEach(t => {
			t.values.forEach((v, i) => {
				v.x = $$.generateTargetX(x[i], t.id, i);
			});

			$$.data.xs[t.id] = x;
		});
	},

	updateTargetXs(targets, xs) {
		const $$ = this;

		targets.forEach(t => {
			xs[t.id] && $$.updateTargetX([t], xs[t.id]);
		});
	},

	generateTargetX(rawX, id, index) {
		const $$ = this;
		let x;

		if ($$.isTimeSeries()) {
			x = rawX ? $$.parseDate(rawX) : $$.parseDate($$.getXValue(id, index));
		} else if ($$.isCustomX() && !$$.isCategorized()) {
			x = isValue(rawX) ? +rawX : $$.getXValue(id, index);
		} else {
			x = index;
		}

		return x;
	},

	cloneTarget(target) {
		return {
			id: target.id,
			id_org: target.id_org,
			values: target.values.map(d => ({x: d.x, value: d.value, id: d.id}))
		};
	},

	updateXs() {
		const $$ = this;

		if ($$.data.targets.length) {
			$$.xs = [];

			$$.data.targets[0].values.forEach(v => {
				$$.xs[v.index] = v.x;
			});
		}
	},

	getPrevX(i) {
		const x = this.xs[i - 1];

		return isDefined(x) ? x : null;
	},

	getNextX(i) {
		const x = this.xs[i + 1];

		return isDefined(x) ? x : null;
	},

	/**
	 * Get min/max value from the data
	 * @private
	 * @param {Array} data array data to be evaluated
	 * @return {{min: {Number}, max: {Number}}}
	 */
	getMinMaxValue(data) {
		let min;
		let max;

		(data || this.data.targets.map(t => t.values))
			.forEach(v => {
				min = d3Min([min, d3Min(v, t => t.value)]);
				max = d3Max([max, d3Max(v, t => t.value)]);
			});

		return {min, max};
	},

	/**
	 * Get the min/max data
	 * @private
	 * @return {{min: Array, max: Array}}
	 */
	getMinMaxData() {
		const $$ = this;

		if (!$$.cache.$minMaxData) {
			const data = $$.data.targets.map(t => t.values);
			const minMax = $$.getMinMaxValue(data);

			let min = [];
			let max = [];

			data.forEach(v => {
				const minData = $$.getFilteredDataByValue(v, minMax.min);
				const maxData = $$.getFilteredDataByValue(v, minMax.max);

				if (minData.length) {
					min = min.concat(minData);
				}

				if (maxData.length) {
					max = max.concat(maxData);
				}
			});

			// update the cached data
			$$.cache.$minMaxData = {min, max};
		}

		return $$.cache.$minMaxData;
	},

	/**
	 * Get filtered data by value
	 * @param {Object} data
	 * @param {Number} value
	 * @return {Array} filtered array data
	 * @private
	 */
	getFilteredDataByValue(data, value) {
		return data.filter(t => t.value === value);
	},

	/**
	 * Return the max length of the data
	 * @return {Number} max data length
	 * @private
	 */
	getMaxDataCount() {
		return d3Max(this.data.targets, t => t.values.length);
	},

	getMaxDataCountTarget(targets) {
		const length = targets.length;
		let max = 0;
		let maxTarget;

		if (length > 1) {
			targets.forEach(t => {
				if (t.values.length > max) {
					maxTarget = t;
					max = t.values.length;
				}
			});
		} else {
			maxTarget = length ? targets[0] : null;
		}

		return maxTarget;
	},

	mapToIds(targets) {
		return targets.map(d => d.id);
	},

	mapToTargetIds(ids) {
		const $$ = this;

		return ids ? (isArray(ids) ? ids.concat() : [ids]) : $$.mapToIds($$.data.targets);
	},

	hasTarget(targets, id) {
		const ids = this.mapToIds(targets);

		for (let i = 0, val; (val = ids[i]); i++) {
			if (val === id) {
				return true;
			}
		}

		return false;
	},

	isTargetToShow(targetId) {
		return this.hiddenTargetIds.indexOf(targetId) < 0;
	},

	isLegendToShow(targetId) {
		return this.hiddenLegendIds.indexOf(targetId) < 0;
	},

	filterTargetsToShow(targets) {
		const $$ = this;

		return targets.filter(t => $$.isTargetToShow(t.id));
	},

	mapTargetsToUniqueXs(targets) {
		const $$ = this;
		let xs = d3Set(d3Merge(
			targets.map(t => t.values.map(v => +v.x))
		)).values();

		xs = $$.isTimeSeries() ? xs.map(x => new Date(+x)) : xs.map(x => +x);

		return xs.sort((a, b) => (a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN));
	},

	addHiddenTargetIds(targetIds) {
		this.hiddenTargetIds = this.hiddenTargetIds.concat(targetIds);
	},

	removeHiddenTargetIds(targetIds) {
		this.hiddenTargetIds = this.hiddenTargetIds.filter(id => targetIds.indexOf(id) < 0);
	},

	addHiddenLegendIds(targetIds) {
		this.hiddenLegendIds = this.hiddenLegendIds.concat(targetIds);
	},

	removeHiddenLegendIds(targetIds) {
		this.hiddenLegendIds = this.hiddenLegendIds.filter(id => targetIds.indexOf(id) < 0);
	},

	getValuesAsIdKeyed(targets) {
		const $$ = this;
		const ys = {};

		targets.forEach(t => {
			const data = [];

			t.values.forEach(v => {
				const value = v.value;

				if (isArray(value)) {
					data.push(...value);
				} else if ($$.isObject(value) && "high" in value) {
					data.push(...Object.values(value));
				} else {
					data.push(value);
				}
			});

			ys[t.id] = data;
		});

		return ys;
	},

	checkValueInTargets(targets, checker) {
		const ids = Object.keys(targets);
		let values;

		for (let i = 0; i < ids.length; i++) {
			values = targets[ids[i]].values;

			for (let j = 0; j < values.length; j++) {
				if (checker(values[j].value)) {
					return true;
				}
			}
		}

		return false;
	},

	hasNegativeValueInTargets(targets) {
		return this.checkValueInTargets(targets, v => v < 0);
	},

	hasPositiveValueInTargets(targets) {
		return this.checkValueInTargets(targets, v => v > 0);
	},

	_checkOrder(type) {
		const config = this.config;

		return isString(config.data_order) &&
			config.data_order.toLowerCase() === type;
	},

	isOrderDesc() {
		return this._checkOrder("desc");
	},

	isOrderAsc() {
		return this._checkOrder("asc");
	},

	orderTargets(targets) {
		const $$ = this;
		const config = $$.config;
		const orderAsc = $$.isOrderAsc();
		const orderDesc = $$.isOrderDesc();

		if (orderAsc || orderDesc) {
			targets.sort((t1, t2) => {
				const reducer = (p, c) => p + Math.abs(c.value);
				const t1Sum = t1.values.reduce(reducer, 0);
				const t2Sum = t2.values.reduce(reducer, 0);

				return orderAsc ? t2Sum - t1Sum : t1Sum - t2Sum;
			});
		} else if (isFunction(config.data_order)) {
			targets.sort(config.data_order);
		} // TODO: accept name array for order

		return targets;
	},

	filterByX(targets, x) {
		return d3Merge(targets.map(t => t.values)).filter(v => v.x - x === 0);
	},

	filterRemoveNull(data) {
		return data.filter(d => isValue(d.value));
	},

	filterByXDomain(targets, xDomain) {
		return targets.map(t => ({
			id: t.id,
			id_org: t.id_org,
			values: t.values.filter(v => xDomain[0] <= v.x && v.x <= xDomain[1])
		}));
	},

	hasDataLabel() {
		const dataLabels = this.config.data_labels;

		return (isBoolean(dataLabels) && dataLabels) ||
			(isObjectType(dataLabels) && notEmpty(dataLabels));
	},

	getDataLabelLength(min, max, key) {
		const $$ = this;
		const lengths = [0, 0];
		const paddingCoef = 1.3;

		$$.selectChart.select("svg").selectAll(".dummy")
			.data([min, max])
			.enter()
			.append("text")
			.text(d => $$.dataLabelFormat(d.id)(d))
			.each(function(d, i) {
				lengths[i] = this.getBoundingClientRect()[key] * paddingCoef;
			})
			.remove();

		return lengths;
	},

	isNoneArc(d) {
		return this.hasTarget(this.data.targets, d.id);
	},

	isArc(d) {
		return "data" in d && this.hasTarget(this.data.targets, d.data.id);
	},

	findSameXOfValues(values, index) {
		const targetX = values[index].x;
		const sames = [];
		let i;

		for (i = index - 1; i >= 0; i--) {
			if (targetX !== values[i].x) {
				break;
			}
			sames.push(values[i]);
		}
		for (i = index; i < values.length; i++) {
			if (targetX !== values[i].x) {
				break;
			}
			sames.push(values[i]);
		}
		return sames;
	},

	findClosestFromTargets(targets, pos) {
		const $$ = this;
		const candidates = targets.map(target => $$.findClosest(target.values, pos)); // map to array of closest points of each target

		// decide closest point and return
		return $$.findClosest(candidates, pos);
	},

	findClosest(values, pos) {
		const $$ = this;
		let minDist = $$.config.point_sensitivity;
		let closest;

		// find mouseovering bar
		values
			.filter(v => v && $$.isBarType(v.id))
			.forEach(v => {
				const shape = $$.main.select(`.${CLASS.bars}${$$.getTargetSelectorSuffix(v.id)} .${CLASS.bar}-${v.index}`).node();

				if (!closest && $$.isWithinBar(shape)) {
					closest = v;
				}
			});

		// find closest point from non-bar
		values
			.filter(v => v && !$$.isBarType(v.id))
			.forEach(v => {
				const d = $$.dist(v, pos);

				if (d < minDist) {
					minDist = d;
					closest = v;
				}
			});

		return closest;
	},

	dist(data, pos) {
		const $$ = this;
		const config = $$.config;
		const xIndex = config.axis_rotated ? 1 : 0;
		const yIndex = config.axis_rotated ? 0 : 1;
		const y = $$.circleY(data, data.index);
		const x = $$.x(data.x);

		return Math.sqrt(Math.pow(x - pos[xIndex], 2) + Math.pow(y - pos[yIndex], 2));
	},

	convertValuesToStep(values) {
		const converted = isArray(values) ? values.concat() : [values];

		if (!this.isCategorized()) {
			return values;
		}

		for (let i = values.length + 1; i > 0; i--) {
			converted[i] = converted[i - 1];
		}

		converted[0] = {
			x: converted[0].x - 1,
			value: converted[0].value,
			id: converted[0].id
		};

		converted[values.length + 1] = {
			x: converted[values.length].x + 1,
			value: converted[values.length].value,
			id: converted[values.length].id
		};

		return converted;
	},

	convertValuesToRange(values) {
		const converted = isArray(values) ? values.concat() : [values];
		const ranges = [];

		converted.forEach(range => {
			const x = range.x;
			const id = range.id;

			ranges.push({
				x,
				id,
				value: range.value[0]
			});

			ranges.push({
				x,
				id,
				value: range.value[2]
			});
		});

		return ranges;
	},

	updateDataAttributes(name, attrs) {
		const $$ = this;
		const config = $$.config;
		const current = config[`data_${name}`];

		if (isUndefined(attrs)) {
			return current;
		}

		Object.keys(attrs).forEach(id => {
			current[id] = attrs[id];
		});

		$$.redraw({withLegend: true});

		return current;
	},

	getAreaRangeData(d, type) {
		if (isArray(d.value)) {
			const index = ["high", "mid", "low"].indexOf(type);

			return index === -1 ? 0 : d.value[index];
		}

		return d.value[type];
	}
});

