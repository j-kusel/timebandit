/**
 * @fileOverview    General purpose calculation methods.
 * @author          J Kusel
 * @requires        ../config/CONFIG.json:config
 */

import c from '../config/CONFIG.json';

/**
 * @module Util
 */

const FLOAT_MUL = Math.pow(10, 8);
const MUL = (x) => Math.round(x*FLOAT_MUL)/FLOAT_MUL;

/**
 * Less-than comparison operator with a 10^-8 float threshold.
 * @param {number} x    first term
 * @param {number} y    second term
 * 
 * @returns {boolean}   comparison truthiness
 * @function
 */
export const lt = (x, y) =>
    (isFinite(x) ? MUL(x):x) //x.toFixed(FLOAT):x)
        < (isFinite(y) ? MUL(y):y)//y.toFixed(FLOAT):y);
/**
 * Less-than comparison operator with a 10^-8 float threshold.
 * @param {number} x    first term
 * @param {number} y    second term
 * 
 * @returns {boolean}   comparison truthiness
 * @function
 */
export const lte = (x, y) =>
    (isFinite(x) ? MUL(x):x)
        <= (isFinite(y) ? MUL(y):y);
/**
 * Less-than comparison operator with a 10^-8 float threshold.
 * @param {number} x    first term
 * @param {number} y    second term
 * 
 * @function
 * @returns {boolean}   comparison truthiness
 */
export const gt = (x, y) =>
    (isFinite(x) ? MUL(x):x)
        > (isFinite(y) ? MUL(y):y);
/**
 * Less-than comparison operator with a 10^-8 float threshold.
 * @param {number} x    first term
 * @param {number} y    second term
 * 
 * @function
 * @returns {boolean}   comparison truthiness
 */
export const gte = (x, y) =>
    (isFinite(x) ? MUL(x):x)
        >= (isFinite(y) ? MUL(y):y);

/**
 * Returns milliseconds from float tick values
 * @param {Array.<number>}  ticks       Measure tick array
 * @param {number}          ms          Measure length in milliseconds
 * @param {number}          tick_loc    Tick index
 * 
 * @function
 * @returns {number}        Location of specified tick in milliseconds
 */
export const tempo_edit = (oldMeas, newMeas, beat_lock, type) => {
    let lock_tempo = (oldMeas.end - oldMeas.start)/oldMeas.timesig * beat_lock.beat + oldMeas.start;
    let lock_percent = beat_lock.beat / oldMeas.timesig;
    if (type === 'start')
        newMeas.end = (lock_tempo - newMeas.start)/lock_percent + newMeas.start
    else if (type === 'end')
        newMeas.start = newMeas.end - (newMeas.end - lock_tempo)/(1 - lock_percent);
    return newMeas;
}

/**
 * Returns milliseconds from float tick values
 * @param {Array.<number>}  ticks       Measure tick array
 * @param {number}          ms          Measure length in milliseconds
 * @param {number}          tick_loc    Tick index
 * 
 * @function
 * @returns {number}        Location of specified tick in milliseconds
 */
export const abs_location = (ticks, ms, tick_loc) => {
    let s_tick = Math.floor(tick_loc);
    let s_remainder = tick_loc - s_tick;
    return ticks[s_tick] + 
        ((ticks[s_tick+1] || ms) - ticks[s_tick]) * s_remainder;
};

/**
 * Calculate new learning rate for nudge algorithms based on change in gap.
 * @param {number}  gap     Previous gap in milliseconds
 * @param {number}  new_gap New gap in milliseconds
 * @param {number}  alpha   Previous learning rate
 * 
 * @function
 * @returns {number}        Updated learning rate
 */
export const monitor = (gap, new_gap, alpha) => {
    let progress = Math.abs(gap) - Math.abs(new_gap);
    if (gap + new_gap === 0 || progress === 0)
        return alpha;

    let perc = Math.abs(progress)/Math.abs(gap);
    if (progress < 0)
        alpha *= -1;

    return alpha * (1-perc)/perc;
};

/**
 * @typedef {Object} Gap            A numerical description of the left and right bounds of open space.
 * @property {Array<number>} gaps   A two-element array with left and right bounds, in milliseconds.
 */

