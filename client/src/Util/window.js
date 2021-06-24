import c from '../config/CONFIG.json';
import { primary, secondary, secondary_light, secondary_light2 } from '../config/CONFIG.json';
import { colors } from 'bandit-lib';
import { crowding } from '../Util/index.js';
import { NUM, LEFT, RIGHT, DEL, BACK } from './keycodes';

let tempo_edit = (oldMeas, newMeas, beat_lock, type) => {
    let old_slope = oldMeas.end - oldMeas.start;
    let lock_tempo = (oldMeas.end - oldMeas.start)/oldMeas.timesig * beat_lock.beat + oldMeas.start;
    let lock_percent = beat_lock.beat / oldMeas.timesig;
    if (type === 'start')
        newMeas.end = (lock_tempo - newMeas.start)/lock_percent + newMeas.start
    else if (type === 'end')
        newMeas.start = newMeas.end - (newMeas.end - lock_tempo)/(1 - lock_percent);
    return newMeas;

}

// generates measure.gaps in 'measure' drag mode
var calcGaps = (measures, id) => {
    var last = false;
    // ASSUMES MEASURES ARE IN ORDER
    return measures.reduce((acc, meas, i) => {
        // skip measure in question
        if (id && (meas.id === id))
            return acc;
        acc = [...acc, [
            (last) ? last.offset + last.ms : -Infinity,
            meas.offset
        ]];
        last = meas;
        return acc;
    }, [])
        .concat([[ last.offset + last.ms, Infinity ]]);
};



