/**
 * P5js sketch for main display
 * @module sketch
 */

import { order_by_key, check_proximity_by_key, parse_bits, crowding, initial_gap, anticipate_gap, calc_gaps, global_gaps, abs_location } from '../Util/index.js';
import { lt, lte, gt, gte } from '../Util/index.js';
//import { bit_toggle } from '../Util/index.js';
import logger from '../Util/logger.js';
import c from '../config/CONFIG.json';
import { primary, /*secondary, secondary_light2*/ } from '../config/CONFIG.json';
import { colors } from 'bandit-lib';
//import { secondary, secondary_light, } from '../config/CONFIG.json';
import _ from 'lodash';
import _Window from '../Util/window.js';
import _Mouse from '../Util/mouse.js';
import _Keyboard from '../Util/keyboard.js';
import { Debugger } from '../Util/debugger.js';
import Printer from '../Util/printer.js';
import keycodes from '../Util/keycodes.js';
import { NUM, LETTERS } from '../Util/keycodes.js';
import { CTRL, MOD, SHIFT, LEFT, UP, RIGHT, DOWN, PERIOD } from '../Util/keycodes.js';
import { SPACE, DEL, BACK, ESC } from '../Util/keycodes.js';
import { KeyE, KeyR, KeyU, KeyY, KeyP, KeyI, KeyC, KeyV, KeyZ } from '../Util/keycodes.js';
import tutorials from '../Util/tutorials/index.js';

console.log(KeyR, KeyU, CTRL);

const DEBUG = process.env.NODE_ENV === 'development';
const SLOW = process.env.NODE_ENV === 'development';

var API = {};
var input;

var conflict = [Infinity, -Infinity];
var obstacles = [Infinity, -Infinity];

// tweaks learning rate for nudge algorithms
var monitor = (gap, new_gap, alpha) => {
    let progress = Math.abs(gap) - Math.abs(new_gap);
    if (gap + new_gap === 0 || progress === 0)
        return alpha;

    let perc = Math.abs(progress)/Math.abs(gap);
    if (progress < 0)
        alpha *= -1;

    return alpha * (1-perc)/perc;
};

/* THIS SYSTEM MAY WORK BETTER FOR FRACTIONAL BEATS
var insert = (list, item) => {
    if (!list.length)
        return [item];

    var center = Math.floor(list.length/2);
    
    if (item === list[center]) {
        return list;
    };
    if (!center) {
        if (item > list[0])
            return list.concat([item]);
        return [item].concat(list);
    }

    var left = list.slice(0, center);
    var right = list.slice(center);
    if (item > list[center])
        return left.concat(insert(right, item));
    return insert(left, item).concat(right);
}; */