/**
 * Generates measure.gaps for a target Measure in 'measure' drag mode
 * @param {Array<Measure>}  measures    Previous gap in milliseconds
 * @param {string}          id          Id of target measure
 * 
 * @function
 * @returns {{gaps: Array<Gap>, obstacles: Array<Measures>}} Open gaps and Measure obstacles
 */
export const calc_gaps = (measures, id) => {
    var last = false;
    if (!(typeof id === 'object'))
        id = [id];
    // ASSUMES MEASURES ARE IN ORDER
    let obstacles = [];
    let gaps = measures.reduce((acc, meas, i) => {
        // skip measure in question
        if (id.length && id.indexOf(meas.id) > -1)
            return acc;
        acc = [...acc, [
            (last) ? last.offset + last.ms : -Infinity,
            meas.offset
        ]];
        obstacles.push(meas);
        last = meas;
        return acc;
    }, [])
        .concat([[ last.offset + last.ms, Infinity ]]);
    return { gaps, obstacles };
};

// document this when it's less of a mess
export const global_gaps = (inst_ordereds, selections, addition) => {
    
    // 'measure' mode
    // i want this elsewhere but there are so many dependencies
    // - this is reused when pasting multiple measures, time to abstract it away
    /* - relies on:
     * instruments length
     * Window selections:
         * only offset and ms (and ids for gap exemptions) i think
     * entire instrument measure count totals
     * calc_gaps function, instrument ordered measures
     * gte/lte helper functions
     */
    let instMeas = [];
    let count = [];
    // create an array instMeas of empty arrays
    for (let i=0; i<inst_ordereds.length; i++) {
        instMeas.push([]);
        count.push(0);
    }

    // push from array of measure objects into instMeas array by inst index,
    // and increment selection counts for each inst to shortcut gap search.
    selections.forEach(sel => {
        count[sel.inst]++;
        instMeas[sel.inst].push(sel.id);
    });

    // skip costly algo if selection is exclusively
    // entire instruments
    if (!count.some((c, i) => 
        (c && (c !== inst_ordereds[i].length))
    ))
        return false;

    // calculate global gaps for each instrument.
    // this cannot be known before all measures are sorted,
    // so must be a separate loop.
    let first = Infinity;
    let last = -Infinity;
    let instGaps = instMeas.map((ids, ind) => {
        let gaps = calc_gaps(inst_ordereds[ind], addition ? [] : ids).gaps;
        first = Math.min(first, gaps[0][1]);
        last = Math.max(last, gaps[gaps.length-1][0]);
        return gaps;
    });

    var fit_check = (select, bias, gap) => {
        let offset = select.offset + bias;
        return gte(offset, gap[0]) && lte(offset + select.ms, gap[1]);
    };


    let breaks = { span: last - first };
    // find initial gap for each selection
    // this can't be known until gaps are calculated, 
    // so must be a separate loop.
    //
    // is this even necessary, or is it handled in the loops below?
    let gapTraces = {};
    let span = [Infinity, -Infinity];
    selections.forEach(select => {
        let meas = gapTraces[select.id] = {
            meas: select,
            gaps: instGaps[select.inst]
        };
        if (addition) {
            meas.pointer = meas.initial = meas.gaps.length-1;
            // add a new measure the minimum known clearance after the end
            meas.meas.offset += breaks.span;
            span = [Math.min(span[0], meas.meas.offset),
                Math.max(span[1], meas.meas.offset + meas.meas.ms)];
            return;
        }

        // when current gap is found, initialize gap pointer
        meas.gaps.some((gap, i) =>
            fit_check(select, 0, gap)
                && ((meas.pointer = i) || true)
        );
        meas.initial = meas.pointer;
    });

    let center = (span[1] + span[0]) * 0.5;
    let center_half = (span[1] - span[0]) * 0.5;
    let leftmost = Infinity;
    selections.forEach(select => {
        select.center_offset = select.offset - center;
        leftmost = Math.min(select.offset, leftmost);
    });
    console.log(leftmost);

    // find global obstacles on left/right
    // - dependent on gapTraces object, fit_check function
    let depth = 10;

    let debug = false;
    let break_check = (arr, dir, bias) => {
        if (depth < 0)
            return arr;
        //depth--;
        if (!isFinite(bias))
            return arr;
        
        let left = (dir==='left');
        let valid = true;
        let result = Object.keys(gapTraces).reduce((acc, key) => {
            if (debug) console.group();
            let select = gapTraces[key];
            let meas = select.meas;
            if (debug) console.log(`checking measure ${meas.timesig}/${meas.denom} in inst `, meas.inst);
            let gap = select.gaps[select.pointer];
            

            if (debug) console.log(gap);
            // if there are no gaps (meaning no obstacles), return generic acc
            if (!gap) {
                if (debug) console.groupEnd();
                return acc;
            }
            let fit = left ?
                fit_check(meas, -bias, gap) :
                fit_check(meas, bias, gap);
            let final = left ?
                select.pointer === 0 :
                select.pointer >= select.gaps.length-1;
            if (final) {
                let nearest_gap = left ?
                    select.gaps[0][1] :
                    select.gaps[select.gaps.length-1][0];
                let candidate = left ?
                    meas.offset - (nearest_gap-meas.ms) :
                    nearest_gap-meas.offset;
                if (gt(candidate, bias) && lt(candidate, acc.nearest)) {
                    acc.nearest = candidate;
                    acc.nearest_gap = nearest_gap;
                }
            } else {
                if (debug) console.log('changing nearest');
                if (debug) console.log('current nearest: ', acc.nearest);
                let nearest_gap = left ?
                    select.gaps[select.pointer-1][1] :
                    select.gaps[select.pointer+1][0];
                
                let candidate = left ?
                    meas.offset - (nearest_gap-meas.ms) :
                    nearest_gap-meas.offset
                if (debug) console.log('candidate: ', candidate);

                if (lt(candidate, acc.nearest)) {
                    if (debug) console.log('new nearest');
                    acc.nearest = candidate;
                    acc.nearest_gap = nearest_gap;
                }
            }
            if (!fit) {
                if (left) {
                    let end_gap = gap[1];
                    let end_meas = meas.offset-bias+meas.ms;
                    if (lt(end_gap, end_meas)) {
                        if (debug) console.log('still more to go');
                        let nearest_gap = select.gaps[select.pointer][1];
                        let nearest = meas.offset - (nearest_gap-meas.ms);
                        if (lt(nearest, acc.nearest)) {
                            if (debug) console.log('new nearest: ', nearest);
                            acc.nearest = nearest;
                            acc.nearest_gap = nearest;
                        }
                    } else if (!final)
                        select.pointer -= 1;
                } else {
                    let start_gap = gap[0];
                    let start_meas = meas.offset+bias;
                    if (gt(start_gap > start_meas)) {
                        if (debug) console.log('still more to go');
                        let nearest = start_gap - meas.offset;
                        if (lt(nearest, acc.nearest)) {
                            if (debug) console.log('new nearest: ', nearest);
                            acc.nearest = nearest;
                            acc.nearest_gap = start_gap;
                        }
                    } else if (!final)
                        select.pointer += 1;
                }
                
                valid = false;
                if (debug) console.log('measure doesnt fit');
            } else {
                if (debug) console.log('measure fits');
            }
            if (debug) console.log('bias: ', bias, 'offset: ', meas.offset);
            if (valid) {
                // how much can we keep moving?
                let wiggle = left ?
                    meas.offset - gap[0]:
                    gap[1]-meas.ms-meas.offset;

                if (wiggle < acc.wiggle) {
                    acc.wiggle = wiggle;
                    acc.abs_left = left ? 
                        gap[0] : gap[1];
                }

            }
            if (debug) console.groupEnd();
            return acc;
        }, { nearest: Infinity, wiggle: Infinity,  abs_left: -Infinity, bias });
        if (valid) {
            // link previous result to current one
            result.half = (result.nearest+result.wiggle)*0.5;
            result.center_far = left ?
                center - result.wiggle :
                center + result.wiggle;
            if (arr.length) {
                let prev = arr[arr.length-1];
                prev.next = result;
                prev.break = (result.bias+prev.wiggle)*0.5;
                result.abs_right = prev.nearest_gap;
                result.center_near = left ?
                    (center - bias) : (center + bias); 
            }
            arr.push(result);
        }
        if (debug) console.log(center);
        return break_check(arr, dir, result.nearest);
    };


    breaks.left = break_check([], 'left', 0);
    if (debug) console.log(breaks.left);
    // reset pointers
    Object.keys(gapTraces).forEach(key => gapTraces[key].pointer = gapTraces[key].initial);
    breaks.right = break_check([], 'right', 0);
    Object.assign(breaks, { span, center, center_half, leftmost });
    return breaks;
}

    
/**
 * Finds adjacent measures and returns their location and distance
 * @param {Array<module:Util~Gap>}  gaps        Array of Gaps in the instrument
 * @param {number}                  position    Left bound of candidate Measure in milliseconds
 * @param {number}                  ms          Right bound of candidate Measure in milliseconds
 * @param {{center: boolean, strict: boolean, context: boolean, impossible: boolean}}
 *                                  options     Calculation options
 * 
 * @function
 * @returns {Object} Representation of "breathing room" of the Measure-like object in the relevant indexed gap. 
 */