export default (p) => {
    class _Window {
        constructor() {
            this.scale = 1.0;
            this.viewport = 0;
            this.scroll = 0;
            this.span = [Infinity, -Infinity];
            this.cursor_loc = 0;

            // modes: ESC, INS, EDITOR
            this.mode = 0;
            this.panels = false;
            this.selected = {
                inst: -1,
                meas: undefined
            };
            this.insts = 0;
            this.mods = {};

            this.insertMeas = {};
            this.editMeas = {};
            this._lockingCandidate = null;
            this.range = { tempo: [0, 100] };
            this.rangeRefresh = () => {};

            this.printTemp = {};

            this.updateViewCallback = () => null;

            this.editor = {};

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

        completeCalc(start, slope, timesig) {
            let tick_total = timesig * this.CONSTANTS.PPQ;
            let inc = slope/tick_total;
            let last = 0;
            let ms = 0;
            var PPQ_mod = this.CONSTANTS.PPQ / this.CONSTANTS.PPQ_tempo;
            let beats = [];
            let ticks = [];
            for (let i=0; i<tick_total; i++) {
                if (!(i%this.CONSTANTS.PPQ))
                    beats.push(ms);
                ticks.push(ms);
                if (i%PPQ_mod === 0) 
                    last = this.CONSTANTS.K / (start + inc*i);
                ms += last;
            };
            beats.push(ms);
            return { beats, ticks, ms }
        }

        enter_editor(type, inst, meas) {
            let types = ['start', 'end', 'timesig'];
            if (types.indexOf(type) > -1) {
                let next = {};
                let pointers = {};
                types.forEach(t => {
                    let str = meas[t].toString();
                    next[t] = str;
                    pointers[t] = str.length;
                });
                this.editor = { type, inst, meas, next, pointers, timer: null };
                return true;
            }
            return false;
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
                this.editor.timer = p.frameCount + (2 * 10);
            } else if (input === DEL || input === BACK) {
                if (pointer !== 0) {
                    this.editor.next[type] =
                        next.slice(0, pointer - 1)
                        + next.slice(pointer);
                    this.editor.pointers[type]--;
                    this.editor.timer = p.frameCount + (2 * 60);
                }
            } else if (input === LEFT)
                this.editor.pointers[type] = Math.max(0, pointer - 1)
            else if (input === RIGHT)
                this.editor.pointers[type] = Math.min(pointer + 1, next.length);
        }

        recalc_editor() {
            let selected = this.editor.meas;
            let updated = Object.keys(this.editor.next).reduce(
                (acc, key) => Object.assign(acc, { [key]: parseInt(this.editor.next[key], 10) }), {});
            // check if anything's changed
            if (['start', 'end', 'timesig'].some(p => (updated[p] !== selected[p]))) {
                var beat_lock = {};
                if ('locks' in selected && Object.keys(selected.locks).length) {
                    let lock = Object.keys(selected.locks)[0];
                    beat_lock.beat = parseInt(lock, 10);
                    beat_lock.type =selected.locks[lock];

                    // check if tempo locked somewhere
                    if (selected.locks[lock] !== 'loc') {
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
                    ({ ...acc, [key]: parseInt(this.editor.next[key], 10) }), {});
                
                let slope = next.end - next.start;
                let calc = this.completeCalc(next.start, slope, next.timesig);
                Object.assign(calc, next); 

                // check for 'loc' locking and adjust offset
                calc.offset = selected.offset;
                if (beat_lock.type === 'loc' || beat_lock.type === 'both')
                    calc.offset += selected.beats[beat_lock.beat] - calc.beats[beat_lock.beat];

                // assign to measure temp
                Object.assign(this.editor.meas, { temp: calc });

                // cache and assign to measure
                this.editor.meas.cache = this.calculate_cache(calc);
                this.editor.meas.cache.temp = true;

                console.log(this.editor.meas);

                // update score tempo range
                this.updateRange({
                    temprange: [
                        Math.min(parseInt(this.editor.next.start, 10), this.range.tempo[0]),
                        Math.max(this.editor.next.end, this.range.tempo[1])
                    ]
                });
            }
        }

        exit_editor() {
            this.editor = {};
        }

        validate_editor(calcGaps) {
            if (this.editor.meas)
                this.validate_measure(this.editor.meas, calcGaps, true);
        }

        validate_measure(meas, calcGaps, tempflag) {
            console.log(meas);
            if (!meas.gaps)
                meas.gaps = calcGaps(meas.inst, meas.id);


            // i don't particularly like how invalid reference is set here
            let [offset, ms, invalid] = tempflag ?
                [meas.temp.offset, meas.temp.ms, meas.temp.invalid] :
                [meas.offset, meas.ms, meas.invalid];

            console.log(offset);

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
                console.log(meas.cache.invalid);
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
            
            //Object.assign(meas, { cache });
            //Object.assign(meas.cache, this.calculate_tempo_cache(meas));

            Object.assign(cache, this.calculate_tempo_cache(meas, cache));
            return cache;
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

            let bounding = [];

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

        setRangeRefresh(refresh) {
            this.rangeRefresh = refresh;
        }

        updateRange(new_range) {
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
                    p.stroke(colors.secondary);
                    p.fill(colors.secondary);
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
                    p.stroke(colors.secondary);
                    p.fill(colors.secondary);
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
                p.stroke(colors.secondary);
                p.fill(colors.secondary);
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
                    p.stroke(colors.primary);
                    p.fill(colors.primary);
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
            let sel = meas || this.selected.meas;
            this.selected.meas.temp = {
                start: sel.start,
                end: sel.end,
                ms: sel.ms,
                ticks: sel.ticks,
                beats: sel.beats,
                offset: sel.offset
            };

            let cache = this.calculate_cache(sel);/*{
                offset: sel.offset*this.scale,
                beats: sel.beats.map(b => b*this.scale),
                ticks: sel.ticks.map(t => t*this.scale),
                ms: sel.ms*this.scale
            };
            */

            Object.assign(this.selected.meas, { cache });
            Object.assign(this.selected.meas.cache, this.calculate_tempo_cache(sel, cache));

        }

        setUpdateViewCallback(cb) {
            this.updateViewCallback = cb;
        }

        updateView(event, { zoom }) {
            if (zoom) {
                let change = 1.0-event.delta/c.SCROLL_SENSITIVITY;
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

        drawLockMenu(type) {
            p.push();
            p.translate(p.mouseDown.x, p.mouseDown.y);

            p.fill(primary);
            p.stroke(primary);
            p.rect(-45, -10, 35, 20);
            p.rect(10, -10, 35, 20);
            p.rect(-17, -20, 35, 20);
            p.stroke(secondary)
            p.fill(secondary)
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

        drawPlayback() {
            // DRAW TOP BAR
            p.stroke(secondary);
            p.fill(secondary);
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
                    p.stroke(120);
                    p.fill(60);
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
                p.stroke(s);
                p.fill(s);
                p.line(c.PANES_WIDTH, c.PLAYBACK_HEIGHT + depth + 1, p.width, c.PLAYBACK_HEIGHT + depth + 1);
            }
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
            let blink = false;
            let next;
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
                next = this.editor.next.timesig;
                text[0] = (this.scale > 0.03) ?
                    [next, denom].join('\n') :
                    ((this.scale > 0.02) ? [next, denom].join('/') :
                        next);

                blink = (this.editor.type === 'timesig') && ((p.millis() % 1000) > 500);
            }
            p.text(...text);

            p.pop();
            if (blink) {
                p.push();
                p.stroke(0);
                let textSize = this.scale > 0.03 ? c.INST_HEIGHT*0.25 : c.INST_HEIGHT * 0.1;
                p.textSize(textSize);
                let w = p.textWidth(next.slice(0, this.editor.pointers.timesig));
                let bound = this.editor.meas.cache.bounding[2];
                if (this.scale > 0.03) {
                    p.translate(c.TIMESIG_PADDING, 0);
                    w -= p.textWidth(next) * 0.5;
                    p.line(w, bound[1], w, bound[1] + textSize);
                } else {
                    p.translate(c.TIMESIG_PADDING/2, 0);
                    p.line(w, bound[1], w, bound[3]);
                }
                p.pop();
            }

            // showing bound with blink
            /*if (blink) {
                p.push();
                p.stroke(0);
                let bound = this.editor.meas.cache.bounding[2];
                p.line(bound[0], bound[1], bound[2], bound[1]);
                p.line(bound[0], bound[3], bound[2], bound[3]);
                p.pop();
            }*/
        }

        select(newSelected) {
            if (newSelected === 'clear') {
                if (this.selected.inst === -1)
                    return false;
                Object.assign(this.selected, { inst: -1, meas: undefined });
                return true;
            }
            if (this.selected.meas) {
                if (newSelected.meas && (this.selected.meas.id === newSelected.meas.id))
                    return false;
                this.editMeas = {};
                delete this.selected.meas.temp;
            }
            Object.assign(this.selected, newSelected);
            return true;
        }
     
        drawFrame() {
            // DRAW BACKGROUND
            p.stroke(secondary_light);
            p.fill(secondary_light);
            p.rect(0, 0, p.width, p.height);
           
        
            // DRAW BOTTOM BAR
            p.stroke(secondary);
            p.fill(secondary);
            p.rect(0, p.height - c.TRACKING_HEIGHT, p.width, c.TRACKING_HEIGHT);

            // DRAW SIDEBAR
            p.push();

        }

        drawTabs({ locator, cursor_loc, isPlaying }) {
            
            p.push();
            // draw tabs
            p.stroke(primary);
            p.fill(primary);

            p.translate(0, p.height - c.TRACKING_HEIGHT);
            p.rect(0, 0, p.width, c.TRACKING_HEIGHT);
            // left
            
            // LOCATION
            // left    

            p.push();
            p.stroke(secondary);
            p.fill(secondary);
            p.textAlign(p.LEFT, p.TOP);
            p.textSize(10);
            p.text(isPlaying ? `LOCATION: ${Math.round(locator)}` : `CURSOR: ${cursor_loc}`,
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
            p.stroke(secondary);
            p.fill(secondary);

            p.line(0, 0, 0, c.TRACKING_HEIGHT);
            p.line(c.INSERT_WIDTH, 0, c.INSERT_WIDTH, c.TRACKING_HEIGHT);
            p.translate(c.INSERT_PADDING, 0);
            p.text('- INSERT', 0, c.TRACKING_HEIGHT/2);
            p.text('- EDITOR', c.INSERT_WIDTH, c.TRACKING_HEIGHT/2);
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
            if (!this.selected.meas && this.selected.inst === index)
                p.fill(colors.selected_inst);
            p.rect(0, 0, p.width-1, c.INST_HEIGHT-1);
            p.pop();
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
            p.stroke(primary);
            p.fill(primary);

            p.translate((p.width - c.TOOLBAR_WIDTH) / 3.0, p.height - c.TRACKING_HEIGHT - c.INSERT_HEIGHT);

            if (this.mode === 1) {
                p.push();
                p.rect(0, 0, c.EDITOR_WIDTH, c.INSERT_HEIGHT);

                p.stroke(secondary);
                p.line(c.INSERT_WIDTH, c.EDITOR_HEIGHT, c.EDITOR_WIDTH, c.EDITOR_HEIGHT); 

                if ('beats' in this.insertMeas) {
                    p.stroke(secondary);
                    p.fill(secondary);

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
                    /*let lines = [
                        `${this.insertMeas.start} - ${this.insertMeas.end} / ${this.insertMeas.timesig}`,
                        `${this.insertMeas.ms.toFixed(2)}ms`
                    ];
                    blockText(lines, { x: 0, y: 0 }, 6); 
                    */
                    p.pop();
                    p.pop();
                }
                p.pop();
            };

            if (this.mode === 2) {
                p.rect(0, 0, c.EDITOR_WIDTH, c.EDITOR_HEIGHT);
                p.stroke(secondary);
                p.line(0, c.EDITOR_HEIGHT, c.INSERT_WIDTH, c.EDITOR_HEIGHT); 
                if (this.selected.meas) {
                    // push into padding
                    p.push();
                    p.stroke(secondary);
                    p.translate(c.INSERT_PADDING, c.INSERT_PADDING);
                    let last = c.EDITOR_WIDTH - c.INSERT_PADDING*2;
                    let meas = this.selected.meas;
                    meas.beats.forEach((beat) => {
                        let x = (beat/meas.ms)*last;
                        p.line(x, 0, x, c.PREVIEW_HEIGHT);
                    });
                    // draw tempo
                    let ystart = this._scaleY(meas.start, c.PREVIEW_HEIGHT, tempoRange);
                    let yend = this._scaleY(meas.end, c.PREVIEW_HEIGHT, tempoRange);
                    p.line(0, ystart, last, yend);
                    p.pop();
                }
            }
            p.pop();
        }

        /*drawEditorFrame(coords, handle) {
            p.push();
            let opac = p.color(primary);
            opac.setAlpha(180);
            p.stroke(opac);
            p.fill(opac);
            p.translate(...coords);
            if (handle)
                p.ellipse(...handle);

            let PANES_THIN = c.PANES_WIDTH/4;
            let inc = 180.0 / c.INST_HEIGHT;
            let op = p.color(primary)
            let end = this.selected.meas.ms*this.scale;
            for (let i=0; i <= c.INST_HEIGHT; i++) {
                op.setAlpha(i*inc);
                p.stroke(op);
                p.line(-PANES_THIN, i, 0, i);
                p.line(end, i, end + PANES_THIN, i);
            }
            p.translate(0, c.INST_HEIGHT);
            p.rect(-PANES_THIN, 0, PANES_THIN*2 + this.selected.meas.ms*this.scale, c.LOCK_HEIGHT);

            p.stroke(secondary);
            p.fill(secondary);
            p.textSize(10);
            p.textAlign(p.LEFT, p.CENTER);
            //p.text(`${select.start} -> ${select.end} / ${select.timesig}`, 5, c.PANES_WIDTH);
                
            p.pop();
        }*/
    };
    return new _Window();

}

