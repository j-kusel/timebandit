/**
 * P5js sketch for main display
 * @module sketch
 */

import { order_by_key, check_proximity_by_key, parse_bits } from '../Util/index.js';
//import { bit_toggle } from '../Util/index.js';
import logger from '../Util/logger.js';
import c from '../config/CONFIG.json';
import { primary, secondary, secondary_light2 } from '../config/CONFIG.json';
import { colors } from 'bandit-lib';
//import { secondary, secondary_light, } from '../config/CONFIG.json';
//import _ from 'lodash';
import _Window from '../Util/window.js';
import _Mouse from '../Util/mouse.js';
import _Keyboard from '../Util/keyboard.js';
import { Debugger } from '../Util/debugger.js';
import Printer from '../Util/printer.js';
import keycodes from '../Util/keycodes.js';
import { CTRL, MOD } from '../Util/keycodes.js';
import tutorials from '../Util/tutorials/index.js';


const DEBUG = process.env.NODE_ENV === 'development';
const SLOW = process.env.NODE_ENV === 'development';

var API = {};
var K;

var div;

var input;

// finds adjacent measures and returns their location and distance
var crowding = (gaps, position, ms, options) => {
    let center = (options && 'center' in options) ? options.center : false;
    let strict = (options && 'strict' in options) ? options.strict : false;
    let final = position + ms;
    let mid = position + ms/2;
    if (final <= gaps[0][1]) 
        return { start: [-Infinity, Infinity], end: [gaps[0][1], gaps[0][1] - (final)] };
    let last_gap = gaps.slice(-1)[0];
    if (position > last_gap[0])
        return { start: [last_gap[0], position - last_gap[0]], end: [Infinity, Infinity] };
        
    return gaps
        .reduce((acc, gap, ind) => {
            // does it even fit in the gap?
            if (gap[1] - gap[0] < ms - (strict ? c.NUDGE_THRESHOLD*2 : 0))
                return acc;
            let start = [gap[0], position - gap[0]];
            let end = [gap[1], gap[1] - final];

            // attempt 3: is the start or end 

            // trying something new... base closest gap on the center of the given spread,
            // in relation to the start or end of available gaps.
            if (center) {
                let target = (gap[0]+acc.end[0])/2;
                // if the previous gap start is -Infinity and 
                //if ((!isFinite(acc.start[0]) && )
                //    || mid < (gap[0]+acc.end[0])/2))
                if (isFinite(target) && mid < target)
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



const [SPACE, DEL, BACK, ESC] = [32, 46, 8, 27];
//const [SHIFT, ALT] = [16, 18];
const [KeyC, KeyI, KeyV] = [67, 73, 86];
//const [KeyH, KeyJ, KeyK, KeyL] = [72, 74, 75, 76];
//const [KeyZ] = [90];
//const [LEFT, UP, RIGHT, DOWN] = [37, 38, 39, 40];
const NUM = []
for (let i=48; i < 58; i++)
    NUM.push(i);

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

// holds arrays of beats by measure id key, MOVE THIS LATER
var locked = {};



export default function measure(p) {
    // monkey-patching Processing for a p.mouseDown function
    p.mouseDown = false;

    var instruments = [];

    // temporary holding for editing measures
    var copied;

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
            let inst = Math.floor(0.01*(p.mouseY - c.PLAYBACK_HEIGHT));
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
                    Window.insertMeas.temp_offset = x_loc;;
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
        let which = null;
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

    var calculate_cache = (meas) => {
        let cache = {
            offset: meas.offset*Window.scale,
            beats: meas.beats.map(b => b * Window.scale),
            ticks: meas.ticks.map(t => t * Window.scale),
            ms: meas.ms*Window.scale,
        }
        Object.assign(meas, { cache });
        Object.assign(meas.cache, Window.calculate_tempo_cache(meas));
        return cache;
    }

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
        p.background(255);
        p.textSize(10);
        console.log(p.textWidth('P'));
        /*input = p.createInput('');
        input.style('z-index: 1');
        input.elt.onchange = (e) => console.log('changed!', e);
        */
    };

    p.windowResized = function () {
        p.resizeCanvas(p.windowWidth - c.CANVAS_PADDING * 2, p.windowHeight - c.FOOTER_HEIGHT);
        // override Y scroll
        Window.updateView({ deltaX: 0, deltaY: 0 }, {});
    }

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        console.log('REDRAWING');

        instruments = props.instruments;
        Window.insertMeas = props.insertMeas;
        Window.selected = props.selected || ({ inst: -1, meas: undefined });
        Window.editMeas = props.editMeas;
        Window.panels = props.panels;
        Window.mode = props.mode;
        Window.insts = props.instruments.length;
        Object.assign(API, props.API);
        Window.setUpdateViewCallback(API.reportWindow);

        // THIS SHOULD BE MOVED INTO APP.JS WITH DEPENDENCIES
        // PASSED IN THE OTHER DIRECTION!
        API.registerTuts(tuts);

        

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

        var beat_lock = {};
        if (Window.selected.meas && 'locks' in Window.selected.meas) {
            let lock_candidates = Object.keys(Window.selected.meas.locks);
            if (lock_candidates.length)
                beat_lock = { beat: lock_candidates[0], type: Window.selected.meas.locks[lock_candidates[0]] };
        }

        // reset select, begin logging on update
        if (Window.selected.inst > -1 && Window.selected.meas)
            Window.selected.meas = instruments[Window.selected.inst].measures[Window.selected.meas.id];

        if ('ms' in Window.editMeas) {
            Window.selected.meas.temp = Window.editMeas;
            if ('beat' in beat_lock)
                Window.selected.meas.temp.offset = Window.selected.meas.temp.offset + Window.selected.meas.beats[beat_lock.beat] - Window.editMeas.beats[beat_lock.beat];
        } else if (Window.selected.meas && 'temp' in Window.selected.meas)
            delete Window.selected.meas.temp;

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
            inst.gap_cache = calcGaps(inst.ordered, '');
        });

        // calculate beat visual locations for all measures
        instruments.forEach(inst => {
            inst.ordered.forEach(meas => {
                calculate_cache(meas);
            });
        });

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
                    for (let i=0; i < measure.ticks.length; i += div) {
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
                inst.ordered.forEach(meas => 
                    Object.assign(meas.cache, Window.calculate_tempo_cache(meas))
                )
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

            // moving into Window.drawMeas?
            inst.ordered.forEach((measure, m_ind) => {
                let key = measure.id;

                // set FLAG_TEMP if drawing a temporary measure?
                let FLAG_TEMP = 'temp' in measure;

                let cache = measure.cache;
                var [ticks, beats, offset, ms] = 
                    [cache.ticks, cache.beats, cache.offset, cache.beats.slice(-1)[0]];
                var [start, end] = FLAG_TEMP ?
                    [measure.temp.start || measure.start, measure.temp.end || measure.end] :
                    [measure.start, measure.end];
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
                if (Window.selected.meas && key === Window.selected.meas.id) {
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
                Window.drawTimesig(measure.timesig, '4', measure);

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

                            // handle blinking cursor
                            let blink = p.millis() % 1000;
                            if (blink > 500) {
                                p.push();
                                p.stroke(0);
                                let w = p.textWidth(next.slice(0, Window.editor.pointer))
                                    + m.text[1];
                                // correct for 'end' textAlign
                                if (ind)
                                    w -= p.textWidth(next);
                                let bound = cache.bounding[ind];
                                p.line(w, bound[1] - 2, w, bound[3] - 2);
                                p.pop();
                            }
                        }
                    }
                    p.text(...text);
                });
                // return from measure translate
                p.pop();

            });

            // does this need to be updated with new cache system?

            // draw snap
            if (snaps.snapped_inst) {
                p.stroke(200, 240, 200);
                let x = snaps.snapped_inst.target * Window.scale + Window.viewport;
                p.line(x, Math.min(snaps.snapped_inst.origin, snaps.snapped_inst.inst)*c.INST_HEIGHT,
                    x, (Math.max(snaps.snapped_inst.origin, snaps.snapped_inst.inst) + 1)*c.INST_HEIGHT);
            };

            let nameColor = p.color('rgba(0,0,0,0.25)');
            p.stroke(nameColor);
            p.fill(nameColor);
            p.textAlign(p.LEFT, p.TOP);
            p.text(inst.name, 10, c.INST_HEIGHT - 20);
            p.pop();
        });

        // draw snaps
        p.stroke(100, 255, 100);
        if (snaps.div_index >= 1)
            Object.keys(snaps.divs[snaps.div_index]).forEach(key => {
                let inst = snaps.divs[snaps.div_index][key][0].inst;
                let xloc = key*Window.scale + Window.viewport;
                let yloc = inst * c.INST_HEIGHT - Window.scroll;
                p.line(xloc, yloc, xloc, yloc + c.INST_HEIGHT);
            });


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
        if (Window.mode === 1) {
            let inst = Math.floor(0.01*(p.mouseY-c.PLAYBACK_HEIGHT));
            // if placing/placed measure with the mouse
            if (API.pollSelecting() || ('temp_offset' in Window.insertMeas)) {
                if (inst < instruments.length && inst >= 0) {
                    p.push();
                    p.translate(Window.insertMeas.cache.offset, inst*c.INST_HEIGHT);
                    p.rect(0, 0, Window.insertMeas.cache.ms, c.INST_HEIGHT);
                    p.stroke(255, 0, 0);
                    if ('beats' in Window.insertMeas)
                        Window.insertMeas.cache.beats.forEach(beat => p.line(beat, 0, beat, c.INST_HEIGHT));
                    p.pop();
                }
            }
        };

        if (DEBUG) {
            Debug.push(`viewport: ${Window.viewport}`);
            Debug.push(`scale: ${Window.scale}`);
            Debug.push(`scroll: ${Window.scroll}`);
            Debug.push(`selected: ${Window.selected.inst}, ${Window.selected.meas ? Window.selected.meas.id : ''}`);
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

        if (Window.panels) {
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
        })

        // this updates the mouse cursor when turning mod keys on and off
        // (otherwise the cursor would only refresh on movement!)
        if (mod_change_flag)
            Mouse.eval_cursor(Window.mods, Window.selected.meas);

        snaps.div_index = (Keyboard.num_counter) ?
            Keyboard.held_nums[Keyboard.held_nums.length-1] - 1 : 0;


        if (p.keyCode === ESC) {
            if (API.printoutCheck()) {
                //printer.clear();
                API.printoutSet(false);
            }
            if (Window.editor.type) {
                Window.exit_editor();
                return;
            }
            if (Window.mode === 0)
                API.toggleInst(true);
            else {
                Window.mode = 0;
                API.updateMode(Window.mode);
            }
            return;
        };

        let num = NUM.indexOf(p.keyCode);
        if (Window.editor.type) {
            let type = Window.editor.type;
            let next = Window.editor.next[type];
            let pointer = Window.editor.pointers[type];
            let dir = Keyboard.checkDirection();
            if (num > -1) {
                Window.editor.next[type] = 
                    next.slice(0, pointer)
                    + num
                    + next.slice(pointer);
                Window.editor.pointers[type]++;
            } else if (p.keyCode === DEL || p.keyCode === BACK) {
                if (pointer !== 0) {
                    Window.editor.next[type] =
                        next.slice(0, pointer - 1)
                        + next.slice(pointer);
                    Window.editor.pointers[type]--;
                }
                return;
            } else if (dir === 'LEFT') {
                Window.editor.pointers[type] = Math.max(0, pointer - 1);
                return;
            } else if (dir === 'RIGHT') {
                Window.editor.pointers[type] = Math.min(pointer + 1, next.length);
                return;
            }
        }

        if (p.keyCode === keycodes.TAB && Window.editor.type) {
            e.preventDefault();
            let types = ['start', 'end', 'timesig'];
            let next = (types.indexOf(Window.editor.type) + 1) % 3;
            Window.editor.type = types[next];
            return;
        }

        if (p.keyCode === keycodes.ENTER) {
            if (Window.insertMeas.confirmed) {
                e.preventDefault();
                return API.enterSelecting();
            }
            if (Window.editor.type) {
                e.preventDefault();
                // THIS NEEDS CROWDING VALIDATION
                let type = Window.editor.type;
                let selected = Window.editor.meas;
                let updated = Object.keys(Window.editor.next).reduce(
                    (acc, key) => Object.assign(acc, { [key]: parseInt(Window.editor.next[key], 10) }), {});
                updated.inst = Window.editor.inst;
                Window.exit_editor();
                // check if anything's changed
                if (['start', 'end', 'timesig'].some(p => (updated[p] !== selected[p])))
                    API.updateMeasure(updated.inst, selected.id, updated.start, updated.end, updated.timesig, measure.offset);
                return;
            }
        }
            

        if (API.disableKeys()) 
            return;
        if (API.checkFocus()) // && Keyboard.checkNumPress())
            return;


        // CTRL/MOD functions
        if (p.keyIsDown(MOD)) {
            if (p.keyCode === KeyC
                && Window.selected.meas
            ) {

                logger.log(`Copying measure ${Window.selected.meas.id}.`);
                copied = Window.selected.meas; //instruments[Window.selected.inst].measures[Window.selected.meas];
                return;
            } else if (p.keyCode === KeyV && copied) {
                API.paste(Window.selected.inst, copied, (p.mouseX-Window.viewport-c.PANES_WIDTH)/Window.scale);
                return;
            }
            /* ADD UNDO HISTORY HERE
            else if (p.keyCode === KeyZ)
                p.keyIsDown(SHIFT) ?
                    API.redo() : API.undo();
            */
        };

        let dir = Keyboard.checkDirection('arrows');
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

        /*if (p.keyCode === KeyV) {
            Window.mode = 2;
            //API.displaySelected(Window.selected);
            API.updateMode(Window.mode);
            return;
        };*/


        if ((p.keyCode === DEL || p.keyCode === BACK)) {
            if (!API.checkFocus() && Window.selected.meas) {
                let to_delete = Window.selected;
                Window.selected = { inst: -1 };
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
            instruments.forEach(inst => {
                inst.ordered.forEach(meas => {
                    calculate_cache(meas);     
                })
            })
        }
        if (API.pollSelecting())
            insertMeasSelecting();
    };

    p.mousePressed = function(e) {
        let checks = [
            { name: 'API.modalCheck', func: API.modalCheck, },
            { name: 'tuts._mouseBlocker', func: tuts._mouseBlocker, },
            {name: 'Mouse.checkOrigin(p)', func: () => Mouse.checkOrigin(p)},
            { name: '[buttons, core_buttons]' , func: () => [...buttons, ...core_buttons]
                .some(click => click())
            },
            { name: 'Mouse.checkTempo(Window.mode)', func: () => Mouse.checkTempo(Window.mode)},
            { name: 'Window.insertMeas.confirmed', func: () => (Window.insertMeas.confirmed)},
        ];
        Mouse.pressInit(p, checks);

        // ############################################## HOW DOES MOUSE.CANCEL EVEN WORK?
        if (Mouse.cancel)
            return;

        if (Mouse.rollover.type.indexOf('marking') > -1) {
            Window.enter_editor(Mouse.rollover.type.split('_')[0], Mouse.rollover.inst, Mouse.rollover.meas)
            return;
        }

        let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)/c.INST_HEIGHT);
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

        if (API.pollSelecting() && !Mouse.select('inst')) {
            API.confirmSelecting(inst, Window.insertMeas.temp_offset);
            e.preventDefault();
            Window.insertMeas.inst = inst;
            return;
        }

        if (inst >= instruments.length || inst < 0)
            return;

        Mouse.select();

        if (Window.selected.meas) {
            if (Window.mods.shift) {
                if (Window.mods.mod)
                    Mouse.tickMode()
                else
                    Mouse.measureMode();
            } else if (Window.mods.mod) {
                Mouse.beatLock();
            }
        };

        API.displaySelected(Window.selected);
    }

    p.mouseDragged = function(event) {
        Mouse.drag.x = p.mouseX - p.mouseDown.x;
        Mouse.drag.y = p.mouseY - p.mouseDown.y;

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
            || Window.selected.meas === -1)
            return;

        // can't drag if nothing selected
        if (!(Window.selected.meas))
            return;



        // retrieve the target measure and calculate the measure's gaps, if not cached
        let measure = Window.selected.meas;
        if (!('gaps' in measure))
            measure.gaps = calcGaps(instruments[Window.selected.inst].ordered, Window.selected.meas.id);
        if (!crowd_cache)
            crowd_cache = crowding(measure.gaps, measure.offset, measure.ms, { strict: true });
        var crowd = crowd_cache;

        // initialize update
        var update = {
            beats: [], ticks: [], offset: measure.offset,
            start: measure.start,
            end: measure.end
        };

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
                ({ target, gap, inst } = closest(next, Window.selected.inst, snaps.div_index));
                if (Math.abs(gap) < Math.abs(acc.gap)) {
                    if (exempt !== undefined && index === exempt) {
                        return acc;
                    }
                    return { index, target, gap, inst };
                }
                return acc;
            }, { index: -1, target: Infinity, gap: Infinity, inst: -1 });

        const finalize = () => {
            let temprange = [Math.min(update.start, Window.range.tempo[0]), Math.max(update.end, Window.range.tempo[1])];
            Window.updateRange({ temprange });
            Object.assign(measure.temp, update);
            let cache = {
                offset: measure.temp.offset*Window.scale,
                beats: measure.temp.beats.map(b => b*Window.scale),
                ticks: measure.temp.ticks.map(t => t*Window.scale),
                ms: measure.temp.ms*Window.scale
            };
            Object.assign(measure, { cache });

            let tempo_cache = Window.calculate_tempo_cache(measure);

            Object.assign(measure.cache, tempo_cache);
            API.updateEdit(measure.temp.start, measure.temp.end, measure.timesig, measure.temp.offset);
            return;
        };

        // if we're just dragging measures, we have all we need now.
        if (Mouse.drag.mode === 'measure') {
            let position = measure.offset + Mouse.drag.x/Window.scale;
            let close = snap_eval(position, measure.beats);

            // determine whether start or end are closer
            // negative numbers signify conflicts
            let crowd = crowding(measure.gaps, position, measure.ms, { center: true });
            Object.assign(update, {
                ticks: measure.ticks.slice(0),
                beats: measure.beats.slice(0),
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
                    update.offset = crowd.end[0] - measure.ms;
                    check_snap = false;
                }
            }

            if (check_snap && close.index !== -1) {
                let gap = close.target - (measure.beats[close.index] + position);
                if (Math.abs(gap) < 50) {
                    snaps.snapped_inst = { ...close, origin: Window.selected.inst };
                    update.offset = position + gap;
                } else
                    snaps.snapped_inst = {};
            };
            
            return finalize();
        };

        // the following are necessary for 'tempo'/'tick' drags

        // retrieve locks
        let lock_candidates = ('locks' in Window.selected.meas) ?
            Object.keys(Window.selected.meas.locks) : [];
        var beat_lock = lock_candidates.length ?
            ({ beat: parseInt(lock_candidates[0], 10), type: Window.selected.meas.locks[lock_candidates[0]] }) :
            {};

        var PPQ_mod = Window.CONSTANTS.PPQ / Window.CONSTANTS.PPQ_tempo;
        // does this renaming really help things?
        var snap = Mouse.drag.grab;

        // tick_array is the total number of tempo updates for the measure
        var tick_array = Array.from({
            length: Window.selected.meas.timesig * Window.CONSTANTS.PPQ_tempo
        }, (__, i) => i);

        // calculates only tempo change ticks.
        // returns beats/tempo ticks and requested individual ticks according to key
        var quickCalc = (start, slope, timesig, extract) => {
            var K = 60000.0 * timesig / slope;
            var sigma = (n) => 1.0 / ((start * Window.CONSTANTS.PPQ_tempo * K / 60000.0) + n);
            // convert extractions to ticks
            let extract_tick_locations = Object.keys(extract)
                .reduce((acc, key) => 
                    ({ ...acc, [extract[key] * Window.CONSTANTS.PPQ_tempo]: key })
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

            // default snap target to end if nowhere else
            // ####### this seems like it could be unpredictable behavior, not sure if i like it
            if (!('snapped' in returned)) 
                returned.snapped = returned.ms;
            return returned;
        };

        var completeCalc = (start, slope, timesig) => {
            let tick_total = timesig * Window.CONSTANTS.PPQ;
            let inc = slope/tick_total;
            let last = 0;
            let ms = 0;
            var PPQ_mod = Window.CONSTANTS.PPQ / Window.CONSTANTS.PPQ_tempo;
            let beats = [];
            let ticks = [];
            for (let i=0; i<tick_total; i++) {
                if (!(i%Window.CONSTANTS.PPQ))
                    beats.push(ms);
                ticks.push(ms);
                if (i%PPQ_mod === 0) 
                    last = Window.CONSTANTS.K / (start + inc*i);
                ms += last;
            };
            beats.push(ms);
            return { beats, ticks, ms }
        }

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
                    let calc = completeCalc(start, slope, measure.timesig);
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
                let calc = quickCalc(start, slope, measure.timesig, calc_extracts);
                let { locked, snapped } = calc;

                if (typeof(locked) === 'number') {// && beat_lock.type === 'loc')
                    // 'absolute' will shift everything around a locked point in absolute time
                    if ('absolute' in beat_lock) {
                        offset = beat_lock.absolute - locked;
                    } else {
                        // why is THIS LINE so difficult???
                        offset = (/*measure.temp.offset || */measure.offset) + measure.beats[beat_lock.beat] - locked;
                        // changed recently, check this out if there are problems
                        //offset = measure.offset + measure.beats[beat_lock.beat] - locked;
                    }
                } else
                    // if nothing's locked, add half the distance from the previous length
                    // to keep the measure centered
                    offset += (ms - calc.ms)*0.5;

                ms = calc.ms;
                
                let new_gap = snapped + offset - target;
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
                if (!nudge_cache || nudge_cache.type !== 2) {
                    measure.temp.offset = crowd.start[0];
                    let rot = update.offset > crowd.start[0] ? 'rot_left' : 'rot_right';
                    let nudge = nudge_factory(measure, crowd.start[0], 0, beat_lock, 0, beat_lock.type === 'both' ? rot : 0);
                    nudge_cache = nudge(update.offset - crowd.start[0], 0.01, 0);
                    nudge_cache.offset = crowd.start[0];
                    nudge_cache.type = 2;
                }
                console.log(update);
                let a = Object.assign(update, nudge_cache);
                console.log(a);
            } else 
                update.offset = crowd.start[0];
            return update;
        };

        const tweak_crowd_next = (update) => {
            console.log("Crowding next measure! Nudge #3");
            // check for interference with the next measure
            if (beat_lock.type === 'loc' || beat_lock.type === 'both') {
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

        // if we move this to a separate function, what globals does it depend on?
        // measure
        // lock_candidates
        // locks, i guess
        // crowd_cache
        // crowding
        // Window.CONSTANTS.K
        // nudge_cache
        // 
        // y-drag
        if (Mouse.drag.mode === 'tempo') {
            let spread = Window.range.tempo[1] - Window.range.tempo[0];
            let change = Mouse.drag.y / c.INST_HEIGHT * spread;
            var beat_lock = Object.keys(measure.locks).length ?
                ({ beat: parseInt(lock_candidates[0], 10), type: Window.selected.meas.locks[lock_candidates[0]] }) : {};
            
            // can't drag a grabbed beat.
            if (beat_lock.beat === Mouse.grabbed)
                return;

            // we need to first conditionally check the new length!
            // if nothing is tempo-locked
            //update = { beats: [], ticks: [], offset: measure.offset };
            if (!('beat' in beat_lock) || beat_lock.type === 'loc') {
                update.start = measure.start - (!(locks & (1 << 1)) ? change : 0);
                update.end = measure.end - (!(locks & (1 << 2)) ? change : 0);

                // no ridiculous values... yet
                if (update.start < 10 || update.end < 10) 
                    return;

                let calc = completeCalc(update.start, update.end-update.start, measure.timesig);
                Object.assign(update, calc);
            // this should work for type === 'both' - DRY this up later
            } else if (beat_lock.type) {
                // must "rotate" slope line around a preserved pivot point
                let slope = (measure.end - measure.start)/measure.timesig;
                let new_slope = slope*Mouse.grabbed - change;
                let pivot = slope * beat_lock.beat;
                let fresh_slope = (new_slope - pivot) / (Mouse.grabbed - beat_lock.beat);
                update.start = (new_slope + measure.start) - fresh_slope*Mouse.grabbed;
                update.end = (fresh_slope*measure.timesig) + update.start;

                // no ridiculous values... yet
                if (update.start < 10 || update.end < 10) 
                    return;
                
                let calc = completeCalc(update.start, fresh_slope*measure.timesig, measure.timesig);
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
      
        if (Math.abs(Mouse.drag.x) < c.DRAG_THRESHOLD_X) {
            //delete measure.temp;
            return;
        } 


        
        if (Mouse.drag.mode === 'tick') {
            // 'tick' drag is dependent on zoom, so we need to gather that info first.
            let beatscale = (-Mouse.drag.x*Window.scale);

            let slope = measure.end - measure.start;
            var temp_start;

            let perc = Math.abs(slope) < c.FLAT_THRESHOLD ?
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

            // NEED TO RETHINK THIS WHOLE SYSTEM
            // these should be generalized to other drag modes.
            // if START is locked
            // change slope, preserve start
            /*
            if (locks & (1 << 1)) {
                //slope += amp_lock;
                update.end += amp_lock;
            }
            // if END is locked
            // change slope, preserve end by changing start to compensate
            else if (locks & (1 << 2)) {
                //slope -= amp_lock;
                update.start += amp_lock;
            // if SLOPE is locked
            // split change between start and end
            } else if (locks & (1 << 4)) {
                //slope += amp_lock/2; 
                update.start += amp_lock/2;
                update.end += amp_lock/2;
            } else {
                // right now it defaults to preserving slope
                update.start += amp_lock/2;
                update.end += amp_lock/2;
                //slope += amp_lock/2; 
                //update.start = measure.start + amp_lock/2;
            };
            */

            const SNAP_THRESH = 2.0;
            // if DIRECTION is locked
            if (locks & (1 << 3)) {
                // flat measure can't change direction
                if (!Window.selected.dir)
                    return;
                let slope = update.end - update.start
                if (slope * Window.selected.dir < SNAP_THRESH) {
                    measure.temp.slope = 0;
                    if (locks & (1 << 2))
                        update.start = measure.end;
                    else if (locks & (1 << 1))
                        update.end = measure.start;
                }
                /*inc = (Window.selected.dir === 1) ?
                    Math.max(inc, 0) : inc;
                if (locks & (1 << 2))
                    measure.temp.start = (Window.selected.dir === 1) ?
                        Math.min(measure.temp.start, measure.end) :
                        Math.max(measure.temp.start, measure.end);
                        */
            };


            //let { ms, locked, grabbed } = quickCalc(temp_start, slope, measure.timesig, { locked: beat_lock.beat, grabbed: snap });
            let calc = completeCalc(update.start, update.end-update.start, measure.timesig);
            Object.assign(update, calc);

            // i don't really think this is necessary, but i was going
            // for a scale-based drag threshold. better ways to implement this.
            /*if (Math.abs(calc.ms - measure.ms) < c.DRAG_THRESHOLD_X) {
                measure.temp.offset = measure.offset;
                measure.temp.start = measure.start;
                slope = measure.end - measure.start;
                return;
            };
            */


            /*let temp_offset = locked ?
                measure.offset + measure.beats[beat_lock.beat] - locked :
                measure.offset;
                */
            /*update.offset = beat_lock.type ?
                measure.offset + measure.beats[beat_lock.beat] - calc.beats[beat_lock.beat] :
                update.offset;
                */

            // shift offset depending on 'loc' lock
            update.offset += (!beat_lock.type || beat_lock.type === 'tempo') ?
                (measure.ms - update.ms)/2 : 
                measure.beats[beat_lock.beat] - update.beats[beat_lock.beat];


            let loc = calc.beats[snap] + update.offset;

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

            let snap_to = closest(loc, Window.selected.inst, snaps.div_index).target;
            
            let gap = loc - snap_to;

            if (Math.abs(gap) < c.SNAP_THRESHOLD) {
                // if initial snap, update measure.temp.start 
                // for the last time and nudge.
                if (!nudge_cache || nudge_cache.type !== 5) {
                    measure.temp.start = update.start;

                    // nudge factory - tick mouse drag, snap to adjacent measure beats
                    let type = (beat_lock.type === 'tempo' || beat_lock.type === 'both') ?
                        ((gap > 0) ? 'rot_right' : 'rot_left') :
                            //'rot_left' : 'rot_right'
                        0;

                    let nudge = nudge_factory(measure, snap_to, snap, beat_lock, locks, type); 
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
        console.log('NOT CANCELLING');

        if (Mouse.drag.mode === 'printer') {
            Mouse.resetDrag();
            if (Window.printTemp.end - Window.printTemp.start > 500)
                printer.push(Window.printTemp);
            Window.printCancel();
            return;
        }

        if (Mouse.drag.mode === 'lock') {
            Window.lockConfirm(Window.selected.meas, Mouse.lock_type);
            Object.assign(Mouse.drag, { x: 0, y: 0, mode: '' });
            return;
        }

        if (Mouse.lock_type)
            Mouse.lock_type = null;

        nudge_cache = false;
        crowd_cache = false;

        if (p.mouseY < 0 || p.mouseY > p.height) {
            Mouse.drag.mode = '';
            return;
        }
        
        // handle threshold
        if (Math.abs(Mouse.drag.x) < c.DRAG_THRESHOLD_X &&
            Math.abs(Mouse.drag.y) < c.DRAG_THRESHOLD_X
        ) {
            if (Window.selected.meas)
                delete Window.selected.meas.temp;
            Mouse.resetDrag();
            return;
        };

        if (!(Window.selected.meas)) {
            Mouse.resetDrag();
            return;
        }

        let measure = Window.selected.meas;
        if (Window.range.temprange) {
            Window.updateRange({ tempo: Window.range.temprange });
            delete Window.range.temprange;
        }

        if (Mouse.drag.mode === 'tempo') {
            API.updateMeasure(Window.selected.inst, Window.selected.meas.id, measure.temp.start, measure.temp.end, measure.beats.length - 1, measure.temp.offset);
            if (Window.selected.meas) {
                delete Window.selected.meas.temp;
            }
            Object.assign(Mouse.drag, { x: 0, y: 0, mode: '' });
            return;
        };

        if (Mouse.drag.mode === 'measure') {
            API.updateMeasure(Window.selected.inst, Window.selected.meas.id, measure.start, measure.end, measure.beats.length - 1, measure.temp.offset);
            Object.assign(Mouse.drag, { x: 0, y: 0, mode: '' });
            return;
        };

        if (Mouse.drag.mode === 'tick') {
            let end = measure.temp.end;
            measure.temp.ticks = [];
            Object.assign(Mouse.drag, { x: 0, y: 0, mode: '' });
            if (end < 10)
                return;
            
            API.updateMeasure(Window.selected.inst, Window.selected.meas.id, measure.temp.start, end, measure.beats.length - 1, measure.temp.offset);
        };
    }

    p.mouseMoved = function(event) {
        if (!(p.mouseX > 0 && p.mouseX < p.width &&
            p.mouseY > 0 && p.mouseY < p.height
        )) {
            return false;
        }

        Window.updateCursorLoc();

        if (API.pollSelecting()) {
            insertMeasSelecting();
            API.newCursor((p.mouseX - Window.viewport - c.PANES_WIDTH)/Window.scale, { insertMeas: Window.insertMeas.temp_offset });
            // return without changing rollover??
            return false;
        }


        // checking for rollover.
        // which instrument?
        let y_loc = p.mouseY - c.PLAYBACK_HEIGHT + Window.scroll;
        let row_calc = (y_loc) /  c.INST_HEIGHT;
        let inst_row = Math.floor(y_loc/c.INST_HEIGHT);
        if (inst_row < instruments.length && inst_row >= 0) {
            let inst = instruments[inst_row];
            // translating to viewport
            let frameX = p.mouseX - c.PANES_WIDTH - Window.viewport;
            let frameY = y_loc % c.INST_HEIGHT;
            // check for measure rollover
            if (!inst.ordered.some(meas => {
                if ((frameX > meas.cache.offset)
                    && (frameX < meas.cache.offset + meas.cache.ms)
                ) {
                    // translating to measure
                    let frameXmeas = frameX - meas.cache.offset;

                    // check markings
                    // CACHE THE BOUNDING BOX #############

                    let bounds = meas.cache.bounding;
                    if (['start_tempo_marking', 'end_tempo_marking', 'timesig_marking'].some((type, ind) => {
                        let bounds = meas.cache.bounding[ind];
                        if (frameXmeas > bounds[0] && frameXmeas < bounds[2] && 
                            frameY > bounds[1] && frameY < bounds[3]
                        ) {
                            Mouse.setRollover({ type, inst: inst_row, meas });
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
                            Mouse.setRollover({ type: 'beat', inst: inst_row, meas, beat: ind });
                            return true;
                        } else if (ind < meas.cache.beats.length-1) { // last beat has no "graph"
                            // translating to tempo graph segment
                            let graph = meas.cache.graph[ind];
                            if (frameXmeas > graph[0] && frameXmeas < graph[2]) {
                                let y = graph[1] - (frameXmeas-beat)*meas.cache.graph_ratios[ind];
                                if (frameY > y - c.ROLLOVER_TOLERANCE &&
                                    frameY < y + c.ROLLOVER_TOLERANCE
                                ) {
                                    Mouse.setRollover({ type: 'tempo', inst: inst_row, meas, beat: ind });
                                    return true;
                                }
                            }
                            return false;
                        } else
                            return false;
                    }))
                        Mouse.setRollover({ type: 'measure', meas });
                    return true;
                } else
                    return false;
            }))
                Mouse.setRollover({ type: 'inst', inst: inst_row });
        }

        // set cursor based on Mouse.rollover
        Mouse.eval_cursor(Window.mods, Window.selected.meas);

        return false;
    };
    
}