export const crowding = (gaps, position, ms, { center=false, strict=false, context=false, impossible=false } = {}) => {
    let final = position + ms;
    let context_final = context ?
        context.position + context.ms : final;
    let mid = position + ms*0.5;
    let context_mid = context ?
        context.position + context.ms*0.5 : mid;
    let offset = context ?
        context.position : position;
    let context_ms = context ?
        context.ms : ms;

    // changing the criteria for first/last -
    // this seems to work well for editor validation but we may
    // still have problems down the line
    if (context_final <= gaps[0][1] || offset <= gaps[0][1]) {
        return { start: [-Infinity, Infinity], end: [gaps[0][1], gaps[0][1] - (final)] };
    }
    let last_gap = gaps.slice(-1)[0];
    if (offset > last_gap[0] || context_final > last_gap[0]) {
        return { start: [last_gap[0], position - last_gap[0]], end: [Infinity, Infinity] };
    }
        
    return gaps
        .reduce((acc, gap, ind) => {
            // does it even fit in the gap?
            if (!impossible && (gap[1] - gap[0] < context_ms - (strict ? c.NUDGE_THRESHOLD*2 : 0)))
                return acc;
            let start = [gap[0], position - gap[0]];
            let end = [gap[1], gap[1] - final];

            // trying something new... base closest gap on the center of the given spread,
            // in relation to the start or end of available gaps.
            if (center) {
                let target = (gap[0]+acc.end[0])/2;
                // if the previous gap start is -Infinity and 
                //if ((!isFinite(acc.start[0]) && )
                //    || mid < (gap[0]+acc.end[0])/2))
                if (isFinite(target) && context_mid < target)
                    return acc;
            }

            // is there ever an instance where these two aren't both triggered?

            // 1. if the distance to the start of the gap is less than the previous,
            // update the returned gap.
            if (Math.abs(start[1]) < Math.abs(acc.start[1]) ||
                (Math.abs(end[1]) < Math.abs(acc.end[1])))
                return ({ start, end, gap: ind });
            // 2. if the distance to the end of the gap is less than the previous,
            // update the returned gap.
            //if (Math.abs(end[1]) < Math.abs(acc.end[1]))
            //    acc.end = end;
            return acc;
        }, { start: [0, Infinity], end: [0, Infinity], gap: -1 });
}

