/**
 * @fileOverview    Code for the Window class
 * @author          J Kusel
 * @requires        ../config/CONFIG.json
 */

import c from '../config/CONFIG.json';
import { primary, secondary, secondary_light, secondary_light2 } from '../config/CONFIG.json';
import { colors } from 'bandit-lib';
import { crowding, abs_location, tempo_edit } from '../Util/index.js';
import { NUM, LETTERS, LEFT, RIGHT, DEL, BACK, PERIOD } from './keycodes';
import _ from 'lodash';

/**
 * Window class dependency injection for p5js
 * @param {Object}  p   p5js Object
 *
 * @function
 * @returns {Object}    {@link Window}
 */
export default (p) => {
    /** Class containing p5js state info, display info, and draw methods. */
    class Window {
        /** Initialize the Window */
        constructor() {
            /** Zoom ratio 
             *  @type {number} 
             */
            this.scale = 1.0;
            /** Location of the left bound of the window in milliseconds
             * @type {number}
             */
            this.viewport = 0;
            /** Y-axis scroll location in pixels
             * @type {number}
             */
            this.scroll = 0;

            this.span = [Infinity, -Infinity];
            /** Location of the mouse cursor in milliseconds
             * @type {number}
             */
            this.cursor_loc = 0;
            this.isPlaying = false;

            // modes: ESC, INS, EDITOR
            this.mode = 0;
            this.panels = false;
            this.selected = Object.assign({}, {inst: -1, meas: false});
    
            this.insts = 0;
            this.mods = {};

            this.entry = {};
            this.insertMeas = {};
            this.copied = [];
            this.pasteMeas = [];
            this.editMeas = {};
            this._lockingCandidate = null;
            this.range = { tempo: [0, 100] };
            this.rangeRefresh = () => {};

            this.printTemp = {};

            this.updateViewCallback = () => null;
            this.POLL_FLAG = null;
            this.modulation = null;

            this.editor = {};
            /** Info for instrument name input
             * @type {Object}
             */
            this.instName = {};
            this.menu_open = false;
            this.menus = [];

            this.markers = {};
            this.temp_marker = {};

            this.loop = {
                start: 0,
                end: 2000,
                cache: {
                    start: 0,
                    end: 2000,
                },
                active: true
            };

            // monkey patch selection color
            let sel_color = p.color(colors.contrast);
            sel_color.setGreen(140);
            sel_color.setAlpha(30);
            colors.selected_inst = sel_color;
        }

        /* what does a lock look like
         * {
         *  beat
         *  type
         * }
         */

        /** Calculates complete measure information
         * @param {number}  start   Measure starting tempo
         * @param {number}  slope   Measure tempo slope
         * @param {number}  timesig Measure time signature numerator
         * @param {number}  denom   Measure time signature denominator
         * @returns {Object}        Calculated beats/ticks/length in ms
         */
        completeCalc(start, slope, timesig, denom) {
            let divisor = denom/4;
            let tick_total = timesig * this.CONSTANTS.PPQ / divisor;
            let inc = slope/tick_total;
            let last = 0;
            let ms = 0;
            var PPQ_mod = this.CONSTANTS.PPQ / this.CONSTANTS.PPQ_tempo;
            let local_PPQ = this.CONSTANTS.PPQ / divisor;
            let beats = [];
            let ticks = [];
            for (let i=0; i<tick_total; i++) {
                if (!(i%local_PPQ))
                    beats.push(ms);
                ticks.push(ms);
                if (i%PPQ_mod === 0) 
                    last = this.CONSTANTS.K / (start + inc*i);
                ms += last;
            };
            beats.push(ms);
            return { beats, ticks, ms }
        }

        // TODO
        change_modulation(keyCode, released) {
            let target = 'div' + this.modulation.zone;
            /*if (released) {
                delete this.modulation[target];
                return;
            }*/
            let index = 'tuplet_zone' in this.modulation ?
                this.modulation.tuplet_zone : 0;
            let num = NUM.indexOf(p.keyCode);
            if (!(target in this.modulation))
                this.modulation[target] = [0, 0];
            this.modulation[target][index] = num;
            this.calc_metric_modulation();
        }

        // TODO
        calc_metric_modulation() {
            let mod = this.modulation;
            if (this.modulation && 'indexLeft' in this.modulation && 'indexRight' in this.modulation) {
                let base = this.modulation.base;
                let tuplet_mods = [
                    'menuLeft' in mod ? mod.divLeft[0] / mod.divLeft[1] : 1,
                    'menuRight' in mod ? mod.divRight[0] / mod.divRight[1] : 1,
                ];
                this.modulation.next = 
                    (base * 
                        Math.pow(2, this.modulation.indexLeft-1) * 
                        (tuplet_mods[0])
                    ) / (
                        Math.pow(2, this.modulation.indexRight-1) * 
                        (tuplet_mods[1])
                    );

                if (this.editor.type) {
                    this.editor.hover_next_number = this.modulation.next;
                    this.editor.hover_next_string = this.modulation.next.toString();
                }
                return;
            }
            if ('next' in this.modulation)
                delete this.modulation.next;
            return null;
        }

        // TODO
        toggle_entry() {
            this.entry = this.entry.mode ? {} : {
                mode: true, duration: 2,
                tuplet: ["1","1"]
            };
        }

        // TODO
        toggle_menu(target) {
            this.menu_open = target || false;
        }

        // TODO
        press_menu(drag) {
            this.menus[this.menu_open].press(drag);
            this.toggle_menu();
        }

        toggle_entry_tuplet() {
            this.entry.tuplet_target ^= 1;
            delete this.entry.timer;
        }

        initialize_menus(menus) {
            this.menus = menus;
        }

        change_entry_tuplet(input) {
            let num = NUM.indexOf(input);
            if (num < 0) return;
            num = num.toString();
            if (this.entry.timer)
                this.entry.tuplet[this.entry.tuplet_target] += num
            else {
                this.entry.tuplet[this.entry.tuplet_target] = num;
                this.entry.timer = p.frameCount + 60;
            }
        }

        change_entry_duration(input) {
            let num = NUM.indexOf(input);
            if (num < 0) return;
            this.entry.duration = num;
        }

        press_event(rollover) {
            // needs: meas, tick
            // start point confirmed, end point still variable
            let event = _.pick(rollover, [
                'meas', 'beat_start', 'beat_dur',
                'tick_start', 'tick_dur', 'schema',
                'nominal', 'place', 'beat', 'note'
            ]);
            Object.assign(this.entry, {
                event, tuplet_target: 0,
                tuplet: ['1','1']
            });
            //event.tuplet = this.entry.tuplet.map(t=>parseInt(t,10));;
        }

        confirm_event() {
            let event = this.entry.event;
            event.tuplet = this.entry.tuplet.map(t=>parseInt(t,10));
            event.basis = Math.pow(2, this.entry.duration);

            delete this.entry.event;
            this.entry.tuplet = ["1","1"];
            this.entry.tuplet_target = 0;

            return event;
        }

        press_marker() {
            let origin = this.x_to_ms(p.mouseX-c.PANES_WIDTH);
            this.temp_marker = { origin, start: origin, placed: false };
            this.temp_marker.cache = this.calculate_marker_cache(this.temp_marker);
        }

        drag_marker(dist) {
            let dist_ms = dist / this.scale;
            let m = this.temp_marker;
            if (Math.abs(dist_ms) > c.MARKER_THRESHOLD) {
                let final = m.origin + dist_ms;
                m.start = Math.min(final, m.origin);
                m.end = Math.max(final, m.origin);
            } else {
                delete m.end;
                m.start = m.origin;
            }
            this.temp_marker.cache = this.calculate_marker_cache(this.temp_marker);
        }

        release_marker() {
            this.temp_marker.placed = true;
            this.temp_marker.name = '';
            this.temp_marker.pointer = 0;
        }

        name_marker(input) {
            let m = this.temp_marker;
            let del = () =>
                (m.pointer !== 0) &&
                    (m.name =
                        m.name.slice(0, m.pointer - 1)
                        + m.name.slice(m.pointer--));
            switch (input) {
                case DEL:
                    del();
                    break;
                case BACK:
                    del();
                    break;
                case LEFT:
                    (m.pointer !== 0) && m.pointer--;
                    break;
                case RIGHT:
                    (m.pointer < m.name.length) && m.pointer++;
                    break;
                default:
                    let char;
                    if (input in LETTERS)
                        char = LETTERS[input]
                    else {
                        let num = NUM.indexOf(input);
                        if (num >= 0)
                            char = num
                    }
                    m.name = m.name.slice(0, m.pointer) + char +
                        m.name.slice(m.pointer++);
            }
        }

        reset_marker() {
            this.temp_marker = {};
        }

        drag_loop(side, closest) {
            let update = this.x_to_ms(p.mouseX - c.PANES_WIDTH);
            let close = closest(update);
            if (Math.abs(close.gap*this.scale) <= 20)
                update = close.target;

            // restrict loop change relative to other side
            this.loop[side] = side === 'start' ?
                Math.min(update, this.loop.end) :
                Math.max(update, this.loop.start);
            this.calculate_loop_cache();
        }

        /**
         * Initialize instrument name input Object ([instName]{@link Window#instName}).
         * @param {number}  inst    Target instrument index
         * @param {string}  oldName Former instrument name (for reversion)
         */
        enter_instName(inst, oldName) {
            this.instName = {
                inst,
                oldName,
                next: oldName,
                pointer: oldName.length
            };
        }

        /**
         * Perform callback for instrument name change and reset [instName]{@link Window#instName}
         */
        exit_instName(cb) {
            if (cb)
                cb(this.instName);
            this.instName = {};
        }

        enter_editor(type, inst, meas) {
            let types = ['start', 'end', 'timesig', 'denom'];
            if (types.indexOf(type) > -1) {
                let next = {};
                let hover_next_number = null;
                let hover_next_string = null;
                let pointers = {};
                types.forEach(t => {
                    let str = meas[t].toString();
                    next[t] = str;
                    pointers[t] = str.length;
                });
                this.editor = { 
                    type, inst, meas, next,
                    hover_next_number, hover_next_string,
                    pointers, timer: null, 
                    old_range: this.range,
                    temp_offset: meas.offset
                };
                // this could be a problem here?
                this.initialize_temp(this.editor.meas);
                return true;
            }
            return false;
        }

        editor_hover(tempo) {
            if (typeof tempo !== 'number') {
                this.editor.hover_next_number = null;
                this.editor.hover_next_string = null;
                return;
            }
            this.editor.hover_next_number = tempo;
            this.editor.hover_next_string = tempo.toFixed(2).toString();
            let str_len = tempo.toString().length - 1;
            if (this.editor.pointers[this.editor.type] > str_len)
                this.editor.pointers[this.editor.type] = str_len;
        }

        // this is never used
        editor_pending_hover() {
            if (this.editor.hover_next_number) {
                let number = this.editor.hover_next_number;
                this.editor.next[this.editor.type] = number.toString();
                this.editor.pending = number;
            }
        }

        editor_reject_hover() {
            this.editor.hover_next_number = null;
            this.editor.hover_next_string = null;
        }

        editor_confirm_hover() {
            this.editor.next[this.editor.type] = this.editor.hover_next_string;
            this.editor_hover(null);
            this.start_editor_timer();
        }

        copy() {
            this.copied = this.getSelection().map(key => this.selected[key]);
        }

        enter_paste_mode() {
            this.pasteMeas = this.copied.map((copy, id) => {
                let meas = Object.assign(_.pick(copy, [
                    'inst', 'start', 'end', 'timesig',
                    'denom', 'offset', 'ms', 'beats', 'ticks'
                ]), { id });
                this.initialize_temp(meas);
                return meas;
            });
            console.log(this.pasteMeas);
        }

        confirm_paste(origin) {
            let pasting = this.pasteMeas.map(meas =>
                Object.assign(
                    _.pick(meas, ['inst', 'start', 'end', 'timesig', 'denom']),
                    { offset: origin + meas.center_offset }
                )
            );
            this.exit_paste_mode();
            return pasting;
        }

        exit_paste_mode() {
            this.pasteMeas = [];
            console.log(this.copied);
        }

        set_polling_flag(type) {
            this.POLL_FLAG = type || null;
        }

        /** Handle a keystroke when instrument name input is focused. Modifies [instName]{@link Window#instName}.
         * @param {number}  input   Numerical keyCode of the keyboard event
         */
        change_instName(input) {
            let num = NUM.indexOf(p.keyCode);
            let letter = LETTERS[p.keyCode];

            let entry = '';
            if (num > -1)
                entry = num
            else if (letter)
                entry = letter;

            let next = this.instName.next;
            let pointer = this.instName.pointer;
            if (entry) {
                this.instName.next = next.slice(0, pointer)
                    + entry
                    + next.slice(pointer)
                this.instName.pointer++;
            } else if (input === DEL || input === BACK) {
                if (pointer !== 0) {
                    this.instName.next =
                        next.slice(0, pointer - 1)
                        + next.slice(pointer);
                    this.instName.pointer--;
                }
            } else if (input === LEFT)
                this.instName.pointer = Math.max(0, pointer - 1)
            else if (input === RIGHT)
                this.instName.pointer = Math.min(pointer + 1, next.length);
        }




        change_editor(input) {
            let num = NUM.indexOf(p.keyCode);

            let type = this.editor.type;
            let next = this.editor.next[type];
            let pointer = this.editor.pointers[type];

            if (num > -1) {
                this.editor.next[type] = 
                    next.slice(0, pointer)
                    + num
                    + next.slice(pointer);
                this.editor.pointers[type]++;
            } else if (input === PERIOD) {
                this.editor.next[type] = 
                    next.slice(0, pointer)
                    + '.'
                    + next.slice(pointer);
                this.editor.pointers[type]++;
            } else if (input === DEL || input === BACK) {
                if (pointer !== 0) {
                    this.editor.next[type] =
                        next.slice(0, pointer - 1)
                        + next.slice(pointer);
                    this.editor.pointers[type]--;
                }
            } else if (input === LEFT)
                this.editor.pointers[type] = Math.max(0, pointer - 1)
            else if (input === RIGHT)
                this.editor.pointers[type] = Math.min(pointer + 1, next.length);
            this.editor.next[type] ? this.start_editor_timer() : this.start_editor_timer(true);
        }

        start_editor_timer(clear) {
            this.editor.timer = clear ? null : p.frameCount + (2 * 10);
        }


        recalc_editor() {
            console.log(Object.assign({}, this.editor));
            let locks = this.editor.meas.locks;
            let selected = this.editor.meas.temp || this.editor.meas;
            let updated = Object.keys(this.editor.next).reduce(
                (acc, key) => Object.assign(acc, { [key]: parseFloat(this.editor.next[key]) }), {});
            // check if anything's changed
            if (['start', 'end', 'timesig', 'denom'].some(p => {
                return (
                (updated[p] !== selected[p]) &&
                updated[p]
            )})) {
                var beat_lock = {};
                if (locks && Object.keys(locks).length) {
                    let lock = Object.keys(locks)[0];
                    beat_lock.beat = parseInt(lock, 10);
                    beat_lock.type = locks[lock];

                    // check if tempo locked somewhere
                    if (locks[lock] !== 'loc') {
                        // if start has changed
                        if (this.editor.type === 'start' && (updated.start !== selected.start))
                            this.editor.next.end = tempo_edit(selected, updated, beat_lock, 'start').end.toString()
                        // if end has changed
                        else if (this.editor.type === 'end' && (updated.end !== selected.end))
                            this.editor.next.start = tempo_edit(selected, updated, beat_lock, 'end').start.toString();
                    }
                }

                // calculate with new changes.
                // parse strings to numbers
                let next = Object.keys(this.editor.next).reduce((acc, key) => 
                    ({ ...acc, [key]: parseFloat(this.editor.next[key]) }), {});
                
                console.log(this.editor.next);
                console.log(next);
                let slope = next.end - next.start;
                let calc = this.completeCalc(next.start, slope, next.timesig, next.denom);
                Object.assign(calc, next); 

                // check for 'loc' locking and adjust offset
                //calc.offset = this.editor.temp_offset;
                console.log(this.editor.temp_offset);
                if (beat_lock.type === 'loc' || beat_lock.type === 'both')
                    this.editor.temp_offset += selected.beats[beat_lock.beat] - calc.beats[beat_lock.beat];

                calc.offset = this.editor.temp_offset;
                // assign to measure temp
                Object.assign(this.editor.meas, { temp: calc });

                // cache and assign to measure
                this.editor.meas.cache = this.calculate_cache(calc);
                this.editor.meas.cache.temp = true;

                console.log(this.editor.meas);

                // update score tempo range
                let [start, end] = [this.editor.next.start, this.editor.next.end].map(n => parseFloat(n));
                let [min, max] = start <= end ?
                    [start, end] : [end, start];
                this.updateRange({
                    temprange: [
                        Math.min(min, this.range.tempo[0]),
                        Math.max(max, this.range.tempo[1])
                    ]
                });
            }
        }

        exit_editor(revert, reversion_cb) {
            if (revert) {
                delete this.editor.meas.temp;
                this.editor.meas.cache = this.calculate_cache(this.editor.meas);
                reversion_cb();
            }
            this.editor = {};
        }

        validate_editor(calcGaps) {
            if (this.editor.meas)
                this.validate_measure(this.editor.meas, calcGaps, true);
        }

        validate_measure(meas, calcGaps, tempflag) {
            if (!meas.gaps)
                meas.gaps = calcGaps(meas.inst, meas.id);


            // i don't particularly like how invalid reference is set here
            let [offset, ms, invalid] = tempflag ?
                [meas.temp.offset, meas.temp.ms, meas.temp.invalid] :
                [meas.offset, meas.ms, meas.invalid];


            let crowd = crowding(meas.gaps, offset, ms, { strict: true, impossible: true });
            console.log(crowd);

            // is measure too big?
            let gap = crowd.end[0] - crowd.start[0];

            // invalid can be 'start', 'end', 'oversize'
            if (ms > gap) {
                console.log('too big');
                invalid.oversize = true;    
            }

            if (crowd.end[1] < 0) {
                invalid.end = crowd.end[1];
                meas.cache.invalid.end = crowd.end[1] * this.scale;
            }
                //updated.offset += crowd.end[1];
            // eventually this will need a left-expansion version
            if (crowd.start[1] < 0) {
                invalid.start = crowd.start[1];
                meas.cache.invalid.start = crowd.start[1] * this.scale;
                //updated.offset -= crowd.start[1];
            }

        }

        // GET RID OF SIDE EFFECTS
        calculate_cache(meas) {
            let cache = {
                offset: meas.offset*this.scale,
                beats: meas.beats.map(b => b * this.scale),
                ticks: meas.ticks.map(t => t * this.scale),
                ms: meas.ms*this.scale,
                temp: false,
                invalid: {}
            }

            if (!meas.invalid)
                meas.invalid = {};

            if (meas.invalid.start)
                cache.invalid.start = meas.invalid.start * this.scale;
            if (meas.invalid.end)
                cache.invalid.end = meas.invalid.end * this.scale;

            Object.assign(cache, this.calculate_tempo_cache(meas, cache));
            return cache;
        }

        calculate_entry_cache(cache, beat, duration) {
            let ms_start = abs_location(cache.ticks, cache.ms, beat);
            let returned = {
                ms_start,
                ms_dur: (abs_location(cache.ticks, cache.ms, beat+duration)
                    || cache.ms) - ms_start
            };
            return returned;
        }

        calculate_tempo_cache(meas, cache) {
            let obj = {
                graph: [],
                graph_ratios: [],
                markings: [],
                bounding: []
            };

            let FLAG_TEMP = ('temp' in meas);

            let start = FLAG_TEMP ? meas.temp.start : meas.start;
            let end = FLAG_TEMP ? meas.temp.end : meas.end;
            
            let range = this.range;

            let bottom = ('temprange' in range) ?
                (range.temprange[0] || range.tempo[0]) :
                range.tempo[0];
            let top = ('temprange' in range) ?
                (range.temprange[1] || range.tempo[1]) :
                range.tempo[1];
            let spread = top - bottom;

            let ystart = c.INST_HEIGHT - (start - bottom)/spread*c.INST_HEIGHT;
            let yend = c.INST_HEIGHT - (end - bottom)/spread*c.INST_HEIGHT;

            let last = [0, ystart];
            cache.beats.slice(1).forEach((beat, i) => {
                let next = [
                    beat, 
                    c.INST_HEIGHT - ((((i+1)/meas.timesig)*(end-start) + start) - bottom)/spread*c.INST_HEIGHT
                ];
                obj.graph.push(last.concat(next));

                let ratio = (last[1] - next[1])/(next[0] - last[0]);
                obj.graph_ratios.push(ratio);
                
                last = next;
            });

            // calculate tempo marking placement
            let sigfig = this.scale > 0.05 ? 2 : 0;
            let start_fixed = start.toFixed(sigfig);
            let start_fixed_len = start_fixed.toString().length;
            let end_fixed = end.toFixed(sigfig);
            let end_fixed_len = end_fixed.toString().length;

            let marking, bound;
            if (ystart > c.TEMPO_PT + c.TEMPO_PADDING) {
                marking = {
                    textAlign: [p.LEFT, p.BOTTOM],
                    text: [start_fixed, c.TEMPO_PADDING, ystart - c.TEMPO_PADDING]
                };
                bound = [
                    c.TEMPO_PADDING, marking.text[2] - c.TEMPO_PT, 
                    c.TEMPO_PADDING + c.TEMPO_PT * start_fixed_len, marking.text[2]
                ];
            } else {
                marking = {
                    textAlign: [p.LEFT, p.TOP],
                    text: [start_fixed, c.TEMPO_PADDING, ystart + c.TEMPO_PADDING]
                };
                bound = [
                    c.TEMPO_PADDING, marking.text[2], 
                    c.TEMPO_PADDING + c.TEMPO_PT * start_fixed_len, marking.text[2] + c.TEMPO_PT
                ];
            }
            obj.markings.push(marking);
            obj.bounding.push(bound);
            if (yend > c.TEMPO_PT + c.TEMPO_PADDING) {
                marking = {
                    textAlign: [p.RIGHT, p.BOTTOM],
                    text: [end_fixed, cache.ms - c.TEMPO_PADDING, yend - c.TEMPO_PADDING]
                };
                bound = [
                    marking.text[1] - c.TEMPO_PT * end_fixed_len, marking.text[2] - c.TEMPO_PT, 
                    marking.text[1], marking.text[2]
                ];
            } else {
                marking = {
                    textAlign: [p.RIGHT, p.TOP],
                    text: [end_fixed, cache.ms - c.TEMPO_PADDING, yend + c.TEMPO_PADDING]
                };
                bound = [
                    marking.text[1] - c.TEMPO_PT * end_fixed_len, marking.text[2], 
                    marking.text[1], marking.text[2] + c.TEMPO_PT
                ];
            }
            obj.markings.push(marking);
            obj.bounding.push(bound);

            // third bounding is the time signature
            // this is conditional on the renderer being ready to measure text (p._setupDone)


            let text_width = meas.timesig.toString().length * 14;
            
            
            if (this.scale > 0.03) {
                if (p._setupDone) {
                    p.push();
                    p.textSize(c.INST_HEIGHT*0.25);
                    text_width = p.textWidth(meas.timesig.toString()) * 0.5;
                    p.pop();
                }
                bound = [
                    c.TIMESIG_PADDING - text_width,
                    c.INST_HEIGHT * 0.25,
                    c.TIMESIG_PADDING + text_width,
                    c.INST_HEIGHT * 0.75
                ];
            } else {
                if (p._setupDone) {
                    p.push();
                    p.textSize(c.INST_HEIGHT*0.1);
                    text_width = (this.scale > 0.02) ?
                        p.textWidth(meas.timesig.toString() + '/4')
                        : p.textWidth(meas.timesig.toString()); 
                    p.pop();
                }
                let HALF_PAD = c.TIMESIG_PADDING * 0.5;
                bound = [0, 0, text_width, c.INST_HEIGHT*0.1]
                    .map(b => b + HALF_PAD);
            }

            obj.bounding.push(bound);
            return obj;
        }

        calculate_schema_cache(cache, schema) {
            let abs = (loc) => abs_location(cache.ticks, cache.ms, loc);
            return ({
                ms_start: abs(schema.tick_start),
                ms_end: abs(schema.tick_end)
                    || cache.ms,
                ms_beats: schema.tick_beats.map(b => abs(b))
            });
        }

        calculate_event_cache(cache, event) {
            let abs = (loc) => abs_location(cache.ticks, cache.ms, loc);
            let ms_start = abs(event.tick_start);
            return {
                ms_start,
                ms_dur: abs(event.tick_start + event.tick_dur) - ms_start
            };
        }

        event_system_cache(meas) {
            if (meas.schemas) {
                let search = (s) => {
                    if (!s)
                        return;
                    s.cache = this.calculate_schema_cache(meas.cache, s);
                    if (s.schemas)
                        s.schemaIds.forEach(id => search(s.schemas[id]))
                }
                meas.schemaIds.forEach(id => search(meas.schemas[id]));
            }
            if (meas.events)
                meas.events.forEach(event =>
                    event.cache = this.calculate_event_cache(meas.cache, event));
        }

        calculate_marker_cache(marker) {
            let cache = { start: marker.start * this.scale };
            if (marker.end)
                cache.end = marker.end * this.scale;
            return cache;
        }

        calculate_loop_cache() {
            this.loop.cache.start = this.loop.start * this.scale;
            this.loop.cache.end = this.loop.end * this.scale;
        }

        setRangeRefresh(refresh) {
            this.rangeRefresh = refresh;
        }

        updateRange(new_range) {
            if ('temprange' in this.range)
                delete this.range.temprange;
            Object.assign(this.range, new_range);
            this.rangeRefresh();
        }

        updateCursorLoc() {
            let mouse = (p.mouseX - this.viewport)/this.scale - c.PANES_WIDTH;
            let cursor_loc = [parseInt(Math.abs(mouse / 3600000), 10)];
            cursor_loc = cursor_loc.concat([60000, 1000].map((num) =>
                parseInt(Math.abs(mouse / num), 10).toString().padStart(2, "0")))
                .join(':');
            cursor_loc += '.' + parseInt(Math.abs(mouse % 1000), 10).toString().padStart(3, "0");
            if (mouse < 0.0)
               cursor_loc = '-' + cursor_loc;
            this.cursor_loc = cursor_loc;
        }

        ms_to_x(ms) {
            return (ms*this.scale + this.viewport);
        }

        x_to_ms(x) {
            return (x - this.viewport) / this.scale;
        }

        printAdjust({ start, end }) {
            if (start)
                this.printTemp.start = start;
            if (end)
                this.printTemp.end = end;
        }

        printCancel() {
            this.printTemp = {};
        }

        printDraw(frames, instHeight) {
            // print temp
            if (this.printTemp !== {}) {
                p.push()
                    p.translate(this.ms_to_x(this.printTemp.start), c.PLAYBACK_HEIGHT);
                    let sib_color = p.color(colors.contrast_light);
                    sib_color.setAlpha(0.25 * 255);
                    p.fill(sib_color);
                    p.rect(0, 0, this.ms_to_x(this.printTemp.end) - this.ms_to_x(this.printTemp.start), instHeight);
                    p.both(colors.secondary);
                    p.push();
                        p.strokeWeight(4);
                        p.line(2, 2, 10, 10);
                        p.line(2, 10, 10, 2);
                    p.pop()
                    p.translate(14, 0);
                    p.textAlign(p.LEFT, p.TOP);
                    p.text(parseInt(Math.abs(this.printTemp.end - this.printTemp.start), 10), 0, 0);
                p.pop();
            }
            Object.keys(frames).forEach(key => {
                let frame = frames[key];
                p.push();
                    p.translate(this.ms_to_x(frame.start), c.PLAYBACK_HEIGHT);
                    let sib_color = p.color(colors.contrast_light);
                    sib_color.setAlpha(0.50 * 255);
                    p.fill(sib_color);
                    p.rect(0, 0, this.ms_to_x(frame.end) - this.ms_to_x(frame.start), instHeight);
                    p.both(colors.secondary);
                    p.push();
                        p.strokeWeight(4);
                        p.line(2, 2, 10, 10);
                        p.line(2, 10, 10, 2);
                    p.pop()

                    p.translate(14, 0);
                    p.textAlign(p.LEFT, p.TOP);
                    p.text(parseInt(frame.end - frame.start, 10), 0, 0);
                p.pop();
            });
            p.push();
                p.translate(p.width-300, instHeight + c.PLAYBACK_HEIGHT);
                let sib_color = p.color(colors.contrast);
                sib_color.setAlpha(0.50 * 255);
                p.fill(sib_color);
                p.rect(0, 0, 300, c.INST_HEIGHT);
                p.both(colors.secondary);
                p.push();
                    p.translate(14, 14);
                    p.textAlign(p.LEFT, p.TOP);
                    p.text(`${Object.keys(frames).length} pages ready for export.`, 0, 0);
                    // exit button
                    p.push();
                        p.strokeWeight(4);
                        p.translate(-22, 0);
                        p.line(286, 0, 294, 8);
                        p.line(286, 8, 294, 0);
                    p.pop()
                    // confirm/clear buttons
                    p.translate(0, 14 + 12);
                    p.rect(0, 0, 50, 20);
                    p.rect(60, 0, 50, 20);
                    p.both(colors.primary);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.text('confirm', 25, 10);
                    p.text('clear', 85, 10);
                p.pop()
            p.pop();
        }


        locking(candidate, beat) {
            if (typeof(beat) !== 'number')
                return false;
            if ('locks' in candidate) {
                // toggle off if found
                if (beat in candidate.locks) {
                    delete candidate.locks[beat];
                    return false;
                } else
                    candidate.locks[beat] = null;
            } else
                candidate.locks = { [beat]: null }
            this._lockingCandidate = beat;
            return true;
        }

        lockConfirm(candidate, type) {
            let beat = this._lockingCandidate;
            if (!type)
                delete candidate.locks[beat]
            else if (beat !== null)
                candidate.locks[beat] = type;
            this._lockingCandidate = null;
        }

        initialize_temp(meas) {
            console.log('INITIALIZED');
            let sel = meas || this.selected[meas.id];
            
            sel.temp = _.pick(sel, [
                'start', 'end', 'ms', 'ticks', 'beats',
                'offset', 'timesig', 'denom'
            ]);

            sel.cache = this.calculate_cache(sel);
        }

        setUpdateViewCallback(cb) {
            this.updateViewCallback = cb;
        }

        updateView(event, { zoom }) {
            if (zoom) {
                let dabs = Math.abs(event.delta);
                let delta = dabs >= 100 ? dabs/event.delta*10 : event.delta;
                let change = 1.0-delta/c.SCROLL_SENSITIVITY;
                this.scale *= change;
                this.viewport = p.mouseX - change*(p.mouseX - this.viewport);
            };
            this.viewport -= event.deltaX;

            let frame_height = (p.height - c.PLAYBACK_HEIGHT - c.TRACKING_HEIGHT);
            if (!zoom) {
                if (frame_height > this.insts*c.INST_HEIGHT) {
                    this.scroll = 0;
                    return;
                } else {
                    this.scroll += event.deltaY;
                    if (this.scroll < 0)
                        this.scroll = 0;
                    if (this.scroll > this.insts*c.INST_HEIGHT - frame_height + 28 + (this.panels ? c.INST_HEIGHT : 0))
                        this.scroll = this.insts*c.INST_HEIGHT - frame_height + 28 + (this.panels ? c.INST_HEIGHT : 0);
                }
            }

            this.updateViewCallback(this.viewport, this.scale, this.scroll);
        }
        
        drawSchemas(measure, rollover, depth) {
            /*if (!rollover.schema)
                return;
                */
            measure.schemaIds.forEach(id => {
                let schema = measure.schemas[id];
                let start = schema.cache.ms_start;
                let end = schema.cache.ms_end;

                p.push();
                let col = p.color(colors.contrast_lighter);
                if (rollover.schema === schema) {
                    col = p.color(colors.accent);
                    // draw X
                    p.push();
                    p.both(colors.primary);
                    p.textAlign(p.CENTER, p.CENTER);
                    // offset X to avoid tempo indicators
                    if (rollover.schema_info) {
                        let ro = rollover.schema_info;
                        if (ro.schemaX)
                            p.both(colors.accent);
                        let x = ro.schema_pos === 'left' ?
                            schema.cache.ms_start + 8 : schema.cache.ms_end - 8;
                        p.text('X', x, 8);
                    }
                    p.pop();
                }
                col.setAlpha(100);
                p.both(col);
                p.rect(start, 0, end-start, c.INST_HEIGHT);
                // draw text
                let tuplet = schema.tuplet.join(':');
                p.both(colors.primary);
                p.textStyle(p.ITALIC);
                p.textSize(12);
                
                // version two
                p.textAlign(p.LEFT, p.BOTTOM);
                let col2 = p.color(colors.primary);
                if (this.scale < 0.3)
                    (this.scale > 0.15) ?
                        col2.setAlpha(255 * (this.scale-0.15)/0.15) :
                        col2.setAlpha(0);
                p.both(col2);
                p.translate(0, c.INST_HEIGHT - (depth)*8)
                p.text(tuplet, start+4, -4);
                schema.cache.ms_beats.forEach(b =>
                    p.line(b, -12, b, -4));
                p.line(start, -4, end-4, -4);

                // version one
                /*p.textAlign(p.CENTER, p.CENTER);
                let y = (depth+1)*8;
                p.text(tuplet, halfway, y);
                let t_width = p.textWidth(tuplet)+16;
                p.line(start+y, y, halfway-t_width/2, y);
                p.line(start+y, y, start+y, y+8);
                p.line(halfway+t_width/2, y, end-y, y);
                p.line(end-y, y, end-y, y+8);
                */

                p.pop();
                if (schema.schemas)
                    this.drawSchemas(schema, rollover, depth+1);
            });
        }

        drawMenu(hover) {
            this.menus[this.menu_open].draw([p.mouseDown.x, p.mouseDown.y], hover);
        }

        drawMarker(m, hover) {
            p.push();
            let start = this.viewport + m.cache.start;
            p.translate(start, 0);
            p.quad(0, 0, -20, 0, -20, 16, 0, c.PLAYBACK_HEIGHT);
            if ('end' in m) {
                p.push();
                let light = p.color(colors.primary);
                light.setAlpha(hover ? 200 : 100);
                p.both(light);
                let width = m.cache.end - m.cache.start;
                p.rect(0, 0, width, c.PLAYBACK_HEIGHT);
                p.pop();
                p.translate(width, 0);
            }
            p.quad(0, 0, 20, 0, 20, 16, 0, c.PLAYBACK_HEIGHT);
            // draw X
            if (hover) {
                p.both(colors.secondary); 
                p.push();
                p.translate(-6, 6);
                p.rotate(p.PI * 0.25);
                p.textAlign(p.CENTER, p.CENTER);
                //p.textAlign(p.LEFT, p.TOP);
                p.text('+', 0, 0);
                p.pop();
            }
            p.pop();
            if (m.placed || m.name) {
                p.push();
                ('end' in m) ?
                    p.textAlign(p.LEFT, p.TOP) :
                    p.textAlign(p.CENTER, p.TOP);
                p.translate(start + ('end' in m ? 4:0), 2);
                p.both(colors.secondary);
                p.text(m.name, 0, 0);
                if (m.placed && (p.millis() % 1000 > 500)) {
                    let w = p.textWidth(m.name.slice(0, m.pointer));
                    if (!m.cache.end)
                        w -= p.textWidth(m.name) * 0.5;
                    p.line(w, 0, w, 12);
                }
                p.pop();
            }
        }

        drawMarkers(ro) {
            p.push();
            let col = p.color(colors.primary);
            col.setAlpha(200);
            p.both(col);
            if ('start' in this.temp_marker)
                this.drawMarker(this.temp_marker);
            Object.keys(this.markers).forEach(key => {
                let hover = ro.marker && ro.marker.start.toString() === key;
                this.drawMarker(this.markers[key], hover);
            });
            p.pop();
        }

        drawLoop(ro) {
            let cache = this.loop.cache;
            if ((cache.start < 0 && cache.end < 0) ||
                (cache.start > p.windowWidth && cache.end > p.windowWidth)
            ) return;
            p.push();
            p.translate(cache.start + this.viewport, c.PLAYBACK_HEIGHT);
            p.strokeWeight(4);
            let col = p.color(colors.accent);
            p.strokeCap(p.SQUARE);
            p.both(col);
            p.line(0, 0, cache.end - cache.start, 0);
            p.strokeWeight(1);
            if (this.isPlaying || ro.type === 'loop') {
                p.push();
                if (ro.side === 'start') {
                    col.setAlpha(100);
                    p.fill(col);
                }
                p.circle(0, 0, 8);
                p.pop();
                col.setAlpha(255);
                p.push();
                if (ro.side === 'end') {
                    col.setAlpha(100);
                    p.fill(col);
                }
                let last = cache.end - cache.start;
                p.circle(last, 0, 8);
                p.pop();
                p.push();
                let gradient_width = 24;
                let start = p.color(colors.accent);
                let end = p.color(colors.accent);
                start.setAlpha(20);
                end.setAlpha(0);
                while (gradient_width--) {
                    p.stroke(p.lerpColor(start, end, gradient_width/10))
                    p.line(gradient_width, 0, gradient_width, p.windowHeight);
                    p.line(last - gradient_width, 0, last - gradient_width, p.windowHeight);
                }
                end.setAlpha(10);
                p.fill(end);
                p.rect(gradient_width, 0, last - gradient_width*2, p.windowHeight);
                p.pop();

            }
            p.pop();
        }

        drawEvent(event, ro) {
            let position = event.cache.ms_start;
            let duration = event.cache.ms_dur;
            p.push();
            p.translate(0, c.INST_HEIGHT * 0.5);
            let col = p.color(colors.contrast);
            col.setAlpha(100);
            if (ro && ro.event && ro.event.beat_start === event.beat_start)
                col.setAlpha(200);

                    
            p.both(col);
            let height = c.INST_HEIGHT / 3;
            p.rect(position, -height*0.2, duration, height*0.4);
            col.setAlpha(200);
            p.both(col);
            p.rect(position-2, -height*0.5, 4, height);
            p.pop();
        };

        drawEntryTuplet() {
            if (this.entry.timer && this.entry.timer < p.frameCount)
                delete this.entry.timer;
            p.push();
            p.translate(p.mouseX - c.PANES_WIDTH + 20, p.mouseY - 20);
            p.textAlign(p.CENTER, p.CENTER);
            p.both(primary);
            p.text(':', 0, 0);
            p.textAlign(p.LEFT, p.CENTER);
            let width = [0,1].map(i => p.textWidth(this.entry.tuplet[i]));
            if (this.entry.tuplet_target === 0) {
                p.rect((-width[0])-3, -7, width[0]+1, 14); 
                p.both(secondary);
            } else {
                p.rect(4, -7, width[1]+1, 14); 
            }
            p.text(this.entry.tuplet[0], (-width[0]-2), 0);
            let col = (this.entry.tuplet_target === 0) ? primary : secondary;
            p.both(col);
            p.text(this.entry.tuplet[1], 4, 0);
            p.pop();
        }

        drawLockMenu(type) {
            p.push();
            p.translate(p.mouseDown.x, p.mouseDown.y);

            p.both(primary);
            p.rect(-45, -10, 35, 20);
            p.rect(10, -10, 35, 20);
            p.rect(-17, -20, 35, 20);
            p.both(secondary)
            p.textSize(10);
            p.textAlign(p.CENTER, p.CENTER);
            p.text('loc', -27, 0);
            p.text('tempo', 27, 0);
            p.text('both', 0, -10);

            if (type === 'both') {
                p.stroke(primary);
                p.rect(-17, -20, 35, 20);
                p.fill(primary);
                p.text('both', 0, -10);
            } else if (type === 'loc') {
                p.stroke(primary);
                p.rect(-45, -10, 35, 20);
                p.fill(primary);
                p.text('loc', -27, 0);
            } else if (type === 'tempo') {
                p.stroke(primary);
                p.rect(10, -10, 35, 20);
                p.fill(primary);
                p.text('tempo', 27, 0);
            }
            p.pop();
        }

        drawPlayback(ro) {
            // DRAW TOP BAR
            p.both(secondary);
            p.rect(0, 0, p.width, c.PLAYBACK_HEIGHT);

            p.push();
            p.translate(c.PANES_WIDTH, 0);
            let zoom_thresholds = [0.0025, 0.01, 0.03, 0.1, 0.5, 1.0, 2.0];
            let zoom_values = [30000, 5000, 1000, 500, 100, 20, 10];
            let formats = [
                (m, s, ms) => `${m}'${s}"`,
                (m, s, ms) => `${m}.${s}:${ms}`,
            ];
            let zoom_formatting = [0,0,1,1,1,1,1];
            zoom_thresholds.some((thresh, i) => {
                if (this.scale > thresh)
                    return false;
                let inc = 0,
                    loc = 0,
                    bias = (((this.viewport/this.scale) % zoom_values[i]) - zoom_values[i])*this.scale,
                    val = zoom_values[i]*this.scale,
                    text = Math.round((-this.viewport-Math.abs(bias))/this.scale);
                p.fill(0);

                p.textAlign(p.LEFT, p.TOP);
                p.textSize(10);
                while (loc < p.width) {
                    p.both(120);
                    loc = inc*val + bias;
                    inc += 1;
                    
                    if (!(text % (zoom_values[i]*5))) {
                        let abstext = Math.abs(text);
                        let min = Math.floor(abstext/60000);
                        let sec = ('0' + Math.floor((abstext-min*60000)/1000)).slice(-2);
                        let ms = ('00' + (abstext % 1000)).slice(-3);
                        let formatter = formats[zoom_formatting[i]];
                        p.text((text >= 0 ? '' : '-') + formatter(min, sec, ms), loc+3, 4);
                        p.line(loc, 10, loc, c.PLAYBACK_HEIGHT);
                    } else
                        p.line(loc, 15, loc, c.PLAYBACK_HEIGHT);
                    text += zoom_values[i];

                    p.stroke(200, 200, 200);
                    for (let v=1; v<5; v++) {
                        let subloc = loc + v*(val/5);
                        p.line(subloc, 20, subloc, c.PLAYBACK_HEIGHT);
                    }
                }
                return true;
            });

            p.line(0, c.PLAYBACK_HEIGHT, p.width, c.PLAYBACK_HEIGHT);
            p.stroke(255, 0, 0);
            p.line(this.viewport, 0, this.viewport, c.PLAYBACK_HEIGHT);
            let gradient_width = 50;
            p.pop();
            while (gradient_width--) {
                let start = p.color(secondary);
                let end = p.color(secondary);
                start.setAlpha(255);
                end.setAlpha(0);
                p.stroke(p.lerpColor(start, end, gradient_width/50))
                p.line(gradient_width, 0, gradient_width, c.PLAYBACK_HEIGHT);
                p.line(p.width - gradient_width, 0, p.width - gradient_width, c.PLAYBACK_HEIGHT);
            }
            // DROP SHADOW
            p.rect(c.PANES_WIDTH, c.PLAYBACK_HEIGHT + 1, p.width, 1);
            let shadow_start = p.color(0);
            let shadow_end = p.color(20);
            shadow_start.setAlpha(200);
            shadow_end.setAlpha(0);
            let depth = 5;
            while (depth--) {
                let s = p.lerpColor(shadow_start, shadow_end, depth/5);
                p.both(s);
                p.line(c.PANES_WIDTH, c.PLAYBACK_HEIGHT + depth + 1, p.width, c.PLAYBACK_HEIGHT + depth + 1);
            }

            p.push();
            p.translate(c.PANES_WIDTH, 0);
            this.drawMarkers(ro);
            this.drawLoop(ro);
            p.pop();
        }

        drawPrinter(pages) {
            p.push();
            p.translate(0, p.height - 150);
            Object.keys(pages).forEach(key => {
                // page === { center, spread, img }
                let page = pages[key];

                p.image(page.img, (page.center - page.spread[0])*this.scale + this.viewport, 0, 200, 100);
            });
            p.pop();
        }

        drawTimesig(numerator, denominator, meas) {
            let denom = typeof denominator === 'string' ?
                denominator : parseInt(denominator, 10);
            p.push();
            p.fill(100);

            let text = [];
            if (this.scale > 0.03) {
                p.translate(c.TIMESIG_PADDING, 0);
                p.textSize(c.INST_HEIGHT*0.25);
                p.textLeading(c.INST_HEIGHT*0.20);
                p.textAlign(p.CENTER, p.CENTER);
                text = [[numerator, denom].join('\n'), 0, c.INST_HEIGHT/2];
            } else {
                p.translate(c.TIMESIG_PADDING/2, c.TIMESIG_PADDING/2);
                p.textSize(c.INST_HEIGHT*0.1);
                p.textAlign(p.LEFT, p.TOP);
                if (this.scale > 0.02)
                    text = [[numerator, denom].join('/'), 0, 0];
                else 
                    text = [numerator, 0, 0];
            }
            if ('meas' in this.editor && this.editor.meas.id === meas.id) {
                let next = [this.editor.next.timesig, this.editor.next.denom];
                
                text[0] = (this.scale > 0.03) ?
                    next.join('\n') :
                    ((this.scale > 0.02) ? next.join('/') :
                        next[0]);

                // handle blinking
                let type = this.editor.type;
                if ((type === 'timesig' || type === 'denom') && ((p.millis() % 1000) > 500)) {
                    p.push();
                    p.stroke(0);
                    let textSize = this.scale > 0.03 ? c.INST_HEIGHT*0.25 : c.INST_HEIGHT * 0.1;
                    p.textSize(textSize);
                    let w = p.textWidth(next[type === 'timesig' ? 0 : 1].slice(0, this.editor.pointers[type]));
                    let bound = this.editor.meas.cache.bounding[2];
                    if (this.scale > 0.03) {
                        p.translate(c.TIMESIG_PADDING, 0);
                        w -= p.textWidth(next) * 0.5;
                        if (type === 'denom')
                            p.translate(0, textSize);
                        p.line(w, bound[1], w, bound[1] + textSize);
                    } else {
                        p.translate(c.TIMESIG_PADDING/2, 0);
                        p.line(w, bound[1], w, bound[3]);
                    }
                    p.pop();
                }
            }
            p.text(...text);
            p.pop();
        }

        resetSelection() {
            return Object.assign({}, {inst: -1, meas: false});
        }

        getSelection() {
            return Object.keys(this.selected).reduce((acc, key) => {
                return (['inst','meas','all','dir'].indexOf(key) > -1) ?
                    acc : acc.concat(key)
            }, []);
        }

        select(newSelected) {
            let add = this.mods.mod;
            if (newSelected === 'clear') {
                if (this.selected.inst === -1)
                    return false;
                this.selected = this.resetSelection();
                return true;
            }
            if ('meas' in newSelected) {
                let id = newSelected.meas.id;
                if (this.selected[id]) {
                    if (add) {
                        delete this.selected[id];
                        if (!this.getSelection().length)
                            this.selected.meas = false;
                        console.log(this.selected);
                        return true;
                    }
                    console.log(this.selected);
                    return false;
                } else {
                    add ?
                        this.selected[id] = newSelected.meas :
                        this.selected = Object.assign({ [id]: newSelected.meas }, this.resetSelection());
                    this.selected.meas = true;
                }
                this.editMeas = {};
                // HOW DO YOU DELETE TEMP HERE?
                //delete this.selected.meas.temp;
                console.log(this.selected);
                return true;
            } else {
                this.selected = this.resetSelection();
                this.selected.inst = newSelected.inst;
            }
            console.log(this.selected);
            //Object.assign(this.selected, newSelected);
            return false;
        }
     
        drawFrame() {
            // DRAW BACKGROUND
            p.both(secondary_light);
            p.rect(0, 0, p.width, p.height);
           
        
            // DRAW BOTTOM BAR
            p.both(secondary);
            p.rect(0, p.height - c.TRACKING_HEIGHT, p.width, c.TRACKING_HEIGHT);

            // DRAW SIDEBAR
            p.push();

        }

        drawTabs({ locator, cursor_loc }) {
            
            p.push();
            // draw tabs
            p.both(primary);

            p.translate(0, p.height - c.TRACKING_HEIGHT);
            p.rect(0, 0, p.width, c.TRACKING_HEIGHT);
            // left
            
            // LOCATION
            // left    

            p.push();
            p.both(secondary);
            p.textAlign(p.LEFT, p.TOP);
            p.textSize(10);
            p.text(this.isPlaying ? `LOCATION: ${Math.round(locator)}` : `CURSOR: ${cursor_loc}`,
                c.TRACKING_PADDING.X, c.TRACKING_PADDING.Y);
            // right
            p.textAlign(p.RIGHT, p.TOP);
            let _span = this.span.map(s => s.toFixed(2)); // format decimal places
            let len = _span[1]-_span[0];
            p.text(`${_span[0]} - ${_span[1]}, \u2248 ${Math.floor(len/60000.0)}'${Math.floor(len/1000.0) % 60}"`, p.width - c.TOOLBAR_WIDTH - c.TRACKING_PADDING.X, c.TRACKING_PADDING.Y);
            p.pop();

            p.translate((p.width - c.TOOLBAR_WIDTH) / 3.0, 0);
            p.textSize(8);
            p.textAlign(p.LEFT, p.CENTER);
            p.both(secondary);

            p.line(0, 0, 0, c.TRACKING_HEIGHT);
            p.line(c.INSERT_WIDTH, 0, c.INSERT_WIDTH, c.TRACKING_HEIGHT);
            p.translate(c.INSERT_PADDING, 0);
            p.text('- INSERT', 0, c.TRACKING_HEIGHT/2);
            p.pop();
        }

        drawInst(inst, index) {
            var yloc = index*c.INST_HEIGHT - this.scroll;
            // frustum culling
            if (yloc + c.INST_HEIGHT < 0)
                return;
            p.push();
            p.translate(0, yloc);
            p.stroke(colors.accent);
            p.fill(secondary_light2);

            // handle color if inst selected
            if (this.selected.inst === index)
                p.fill(colors.selected_inst);
            p.rect(0, 0, p.width-1, c.INST_HEIGHT-1);
            p.pop();
        }

        drawTempoPicker(ro) {
            // i think tempo should always be passed in rollover,
            // but let's keep a backup calculation here for now.
            let tempo;
            if (this.modulation && 'next' in this.modulation)
                tempo = this.modulation.next
            else
                tempo = ro.tempo || (ro.meas.end - ro.meas.start) / ro.meas.timesig * ro.beat + ro.meas.start;
            tempo = Math.round(tempo);
            let x = ('tick' in ro ? 
                    ro.meas.cache.ticks[ro.tick] :
                    ro.meas.cache.beats[ro.beat]) + ro.meas.cache.offset + this.viewport;
            p.push();
            p.translate(x, (ro.inst + 0.5)*c.INST_HEIGHT);

            // base tempo button
            p.both(primary);
            if (this.modulation)
                p.fill(colors.accent);
            let tempo_width = p.textWidth(tempo) + 4;
            p.rect(-tempo_width*0.5 - 4, -10, tempo_width + 8, 20);
            p.both(secondary);
            if (this.modulation)
                p.both(primary);

            p.textAlign(p.CENTER, p.CENTER);
            p.text(tempo, 0, 0);
            p.pop();

        }

        drawModWheel() {
            let mod = this.modulation;
            
            if (mod.timerLeft < p.frameCount) {
                mod.menuLeft = 'Left';
                mod.divLeft = [1,1];
                delete mod.timerLeft;
            }
            if (mod.timerRight < p.frameCount) {
                mod.menuRight = 'Right';
                mod.divRight = [1,1];
                delete mod.timerRight;
            }
            p.push();

            p.translate(mod.origin.x(), mod.origin.y());

            p.strokeCap(p.SQUARE);
            p.strokeWeight(20);
            p.stroke(primary);
            p.noFill();
            p.arc(-20, 0, 80, 80, p.HALF_PI, -p.HALF_PI);
            p.arc(20, 0, 80, 80, -p.HALF_PI, p.HALF_PI);
            p.strokeWeight(18);
            p.stroke(secondary);
            let EDGE_BUFFER = p.PI * 0.01;

            p.push();
            p.strokeWeight(28);
            p.stroke(colors.contrast);
            /*if (mod.menuLeft) {
                p.arc(-20, 0, 80, 80, p.HALF_PI, p.HALF_PI + p.PI);
            } if (mod.menuRight) {
                p.arc(20, 0, 80, 80, 0, p.HALF_PI);
            }*/
            p.pop();

            let FIFTH_PI = p.PI * 0.2;

            for (let segment=0; segment<5; segment++) {
                let left_start = p.HALF_PI + segment * FIFTH_PI;
                let right_start = segment * FIFTH_PI - p.HALF_PI;
                p.push();
                if (mod.indexLeft === 4-segment) {
                    p.strokeWeight(28);
                    p.stroke(colors.accent);
                }
                p.arc(-20, 0, 80, 80, left_start + EDGE_BUFFER, left_start + FIFTH_PI - EDGE_BUFFER);
                p.pop();
                p.push();
                if (mod.indexRight === segment) {
                    p.strokeWeight(28);
                    p.stroke(colors.accent);
                }
                p.arc(20, 0, 80, 80, right_start + EDGE_BUFFER, right_start + FIFTH_PI - EDGE_BUFFER);
                p.pop();
            }
            p.textAlign(p.CENTER, p.CENTER);
            let pow2 = [32,16,8,4,2];
            let text = [
                /*(l && l>2) ? pow(l) :*/ pow2,
                /*(r && r>2) ? pow(r) :*/ pow2
            ];
            for (let segment=0; segment<5; segment++) {
                //let text = Math.pow(2, 5-segment).toString();
                p.push();
                p.strokeWeight(1);
                p.both(primary);
                p.translate(-20, 0);
                let angle_x = 40 * p.cos(FIFTH_PI * segment + p.HALF_PI + FIFTH_PI/2);
                let angle_y = 40 * p.sin(FIFTH_PI * segment + p.HALF_PI + FIFTH_PI/2);
                p.text(text[0][segment], angle_x, angle_y);
                p.text(text[1][segment], -1 * angle_x + 40, angle_y);
                p.pop();
            }
            p.push();
            p.strokeWeight(1);
            p.both(primary);
            p.textStyle(p.ITALIC);
            if (mod.menuLeft) 
                p.text(mod.divLeft.join(':'), -26, 0);
            if (mod.menuRight) 
                p.text(mod.divRight.join(':'), 26, 0);
            p.pop();
            p.pop();
        }

        set_modulation(rollover) {
            if (!rollover)
                return this.modulation = null;

            let new_mod = _.pick(rollover, ['beat', 'inst', 'meas']);
            let meas = new_mod.meas;
            if (rollover.type === 'tempo') {
                new_mod.tick = rollover.tick;
                new_mod.base = rollover.tempo;
            } else if (rollover.type === 'beat') {
                new_mod.base = (meas.end - meas.start)/meas.timesig * new_mod.beat + meas.start;
            }

            new_mod.origin = { 
                x: () => 
                    (new_mod.tick ? 
                        meas.cache.ticks[new_mod.tick] : 
                        meas.cache.beats[new_mod.beat]
                    ) + meas.cache.offset
                    + this.viewport,
                y: () => (new_mod.inst + 0.5)*c.INST_HEIGHT - this.scroll,
                zone: 'Left'
            };

            this.modulation = new_mod;
        }

        _scaleY(input, height, range) {
            return height - (input - range.tempo[0])/(range.tempo[1] - range.tempo[0])*height;
        }

        scaleX(input) {
            return (input*this.scale + this.viewport);
        }

        focus({ scale, viewport }) {
            this.viewport = viewport;
            this.scale = scale;
        }
           
        drawToolbar(tempoRange) { 
            p.push();
            p.both(primary);

            p.translate((p.width - c.TOOLBAR_WIDTH) / 3.0, p.height - c.TRACKING_HEIGHT - c.INSERT_HEIGHT);

            if (this.mode === 1) {
                p.push();
                p.rect(0, 0, c.EDITOR_WIDTH, c.INSERT_HEIGHT);

                p.stroke(secondary);
                p.line(c.INSERT_WIDTH, c.EDITOR_HEIGHT, c.EDITOR_WIDTH, c.EDITOR_HEIGHT); 

                if ('beats' in this.insertMeas) {
                    p.both(secondary);

                    // draw beats
                    // push into padding
                    p.push();
                    p.translate(c.INSERT_PADDING, c.INSERT_PADDING);
                    let last = c.EDITOR_WIDTH - c.INSERT_PADDING*2;
                    this.insertMeas.beats.forEach((beat) => {
                        let x = (beat/this.insertMeas.ms)*last;
                        p.line(x, 0, x, c.PREVIEW_HEIGHT);
                    });
                    // draw tempo
                    let ystart = this._scaleY(this.insertMeas.start, c.PREVIEW_HEIGHT, tempoRange);
                    let yend = this._scaleY(this.insertMeas.end, c.PREVIEW_HEIGHT, tempoRange);
                    p.line(0, ystart, last, yend);

                    // push into metadata
                    p.push();
                    p.translate(0, c.PREVIEW_HEIGHT + c.INSERT_PADDING);
                    p.textAlign(p.LEFT, p.TOP);
                    p.pop();
                    p.pop();
                }
                p.pop();
            };
            p.pop();
        }
    };
    return new Window();

}