export default function measure(p) {
    // monkey-patching Processing for a p.mouseDown function
    p.mouseDown = false;

    var instruments = [];

    var lock_persist = () => null;
    var reset_lock_persist = () => lock_persist = (() => console.log('not set'));
    var set_lock_persist = (inst, id, locks) =>
        lock_persist = () => 
            inst < instruments.length ?
                Object.assign(instruments[inst].measures[id], locks) : null; 
                            

    var gatherRanges = (except) =>
        instruments.reduce((acc, inst) => {
            Object.keys(inst.measures).forEach(key => {
                let meas = inst.measures[key];
                if (except && meas.id === except)
                    return acc;
                acc.min = Math.min(acc.min, meas.start, meas.end);
                acc.max = Math.max(acc.max, meas.start, meas.end);
            });
            return acc;
        }, { min: Infinity, max: -Infinity });

    var locks = 0;

    var snaps = {
        divs: [],
        div_index: 0,
        snapped_inst: {}
    };

    // cached from nudge algorithm as { start, slope, offset, ms }
    var nudge_cache = false;
    // { start: [location, distance-from-location], end: [location, distance-from-location], gap: []}
    var crowd_cache = false;

    // misc
    var isPlaying = false;

    // instantiate classes
    var Window = _Window(p);
    var Mouse = _Mouse(p, Window);
    var Keyboard = _Keyboard(p);

    var printer = new Printer(p);

    var x_to_ms = x => (x-Window.viewport)/Window.scale;
    var insertMeasSelecting = () => {
        let x_loc = x_to_ms(p.mouseX - c.PANES_WIDTH);
        if (Window.mode === 1) {
            let inst = Math.floor(0.01*(p.mouseY - c.PLAYBACK_HEIGHT - Window.scroll));
            Window.insertMeas.inst = inst;
            if (inst < instruments.length && inst >= 0) {
                let crowd = crowding(instruments[inst].gap_cache, x_loc, Window.insertMeas.ms, { strict: true, center: true });
                let crowd_start = crowd.start[0];
                let crowd_end =  crowd.end[0];

                let offset = x_loc;
                if (offset < crowd_start + c.SNAP_THRESHOLD) // && offset > crowd_start - Window.insertMeas.ms/2)
                    Window.insertMeas.temp_offset = crowd_start
                else if (offset + Window.insertMeas.ms + c.SNAP_THRESHOLD > crowd_end)
                    Window.insertMeas.temp_offset = crowd_end - Window.insertMeas.ms
                else
                    Window.insertMeas.temp_offset = x_loc;
                Window.insertMeas.cache.offset = Window.ms_to_x(Window.insertMeas.temp_offset);

            }
        }
    }

    var tick_zoom = () => {
        let step = Window.CONSTANTS.PPQ;
        let resolutions = [];
        let tempo_ticks = 1;
        while ((tempo_ticks) <= Window.CONSTANTS.PPQ ) {
            resolutions.push(tempo_ticks);
            tempo_ticks *= 2;
        }
        // BREAK OUT INTO FUNCTION
        let scales = [5, 1, 0.075, 0.05, 0.025];
        let lerp = 0;
        scales.some((scale, index) => {
            if (Window.scale > scale) {
                // linear interpolation for tick fades.
                // how far away from the next division are we?
                step = (index >= resolutions.length) ?
                     Window.CONSTANTS.PPQ : resolutions[index];
                lerp = index ? 
                    (Window.scale - scale)/(scales[index-1]-scale) : 0;
                return true;
            }
            return false;
        });

        return [step, lerp];
    }

    // calculates only tempo change ticks.
    // returns beats/tempo ticks and requested individual ticks according to key
    var quickCalc = (start, slope, timesig, denom, extract) => {
        // tick_array is the total number of tempo updates for the measure
        var divisor = denom/4;
        var tick_array = Array.from({
            length: timesig * Window.CONSTANTS.PPQ_tempo / divisor
        }, (__, i) => i);

        /* original 4/4 algorithm - DO NOT DELETE
         * var K = 60000.0 * timesig / slope;
         * var sigma = (n) => 1.0 / ((start * Window.CONSTANTS.PPQ_tempo  * K / 60000.0) + n);
         */

        // new algorithm essentially doubles, quadruples, etc. start and slope
        slope *= divisor;
        var K = 60000.0 * timesig / slope;
        var sigma = (n) => 1.0 / ((start * Window.CONSTANTS.PPQ_tempo * K / 60000.0) + n);


        // convert extractions to ticks
        if (extract === undefined)
            extract = {};
        let extract_tick_locations = Object.keys(extract)
            .reduce((acc, key) => 
                ({ ...acc, [extract[key] * Window.CONSTANTS.PPQ_tempo / divisor]: key })
            , {});

        let returned = { beats: [], ticks: [] };

        returned.ms = K * tick_array.reduce((sum, i) => {
            if (i in extract_tick_locations)
                returned[extract_tick_locations[i]] = sum*K;
            return sum + sigma(i);
        }, 0);
        // catch last beat
        if (tick_array.length in extract_tick_locations)
            returned[extract_tick_locations[tick_array.length]] = returned.ms;

        return returned;
    };



    // debugger
    var Debug = new Debugger(p, Window, Mouse);

    var subs = [];
    var buttons = [];
    var core_buttons = [];
    var subscriber = (type, func) => {
        return (type === 'draw') ?
            subs.push(func) :
            buttons.push(func);
    };


    var tuts = tutorials(p, subscriber, API, Window);

    var calculate_insertMeas_cache = (meas) => {
        let cache = {
            offset: meas.temp_offset * Window.scale,
            beats: meas.beats.map(b => b * Window.scale),
            ticks: meas.ticks.map(t => t * Window.scale),
            ms: meas.ms*Window.scale,
        }
        return cache;
    }

    p.setup = function () {
        p.createCanvas(p.windowWidth - c.CANVAS_PADDING * 2, p.windowHeight - c.FOOTER_HEIGHT);
    };

    p.windowResized = function () {
        p.resizeCanvas(p.windowWidth - c.CANVAS_PADDING * 2, p.windowHeight - c.FOOTER_HEIGHT);
        // override Y scroll
        Window.updateView({ deltaX: 0, deltaY: 0 }, {});
    }

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        console.log('REDRAWING');

        instruments = props.instruments;
            
        lock_persist();
        reset_lock_persist();
        Window.insertMeas = props.insertMeas;
        Window.editMeas = props.editMeas;
        Window.newInst = props.newInst;
        Window.mode = props.mode;
        Window.insts = props.instruments.length;
        Object.assign(API, props.API);
        Window.setUpdateViewCallback(API.reportWindow);

        // THIS SHOULD BE MOVED INTO APP.JS WITH DEPENDENCIES
        // PASSED IN THE OTHER DIRECTION!
        API.registerTuts(tuts);
        API.registerPollingFlag((type) => Window.set_polling_flag(type));

        Window.CONSTANTS = props.CONSTANTS;
        Window.CONSTANTS.K = 60000.0 / Window.CONSTANTS.PPQ;
        core_buttons = [];
        // add insert tab button
        core_buttons.push(() => {
            let insert_x = (p.width - c.TOOLBAR_WIDTH) / 3.0;
            if (p.mouseX > insert_x &&
                p.mouseX < insert_x + c.INSERT_WIDTH &&
                p.mouseY > p.height - c.TRACKING_HEIGHT &&
                p.mouseY < p.height
            ) {
                Window.mode = (Window.mode === 1) ? 0 : 1;
                API.updateMode(Window.mode);
                return true;
            } else
                return false;
        });
        // add editor tab button
        /*core_buttons.push(() => {
            let insert_x = (p.width - c.TOOLBAR_WIDTH) / 3.0 + c.INSERT_WIDTH;
            if (p.mouseX > insert_x &&
                p.mouseX < insert_x + c.INSERT_WIDTH &&
                p.mouseY > p.height - c.TRACKING_HEIGHT &&
                p.mouseY < p.height
            ) {
                Window.mode = (Window.mode === 2) ? 0 : 2;
                API.updateMode(Window.mode);
                return true;
            } else
                return false;
        });
        */

        // I have NO idea what beat lock does here... some kind of insurance against the main react app shifting a measure?
        var beat_lock = {};
        /*if (Window.selected.meas && 'locks' in Window.selected.meas) {
            let lock_candidates = Object.keys(Window.selected.meas.locks);
            if (lock_candidates.length)
                beat_lock = { beat: lock_candidates[0], type: Window.selected.meas.locks[lock_candidates[0]] };
        }
        */

        // redraw simply clears temp?
        if (Window.selected.meas) {
            Window.getSelection().forEach(id => {
                let meas = Window.selected[id];
                // why is this necessary? why doesn't this reference persist?
                let ref = instruments[meas.inst].measures[meas.id];
                if (ref) {
                    Window.selected[id] = ref;
                    delete ref.temp;
                }
            });

        }

        if ('locks' in props)
            locks = props.locks.reduce((acc, lock) => (acc |= (1 << lock)), 0); 

        // REFACTOR ORDERING INTO NUM ITERATIONS LATER
        instruments.forEach((inst) => {
            inst.ordered = order_by_key(inst.measures, 'offset');
            if (inst.ordered.length) {
                let last = inst.ordered[inst.ordered.length - 1];
                Window.span = [
                    Math.min(Window.span[0], inst.ordered[0].offset),
                    Math.max(Window.span[1], last.offset + last.ms)
                ];
            };

            // cache gaps
            inst.gap_cache = calc_gaps(inst.ordered, '').gaps;
            console.log(inst.gap_cache);
        });

        // calculate beat visual locations for all measures
        instruments.forEach(inst =>
            inst.ordered.forEach(meas =>
                meas.cache = Window.calculate_cache(meas))
        );

        // calculate insertMeas visual locations
        if ('beats' in Window.insertMeas)
            Window.insertMeas.cache = calculate_insertMeas_cache(Window.insertMeas);

        // rewrite this
        logger.log('Recalculating snap divisions...');
        snaps.divs = NUM.slice(1).reduce((acc, num, n_ind) => {
            let add_snaps = {};
            let div = Window.CONSTANTS.PPQ / (n_ind + 1);
            instruments.forEach((inst, i_ind) =>
                inst.ordered.forEach((measure) => {
                    let divisor = measure.denom / 4;
                    let div_mod = div / divisor;
                    for (let i=0; i < measure.ticks.length; i += div_mod) {
                        let tick = Math.round(i);
                        let target = (tick >= measure.ticks.length) ?
                            measure.ms : measure.ticks[tick];
                        let loc = (target + measure.offset).toString();
                        let obj = { inst: i_ind, meas: measure.id };
                        if (loc in add_snaps)
                            add_snaps[loc].push(obj)
                        else
                            add_snaps[loc] = [obj];
                    };
                }) , {});
            return [...acc, add_snaps];
        }, []);

        Window.updateRange(Window.CONSTANTS.range);
        
        Window.setRangeRefresh(() =>
            instruments.forEach(inst =>
                inst.ordered.forEach(meas => {
                    Object.assign(meas.cache, Window.calculate_tempo_cache(meas, meas.cache))
                })
            )
        );

    }

    p.draw = function () {
        if (SLOW)
            p.frameRate(10);

        Window.drawFrame();

        // push below playback bar
        p.push();

        p.translate(0, c.PLAYBACK_HEIGHT);
        p.stroke(primary);
        p.fill(primary);
        p.rect(0, 0, c.PANES_WIDTH, p.height);
        p.translate(c.PANES_WIDTH, 0);

        // this instrument loop is 200 lines, that's ridiculous.
        // now down to 115.

        instruments.forEach((inst, i_ind) => {
            // prototyping this new function
            Window.drawInst(inst, i_ind);
            var yloc = i_ind*c.INST_HEIGHT - Window.scroll;

            p.push();
            p.translate(0, yloc);

            // conflicts is an array of functions to draw conflict boxes
            // once all measures are drawn
            let conflicts = [];

            // moving into Window.drawMeas?
            inst.ordered.forEach((measure, m_ind) => {
                let key = measure.id;

                let cache = measure.cache;
                var [ticks, beats, offset, ms] = 
                    [cache.ticks, cache.beats, cache.offset, cache.beats.slice(-1)[0]];
                if (Mouse.rollover.meas && Mouse.rollover.meas.id === key)
                    Debug.push(`${cache.offset}`);

                var [graph] = [cache.graph];


                let origin = offset + Window.viewport;

                 // skip if offscreen
                if (origin + ms < 0 ||
                    origin > p.width
                )
                    return;
               
                p.push();
                p.translate(origin, 0);

                // handle selection
                if (Window.selected.meas && (key in Window.selected)) {
                    let sel_color = p.color(colors.contrast);
                    sel_color.setGreen(150);
                    sel_color.setAlpha(50);
                    p.fill(sel_color);
                     
                    p.rect(0, 0, ms, c.INST_HEIGHT);
                }

                // draw ticks

                let step, lerp;
                [step, lerp] = tick_zoom();
                for (var i=0; i < ticks.length; i += (step === 1 ? step : step/2)) {
                    let loc = ticks[i];
                    // skip if offscreen
                    if (loc + origin > p.width || loc + origin < 0)
                        continue;

                    let color = p.color(240);
                    if (i % step)
                        color.setAlpha(255*lerp)
                    p.stroke(color);
                    p.line(loc, 0, loc, c.INST_HEIGHT);
                };

                // draw timesig
                Window.drawTimesig(measure.timesig, measure.denom, measure);

                // draw beats
                beats.forEach((beat, index) => {
                    let alpha = 255;
                    let color = ('locks' in measure && index in measure.locks) ?
                        p.color(0, 0, 255) : p.color(colors.accent);

                    // bypass first beat when fading
                    if (Window.scale < 0.05 && (index !== 0))
                        alpha = Math.max(60, 255*(Window.scale/0.05));
                    color.setAlpha(alpha);
                    p.stroke(color);
                    p.line(beat, 0, beat, c.INST_HEIGHT);
                });


                p.stroke(240, 200, 200);
                // draw tempo graph
                // MOVING THIS TO CALCULATE_CACHE
                graph.forEach((graph, ind) => {
                    p.strokeWeight(1);
                    if ((Mouse.rollover.type === 'tempo') &&
                        (measure.id === Mouse.rollover.meas.id) &&
                        (ind === Mouse.rollover.beat)
                    )
                        p.strokeWeight(3);
                    p.line(...graph);
                });

                // draw tempo markings
                p.fill(100);
                ['start', 'end'].forEach((mark, ind) => {
                    let m = cache.markings[ind];
                    p.textAlign(...m.textAlign);
                    p.textSize(c.TEMPO_PT);
                    let text = m.text.slice(0);
                    if ('meas' in Window.editor && Window.editor.meas.id === measure.id) {
                        let next = Window.editor.next[mark];
                        text[0] = next; 
                        
                        if (Window.editor.type === mark) {
                            p.textSize(c.TEMPO_PT + 2);
                            // draw hover indicator rectangles
                            if (Window.editor.hover_next_number) {
                                text[0] = Window.editor.hover_next_number.toString();
                                p.push();
                                let c_color = p.color(colors.contrast);
                                c_color.setAlpha(100);
                                p.stroke(c_color);
                                p.fill(c_color);
                                let width = p.textWidth(text[0]);
                                let align_x = m.textAlign[0] === p.LEFT ?
                                    0 : -width;
                                let align_y = m.textAlign[1] === p.TOP ?
                                    -8 : -16;
                                p.rect(text[1] + align_x, text[2] + align_y, width, 18);
                                p.pop();
                            }
                            // handle blinking cursor
                            let blink = p.millis() % 1000;
                            if (blink > 500) {
                                p.push();
                                p.stroke(0);
                                let w = p.textWidth(text[0].slice(0, Window.editor.pointer))
                                    + m.text[1];
                                // correct for 'end' textAlign
                                if (ind)
                                    w -= p.textWidth(text[0]);
                                let bound = cache.bounding[ind];
                                p.line(w, bound[1] - 2, w, bound[3] - 2);
                                p.pop();
                            }
                        }
                    }
                    p.text(...text);
                });

                // draw schemas
                if (measure.schemas)
                    Window.drawSchemas(measure, 0);

                // draw events
                if (measure.events)
                    Window.drawEvents(measure);
                // entering an event?
                if (Window.entry.mode &&
                    Mouse.rollover.type === 'entry' &&
                    Mouse.rollover.meas.id === measure.id
                )
                    Window.drawEvent(0, Window.entry.ms_start, Window.entry.ms_dur);

                // return from measure translate
                p.pop();

                if (cache.invalid) {
                    let conflictColor = p.color(colors.accent);
                    conflictColor.setAlpha(150);
                    if ('start' in cache.invalid)
                        conflicts.push(() => {
                            p.push();
                            p.translate(origin, 0);
                            p.stroke(conflictColor);
                            conflictColor.setAlpha(100);
                            p.fill(conflictColor);
                            p.rect(0, 0, -cache.invalid.start, c.INST_HEIGHT);
                            p.pop();
                        });
                    if ('end' in cache.invalid)
                        conflicts.push(() => {
                            p.push();
                            p.translate(origin + ms, 0);
                            p.stroke(conflictColor);
                            conflictColor.setAlpha(100);
                            p.fill(conflictColor);
                            p.rect(0, 0, cache.invalid.end, c.INST_HEIGHT);
                            p.pop();
                        });
                }

                if (measure.temp && measure.temp.crowd) {
                    p.push();
                    let origin = measure.cache.offset + Window.viewport;
                    p.translate(origin, 0);
                    let box_color = p.color(colors.accent);
                    box_color.setAlpha(100);
                    p.stroke(box_color);
                    p.fill(box_color);
                    /*let crowd = measure.temp.crowd;
                    if (crowd.start[1] < 0) {
                        let start = Math.min(-(crowd.start[1] * Window.scale), measure.cache.ms);
                        p.rect(0, 0, start, c.INST_HEIGHT);
                    }
                    if (crowd.end[1] < 0) {
                        let end = Math.min(-(crowd.end[1] * Window.scale), measure.cache.ms);
                        p.rect(measure.cache.ms-end, 0, end, c.INST_HEIGHT);
                    }
                    */
                    p.pop();
                }

            });

            if (Window.pasteMeas.length) {
                Window.pasteMeas.forEach(meas => {
                    if (meas.inst === i_ind) {
                        let origin = Mouse.move.origin;


                         // skip if offscreen
                        if (origin + meas.ms < 0 ||
                            origin > p.width
                        )
                            return;
                   
                        p.push();
                        p.translate(origin+(meas.center_offset*Window.scale), 0);
                        p.fill(255, 0, 0);
                        p.rect(0, 0, meas.cache.ms, c.INST_HEIGHT);
                        p.pop();

                    }
                });
            }


            
            // draw all conflict boxes
            conflicts.forEach(func => func());

            // does this need to be updated with new cache system?

            // draw snap
            if (snaps.snapped_inst) {
                p.stroke(200, 240, 200);
                let x = snaps.snapped_inst.target * Window.scale + Window.viewport;
                p.line(x, Math.min(snaps.snapped_inst.origin, snaps.snapped_inst.inst)*c.INST_HEIGHT,
                    x, (Math.max(snaps.snapped_inst.origin, snaps.snapped_inst.inst) + 1)*c.INST_HEIGHT);
            };

            p.push();
            p.translate(10, c.INST_HEIGHT - 20);
            p.textSize(12);

            let MOUSE_OVER = (
                'type' in Mouse.rollover && 
                Mouse.rollover.type === 'instName_marking' &&
                Mouse.rollover.inst === i_ind
            );
            let SAME_INST = 'inst' in Window.instName && Window.instName.inst === i_ind;
            let name_text = inst.name;
            let blink = false;

            let textWidth;
            if (SAME_INST) {
                blink = (p.millis() % 1000) > 500;
                name_text = Window.instName.next;
                textWidth = p.textWidth(name_text.slice(0, Window.instName.pointer));
                let boxColor = p.color(colors.accent);
                boxColor.setAlpha(100);
                p.stroke(boxColor);
                p.fill(boxColor);
                p.rect(-3, -3, textWidth + 8, 17);
            }

            let nameColor = (SAME_INST || MOUSE_OVER) ?
                p.color(colors.accent) :
                p.color('rgba(0,0,0,0.25)');
            p.stroke(nameColor);
            p.fill(nameColor);
            p.textAlign(p.LEFT, p.TOP);
            p.text(name_text, 0, 0);
            if (blink)
                p.line(textWidth, 0, textWidth, 12);
            p.pop();
            p.pop();
        });
        if (conflict) {
            p.push();
            let cb = p.color(colors.accent);
            cb.setAlpha(100);
            p.fill(cb);
            p.rect(Window.ms_to_x(conflict[0]), 0, (conflict[1]-conflict[0])*Window.scale, instruments.length*c.INST_HEIGHT); 
            cb = p.color(colors.contrast);
            cb.setAlpha(100);
            p.fill(cb);
            p.rect(Window.ms_to_x(obstacles[0]), 0, (obstacles[1]-obstacles[0])*Window.scale, instruments.length*c.INST_HEIGHT); 
            p.pop();
        };


        if (Window.modulation || (Window.POLL_FLAG && Mouse.rollover.type === 'beat'))
            Window.drawTempoPicker(Mouse.rollover);

        if (/*Window.editor.type && */Window.modulation)
            Window.drawModWheel()

        if (Mouse.drag.mode === 'entry')
            Window.drawEntryTuplet();



        // draw snaps
        p.stroke(100, 255, 100);
        if (snaps.div_index >= 1)
            Object.keys(snaps.divs[snaps.div_index]).forEach(key => {
                let inst = snaps.divs[snaps.div_index][key][0].inst;
                let xloc = key*Window.scale + Window.viewport;
                let yloc = inst * c.INST_HEIGHT - Window.scroll;
                p.line(xloc, yloc, xloc, yloc + c.INST_HEIGHT);
            });

        // draw editor hover information
        if (Window.editor.type && Window.editor.hover_next_string && !Window.modulation) {
            if ('type' in Mouse.rollover) {
                p.push();
                let rollover_color = p.color(colors.primary);
                rollover_color.setAlpha(100);
                p.stroke(rollover_color);
                p.fill(rollover_color);

                // these are identical for now, but text should adapt
                // to avoid collisions with tempo line in the future
                if (Mouse.rollover.type === 'tempo') {
                    p.textAlign(p.LEFT, p.BOTTOM);
                    p.text(Window.editor.hover_next_string, p.mouseX, p.mouseY);
                } else if (Mouse.rollover.type === 'beat') {
                    p.textAlign(p.LEFT, p.BOTTOM);
                    p.text(Window.editor.hover_next_string, p.mouseX, p.mouseY);
                }
                p.pop();
            }
        }



        // draw editor frame
        /*if (Window.mode === 2 && Window.selected.meas) {
            
            let select = Window.selected.meas;
            let x = select.offset * Window.scale + Window.viewport;
            let y = Window.selected.inst*c.INST_HEIGHT - Window.scroll;

            let spread = Math.abs(Window.range.tempo[1] - Window.range.tempo[0]);
            let tempo_slope = (select.end - select.start)/select.timesig;
            let slope = tempo_slope/spread*c.INST_HEIGHT; 
            let base = (select.start - Window.range.tempo[0])/spread*c.INST_HEIGHT;


            // MOVE THIS BLOCK TO BEAT DRAWING BLOCK WHEN QUEUING
            let handle;
            if (Mouse.drag.mode === 'tempo' && 'temp' in select) {
                handle = [select.temp.beats[Mouse.drag.index]*Window.scale, y - c.PLAYBACK_HEIGHT, 10, 10]; 
                Mouse.cursor = 'ns-resize';
            } else if (Mouse.drag.mode !== 'tick') {
                for (let i=1; i < select.beats.length; i++) {
                    let xloc = select.beats[i-1]*Window.scale;
                    let xloc2 = select.beats[i]*Window.scale;
                    let width = xloc2-xloc;
                    let yloc = c.INST_HEIGHT - base - slope*(i-1);

                    let tolerance = 5;

                    let func = () => {
                        let ytarget = (p.mouseX-c.PANES_WIDTH-x-xloc)/width*slope + slope*(i-1) + base;
                        let mouseloc = p.mouseY-c.PLAYBACK_HEIGHT;
                        let tempo_target = c.INST_HEIGHT*(Window.selected.inst+1)-ytarget;
                        return (mouseloc < tempo_target + tolerance
                        && mouseloc > tempo_target - tolerance);
                    };
                };
            };
            
            Window.drawEditorFrame([x, y], handle);

        }
        */


            

        // draw cursor / insertMeas
        p.stroke(200);
        p.fill(240);

        p.line(p.mouseX-c.PANES_WIDTH, 0, p.mouseX-c.PANES_WIDTH, c.INST_HEIGHT*instruments.length);
        
        // INSERT MODE
        if (Window.mode === 1 && 'beats' in Window.insertMeas) {
            p.push();
            p.translate(Window.insertMeas.cache.offset, Window.insertMeas.inst*c.INST_HEIGHT);
            p.rect(0, 0, Window.insertMeas.cache.ms, c.INST_HEIGHT);
            p.stroke(255, 0, 0);
            Window.insertMeas.cache.beats.forEach(beat => p.line(beat, 0, beat, c.INST_HEIGHT));
            p.pop();
        };

        if (DEBUG) {
            Debug.push(`viewport: ${Window.viewport}`);
            Debug.push(`scale: ${Window.scale}`);
            Debug.push(`scroll: ${Window.scroll}`);
            Debug.push(`selected: ${Window.selected.inst}, ${Window.selected.meas ? Window.getSelection().join(', ') : ''}`);
            Debug.write({ x: 0, y: (instruments.length+1)*c.INST_HEIGHT + c.DEBUG_TEXT }, c.DEBUG_TEXT);
            Debug.frameRate();
            Debug.clear();
        };


        isPlaying = API.get('isPlaying');

        p.stroke(0);
        p.fill(0);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(12);

        
        if (isPlaying) {
            let tracking = API.exposeTracking().locator();
            // check for final measure here;
            if (tracking > Window.range.span[1] + 1000) {
                isPlaying = false;
                API.play(isPlaying, null);
            };
            let tracking_vis = tracking*Window.scale + Window.viewport;
            p.line(tracking_vis, c.PLAYBACK_HEIGHT, tracking_vis, c.INST_HEIGHT*2 + c.PLAYBACK_HEIGHT);
        };

        Mouse.dragCursorUpdate();


                

        p.pop();

        p.push();
        p.stroke(0);
        p.strokeWeight(5);
        if (p.mouseDown.x && p.mouseDown.y && DEBUG) {
            p.line(p.mouseDown.x, p.mouseDown.y, p.mouseDown.x + Mouse.drag.x, p.mouseDown.y + Mouse.drag.y);
        }
        p.pop();

        Window.drawPrinter(printer.pages);

        // draw lock menu
        if (Mouse.drag.mode === 'lock') {
            Window.drawLockMenu(Mouse.lock_type);
        }
       

        Window.drawPlayback();
        Window.drawTabs({ locator: API.exposeTracking().locator(), cursor_loc: Window.cursor_loc, isPlaying });
        Window.drawToolbar(Window.range);

        if (Window.newInst) {
            p.fill(255, 0, 0, 10);
            p.rect(0, c.PLAYBACK_HEIGHT + c.INST_HEIGHT*instruments.length - Window.scroll, p.width, c.INST_HEIGHT);
        };
            
        subs.forEach(sub => sub());

        // do that printout check thing here
        if (API.printoutCheck()) {
            // draw temporary printer window
            let height = instruments.length*c.INST_HEIGHT;
            Window.printDraw(printer.frames, height);
            // check drag
            if (Mouse.drag.type !== 'printerDrag' &&
                p.mouseY > c.PLAYBACK_HEIGHT &&
                p.mouseY < height + c.PLAYBACK_HEIGHT &&
                Object.keys(printer.frames).some(key => {
                    let frame = printer.frames[key];
                    let start = Window.ms_to_x(frame.start);
                    let end = Window.ms_to_x(frame.end);
                    if (p.mouseX > start - 5 && p.mouseX < start + 5) {
                        console.log(1);
                        Mouse._rollover = { type: 'printerDrag', id: key, edge: 'start' };
                        return true;
                    } else if (p.mouseX > end - 5 && p.mouseX < end + 5) {
                        console.log(2);
                        Mouse._rollover = { type: 'printerDrag', id: key, edge: 'end' };
                        return true;
                    }
                    return false;
                })
            ) {
                Mouse.cursor = 'ew-resize';
            // check confirm/cancel buttons, X rollover
            } else if (p.mouseY > height + 12 + c.PLAYBACK_HEIGHT &&
                p.mouseY < height + 26 + c.PLAYBACK_HEIGHT &&
                p.mouseX > p.width - 22 &&
                p.mouseX < p.width - 8
            ) {
                Mouse._rollover = { type: 'printerClose' };
                Mouse.cursor = 'pointer';               
            } else if (p.mouseY > height + c.PLAYBACK_HEIGHT + 40 &&
                p.mouseY < height + c.PLAYBACK_HEIGHT + 60
            ) {
                if (p.mouseX > p.width - 300 + 14 &&
                    p.mouseX < p.width - 300 + 64
                ) {
                    Mouse._rollover = { type: 'printerConfirm' };
                    Mouse.cursor = 'pointer';
                } else if (p.mouseX > p.width - 300 + 74 &&
                    p.mouseX < p.width - 300 + 124
                ) {
                    Mouse._rollover = { type: 'printerClear' };
                    Mouse.cursor = 'pointer';
                }
            } else {
                let X_y = c.PLAYBACK_HEIGHT + 14;
                Object.keys(printer.frames).forEach(key => {
                    let frame_X = Window.ms_to_x(printer.frames[key].start);
                    if (p.mouseX > frame_X && p.mouseX < frame_X + 14 &&
                        p.mouseY > c.PLAYBACK_HEIGHT && p.mouseY < X_y
                    ) {
                        Mouse._rollover = { type: 'printerDelete', id: key };
                        Mouse.cursor = 'pointer';
                    }
                });
            }
        }

        // mouse timer animation
        if (Window.editor.timer) {
            p.push();
            p.stroke(0);
            p.fill(0);
            p.translate(p.mouseX, p.mouseY);
            p.arc(0, 0, 12, 12, 0, p.TWO_PI * ((Window.editor.timer - p.frameCount) / 120));

            if (Window.editor.timer < p.frameCount) {
                console.log(Window.editor);
                Window.recalc_editor();
                Window.validate_editor((inst, id) => calc_gaps(instruments[inst].ordered, id).gaps);
                Window.editor.timer = null;
            }
            p.pop();
        }

            

    }

    p.keyReleased = function(e) {
        let mods = ['CTRL', 'SHIFT', 'MOD', 'ALT'];
        let mod_change_flag = false;
        mods.forEach(k => {
            if (e.keyCode === keycodes[k]) {
                Window.mods[k.toLowerCase()] = false;
                mod_change_flag = true;
            }
        })
        if (mod_change_flag)
            Mouse.eval_cursor(Window.mods, Window.selected.meas);

        if (!API.checkFocus() && Keyboard.checkNumRelease())
            return false;
        return false;
    }

    p.keyPressed = function(e) {
        if (API.modalCheck())
            return;

        let mods = ['CTRL', 'SHIFT', 'MOD', 'ALT'];
        let mod_change_flag = false;
        mods.forEach(k => {
            if (e.keyCode === keycodes[k]) {
                Window.mods[k.toLowerCase()] = true;
                mod_change_flag = true;
            }
        });

        // this updates the mouse cursor when turning mod keys on and off
        // (otherwise the cursor would only refresh on movement!)
        if (mod_change_flag)
            Mouse.eval_cursor(Window.mods);

        snaps.div_index = (Keyboard.num_counter) ?
            Keyboard.held_nums[Keyboard.held_nums.length-1] - 1 : 0;


        if (p.keyCode === ESC) {
            if (API.printoutCheck()) {
                //printer.clear();
                API.printoutSet(false);
            }
            if ('inst' in Window.instName) {
                Window.exit_instName();
                return;
            }
            if (Window.pasteMeas.length)
                return Window.exit_paste_mode();
            if (Window.modulation) {
                Window.set_modulation();
                if (Window.editor.type)
                    Window.editor_reject_hover();
                Mouse.drag.mode = '';
                return;
            }
            if (Window.editor.type)
                return Window.exit_editor(true, 
                    () => {
                        let r = gatherRanges();
                        Window.updateRange({ tempo: [r.min, r.max] });
                    });
            if (Window.entry.mode) {
                Mouse.resetDrag();
                return Window.toggle_entry();
            }
            if (Window.mode === 0)
                API.toggleInst(true)
            else
                API.updateMode(Window.mode = 0);
            return;
        };

        if ([...NUM, ...Object.keys(LETTERS).map(l => parseInt(l, 10)), DEL, BACK, LEFT, RIGHT, PERIOD].indexOf(p.keyCode) > -1) {
            if (Window.entry.mode) {
                e.preventDefault();
                return (Mouse.drag.mode === 'entry') ? 
                    Window.change_entry_tuplet(p.keyCode) : 
                    Window.change_entry_duration(p.keyCode);
            } else if (NUM.indexOf(p.keyCode) > -1 && Window.modulation) {
                e.preventDefault();
                Window.change_modulation(p.keyCode);
                return;
            } else if (Window.editor.type) {
                e.preventDefault();
                Window.change_editor(p.keyCode);
                return;
            } else if ('inst' in Window.instName) {
                e.preventDefault();
                Window.change_instName(p.keyCode);
                return;
            }
        }

        if (p.keyCode === keycodes.TAB) {
            if (Window.editor.type) {
                let types = ['start', 'end', 'timesig', 'denom'];
                return Window.editor.type = types[(types.indexOf(Window.editor.type) + 1) % 4];
            } else if (Mouse.drag.mode === 'entry') {
                e.preventDefault();
                return Window.toggle_entry_tuplet();
            }
        }

        if (p.keyCode === keycodes.ENTER) {
            if (Window.insertMeas.confirmed) {
                e.preventDefault();
                return API.enterSelecting();
            }
            if ('inst' in Window.instName) {
                e.preventDefault();
                Window.exit_instName((instName) => {
                    if (Window.instName.next)
                        API.updateInst(Window.instName.inst, { name: Window.instName.next });
                });
                return;
            }
            if (Window.editor.type) {
                e.preventDefault();
                // force calculation/validation if timer still running
                if (Window.editor.timer) {
                    Window.editor.timer = null;
                    Window.recalc_editor();
                    Window.validate_editor((inst, id) => calc_gaps(instruments[inst].ordered, id).gaps);
                }

                let selected = Window.editor.meas;
                if (selected.temp.invalid && ('start' in selected.temp.invalid || 'end' in selected.temp.invalid))
                    return;
                let updated = _.pick(selected, 
                    ['start', 'end', 'timesig', 'denom', 'offset', 'inst', 'id']
                );
                // overwrite, check for changes 
                let diff = false;
                ['start', 'end', 'timesig', 'denom'].forEach(key => {
                    updated[key] = parseFloat(Window.editor.next[key]);
                    diff = diff || (updated[key] === selected[key]);
                });
                if (!diff)
                    return Window.exit_editor(true, gatherRanges);
                updated.offset = Window.editor.temp_offset;
                Window.exit_editor();
                set_lock_persist(updated.inst, selected.id, Object.assign({}, { locks: selected.locks }));
                API.updateMeasure(updated);
                return;
            }
        }
            

        if (API.disableKeys()) 
            return;
        if (API.checkFocus()) // && Keyboard.checkNumPress())
            return;

        if (p.keyCode === KeyY && Window.selected.meas) {
            e.preventDefault();
            Window.copy();
            return false;
            //logger.log(`Copying measures ${copied.join(', ')}.`);
        } else if (p.keyCode === KeyP && Window.copied.length) {
            // new multiple-selection pasting code
            Window.enter_paste_mode();
            let breaks = global_gaps(
                instruments.map(i => i.ordered),
                Window.pasteMeas,
                true
            );
            Mouse.pasteMode(breaks);
            Mouse.move.filter_move();
            return;
        }

        if (p.keyCode === KeyE)
            return Window.toggle_entry();

        if (p.keyCode === KeyU) 
            return API.undo()
        else if (p.keyIsDown(CTRL) && (p.keyCode === KeyR))
            return API.redo();


        // CTRL/MOD functions
        if (p.keyIsDown(MOD)) {
            /*if (p.keyCode === KeyC && Window.selected.meas) {
                e.preventDefault();
                Window.copy();
                return false;
                //logger.log(`Copying measures ${copied.join(', ')}.`);
            } else if (p.keyCode === KeyV && Window.copied.length) {
                console.log(Window.copied);
                // new multiple-selection pasting code
                Window.enter_paste_mode();
                
                //console.log(Window.pasteMeas);
                let breaks = global_gaps(
                    instruments.map(i => i.ordered),
                    Window.pasteMeas,
                    true
                );
                Mouse.pasteMode(breaks);
                return;
            }
            */
            // ADD UNDO HISTORY HERE
            /*else if (p.keyCode === KeyZ)
                p.keyIsDown(SHIFT) ?
                    API.redo() : API.undo()
                    */
        };
        

        let dir = Keyboard.checkDirection();
        if (Window.selected.meas && dir) {
            if (dir === 'DOWN') {
                if (Window.selected.inst >= instruments.length - 1)
                    return;
                let ind = check_proximity_by_key(Window.selected.meas, instruments[Window.selected.inst + 1].ordered, 'offset');
                Window.select({ ind,
                    inst: Math.min(Window.selected.inst + 1, instruments.length - 1),
                    meas: instruments[Window.selected.inst + 1].ordered[ind],
                });
            } else if (dir === 'UP') { // || p.keyCode === UP) {
                if (Window.selected.inst <= 0)
                    return;
                let ind = check_proximity_by_key(Window.selected.meas, instruments[Window.selected.inst - 1].ordered, 'offset');
                Window.select({ ind,
                    inst: Math.max(Window.selected.inst - 1, 0),
                    meas: instruments[Window.selected.inst -1].ordered[ind],
                });
            } else if (dir === 'LEFT') { // || p.keyCode === LEFT) {
                let ind = Math.max(Window.selected.ind - 1, 0);
                Window.select({ ind,
                    inst: Window.selected.inst,
                    meas: instruments[Window.selected.inst].ordered[ind]
                });
            } else if (dir === 'RIGHT') { // || p.keyCode === RIGHT) {
                let ind =  Math.min(Window.selected.ind + 1, instruments[Window.selected.inst].ordered.length - 1);
                Window.select({ ind,
                    inst: Window.selected.inst,
                    meas: instruments[Window.selected.inst].ordered[ind]
                });
            };
            return;
        }


        if (p.keyCode === KeyI) {
            Window.mode = 1;
            API.updateMode(Window.mode);
            return;
        };

        if ((p.keyCode === DEL || p.keyCode === BACK)) {
            if (!API.checkFocus() && Window.selected.meas) {
                let to_delete = Window.getSelection().map(key => Window.selected[key]);
                Window.selected = Window.resetSelection();
                API.deleteMeasure(to_delete);
            }
            return;
        }

        if (p.keyCode === SPACE) {
            (Window.mode === 1) ?
                API.preview((p.mouseX - Window.viewport)/Window.scale) :
                API.play((p.mouseX - Window.viewport)/Window.scale);
            return;
        }

        return true;
    };

    p.mouseWheel = function(event) {
        if (API.modalCheck())
            return;
        if (p.mouseX < 0 || p.mouseX > p.width ||
            p.mouseY < 0 || p.mouseY > p.height
        )
            return;
        event.preventDefault();
        let zoom = p.keyIsDown(MOD);
        
        Window.updateCursorLoc();
        Window.updateView(event, { zoom });
        tick_zoom();

        // if zooming, recalculate location cache
        if (zoom) {
            if ('beats' in Window.insertMeas)
                Window.insertMeas.cache = calculate_insertMeas_cache(Window.insertMeas);
            if (Window.pasteMeas.length) {
                Window.pasteMeas.forEach(m => m.cache = Window.calculate_cache(m));
                Mouse.move.filter_move();
            }
            instruments.forEach(inst => {
                inst.ordered.forEach(meas => {
                    meas.cache = Window.calculate_cache(('temp' in meas) ? meas.temp : meas)
                    if (meas.schemas) {
                        let search = (s) => {
                            if (!s)
                                return;
                            s.cache = Window.calculate_schema_cache(meas.cache, s);
                            if (s.schemas)
                                s.schemaIds.forEach(id => search(s.schemas[id]))
                        }
                        meas.schemaIds.forEach(id => search(meas.schemas[id]));
                    }
                    if (meas.events)
                        meas.events.forEach(event =>
                            event.cache = Window.calculate_event_cache(meas, meas.cache, event)
                        );
                })
            });
            if (Mouse.rollover && Mouse.rollover.type === 'entry') {
                let meas = Mouse.rollover.meas;
                let PPQ_adjust = Window.CONSTANTS.PPQ*(4/meas.denom);
                // WHY IS DURATION STORED AS TICKS BUT BEAT ISN'T??
                Object.assign(Window.entry, Window.calculate_entry_cache(meas.cache,
                    Mouse.rollover.tick_start, Mouse.rollover.tick_dur));
            }

        }
        if (API.pollSelecting('offset'))
            insertMeasSelecting();
    };

    p.mousePressed = function(e) {
        let checks = [
            { name: 'API.modalCheck', func: API.modalCheck, },
            { name: 'tuts._mouseBlocker', func: tuts._mouseBlocker, },
            { name: 'Mouse.checkOrigin(p)', func: () => Mouse.checkOrigin(p)},
            { name: '[buttons, core_buttons]' , func: () => [...buttons, ...core_buttons]
                .some(click => click())
            },
        ];
        Mouse.pressInit(p, checks);

        if (Mouse.cancel)
            return;


        if (Window.pasteMeas.length) {
            let pasting = Window.confirm_paste(Mouse.move.origin_ms);
            Mouse.resetMove();
            API.newMeasure(pasting);
        }

        // all editor mode functions should be grouped together here.
        // confirming hover?
        if (Window.editor.type && Window.editor.hover_next_number) {
            //Window.editor_pending_hover();
            Mouse.pollMode();
            Window.set_modulation(Mouse.rollover);
            return;
        }

        // quitting editor?
        if (Window.editor.type && (
            !('meas' in Mouse.rollover) || !(Mouse.rollover.meas.id === Window.editor.meas.id)
        )) {
            Window.exit_editor(true, gatherRanges);
            return;
        }

        if (Window.entry.mode && Mouse.rollover.meas)
            return Mouse.entryMode();

        // polling mode functions
        if (Window.POLL_FLAG && Mouse.rollover.type === 'beat') {
            // check bounding box
            let frameY = p.mouseY - c.PLAYBACK_HEIGHT - Mouse.rollover.inst*c.INST_HEIGHT;
            let half_height = c.INST_HEIGHT * 0.5;
            if (frameY > half_height - 15 && frameY < half_height + 15) {
                Mouse.pollMode();
                Window.set_modulation(Mouse.rollover);
            }
            e.preventDefault();
            return;

        }

        


        // handle editor markings
        if (Mouse.rollover.type.indexOf('marking') > -1) {
            let type = Mouse.rollover.type.split('_')[0];
            if (type === 'instName')
                Window.enter_instName(Mouse.rollover.inst, instruments[Mouse.rollover.inst].name)
            else if (Window.editor.type && Window.editor.type !== type) {
                Window.recalc_editor();
                Window.validate_editor((inst, id) => calc_gaps(instruments[inst].ordered, id).gaps);
                Window.editor.timer = null;
                Window.editor.type = type
            } else
                Window.enter_editor(type, Mouse.rollover.inst, Mouse.rollover.meas);
            return;
        }



        // printing mode
        if (API.printoutCheck()) {
            if (Mouse.rollover.type === 'printerDrag') {
                Mouse.drag.mode = 'printerDrag';
                Mouse.drag.id = Mouse.rollover.id;
                Mouse.drag.edge = Mouse.rollover.edge;
                return;
            }
            // are we deleting a page? closing? clearing? confirming?
            else if (Mouse.rollover.type === 'printerClose') {
                API.printoutSet(false);
                return;
            } else if (Mouse.rollover.type === 'printerDelete') {
                printer.clear(Mouse.rollover.id);
                return;
            } else if (Mouse.rollover.type === 'printerClear') {
                printer.clear();
                return;
            } else if (Mouse.rollover.type === 'printerConfirm') {
                order_by_key(printer.frames, 'start').forEach((frame, i) => {
                    let img = printer.snapshot(instruments, (frame.end+frame.start)/2, { duration: Math.abs(frame.end - frame.start) });
                    // these still save individually... how to zip?
                    p.save(img, `bandit_${i}.png`);
                });
                return;
            }

            Mouse.printMode();
            let loc = x_to_ms(p.mouseX);
            Window.printAdjust({ start: loc, end: loc }); 
            return;
        }

        if (API.pollSelecting('offset') /*&& !Mouse.select('inst')*/) {
            API.confirmSelecting('offset', Window.insertMeas.inst, Window.insertMeas.temp_offset);
            e.preventDefault();
            return;
        }

        let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)/c.INST_HEIGHT);
        if (inst >= instruments.length || inst < 0)
            return;

        if ('meas' in Mouse.rollover && Mouse.rollover.meas.id in Window.selected) {
            if (Window.mods.shift) {
                if (Window.mods.mod)
                    Mouse.tickMode()
                else {
                    // map Window.selected hashmap to an array of measure objects,
                    let breaks = global_gaps(
                        instruments.map(i => i.ordered),
                        Window.getSelection()
                            .map(id => Window.selected[id])
                    );

                    Mouse.measureMode({ breaks });
                }
            } else if (Window.mods.mod) {
                if (Mouse.rollover.type === 'beat')
                    Mouse.beatLock()
                else if (Mouse.rollover.type === 'tempo')
                    Mouse.tempoMode();
            }
            return;
        };

        // on new selection, skip all other options
        if (Window.select(_.pick(Mouse.rollover, ['inst', 'meas'])))
            return true;

        API.displaySelected(Window.selected);
    }

    p.mouseDragged = function(event) {
        Mouse.drag.x = p.mouseX - p.mouseDown.x;
        Mouse.drag.y = p.mouseY - p.mouseDown.y;

        // for metric modulation menu
        if (Window.modulation) {
            let [frameX, frameY] = [p.mouseX - c.PANES_WIDTH, p.mouseY - c.PLAYBACK_HEIGHT];
            let [x, y] = [Window.modulation.origin.x(), Window.modulation.origin.y()];
            Window.modulation.zone = (frameX < x) ? 'Left' : 'Right';
            // skip if wheel not within reach
            if (Math.abs(frameX - x) < 20)
                return;

            let target = 'index' + Window.modulation.zone;
            // offset from center
            x += (frameX < x) ? -20 : 20;
            if (Window.modulation.menuLeft || Window.modulation.menuRight) {
                let diff = frameX - x - ((frameX < x) ? -6 : 6);
                let half_width = p.textWidth('18:18') * 0.5;
                if (diff < 0 && diff > -half_width) {
                    return Window.modulation.tuplet_zone = 0
                } else if (diff > 0 && diff < half_width) {
                    return Window.modulation.tuplet_zone = 1;
                }
            }
            delete Window.modulation.tuplet_zone;
            let dist = p.dist(x, y, frameX, frameY)
            if (dist > 30 && dist < 50) {
                let theta = p.atan((frameY - y)/(frameX - x));
                if (theta <= 1.5 && theta >= -1.5) {
                    let clamp_ratio = 5/3;
                    let index = Math.floor((theta+1.5) * clamp_ratio);
                    let old_index = Window.modulation[target];
                    // invert option indices, depending on side
                    Window.modulation[target] = (target === 'indexLeft') ? 4-index : index;
                    if ((!old_index) || (old_index !== Window.modulation[target])) {
                        Window.modulation['timer' + Window.modulation.zone] = p.frameCount + 12;
                        Window.calc_metric_modulation();
                    }
                }
                return;
            }
        }


        // printer drag
        if (Mouse.drag.mode === 'printer') {
            Window.printAdjust({ end: x_to_ms(p.mouseX) });
            return;
        };

        if (Mouse.drag.mode === 'printerDrag') {
            printer.frames[Mouse.drag.id][Mouse.drag.edge] = x_to_ms(p.mouseX);
            return;
        }

        // can't drag if haven't clicked
        if (!Mouse.drag.mode)
            return;

        // locking drag gets info for lock popup menu
        if (Mouse.drag.mode === 'lock') {
            Mouse.checkLock();
            return;
        }

        // still can't drag the first beat, this needs to be changed
        if (Mouse.rollover.beat === 0
            //|| Mouse.cancel
            || (!Window.selected.meas))
            return;

        // can't drag if nothing selected
        if (!(Window.selected.meas))
            return;




        // retrieve the target measure and calculate the measure's gaps, if not cached
        let measure = Mouse.rollover.meas/*Window.selected.meas*/;
        if (!('gaps' in measure))
            measure.gaps = calc_gaps(instruments[measure.inst].ordered, measure.id).gaps;
        if (!crowd_cache)
            crowd_cache = crowding(measure.gaps, measure.offset, measure.ms, { strict: true, context: { position: measure.offset, ms: measure.ms } });
        var crowd = crowd_cache;



        // find snap point closest to a position in other instruments
        var closest = (position, inst, div) =>
            Object.keys(snaps.divs[div]).reduce((acc, key, ind, keys) => {
                if (snaps.divs[div][key][0].inst === inst)
                    return acc;
                let gap = parseFloat(key, 10) - position;
                return (Math.abs(gap) < Math.abs(acc.gap) ? 
                    { target: parseFloat(key, 10), gap, inst: snaps.divs[div][key][0].inst } :
                    acc);
            }, { target: -1, gap: Infinity, inst: -1 });

        // wrapper for closest() that takes an array of beat candidates for snapping
        var snap_eval = (position, candidates, exempt) =>
            candidates.reduce((acc, candidate, index) => {
                let next = position + candidate;
                let target, gap, inst;
                ({ target, gap, inst } = closest(next, measure.inst, snaps.div_index));
                if (Math.abs(gap) < Math.abs(acc.gap)) {
                    if (exempt !== undefined && index === exempt) {
                        return acc;
                    }
                    return { index, target, gap, inst };
                }
                return acc;
            }, { index: -1, target: Infinity, gap: Infinity, inst: -1 });


        // initialize update
        var update = _.pick(measure, ['offset', 'start', 'end', 'id']);
        Object.assign(update, { beats: [], ticks: [] });
        

        const finalize = (moved) => {

            // need a skip here to prevent unnecessary cache calculations
            if (!moved) {
                let ranges = gatherRanges(measure.id);
                let [min, max] = update.start <= update.end ?
                    [update.start, update.end] : [update.end, update.start];
                let temprange = [Math.min(min, ranges.min), Math.max(max, ranges.max)];
                Window.updateRange({ temprange });
            }
            if (typeof update.length !== 'number') {
                update = [update];
            }
            update.forEach(meas => {
                let measure = Window.selected[meas.id];
                Object.assign(measure.temp, meas);
                measure.temp.invalid = {};
                let cache = Window.calculate_cache(measure.temp);
                Object.assign(measure, { cache });
            });
            

            //API.updateEdit(measure.temp.start, measure.temp.end, measure.timesig, measure.temp.offset);
            return;
        };

        // if we're just dragging measures, we have all we need now.
        if (Mouse.drag.mode === 'measure') {

            if (Window.editor.type) {
                // initialize update
                if ('temp' in measure)
                    Object.assign(update, _.pick(measure.temp, ['offset', 'start', 'end']));

                let position = Window.editor.temp_offset + Mouse.drag.x/Window.scale;
                let temp = measure.temp;
                let close = snap_eval(position, measure.beats);
                let crowd = crowding(measure.gaps, position, temp.ms, { center: true });
                Object.assign(update, {
                    ticks: temp.ticks.slice(0),
                    beats: temp.beats.slice(0),
                    offset: position
                });
                // initialize flag to prevent snapping when there's no space anyways
                let check_snap = true;
                if (Math.abs(crowd.start[1]) < Math.abs(crowd.end[1])) {
                    if (crowd.start[1] - c.SNAP_THRESHOLD*2 < 0) {
                        update.offset = crowd.start[0];
                        check_snap = false;
                    }
                } else {
                    if (crowd.end[1] - c.SNAP_THRESHOLD*2 < 0) {
                        update.offset = crowd.end[0] - temp.ms;
                        check_snap = false;
                    }
                }

                if (check_snap && close.index !== -1) {
                    let gap = close.target - (temp.beats[close.index] + position);
                    if (Math.abs(gap) < 50) {
                        snaps.snapped_inst = { ...close, origin: Window.editor.inst };
                        update.offset = position + gap;
                    } else
                        snaps.snapped_inst = {};
                };

                return finalize(true);
            }

            let dragged = Mouse.drag.x/Window.scale;
            let selections = Window.getSelection().map(id => Window.selected[id]);

            // backwards/forwards store remaining wiggle room
            let new_drag, bw, fw;
            [new_drag, bw, fw] = Mouse.drag.filter_drag(dragged);
            if (bw || fw) {
                // adding a snap check for dragged measure here
                let close = snap_eval(new_drag+measure.offset, measure.beats);
                if (close.index !== -1 && Math.abs(close.gap) < 50) {
                    let s_new_drag = Math.abs(new_drag + close.gap);
                    if ((s_new_drag > bw)
                        && (s_new_drag < fw)
                    ) {
                        new_drag += close.gap;
                        snaps.snapped_inst = { ...close, origin: measure.inst };
                    } else
                        snaps.snapped_inst = {};
                };
            }


            update = selections.map(select => {
                var meas_update = _.pick(select, ['beats', 'ticks', 'offset', 'start', 'end', 'id']);
                meas_update.offset += new_drag;
                return meas_update;
            });
            return finalize(true);
        };

        // the following are necessary for 'tempo'/'tick' drags

        // retrieve locks
        let lock_candidates = ('locks' in measure) ?
            Object.keys(measure.locks) : [];
        var beat_lock = lock_candidates.length ?
            ({ beat: parseInt(lock_candidates[0], 10), type: measure.locks[lock_candidates[0]] }) :
            {};

        // LENGTH GRADIENT DESCENT
        var nudge_factory = (measure, target, snap, beat_lock, locks, type) => {
            var start = measure.temp.start || measure.start;
            var end = measure.temp.end || measure.end;
            var slope = end - start;
            var offset = measure.temp.offset || measure.offset;
            var ms = measure.temp.ms || measure.ms;
            var lock_tempo = (beat_lock) ? 
                (slope/measure.timesig) * beat_lock.beat + start :
                0;

            let nudge = (gap, alpha, depth, even) => {
                if (depth > 99 || Math.abs(gap) < c.NUDGE_THRESHOLD) {
                    // last full calculation
                    let calc = Window.completeCalc(start, slope, measure.timesig, measure.denom);
                    ms = calc.ms;
                    return { start, end, slope, offset, ms, beats: calc.beats, ticks: calc.ticks, snap };
                }

                // initialize changes based on learning rate
                let delta = { start: alpha, end: alpha };
                // if start not locked
                if (!!(locks & (1 << 1)))
                    delta.start = 0;
                if (!!(locks & (1 << 2)))
                    delta.end = 0;

                // invert the changes applied to one side of the tempo slope if necessary
                if (type === 'rot_left')
                    delta.start *= -1;
                if (type === 'rot_right')
                    delta.end *= -1;

                // does this play well with rotations? gotta think that through
                start *= (gap > c.NUDGE_THRESHOLD) ?
                    (1 + delta.start) : (1 - delta.start);
                end *= (gap > c.NUDGE_THRESHOLD) ?
                    (1 + delta.end) : (1 - delta.end);
                slope = end - start;

                let calc_extracts = { snapped: snap };
                if (beat_lock) {
                    Object.assign(calc_extracts, { locked: beat_lock.beat });

                    // NEW ROTATION CORRECTION
                    if ((type === 'rot_left' || type === 'rot_right')) {
                        let adjust = ((slope/measure.timesig) * beat_lock.beat + start) - lock_tempo;
                        start -= adjust;
                        end -= adjust;
                    }
                }
                let calc = quickCalc(start, slope, measure.timesig, measure.denom, calc_extracts);
                let { locked, snapped } = calc;

                if (typeof(locked) === 'number') {// && beat_lock.type === 'loc')
                    // 'absolute' will shift everything around a locked point in absolute time
                    if ('absolute' in beat_lock) {
                        offset = beat_lock.absolute - locked;
                    } else {
                        // why is THIS LINE so difficult???
                        offset = measure.offset + measure.beats[beat_lock.beat] - locked;
                    }
                } else
                    // if nothing's locked, add half the distance from the previous length
                    // to keep the measure centered
                    offset += (ms - calc.ms)*0.5;

                ms = calc.ms;
                
                let new_gap = snapped + offset - target;
                console.log(gap, new_gap, snapped + offset, target);
                alpha = monitor(gap, new_gap, alpha);
                return nudge(new_gap, alpha, depth + 1, even);
            }

            return nudge;
        };

        const tweak_crowd_size = (update) => {
            console.log('Getting too big! Nudge #1');
            // can't really do this with a location lock
            if (beat_lock.type && beat_lock.type !== 'tempo')
                return;
            //update.offset = crowd.start[0];
            if (!nudge_cache || nudge_cache.type !== 1) {
                measure.temp.offset = crowd.start[0];
                // nudge factory - fill gap
                let nudge = nudge_factory(measure, crowd.end[0], measure.timesig, { beat: 0, type: 'loc', absolute: crowd.start[0] }, 
                    // use rotation type if 'tempo' lock
                    beat_lock.type === 'tempo' ? 'rot_right': 0
                );
                nudge_cache = nudge(crowd.end[0] - (crowd.start[0] - update.ms), 0.01, 0);
                nudge_cache.type = 1;
            }
            Object.assign(update, nudge_cache);
            update.offset = crowd.start[0];
            return update;
        }

        const tweak_crowd_previous = (update) => {
            console.log("Crowding previous measure! Nudge #2");
            if (beat_lock.type === 'loc' || beat_lock.type === 'both') {
                if (beat_lock.beat === 0)
                    return update;
                if (!nudge_cache || nudge_cache.type !== 2) {
                    measure.temp.offset = crowd.start[0];
                    let rot = update.offset > crowd.start[0] ? 'rot_left' : 'rot_right';
                    let nudge = nudge_factory(measure, crowd.start[0], 0, beat_lock, 0, beat_lock.type === 'both' ? rot : 0);
                    nudge_cache = nudge(update.offset - crowd.start[0], 0.01, 0);
                    nudge_cache.offset = crowd.start[0];
                    nudge_cache.type = 2;
                }
                Object.assign(update, nudge_cache);
            } else 
                update.offset = crowd.start[0];
            return update;
        };

        const tweak_crowd_next = (update) => {
            console.log("Crowding next measure! Nudge #3");
            // check for interference with the next measure
            if (beat_lock.type === 'loc' || beat_lock.type === 'both') {
                if (beat_lock.beat === measure.timesig)
                    return update;
                if (!nudge_cache || nudge_cache.type !== 3) {
                    measure.temp.offset = update.offset;
                    // the strategy here is to lock the standard beat, 
                    // then snap the end of the measure to crowd.end[0]

                    let rot = update.offset > crowd.start[0] ? 'rot_left' : 'rot_right';
                    let nudge = nudge_factory(measure, crowd.end[0], measure.timesig, { beat: beat_lock.beat, /*absolute: measure.offset + measure.beats[beat_lock.beat],*/ type: 'loc' }, 0, 
                        beat_lock.type === 'both' ? rot : 0);
                    nudge_cache = nudge(crowd.end[0] - update.offset - update.ms, 0.01, 0);
                    // correct for offset
                    nudge_cache.offset = crowd.end[0] - nudge_cache.ms;
                    nudge_cache.type = 3;
                }
                Object.assign(update, nudge_cache);
            } else
                update.offset = crowd.end[0] - update.ms;
            return update;
        };



        // begin tweaks
        if (Mouse.drag.mode === 'tempo') {
            let spread = Window.range.tempo[1] - Window.range.tempo[0];
            let change = Mouse.drag.y / c.INST_HEIGHT * spread;

            // we need to first conditionally check the new length!
            // if nothing is tempo-locked
            if (!('beat' in beat_lock) || beat_lock.type === 'loc') {
                update.start = measure.start - (!(locks & (1 << 1)) ? change : 0);
                update.end = measure.end - (!(locks & (1 << 2)) ? change : 0);

                // no ridiculous values... yet
                if (update.start < 10 || update.end < 10) 
                    return;

                let calc = Window.completeCalc(update.start, update.end-update.start, measure.timesig, measure.denom);
                Object.assign(update, calc);
            // this should work for type === 'both' - DRY this up later
            } else if (beat_lock.type) {
                // must "rotate" slope line around a preserved pivot point
                //
                // this new algo feels more sensible but still might be too sensitive
                let slope = (measure.end - measure.start)/measure.timesig;
                let slope_change = change * (Mouse.grabbed >= beat_lock.beat ? -1 : 1);

                if (beat_lock.beat === 0)
                    update.end += slope_change
                else {
                    let new_slope = slope + slope_change;
                    let pivot = slope * beat_lock.beat;
                    let new_pivot = new_slope * beat_lock.beat;
                    update.start = measure.start + (pivot - new_pivot);
                    update.end = new_slope * measure.timesig + update.start;
                }

                // no ridiculous values... yet
                if (update.start < 10 || update.end < 10) 
                    return;
                
                let calc = Window.completeCalc(update.start, update.end - update.start, measure.timesig, measure.denom);
                Object.assign(update, calc);
            }

            
            // IS THE THING JUST TOO BIG?
            // very unlikely with a location lock?
            if (update.ms > crowd.end[0] - crowd.start[0]) {
                console.log('Getting too big! Nudge #1');
                update = tweak_crowd_size(update);
                update.offset = crowd.start[0];
                return finalize();
            }

            // shift offset depending on 'loc' lock
            update.offset += (!beat_lock.type || beat_lock.type === 'tempo') ?
                (measure.ms - update.ms)/2 : 
                measure.beats[beat_lock.beat] - update.beats[beat_lock.beat];


            // check if the adjustment crowds the previous or next measures
            if (update.offset < crowd.start[0] + c.SNAP_THRESHOLD) {
                update = tweak_crowd_previous(update);
            } else if (update.offset + update.ms > crowd.end[0] - c.SNAP_THRESHOLD) {
                update = tweak_crowd_next(update);
            }

            return finalize();
        }
      
        if (Math.abs(Mouse.drag.x) < c.DRAG_THRESHOLD_X)
            return;
        
        if (Mouse.drag.mode === 'tick') {
            // 'tick' drag is dependent on zoom, so we need to gather that info first.
            let beatscale = (-Mouse.drag.x*Window.scale);

            let slope = measure.end - measure.start;

            let perc = Math.abs(slope) < c.FLAT_THRESHOLD ?
                // where did dir here come from??
                ((Window.selected.dir === 1) ? -c.FLAT_THRESHOLD : c.FLAT_THRESHOLD) :
                Mouse.grabbed/Math.abs(slope);

            let amp_lock = beatscale/perc;

            if (beat_lock.type === 'tempo' || beat_lock.type === 'both') {
                /* tick dragging with a tempo lock presents a problem -
                 * measure expansion/contraction is parabolic when
                 * maintaining tempo at a lock point.
                 *
                 * we can predict whether an initial drag will expand or
                 * contract based on how far/how many ticks into the measure the lock is
                 *
                 * if locked at less than half,
                 * drag right increases slope, drag left decreases slope
                 *
                 * if locked at more than half,
                 * drag right decreases slope, drag left increases slope
                 *
                 * for now, the behavior of this is just gonna feel kinda weird.
                 */

                // increase slope, then lower both start/end to maintain beat lock tempo;
                // comparable to a 'rot_right' nudge.

                // with first beat loc-locked, this feels better as subtraction than addition.
                update.end += amp_lock;
                let slope = update.end - update.start;
                let lock_tempo_diff = slope/measure.timesig * beat_lock.beat - (measure.end - measure.start)/measure.timesig * beat_lock.beat;
                update.start -= lock_tempo_diff;
                update.end -= lock_tempo_diff;
            } else {
                update.start += amp_lock/2;
                update.end += amp_lock/2;
            }

            const SNAP_THRESH = 2.0;
            // if DIRECTION is locked
            if (locks & (1 << 3)) {
                // flat measure can't change direction
                if (!Window.selected.dir)
                    return;
                let slope = update.end - update.start;
                if (slope * Window.selected.dir < SNAP_THRESH) {
                    measure.temp.slope = 0;
                    if (locks & (1 << 2))
                        update.start = measure.end;
                    else if (locks & (1 << 1))
                        update.end = measure.start;
                }
            };


            let calc = Window.completeCalc(update.start, update.end-update.start, measure.timesig, measure.denom);
            Object.assign(update, calc);


            // shift offset depending on 'loc' lock
            update.offset += (!beat_lock.type || beat_lock.type === 'tempo') ?
                (measure.ms - update.ms)/2 : 
                measure.beats[beat_lock.beat] - update.beats[beat_lock.beat];


            let loc = calc.beats[Mouse.drag.grab] + update.offset;

            // LEAVING OFF HERE

            // check for overlaps
            //crowd = crowding(measure.gaps, update.offset, calc.ms);
            if (update.ms > crowd.end[0] - crowd.start[0]) {
                update = tweak_crowd_size(update);
                return finalize();
            } 

            // check if the adjustment crowds the previous or next measures
            // bypass if first or last beats are 'loc' locked
            let loc_lock = (beat_lock.type === 'both' || beat_lock.type === 'loc') &&
                (beat_lock.beat === 0 || beat_lock.beat === measure.timesig);
            if (update.offset < crowd.start[0] + c.SNAP_THRESHOLD && !loc_lock) {
                update = tweak_crowd_previous(update);
                return finalize();
            } else if (update.offset + update.ms > crowd.end[0] - c.SNAP_THRESHOLD && !loc_lock) {
                update = tweak_crowd_next(update);
                return finalize();
            }

            let close_calc = closest(loc, measure.inst, snaps.div_index);
            let snap_to = close_calc.target;
            
            let gap = loc - snap_to;

            if (Math.abs(gap) < c.SNAP_THRESHOLD) {
                // if initial snap, update measure.temp.start 
                // for the last time and nudge.
                if (!nudge_cache || nudge_cache.type !== 5) {
                    measure.temp.start = update.start;

                    // nudge factory - tick mouse drag, snap to adjacent measure beats
                    let type = (beat_lock.type === 'tempo' || beat_lock.type === 'both') ?
                        ((gap > 0) ? 'rot_right' : 'rot_left') : 0;

                    let nudge = nudge_factory(measure, snap_to, Mouse.drag.grab, beat_lock, locks, type); 
                    nudge_cache = nudge(gap, 0.001, 0);
                    nudge_cache.type = 5;
                };
                Object.assign(update, nudge_cache);
            } else
                nudge_cache = false;

            return finalize();
        }

    };

    p.mouseReleased = function(event) {

        p.mouseDown = false;
        if (Mouse.cancel) {
            Mouse.cancel = false;
            if (!Mouse.drag.mode) {
                return;
            }
        }

        if (Mouse.drag.mode === 'entry') {
            Window.confirm_event();
            Mouse.resetDrag();
            return;
        }

        if (Mouse.drag.mode === 'printer') {
            Mouse.resetDrag();
            if (Window.printTemp.end - Window.printTemp.start > 500)
                printer.push(Window.printTemp);
            Window.printCancel();
            return;
        }

        if (Mouse.drag.mode === 'lock') {
            Window.lockConfirm(Mouse.rollover.meas, Mouse.lock_type);
            Mouse.resetDrag();
            return;
        }

        if (Mouse.drag.mode === 'modulation') {
            let next = Window.modulation.next || Window.modulation.base;

            Window.set_modulation();
            Mouse.resetDrag();

            if (Window.editor.type) {
                Window.editor.hover_next_number = next;
                Window.editor.hover_next_string = next.toString();
                Window.editor_confirm_hover();
                return;
            }
            if (API.pollSelecting('start')) 
                API.confirmPoll('start', next)
            else if (API.pollSelecting('end'))
                API.confirmPoll('end', next);
            return;

        }

        if (Mouse.lock_type)
            Mouse.lock_type = null;

        nudge_cache = false;
        crowd_cache = false;

        if (!(Mouse.rollover.meas)
            || p.mouseY < 0 || p.mouseY > p.height
        ) {
            Mouse.resetDrag();
            return;
        }

        // process drag results

        if (!Mouse.drag.mode)
            return;
        if (Window.range.temprange) {
            Window.updateRange({ tempo: Window.range.temprange });
            delete Window.range.temprange;
        }

        let selected = Mouse.rollover.meas;
        // request that locks persist after API updateMeasure()
        let lock_persistence = () => {
            if ('locks' in selected)
                set_lock_persist(selected.inst, selected.id, Object.assign({}, { locks:  selected.locks }));
        }

        if (Mouse.drag.mode === 'measure') {
            if (Window.editor.type)
                Window.editor.temp_offset = Window.editor.meas.temp.offset
            else {
                lock_persistence();
                selected = Window.getSelection().map(id => {
                    let returned = Object.assign({}, _.pick(Window.selected[id], [
                        'inst', 'id', 'start', 'end', 'timesig', 'denom'
                    ]));
                    return Object.assign(returned, _.pick(Window.selected[id].temp, ['offset']));
                });
                API.updateMeasure(selected);  
            }
            Mouse.resetDrag();
            return;
        } else if (Mouse.drag.mode === 'tick' || Mouse.drag.mode === 'tempo') {
            lock_persistence();
            let update = _.pick(selected, ['inst', 'id', 'timesig', 'denom']);
            Object.assign(update, _.pick(selected.temp, ['offset', 'start', 'end']));
            API.updateMeasure(update);  
            Mouse.resetDrag();
        };

        return;
    }

    p.mouseMoved = function(event) {
        if (!(p.mouseX > 0 && p.mouseX < p.width &&
            p.mouseY > 0 && p.mouseY < p.height
        )) {
            return false;
        }

        Window.updateCursorLoc();

        if (Mouse.move.type === 'paste')
            return Mouse.move.filter_move();

        if (API.pollSelecting('offset')) {
            insertMeasSelecting();
            API.newCursor((p.mouseX - Window.viewport - c.PANES_WIDTH)/Window.scale, { insertMeas: Window.insertMeas.temp_offset });
            // return without changing rollover??
            return false;
        }


        // if editor is open, reset any hover selection
        if (Window.editor.type)
            Window.editor_hover(null);


        // checking for rollover.
        // which instrument?
        let y_loc = p.mouseY - c.PLAYBACK_HEIGHT + Window.scroll;
        let inst = Math.floor(y_loc/c.INST_HEIGHT);
        if (inst < instruments.length && inst >= 0) {
            let instrument = instruments[inst];
            // translating to viewport
            let X = p.mouseX - c.PANES_WIDTH;
            let frameX = X - Window.viewport;
            let frameY = y_loc % c.INST_HEIGHT;
            // check for inst name rollover
            //
            p.push();
            p.textSize(12);
            let nameWidth = p.textWidth(instrument.name);
            p.pop();
            if ((frameY >= c.INST_HEIGHT - 20) &&
                (X <= nameWidth + 10) &&
                (frameY <= c.INST_HEIGHT - 12) &&
                (X >= 10)
            ) {
                Mouse.setRollover({ type: 'instName_marking', inst });
            // check for measure rollover
            } else if (!instrument.ordered.some(meas => {
                if ((frameX > meas.cache.offset)
                    && (frameX < meas.cache.offset + meas.cache.ms)
                ) {

                    // translating to measure
                    let frameXmeas = frameX - meas.cache.offset;

                    // fifth pass -_-
                    if (Window.entry.mode) {
                        let note = Math.pow(2, Window.entry.duration);
                        let inc = meas.denom / Math.max(note, meas.denom);
                        let beat_dur = meas.denom / note;

                        // convert tick index to beat decimal
                        let tick_perc = 1/meas.cache.ticks.length;
                        let perc;
                        // default to end
                        let frac = meas.timesig;
                        let last = 0;
                        meas.cache.ticks.slice(1).some((tick,i) => {
                            if (tick > frameXmeas) {
                                let remainder = (frameXmeas - last)/(tick-last);
                                perc = (i+remainder)*tick_perc;
                                frac = perc * meas.timesig;
                                return true;
                            }
                            last = tick;
                        });

                        let in_schema = false;

                        let beat = Math.round(frac/inc);
                        let beat_start = beat * inc;
                        let nominal = [[beat+1, Math.max(note, meas.denom)].join('/')];
                        let stack = [];
                        let traverse = (frac, child) => {
                            if (!child.schemas)
                                return child;
                            let in_schema = false;
                            if (child.schemaIds.some(id => {
                                let schema = child.schemas[id];
                                if (gte(frac, schema.beat_start) && lt(frac, schema.beat_end))
                                    return in_schema = traverse(frac, schema);
                            }))
                                return in_schema;
                            return child;
                        };
                        if (meas.schemas) {
                            let search = input => 
                                (id => {
                                    let s = meas.schemas[id];
                                    // shortcut if cursor is before all later schemas
                                    if (lt(input, s.beat_start))
                                        return true;
                                    if (gte(input, s.beat_start) && lt(input, s.beat_end))
                                        return in_schema = traverse(input, s);
                                });

                            meas.schemaIds.some(search(frac));
                            //let beat;
                            if (in_schema) {
                                console.log(beat_start);
                                let inc = (in_schema.beat_end - in_schema.beat_start) / in_schema.tuplet[0];
                                //nominal.push(
                                let div_relation = in_schema.basis / Math.max(note, in_schema.basis);
                                let div = inc * div_relation;
                                let schema_start = frac - in_schema.beat_start;
                                beat = Math.round(schema_start/div);
                                beat_start = beat * div + in_schema.beat_start;
                                in_schema = false;
                            }
                            // search again for duration
                            meas.schemaIds.some(search(beat_start));
                            if (in_schema) {
                                console.log(in_schema);
                                inc = (in_schema.beat_end - in_schema.beat_start) / in_schema.tuplet[0];
                                nominal = [[(beat+1).toString(), note].join('/')];
                                let dur_relation = in_schema.basis / note;
                                beat_dur = inc * dur_relation;
                                // clip duration at end of schema ?
                                if (gt(beat_start + beat_dur, in_schema.beat_end))
                                    beat_dur = in_schema.beat_end - beat_start;
                                let sschema = in_schema;
                                while (sschema) {
                                    nominal.push(`(${sschema.nominal}, ${sschema.beat})`);
                                    sschema = sschema.parent;
                                }
                            }
                        }
                        let PPB = Window.CONSTANTS.PPQ*(4/meas.denom);


                        let rollover = { meas, inst, type: 'entry', 
                            nominal, beat: (beat+1).toString(), note,
                            beat_start, beat_dur,
                            tick_start: beat_start*PPB,
                            tick_dur: beat_dur*PPB,
                            schema: in_schema
                        };
                        Object.assign(Window.entry, Window.calculate_entry_cache(meas.cache, rollover.tick_start, rollover.tick_dur));
                        Mouse.setRollover(rollover);
                        return true;
                    }

                    // check markings
                    let bounds = meas.cache.bounding;
                    if (['start_tempo_marking', 'end_tempo_marking', 'timesig_marking'].some((type, ind) => {
                        let bounds = meas.cache.bounding[ind];
                        if (frameXmeas > bounds[0] && frameXmeas < bounds[2] && 
                            frameY > bounds[1] && frameY < bounds[3]
                        ) {
                            Mouse.setRollover({ type, inst, meas });
                            return true;
                        }
                        return false;
                    }))
                        return true;


                    // check for beat rollover
                    if (!meas.cache.beats.some((beat, ind) => {
                        if ((frameXmeas > beat - c.ROLLOVER_TOLERANCE) &&
                            (frameXmeas < beat + c.ROLLOVER_TOLERANCE)
                        ) {
                            let tempo = (meas.end - meas.start)/meas.timesig * ind + meas.start;
                            Mouse.setRollover({ type: 'beat', inst, meas, beat: ind, tempo });
                            if ((Window.editor.type === 'start' || Window.editor.type === 'end') && Window.editor.meas.id !== meas.id) {
                                Window.editor_hover(tempo);
                            }
                            return true;
                        } else if (ind < meas.cache.beats.length-1) { // last beat has no "graph"
                            // translating to tempo graph segment
                            let graph = meas.cache.graph[ind];
                            if (frameXmeas > graph[0] && frameXmeas < graph[2]) {
                                let y = graph[1] - (frameXmeas-beat)*meas.cache.graph_ratios[ind];
                                if (frameY > y - c.ROLLOVER_TOLERANCE &&
                                    frameY < y + c.ROLLOVER_TOLERANCE
                                ) {
                                    let rollover = { type: 'tempo', inst, meas, beat: ind };
                                    if ((Window.editor.type === 'start' || Window.editor.type === 'end') && Window.editor.meas.id !== meas.id) {
                                        let spread = meas.cache.beats[ind + 1] - beat;
                                        let perc = (frameXmeas - beat)/spread;
                                        let PPQ_adjust = Window.CONSTANTS.PPQ / (meas.denom / 4);
                                        let tick = Math.round(perc * PPQ_adjust) + ind*PPQ_adjust;
                                        // should the user be able to select the tempo graph of the edited measure?
                                        let tempo = (tick * (meas.end - meas.start) / meas.ticks.length) + meas.start;
                                        Window.editor_hover(tempo);
                                        Object.assign(rollover, { tick, tempo });
                                    }
                                    Mouse.setRollover(rollover);
                                    return true;
                                }
                            }
                            return false;
                        } else
                            return false;
                    }))
                        Mouse.setRollover({ type: 'measure', inst, meas });
                    return true;
                } else
                    return false;
            }))
                Mouse.setRollover({ type: 'inst', inst });
        }

        // set cursor based on Mouse.rollover
        Mouse.eval_cursor();

        return false;
    };
    
}