/**
 * Finds initial "wiggle room" of the Measure-like object when beginning a selection's 'measure' drag.
 * @param {Array<module:Util~Gap>}  gaps        Array of Gaps in the instrument
 * @param {number}                  offset      Left bound of candidate Measure in milliseconds
 * @param {number}                  ms          Right bound of candidate Measure in milliseconds
 * 
 * @function
 * @returns {Object}                            Representation of "wiggle room" 
 */
export const initial_gap = (gaps, offset, ms) => {
    // right now this starts by finding the first 
    let current = -1;
    gaps.some((gap, i) => {
        if (offset >= gap[0] &&
            offset + ms <= gap[1]
        ) {
            current = i;
            return true;
        }
        return false;
    });
    let gap_left, gap_right;
    var search_gap = (current, dir) => {
        // left and right boundaries of current gap
        let left = gaps[current][0];
        let right = gaps[current][1];

        // too big? keep searching
        if (ms > right - left) {
            if (dir > 0)
                return search_gap(current+1, dir);
            return search_gap(current-1, dir);
        }
        return gaps[current];
    }

    // left and right search
    // later, allow previous caches to be passed in to reduce gap search calculations
    if (current-1 > -1)
        gap_left = search_gap(current-1, -1);
    if (current+1 < gaps.length)
        gap_right = search_gap(current+1, 1);

    return { 
        left: gap_left, right: gap_right,
        wiggle: [
            offset - gaps[current][0],
            gaps[current][1] - (offset + ms)
        ]
    }
    // something here about return false or recurse if negative
}

/**
 * TODO
 * @function
 */
export const anticipate_gap = (gaps, offset, ms, /*current*/) => {
    let [left, current, right] = [null, null, null];
    let end = offset+ms;
    let valid = gaps.some((gap, i) => {
        if (gte(offset, gap[0]) && lte(end, gap[1])) {
            current = gap;
            if (i<gaps.length-1)
                right = gaps[i+1];
            return true;
        } else console.log('this doesnt fit');
        if (lte(ms, gap[1] - gap[0]))
            left = gap;
        return false;
    });
    if (!(valid || right))
        right = [gaps[gaps.length-1][0]];

    // if measure is valid, return its wiggle room,
    // otherwise return the distance in either direction
    // to the previous/next gap
    let obj = {
        valid,
        resolution: [
            left ? offset - (left[1]-ms) : Infinity, //null,
            right ? right[0] - offset : Infinity //null
        ]
    };
    if (valid)
        obj.wiggle = [
            offset - current[0],
            current[1] - (offset + ms)
        ];

    return obj;
}

/**
 * Finds initial "wiggle room" of the Measure-like object when beginning a selection's 'measure' drag.
 * @param {Array<module:Util~Gap>}  gaps        Array of Gaps in the instrument
 * @param {number}                  offset      Left bound of candidate Measure in milliseconds
 * @param {number}                  ms          Right bound of candidate Measure in milliseconds
 * 
 * @function
 * @returns {Object}                            Representation of "wiggle room" 
 */
export const MeasureCalc = (features, options) => {
    let start, end, timesig, denom;
    let PPQ, PPQ_tempo;
    ({ start, end, timesig, denom } = features);
    if (!denom)
        denom = 4;
    ({ PPQ, PPQ_tempo } = options);
    var ms;
    var beats = [];
    var ticks = [];
    let divisor = denom/4;
    let tick_num = options.PPQ * (timesig/divisor);
    let cumulative = 0.0;
    let inc = (end-start)/tick_num;
    let K = 60000.0 / PPQ;
    let PPQ_mod = PPQ / PPQ_tempo;
    let local_PPQ = PPQ/divisor;
    let last = 0;
    for (var i=0; i < tick_num; i++) {
        if (!(i%local_PPQ))
            beats.push(cumulative);
        ticks.push(cumulative);
        if (i%PPQ_mod === 0)
            last = K / (start + inc*i);
        cumulative += last;
    }
    ms = cumulative;
    beats.push(ms);

    return {start, end, timesig, denom, beats, ms, ticks, offset: features.offset};
}

//TODO
/**
 * @param {Measure}         meas        
 * @param {Array<string>}   param 
 * @param {Object}          schema          
 * @function
 * @returns {Object}                            Event object 
 */
export const EventCalc = (meas, param, schema, PPQ) => {
    let data = param[1].replace(/ /g, '').split(':');
    let frac = data[1].split('/').map(n=>parseInt(n,10));
    let event = {
        meas, note: frac[1],
        dur: data[0],
        nominal: param.slice(1)
    };

    // create dummy schema to set local note division,
    // or pass on schema division.
    let div, beat_dur;
    if (!schema) {
        div = meas.denom / frac[1];
        beat_dur = meas.denom / parseInt(event.dur, 10);
        schema = { beat_start: 0, basis: frac[1] };
    } else {
        div = schema.beat_dur / schema.tuplet[0];
        beat_dur = schema.basis / parseInt(event.dur, 10) * div;
        event.schema = schema;
    }
    let PPB = (4/meas.denom) * PPQ;
    Object.assign(event, {
        beat: frac[0] * (schema.basis / frac[1]),
        beat_dur,
        beat_start: schema.beat_start + div * (frac[0]-1)
    });

    event.tick_start = event.beat_start * PPB;
    event.tick_dur = event.beat_dur * PPB;

    return event;
}

/**
 * @param {string}      nominal        
 * @param {Object}      parent 
 * @param {number}      denom          
 * @param {number}      PPQ
 * @function
 * @returns {Object}    Schema object 
 */
export const SchemaCalc = (nominal, parent, denom, PPQ) => {
    let schema = {};

    console.log(nominal);
    let frac = nominal[1].split('/').map(s => parseInt(s,10));
    // correct 1-indexed frac
    frac[0]--;
    let tuplet, basis;
    [tuplet, basis] = nominal[0].split('-');
    schema.tuplet = tuplet.split('/').map(s => parseInt(s,10));
    schema.basis = parseInt(basis, 10);
    schema.nominal = nominal;

    if (parent) {
        schema.parent = parent;
        let ratio = parent.basis / frac[1];
        let div = parent.beat_dur / parent.tuplet[0];
        schema.beat_start = div * frac[0] * ratio + parent.beat_start;
        schema.beat_dur = div * schema.tuplet[1] * ratio;
    } else {
        schema.beat_start = frac[0]/frac[1] * denom;
        schema.beat_dur = (1/schema.basis) * schema.tuplet[1] * denom;
    }
    schema.beat_end = schema.beat_start + schema.beat_dur;

    let PPB = (4/denom) * PPQ;
    schema.tick_start = schema.beat_start * PPB;
    schema.tick_end = schema.beat_end * PPB;
    let div = (schema.tick_end - schema.tick_start)/schema.tuplet[0];
    schema.tick_beats = Array.from({length: schema.tuplet[0]}, 
        (__,i) => schema.tick_start + i*div);

    return schema;
}

/**
 * Sort a given Object by one of its orderable keys.
 * @param {Object}      obj     The object to be sorted 
 * @param {string}      key     The key to sort by
 * @function
 * @returns {Array<number>}     An array of sorted values for the given key     
 */
export const order_by_key = (obj, key) => {
    var merge = (arrL, arrR) => {
        let lI = 0, rI = 0, sorted=[];
        while (lI < arrL.length && rI < arrR.length)
            sorted.push((arrL[lI][key] < arrR[rI][key]) ?
                arrL[lI++] : arrR[rI++]);
        return sorted.concat(arrL.slice(lI)).concat(arrR.slice(rI));
    };

    var sort = (arr) => {
        let m = Math.floor(arr.length / 2);
        return (m ?
            merge(sort(arr.slice(0, m)), sort(arr.slice(m)))
            : arr);
    };

    return sort(Object.keys(obj).map(key => obj[key]));
};

/**
 * Determine the closest proximity element of an array by key.
 * @param {Object}          obj     The candidate object 
 * @param {Array<Object>}   arr     The array for comparison
 * @param {string}          key     The key used to measure distance
 * @function
 * @returns {number}        The index of the closest object      
 */
export const check_proximity_by_key = (obj, arr, key) => {
    let gap = [-1, Infinity];
    let last_gap = [-1, Infinity];
    arr.some((candidate, ind) => {
        gap = [ind, Math.abs(obj[key] - candidate[key])];
        if (last_gap[1] < gap[1])
            return true;
        last_gap = [ind, gap[1]];
        return false;
    });
    return last_gap[0];
};

/**
 * Toggle a bit on and off.
 * @param {number}      num     The original number 
 * @param {number}      item    The target bit 
 * @function
 * @returns {number}    The modified number
 */
export const bit_toggle = (num, item) => num ^ (1 << item);

/**
 * Count the positive bits in a number.
 * @param {number}      n   The number 
 * @function
 * @returns {number}    The number of positive bits in n
 */
export const parse_bits = (n) => {
    let bits = [];
    let counter = 0;
    while(n) {
        if (n & 1)
            bits.push(counter);
        n = n >> 1;
        counter += 1;
    };
    return bits;
};

