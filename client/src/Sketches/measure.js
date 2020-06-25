import { order_by_key, check_proximity_by_key } from '../Util/index.js';
import c from '../config/CONFIG.json';
import { primary, secondary, secondary_light, secondary_light2 } from '../config/CONFIG.json';
import _ from 'lodash';

var scale = 1.0;
var viewport = 0;
var range = [0, 100];
var span = [Infinity, -Infinity];

const DEBUG = true;
const SLOW = true;

const [MOD, SHIFT, CTRL, ALT, SPACE, DEL, BACK, ESC] = [17, 16, 91, 18, 32, 46, 8, 27];
const [KeyC, KeyI, KeyV, KeyH, KeyJ, KeyK, KeyL] = [67, 73, 86, 72, 74, 75, 76];
//const [KeyZ] = [90];
//const [LEFT, UP, RIGHT, DOWN] = [37, 38, 39, 40];
const NUM = []
for (let i=48; i < 58; i++)
    NUM.push(i);


// CAN THIS BE CACHED?
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

var initialize_temp = (measure) => ({
    start: measure.start,
    end: measure.end,
    ms: measure.ms,
    ticks: measure.ticks,
    beats: measure.beats,
    offset: measure.offset
});


var bit_toggle = (list, item) => list ^ (1 << item);

var parse_bits = (n) => {
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

var monitor = (gap, new_gap, alpha) => {
    let progress = Math.abs(gap) - Math.abs(new_gap);
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
};
    


// takes mouse location and boundaries, returns boolean for if mouse is inside
/*var mouseBounding = (p, bounds) =>
    
    */

class MouseInfo {
    constructor() {
        this.grabbed = 0;
        this.drag = {
            x: 0, y: 0,
            mode: '',
        };
        this.outside_origin = true;
        this.rollover = {};
        this.cursor = 'default';
        this.translate = [];
    }

    get loc() {
        return this.translate.slice(-1)[0];
    }

    push(t) {
        let last = this.translate.slice(-1)[0];
        if (last)
            this.translate.push({
                x: last.x + t.x,
                y: last.y + t.y
            })
        else
            this.translate.push(t);
    }

    pop() {
        return this.translate.pop();
    }
};

var Mouse = new MouseInfo();

export default function measure(p) {

    var API, CONSTANTS;
    var instruments = [];
    var insertMeas = {};
    var editMeas = {};
    var mode = 0;
    var panels = false;
    var locks = 0;



    var selected = { };

    var modifiers = 0;
    var dir;
    var locked = {};
    var snaps = {
        divs: [],
        div_index: 0,
        snapped_inst: {}
    };
    var nudge_cache = false;
    var crowd_cache = false;
    var isPlaying = false;
    

    var debug_messages = [];

    var copied;


    // modes: ESC, INS, EDITOR

    var beat_rollover = (beat, index) => {
        if (Mouse.drag.x)
            return false;
        let translated = p.mouseX - Mouse.loc.x;
        if (translated > beat-c.ROLLOVER_TOLERANCE && translated < beat+c.ROLLOVER_TOLERANCE)
            return true;
    };

    var bit_loader = (acc, mod, ind) =>
        p.keyIsDown(mod) ?
            acc |(1 << (ind + 1)) : acc;

    var mod_check = (keys, mods) => 
        (typeof(keys) === 'object') ?
            keys.reduce((bool, key) =>
                bool && (mods & (1 << key)) !== 0, true)
            : (mods & (1 << keys)) !== 0;

    var num_check = () =>
        p.keyIsDown(SHIFT) ?
            NUM.reduce((acc, num, ind) =>
                p.keyIsDown(num) ? 
                    [...acc, ind] : acc, []) :
            [];
    

    var blockText = (lines, coords, fontSize)  => {
        let font = fontSize || c.FONT_DEFAULT_SIZE;
        let lineY = (y) => font*y + coords.y;
        lines.forEach((line, i) => p.text(line, coords.x, lineY(i)));
    };

    var updateSelected = (newSelected) => {
        if ('meas' in selected) {
            if (selected.meas.id === newSelected.meas.id)
                return;
            editMeas = {};
            delete selected.meas.temp;
        }
        Object.assign(selected, newSelected);
        API.displaySelected(selected);
    }

    p.setup = function () {
        p.createCanvas(p.windowWidth - c.CANVAS_PADDING * 2, p.windowHeight - c.FOOTER_HEIGHT);
        p.background(255);
    };

    p.windowResized = function () {
        p.resizeCanvas(p.windowWidth - c.CANVAS_PADDING * 2, p.windowHeight - c.FOOTER_HEIGHT);
    }

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        debug_messages = [];
        instruments = props.instruments;
        insertMeas = props.insertMeas;

        editMeas = props.editMeas;
        panels = props.panels;
        mode = props.mode;
        ({ API, CONSTANTS } = props);

        var beat_lock = ('meas' in selected && selected.meas.id in locked && locked[selected.meas.id].beats) ?
            parse_bits(locked[selected.meas.id].beats) : [];

        // reset select, begin logging on update
        if (selected.inst > -1 && 'meas' in selected)
            selected.meas = instruments[selected.inst].measures[selected.meas.id];
            



        if ('ms' in editMeas) {
            selected.meas.temp = editMeas;
            if (beat_lock.length === 1)
                selected.meas.temp.offset = selected.meas.temp.offset + selected.meas.beats[beat_lock[0]] - editMeas.beats[beat_lock[0]];
        } else if ('meas' in selected && 'temp' in selected.meas) {
            delete selected.meas.temp;
        }

        if ('locks' in props)
            locks = props.locks.reduce((acc, lock) => (acc |= (1 << lock)), 0); 

        // REFACTOR ORDERING INTO NUM ITERATIONS LATER
        instruments.forEach((inst) => {
            inst.ordered = order_by_key(inst.measures, 'offset');
            if (inst.ordered.length) {
                let last = inst.ordered[inst.ordered.length - 1];
                span = [
                    Math.min(span[0], inst.ordered[0].offset),
                    Math.max(span[1], last.offset + last.ms)
                ];
            }
        });

        // rewrite this
        snaps.divs = NUM.slice(1).reduce((acc, num, n_ind) => {
            let add_snaps = {};
            let div = CONSTANTS.PPQ / (n_ind + 1);
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

        range = CONSTANTS.range;
        

    }

    p.draw = function () {
        debug_messages = [];
        if (SLOW)
            p.frameRate(10);

        // reset Mouse.rollover cursor
        Mouse.cursor = 'default';

        // key check
        modifiers = [CTRL, SHIFT, MOD, ALT].reduce(bit_loader, 0);
        let nums = num_check();
        snaps.div_index = (nums.length) ?
            nums[0] - 1 : 0;

        // DRAW BACKGROUND
        p.stroke(secondary_light);
        p.fill(secondary_light);
        p.rect(0, 0, p.width, p.height);
       
        // DRAW TOP BAR
        p.stroke(secondary);
        p.fill(secondary);
        p.rect(0, 0, p.width, c.PLAYBACK_HEIGHT);

        // DRAW BOTTOM BAR
        p.stroke(secondary);
        p.fill(secondary);
        p.rect(0, p.height - c.TRACKING_HEIGHT, p.width, c.TRACKING_HEIGHT);

        Mouse.push({ x: c.PANES_WIDTH, y: c.PLAYBACK_HEIGHT });
        if (selected.meas) {
            let first = c.PANES_WIDTH + selected.meas.offset*scale + viewport;
            let last = first + selected.meas.ms*scale;
            if (mod_check([2], modifiers) &&
                (p.mouseX > first
                    && p.mouseX < last
                    && p.mouseY >= selected.inst*c.INST_HEIGHT + c.PLAYBACK_HEIGHT
                    && p.mouseY < (selected.inst + 1)*c.INST_HEIGHT + c.PLAYBACK_HEIGHT
                    && true))
                Mouse.cursor = 'ew-resize';
        }

        // push below playback bar
        p.push();
        
        p.translate(0, c.PLAYBACK_HEIGHT);
        p.stroke(primary);
        p.fill(primary);
        p.rect(0, 0, c.PANES_WIDTH, p.height);
        p.translate(c.PANES_WIDTH, 0);


        // update Mouse location
        let new_rollover = {};
        instruments.forEach((inst, i_ind) => {
            var yloc = i_ind*c.INST_HEIGHT + c.PLAYBACK_HEIGHT;

            if (Mouse.drag.mode === '' &&
                p.mouseY > yloc && p.mouseY <= yloc + c.INST_HEIGHT)
                Object.assign(new_rollover, {
                    type: 'inst',
                    inst: i_ind,
                });

            // push into instrument channel
            p.push();
            p.translate(0, yloc - c.PLAYBACK_HEIGHT);
            p.stroke(255, 0, 0);
            p.fill(secondary_light2);

            // handle inst selection
            if (!selected.meas && selected.inst === i_ind)
                p.fill(230);

            p.rect(0, 0, p.width-1, 99);

            inst.ordered.forEach((measure, m_ind) => {
            //Object.keys(inst.measures).forEach((key, m_ind) => {
                //let measure = inst.measures[key];
                let key = measure.id;

                // skip if offscreen
                /*if (final + origin < c.PANES_WIDTH ||
                    origin > p.width
                )
                    return;
                    */

                // check for temporary display
                /*var [ticks, beats, offset] = ((measure.temp_ticks && measure.temp_ticks.length) || measure.temp_offset) ?
                    ['temp_ticks', 'temp_beats', 'temp_offset'] :
                    ['ticks', 'beats', 'offset'];
                    */

                let temp = 'temp' in measure;
                var [ticks, beats, offset, ms, s, e] = temp ?
                    [measure.temp.ticks, measure.temp.beats, measure.temp.offset, measure.temp.beats.slice(-1)[0], measure.temp.start || measure.start, measure.temp.end || measure.end] :
                    [measure.ticks, measure.beats, measure.offset, measure.beats.slice(-1)[0], measure.start, measure.end];


                let origin = (offset)*scale + viewport;
                let final = ms * scale;
                
                if (Mouse.drag.mode === '' &&
                    p.mouseX > origin && p.mouseX < (origin + final) &&
                    p.mouseY > yloc && p.mouseY <= yloc + c.INST_HEIGHT)
                    Object.assign(new_rollover, {
                        ind: m_ind,
                        type: 'measure',
                        meas: measure
                    });


                let position = (tick) => (tick*scale + viewport);
                
                // push into first beat
                p.push();
                p.translate(origin, 0);
                Mouse.push({ x: origin, y: yloc - c.PLAYBACK_HEIGHT });

                // draw origin
                p.stroke(0, 255, 0);
                p.line(0, 0, 0, c.INST_HEIGHT);

                // handle selection
                if (selected.meas && key === selected.meas.id) {
                    p.fill(0, 255, 0, 60);
                    p.rect(0, 0, final, c.INST_HEIGHT);
                }


                // draw ticks
                p.stroke(240);
                let step = 1;
                // BREAK OUT INTO FUNCTION
                if (scale < 1) { 
                    if (scale < 0.05)
                        step = (scale < 0.025) ? CONSTANTS.PPQ : CONSTANTS.PPQ_mod * 2 
                    else 
                        step = CONSTANTS.PPQ_mod;
                };

                for (var i=0; i < ticks.length; i += step) {
                    let loc = ticks[i]*scale;
                    if (loc + origin > p.width)
                        continue;
                    p.line(loc, 0, loc, c.INST_HEIGHT);
                };

                // draw timesig
                p.push();
                p.translate(c.TIMESIG_PADDING, c.TIMESIG_PADDING);
                p.fill(100);
                p.textSize(c.INST_HEIGHT*0.25);
                p.textLeading(c.INST_HEIGHT*0.20);
                p.textAlign(p.LEFT, p.CENTER);
                p.text([measure.timesig, '4'].join('\n'), 0, c.INST_HEIGHT/2);
                p.pop();

                // draw beats
                beats.forEach((beat, index) => {
                    let coord = beat*scale;
                    let color = [255, 0, 0];
                    let alpha = 255;
                    if (key in locked && (locked[key].beats & (1 << index)))
                        color = [0, 0, 255];

                    // try Mouse.rollover
                    let ro = (!temp
                        && p.mouseY >= yloc
                        && p.mouseY < yloc + c.INST_HEIGHT
                        && beat_rollover(coord, index, Mouse.loc)
                    );

                    if (ro &&
                        Mouse.drag.mode === '') {
                        alpha = 100;
                        Object.assign(new_rollover, {
                            type: 'beat',
                            beat: index
                        })
                            
                        if (mod_check(1, modifiers)
                            && 'meas' in selected
                        ) {

                            // change Mouse.rollover cursor
                            let shifted = mod_check(2, modifiers)
                            Mouse.cursor = (shifted) ?
                                'text' : 'pointer';

                            if (key in locked) {
                                let bits = parse_bits(locked[key].beats);
                                if ((bits.length >= 2 && (bits.indexOf(new_rollover.beat) === -1) && !shifted)
                                    || (bits.indexOf(new_rollover.beat) !== -1 && shifted)
                                )
                                    Mouse.cursor = 'not-allowed';
                            };
                        } 
                    }
                    

                    p.stroke(...color, alpha);
                    p.line(coord, 0, coord, c.INST_HEIGHT);
                });

                // draw tempo graph
                p.stroke(240, 200, 200);
                let bottom = ('temprange' in range) ?
                    (range.temprange[0] || range.tempo[0]) :
                    range.tempo[0];
                let top = ('temprange' in range) ?
                    (range.temprange[1] || range.tempo[1]) :
                    range.tempo[1];

                let scaleY = (input) => c.INST_HEIGHT - (input - bottom)/(top - bottom)*c.INST_HEIGHT;
                let ystart = scaleY(s);
                let yend = scaleY(e);
                p.line(0, ystart, beats.slice(-1)[0]*scale, yend);

                // draw tempo markings
                p.fill(100);
                p.textSize(c.TEMPO_PT);
                let tempo_loc = { x: position(0) + c.TEMPO_PADDING };
                if (ystart > c.TEMPO_PT + c.TEMPO_PADDING) {
                    p.textAlign(p.LEFT, p.BOTTOM);
                    tempo_loc.y = ystart - c.TEMPO_PADDING;
                } else {
                    p.textAlign(p.LEFT, p.TOP);
                    tempo_loc.y = ystart + c.TEMPO_PADDING;
                };
                p.text(s.toFixed(2), c.TEMPO_PADDING, tempo_loc.y);

                tempo_loc = { x: position(ms) - c.TEMPO_PADDING };
                if (yend > c.TEMPO_PT + c.TEMPO_PADDING) {
                    p.textAlign(p.RIGHT, p.BOTTOM);
                    tempo_loc.y = yend - c.TEMPO_PADDING;
                } else {
                    p.textAlign(p.RIGHT, p.TOP);
                    tempo_loc.y = yend + c.TEMPO_PADDING;
                };
                p.text(e.toFixed(2), ms*scale - c.TEMPO_PADDING, tempo_loc.y);

                // return from measure translate
                p.pop();
                Mouse.translate.pop();

            });

            // draw snap
            if (snaps.snapped_inst) {
                p.stroke(200, 240, 200);
                let x = snaps.snapped_inst.target * scale + viewport;
                p.line(x, Math.min(snaps.snapped_inst.origin, snaps.snapped_inst.inst)*c.INST_HEIGHT,
                    x, (Math.max(snaps.snapped_inst.origin, snaps.snapped_inst.inst) + 1)*c.INST_HEIGHT);
            };

            p.pop();
        });



        // draw snaps
        p.stroke(100, 255, 100);
        if (snaps.div_index > 1)
            Object.keys(snaps.divs[snaps.div_index]).forEach(key => {
                let inst = snaps.divs[snaps.div_index][key][0].inst;
                let xloc = key*scale + viewport;
                let yloc = inst * c.INST_HEIGHT;
                p.line(xloc, yloc, xloc, yloc + c.INST_HEIGHT);
            });

        // draw debug

        let mouse = (p.mouseX - viewport)/scale;
        let cursor_loc = [parseInt(Math.abs(mouse / 3600000), 10)];
        cursor_loc = cursor_loc.concat([60000, 1000].map((num) =>
            parseInt(Math.abs(mouse / num), 10).toString().padStart(2, "0")))
            .join(':');
        cursor_loc += '.' + parseInt(Math.abs(mouse % 1000), 10).toString().padStart(3, "0");
        if (mouse < 0.0)
           cursor_loc = '-' + cursor_loc;



        var scaleY = (input, scale) => scale - (input - range.tempo[0])/(range.tempo[1] - range.tempo[0])*scale;

        // draw editor frame
        if (mode === 2 && 'meas' in selected) {
            p.push();
            let opac = p.color(primary);
            opac.setAlpha(180);
            p.stroke(opac);
            p.fill(opac);

            let select = selected.meas;
            let x = select.offset * scale + viewport;
            let y = selected.inst*c.INST_HEIGHT;
            p.translate(x, y);
            Mouse.push({ x, y });

            let spread = Math.abs(range.tempo[1] - range.tempo[0]);
            let tempo_slope = (select.end - select.start)/select.timesig;
            let slope = tempo_slope/spread*c.INST_HEIGHT; 
            let base = (select.start - range.tempo[0])/spread*c.INST_HEIGHT;


            if (Mouse.drag.mode === 'tempo' && 'temp' in select) {
                p.ellipse(select.temp.beats[Mouse.drag.index]*scale, Mouse.loc.y, 10, 10); 
                Mouse.cursor = 'ns-resize';
            } else if (Mouse.drag.mode !== 'tick') {
                for (let i=0; i < select.beats.length; i++) {
                    let xloc = select.beats[i]*scale;
                    let yloc = c.INST_HEIGHT - base - slope*i;
                    if (p.mouseX > Mouse.loc.x + xloc - 5 &&
                        p.mouseX < Mouse.loc.x + xloc + 5 &&
                        p.mouseY > Mouse.loc.y + yloc - 5 &&
                        p.mouseY < Mouse.loc.y + yloc + 5 
                    ) {
                        p.ellipse(xloc, yloc, 10, 10); 
                        Mouse.cursor = 'ns-resize';
                        new_rollover = {
                            type: 'tempo',
                            tempo: tempo_slope*i + select.start
                        };
                        break;
                    }
                };
            };
            Mouse.pop();



            let PANES_THIN = c.PANES_WIDTH/4;
            let inc = 180.0 / c.INST_HEIGHT;
            let op = p.color(primary)
            let end = select.ms*scale;
            for (let i=0; i <= c.INST_HEIGHT; i++) {
                op.setAlpha(i*inc);
                p.stroke(op);
                p.line(-PANES_THIN, i, 0, i);
                p.line(end, i, end + PANES_THIN, i);
            }
            p.translate(0, c.INST_HEIGHT);
            p.rect(-PANES_THIN, 0, PANES_THIN*2 + select.ms*scale, c.LOCK_HEIGHT);

            p.stroke(secondary);
            p.fill(secondary);
            p.textSize(10);
            p.textAlign(p.LEFT, p.CENTER);
            //p.text(`${select.start} -> ${select.end} / ${select.timesig}`, 5, c.PANES_WIDTH);
                
            p.pop();
        }

        Mouse.rollover = new_rollover;

        if (DEBUG) {
            p.push();
            p.translate(0, (instruments.length+1)*c.INST_HEIGHT);
            debug_messages.push(selected.meas ?
                `selected - start: ${selected.meas.start.toFixed(2)}, end: ${selected.meas.end.toFixed(2)}, ms: ${selected.meas.ms.toFixed(2)}` :
                `selected - none`
            );

            debug_messages.push((selected.meas && 'temp' in selected.meas) ?
                `temp - start: ${selected.meas.temp.start.toFixed(2)}, end: ${selected.meas.temp.end.toFixed(2)}, ms: ${selected.meas.temp.ms.toFixed(2)}` :
                `temp - none`
            );

            debug_messages.push(`rollover - type: ${Mouse.rollover.type}, inst: ${Mouse.rollover.inst}, meas: ${'meas' in Mouse.rollover ? Mouse.rollover.meas.id : undefined}, index: ${Mouse.rollover.beat}`);
            debug_messages.push(`drag - mode: ${Mouse.drag.mode}`);

            p.stroke(primary); //200, 240, 200);
            p.textSize(c.DEBUG_TEXT);
            p.textAlign(p.LEFT, p.TOP);
            let lines = (selected.meas) ?
                [`selected: ${'temp' in selected.meas ? [selected.meas.temp.start, selected.meas.temp.end].join(' ') : 'no temp'}  beats - ${selected.meas.ms.toFixed(1)} ms`] :
                [''];

            lines.push(`location: ${cursor_loc}`);
            lines = [...lines, ...(debug_messages || [])];
            blockText(lines, { x: 0, y: c.DEBUG_TEXT }, c.DEBUG_TEXT);

            p.textAlign(p.CENTER, p.CENTER);


            let lineY = (line) => c.DEBUG_TEXT*line + c.DEBUG_HEIGHT;

            p.push();
            p.translate(0, lineY(lines.length) + 5);
            p.fill(240);
            p.textSize(8);
            [
                {name: 'MOD', code: MOD},
                {name: 'SHIFT', code: SHIFT},
                {name: 'CTRL', code: CTRL},
                {name: 'ALT', code: ALT},
                {name: 'C', code: KeyC},
                {name: 'V', code: KeyV},
            ].forEach((key, ind) => {
                if (p.keyIsDown(key.code))
                    p.fill(120);
                p.rect(5 + ind*25, 0, 20, 15);
                p.fill(240);
                p.text(key.name, 15 + ind*25, 7);
            });

            p.push();
            p.translate(0, 20);
            NUM.forEach((num, ind) => {
                if (p.keyIsDown(num))
                    p.fill(120);
                p.rect(5 + ind*25, 0, 20, 15);
                p.fill(240);
                p.text(ind, 15 + ind*25, 7);
            });
            p.pop();
            p.pop();
            p.pop();
        };

            

        // draw cursor / insertMeas
        p.stroke(200);
        p.fill(240);
        let t_mouseX = p.mouseX - Mouse.loc.x;//p.mouseX - c.PANES_WIDTH;
        let t_mouseY = p.mouseY - Mouse.loc.y;//p.mouseY - c.PLAYBACK_HEIGHT;
        p.line(t_mouseX, 0, t_mouseX, c.INST_HEIGHT*instruments.length);
        let draw_beats = beat => {
            let x = ('inst' in insertMeas) ? 
                (insertMeas.temp_offset + beat) * scale :
                t_mouseX + beat*scale;
            let y = ('inst' in insertMeas) ?
                insertMeas.inst * c.INST_HEIGHT :
                Math.floor(0.01*t_mouseY)*c.INST_HEIGHT;
            p.line(x, y, x, y + c.INST_HEIGHT);
        };


        Mouse.pop();

        if (mode === 1) {
            let inst = Math.floor(0.01*t_mouseY);
            if (API.pollSelecting()) {
                if (inst < instruments.length && inst >= 0) {
                    p.rect(t_mouseX, inst*c.INST_HEIGHT, insertMeas.ms*scale, c.INST_HEIGHT);
                    p.stroke(255, 0, 0);
                    if ('beats' in insertMeas)
                        insertMeas.beats.forEach(draw_beats);
                }
            } else if ('temp_offset' in insertMeas) {
                p.rect(insertMeas.temp_offset*scale, selected.inst*c.INST_HEIGHT, insertMeas.ms*scale, c.INST_HEIGHT);
                p.stroke(255, 0, 0);
                insertMeas.beats.forEach(draw_beats);
            };
        };


        isPlaying = API.get('isPlaying');

        p.stroke(0);
        p.fill(0);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(12);

        
        if (isPlaying) {
            let tracking = API.exposeTracking().locator();
            // check for final measure here;
            if (tracking > range.span[1] + 1000) {
                isPlaying = false;
                API.play(isPlaying, null);
            };
            let tracking_vis = tracking*scale + viewport;
            p.line(tracking_vis, c.PLAYBACK_HEIGHT, tracking_vis, c.INST_HEIGHT*2 + c.PLAYBACK_HEIGHT);
        };
        if (Mouse.drag.mode === 'measure')
            Mouse.cursor = 'ew-resize'
        else if (Mouse.drag.mode === 'tempo')
            Mouse.cursor = 'ns-resize'
        else if (Mouse.drag.mode === 'tick')
            Mouse.cursor = 'text';
        document.body.style.cursor = Mouse.cursor;
                

        p.pop();
        p.fill(primary);
        p.stroke(primary);

        
        // draw tabs
        p.stroke(primary);
        p.fill(primary);

        p.push();
        p.translate(0, p.height - c.TRACKING_HEIGHT)
        p.rect(0, 0, p.width, c.TRACKING_HEIGHT);
        // left
        
        // LOCATION
        // left    

        p.push();
        p.stroke(secondary);
        p.fill(secondary);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(10);
        p.text(isPlaying ? `LOCATION: ${API.exposeTracking().locator()}` : `CURSOR: ${cursor_loc}`,
            c.TRACKING_PADDING.X, c.TRACKING_PADDING.Y);
        // right
        p.textAlign(p.RIGHT, p.TOP);
        let _span = span.map(s => s.toFixed(2)); // format decimal places
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

        p.push();
        p.translate((p.width - c.TOOLBAR_WIDTH) / 3.0, p.height - c.TRACKING_HEIGHT - c.INSERT_HEIGHT);


        if (mode === 1) {
            p.push();
            p.rect(0, 0, c.EDITOR_WIDTH, c.INSERT_HEIGHT);

            p.stroke(secondary);
            p.line(c.INSERT_WIDTH, c.EDITOR_HEIGHT, c.EDITOR_WIDTH, c.EDITOR_HEIGHT); 

            if ('beats' in insertMeas) {
                p.stroke(secondary);
                p.fill(secondary);

                // draw beats
                // push into padding
                p.push();
                p.translate(c.INSERT_PADDING, c.INSERT_PADDING);
                let last = c.EDITOR_WIDTH - c.INSERT_PADDING*2;
                insertMeas.beats.forEach((beat) => {
                    let x = (beat/insertMeas.ms)*last;
                    p.line(x, 0, x, c.PREVIEW_HEIGHT);
                });
                // draw tempo
                let ystart = scaleY(insertMeas.start, c.PREVIEW_HEIGHT);
                let yend = scaleY(insertMeas.end, c.PREVIEW_HEIGHT);
                p.line(0, ystart, last, yend);

                // push into metadata
                p.push();
                p.translate(0, c.PREVIEW_HEIGHT + c.INSERT_PADDING);
                p.textAlign(p.LEFT, p.TOP);
                let lines = [
                    `${insertMeas.start} - ${insertMeas.end} / ${insertMeas.timesig}`,
                    `${insertMeas.ms.toFixed(2)}ms`
                ];
                blockText(lines, { x: 0, y: 0 }, 6); 
                p.pop();
                p.pop();
            }
            p.pop();
        };

        if (mode === 2) {
            p.rect(0, 0, c.EDITOR_WIDTH, c.EDITOR_HEIGHT);
            p.stroke(secondary);
            p.line(0, c.EDITOR_HEIGHT, c.INSERT_WIDTH, c.EDITOR_HEIGHT); 
            if (selected.meas) {
                // push into padding
                p.push();
                p.stroke(secondary);
                p.translate(c.INSERT_PADDING, c.INSERT_PADDING);
                let last = c.EDITOR_WIDTH - c.INSERT_PADDING*2;
                let meas = instruments[selected.inst].ordered[selected.ind];
                meas.beats.forEach((beat) => {
                    let x = (beat/meas.ms)*last;
                    p.line(x, 0, x, c.PREVIEW_HEIGHT);
                });
                // draw tempo
                let ystart = scaleY(meas.start, c.PREVIEW_HEIGHT);
                let yend = scaleY(meas.end, c.PREVIEW_HEIGHT);
                p.line(0, ystart, last, yend);
                p.pop();
            }
        }
        p.pop();

        if (panels) {
            p.fill(255, 0, 0, 10);
            p.rect(0, c.PLAYBACK_HEIGHT + c.INST_HEIGHT*instruments.length, p.width, c.INST_HEIGHT);
        };
            


        if (DEBUG) {
            p.textAlign(p.RIGHT, p.TOP);
            p.textSize(18);
            p.stroke(secondary);
            p.fill(secondary);

            p.text(Math.round(p.frameRate()), p.width - 10, 5);
        }

    }

    p.keyPressed = function(e) {
        if (API.disableKeys())
            return;

        if ('meas' in selected) {

            // DIRECTIONAL KEYS
            if (p.keyCode === KeyJ) { // || p.keyCode === DOWN) {
                if (selected.inst >= instruments.length - 1)
                    return;
                let ind = check_proximity_by_key(selected.meas, instruments[selected.inst + 1].ordered, 'offset');
                
                updateSelected({
                    ind,
                    inst: Math.min(selected.inst + 1, instruments.length - 1),
                    meas: instruments[selected.inst + 1].ordered[ind],
                });

                return;
            }

            if (p.keyCode === KeyK) { // || p.keyCode === UP) {
                if (selected.inst <= 0)
                    return;
                let ind = check_proximity_by_key(selected.meas, instruments[selected.inst - 1].ordered, 'offset');

                updateSelected({
                    ind,
                    inst: Math.max(selected.inst - 1, 0),
                    meas: instruments[selected.inst -1].ordered[ind],
                });

                return;
            };

            if (p.keyCode === KeyH) { // || p.keyCode === LEFT) {
                let ind = Math.max(selected.ind - 1, 0);
                
                updateSelected({
                    ind,
                    inst: selected.inst,
                    meas: instruments[selected.inst].ordered[ind]
                });
                
                return;
            };

            if (p.keyCode === KeyL) { // || p.keyCode === RIGHT) {
                let ind =  Math.min(selected.ind + 1, instruments[selected.inst].ordered.length - 1);
                updateSelected({
                    ind,
                    inst: selected.inst,
                    meas: instruments[selected.inst].ordered[ind]
                });

                return;
            };
        }

        if (p.keyCode === ESC) {
            if (mode === 0)
                API.toggleInst(true);
            else {
                mode = 0;
                API.updateMode(mode);
            }
            return;
        };

        if (p.keyCode === KeyI) {
            mode = 1;
            API.updateMode(mode);
            return;
        };

        if (p.keyCode === KeyV) {
            mode = 2;
            //API.displaySelected(selected);
            API.updateMode(mode);
            return;
        };


        if ((p.keyCode === DEL || p.keyCode === BACK)
            && 'meas' in selected
        ) {
            let to_delete = selected;
            selected = { inst: -1 };
            API.deleteMeasure(to_delete);
            return;
        }

        if (p.keyCode === SPACE) {
            (mode === 1) ?
                API.preview((p.mouseX - viewport)/scale) :
                API.play((p.mouseX - viewport)/scale);
            return;
        }

        // CTRL/MOD functions
        if (p.keyIsDown(MOD)) {
            if (p.keyCode === KeyC
                && 'meas' in selected
            )
                copied = instruments[selected.inst].measures[selected.meas];
            else if (p.keyCode === KeyV && copied)
                API.paste(selected.inst, copied, (p.mouseX-viewport)/scale);
            /* ADD UNDO HISTORY HERE
            else if (p.keyCode === KeyZ)
                p.keyIsDown(SHIFT) ?
                    API.redo() : API.undo();
            */
        };
        return true;
    };

    p.mouseWheel = function(event) {
        event.preventDefault();
        if (p.keyIsDown(CTRL)) {
            let change = 1.0-event.delta/c.SCROLL_SENSITIVITY;
            scale = scale*change;
            viewport = p.mouseX - change*(p.mouseX - viewport);
            API.newScaling(scale);
        };
        viewport -= event.deltaX;
        API.reportWindow(viewport, scale);
    };

    p.mousePressed = function(e) {

        // return if outside canvas or over active menu
        if (p.mouseX === Infinity 
            || p.mouseX < 0
            || p.mouseY === Infinity 
            || p.mouseY < 0
            || p.mouseY > p.height
        ) {
            Mouse.outside_origin = true;
            return;
        } else
            Mouse.outside_origin = false;

        if (Mouse.rollover.type === 'tempo') {
            Mouse.drag.mode = 'tempo';
            Mouse.drag.grab = Mouse.rollover.index;
            Mouse.grabbed = Mouse.rollover.index;
            return;
        };

        let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)/c.INST_HEIGHT);

        // check for editor menus
        if (mode === 2
            && 'meas' in selected
        ) {
            let selStart = c.PANES_WIDTH + selected.meas.offset*scale + viewport;
            let menuStart = inst*c.INST_HEIGHT + c.PLAYBACK_HEIGHT;
            if (p.mouseY > menuStart
                && p.mouseY < menuStart + c.LOCK_HEIGHT
                && p.mouseX > selStart
                && p.mouseX < selStart + selected.meas.ms*scale
            ) {
                Mouse.outside_origin = true;
                return;
            } else {
                editMeas = {};
            }
        }

        if (inst >= instruments.length || inst < 0)
            return;

        if (API.pollSelecting()) {
            insertMeas.temp_offset = API.confirmSelecting(inst);
            insertMeas.inst = inst;
            return;
        }

        Object.assign(Mouse.drag, { x: 0, y: 0 });

        let measures = instruments[inst].ordered;

        let newSelect = {
            ind: Mouse.rollover.ind,
            inst: inst,
            meas: Mouse.rollover.meas,
        };
        if (!_.isEqual(newSelect, selected)) {
            selected = newSelect;
            return;
        }

        let measure = selected.meas;


        if (mod_check([1, 2], modifiers)) {
            measure.temp = initialize_temp(measure);
            Mouse.grabbed = Mouse.rollover.beat === measure.beats.length - 1 ?
                60000.0/measure.beats.slice(-1)[0]
                : 60000.0/(measure.ticks[(Mouse.rollover.beat * CONSTANTS.PPQ)]);
            dir = 0;
            measure.temp.start = measure.start;
            if (measure.end > measure.start)
                dir = 1;
            if (measure.start > measure.end)
                dir = -1;
            Mouse.drag.mode = 'tick';
            Mouse.drag.grab = Mouse.rollover.beat;
        } else if (mod_check(2, modifiers)) {
            // SHIFT held?
            measure.temp = initialize_temp(measure);
            Mouse.drag.mode = 'measure';
        } else if (mod_check(1, modifiers)) {
            // LOCKING
            // CTRL held?
            if (!(selected.meas.id in locked))
                locked[selected.meas.id] = {
                    beats: [],
                    meta: {}
                };
            // IS THIS DUMB?
            if (parse_bits(locked[selected.meas.id].beats).length < 2 || parse_bits(locked[selected.meas.id].beats).indexOf(Mouse.rollover.beat) !== -1)
                locked[selected.meas.id].beats = bit_toggle(locked[selected.meas.id].beats, Mouse.rollover.beat);
        };

    }

    p.mouseDragged = function(event) {

        if (Mouse.drag.mode === '')
            return;
        if (Mouse.rollover.beat === 0
            || Mouse.outside_origin
            || selected.meas === -1)
            return;

        if (!(selected.meas))
            return;

        var beat_lock = (selected.meas.id in locked && locked[selected.meas.id].beats) ?
            parse_bits(locked[selected.meas.id].beats) : [];

        var ticks = (selected.meas.timesig) * CONSTANTS.PPQ_tempo;
        var tick_array = Array.from({length: ticks}, (__, i) => i);


        var closest = (position, inst, div) =>
            Object.keys(snaps.divs[div]).reduce((acc, key, ind, keys) => {
                if (snaps.divs[div][key][0].inst === inst)
                    return acc;
                let gap = parseFloat(key, 10) - position;
                return (Math.abs(gap) < Math.abs(acc.gap) ? 
                    { target: parseFloat(key, 10), gap, inst: snaps.divs[div][key][0].inst } :
                    acc);
            }, { target: -1, gap: Infinity, inst: -1 });

        var snap_eval = (position, candidates) =>
            candidates.reduce((acc, candidate, index) => {
                let next = position + candidate;
                let target, gap, inst;
                ({ target, gap, inst } = closest(next, selected.inst, snaps.div_index));
                if (Math.abs(gap) < Math.abs(acc.gap)) 
                    return { index, target, gap, inst };
                return acc;
            }, { index: -1, target: Infinity, gap: Infinity, inst: -1 });

        let measure = selected.meas;
        if (!('temp' in measure))
            measure.temp = initialize_temp(measure);
        if (!('gaps' in measure))
            measure.gaps = calcGaps(instruments[selected.inst].ordered, selected.meas.id);

        let position = measure.offset + Mouse.drag.x/scale;
        var crowding = (gaps, position, ms, options) => {
            let strict = (options && 'strict' in options) ? options.strict : false;
            let final = position + ms;
            if (final <= gaps[0][1]) 
                return { start: [-Infinity, Infinity], end: [gaps[0][1], gaps[0][1] - (final)] };
            let last_gap = gaps.slice(-1)[0];
            if (position > last_gap[0])
                return { start: [last_gap[0], position - last_gap[0]], end: [Infinity, Infinity] };
                
            return gaps
                .reduce((acc, gap) => {
                    // does it even fit in the gap?
                    if (gap[1] - gap[0] < ms - (strict ? c.NUDGE_THRESHOLD*2 : 0))
                        return acc;
                    let start = [gap[0], position - gap[0]];
                    let end = [gap[1], gap[1] - final];

                    /*if (gap[0] === -Infinity && final <= gap[1])
                        acc.start = [-Infinity, Infinity]
                    else*/ if (Math.abs(start[1]) < Math.abs(acc.start[1]))
                        acc.start = start;
                    /*if (gap[1] === Infinity && position >= gap[0])
                        acc.end = [Infinity, Infinity]
                    else*/ if (Math.abs(end[1]) < Math.abs(acc.end[1]))
                        acc.end = end;
                    return acc;
                }, { start: [0, Infinity], end: [0, Infinity], gap: [] });
        }

        var PPQ_mod = CONSTANTS.PPQ / CONSTANTS.PPQ_tempo;
        var C = (delta) => 60000.0 * (measure.beats.length - 1) / (delta);
        var sigma = (start, constant) => ((n) => (1.0 / ((start * CONSTANTS.PPQ_tempo * constant / 60000.0) + n)));
        var grab = Mouse.drag.grab * CONSTANTS.PPQ_tempo;
        var snapper = Mouse.drag.grab;

        var quickCalc = (start, slope, timesig, lock_target, _snapper) => {
            var C1 = (delta) => 60000.0 * (timesig) / (delta);
            var sigma = (start, constant) => ((n) => (1.0 / ((start * CONSTANTS.PPQ_tempo * constant / 60000.0) + n)));

            let new_C = C1(slope);
            let locked = 0;
            let snapped = -1;
            let lock = lock_target * CONSTANTS.PPQ_tempo;
            let snap = _snapper * CONSTANTS.PPQ_tempo;

            let ms = new_C * tick_array.reduce((sum, __, i) => {
                if (i === lock)
                    locked = sum*new_C;
                if (i === snap)
                    snapped = sum*new_C;
                return sum + sigma(start, new_C)(i);
            }, 0);

            // default snap target to end if nowhere else
            if (snapped < 0) 
                snapped = ms;
            return [ms, locked, snapped];
        };

        // LENGTH GRADIENT DESCENT

        var nudge_factory = (measure, oldSlope, target, _snapper, anchor, locks) => {
            console.log('spawning nudge');
            console.log({oldSlope, target, _snapper, anchor, locks});

            var start = measure.temp.start || measure.start;
            var end = measure.end;
            var offset = measure.temp.offset || measure.offset;
            var slope = oldSlope;

            let delta = (!(locks & (1 << 1)) && !(locks & (1 << 2))) ? 
                1.0 : 0.5;
            let diff_null = !!(locks & (1 << 2));
            let slope_lock = !!(locks & (1 << 4));

            //let anchor_target = anchor * CONSTANTS.PPQ_tempo;

            let ms;
            let nudge = (gap, alpha, depth) => {
                if (depth > 99 || Math.abs(gap) < c.NUDGE_THRESHOLD)
                    // I DON'T THINK YOU NEED TO RETURN OFFSET HERE
                    return { start, slope, offset, ms };
                // if END is locked
                if (diff_null) {
                    start *= (gap > c.NUDGE_THRESHOLD) ?
                        (1 + alpha) : (1 - alpha);
                    slope = end - start;
                // if SLOPE is locked
                } else if (slope_lock) {
                    start *= (gap > c.NUDGE_THRESHOLD) ?
                        (1 + alpha) : (1 - alpha);
                // else change alpha multiplier based on start or slope lock
                } else
                    slope *= (gap > c.NUDGE_THRESHOLD) ?
                        (1 + alpha*delta) : (1 - alpha*delta);

                let locked, snapped;
                [ms, locked, snapped] = quickCalc(start, slope, measure.timesig, anchor, _snapper);
                if (locked)
                    offset = measure.offset + measure.beats[beat_lock[0]] - locked;

                let new_gap = snapped + offset - target;
                alpha = monitor(gap, new_gap, alpha);
                return nudge(new_gap, alpha, depth + 1);
            }

            return nudge;
        };


        // y-drag
        if (Mouse.drag.mode === 'tempo') {
            Mouse.drag.y += event.movementY;
            let spread = range.tempo[1] - range.tempo[0];
            let change = Mouse.drag.y / c.INST_HEIGHT * spread;
            let locked_beat = beat_lock.length ?
                beat_lock[0] : 0;
            let pivot = (measure.end - measure.start)/measure.timesig * locked_beat;
            
            if (locked_beat !== Mouse.grabbed) {
                let slope = (measure.end - measure.start)/measure.timesig;
                let new_slope = slope*Mouse.grabbed - change;
                if (!beat_lock.length) {
                    let update = {
                        start: measure.start - change,
                        end: measure.end - change,
                        offset: measure.offset,
                        beats: [],
                        ticks: []
                    }
                    if (update.start < 10 || update.end < 10)
                        return;

                    if (!crowd_cache)
                        crowd_cache = crowding(measure.gaps, measure.offset, measure.ms, { strict: true });
                    let crowd = crowd_cache;

                    update.slope = update.end - update.start;
                    let inc = (measure.end - measure.start)/measure.ticks.length;
                    let cumulative = 0.0;
                    let K = 60000.0 / CONSTANTS.PPQ;
                    let last = 0;


                    measure.ticks.forEach((__, i) => {
                        if (!(i%CONSTANTS.PPQ))
                            update.beats.push(cumulative);
                        update.ticks.push(cumulative);
                        if (i%PPQ_mod === 0) 
                            last = K / (update.start + inc*i);
                        cumulative += last;
                    });
                    update.beats.push(cumulative);
                    let start_lock = false;
                    let end_lock = false;


                    update.offset += (measure.ms - cumulative)/2; 
                    let offset = update.offset;
                    let startflag = false;
                    let endflag = false;

                    // restore if this gets dicey later, but i think its okay
                    if (update.offset + cumulative > crowd.end[0] - c.SNAP_THRESHOLD) {
                        endflag = true;
                        //update.offset += crowd.end[0] - cumulative - offset;
                    }
                    if (update.offset < crowd.start[0] + c.SNAP_THRESHOLD) {
                        startflag = true;
                        //update.offset -= offset - crowd.start[0];
                    }

                    if (startflag) 
                        update.offset = crowd.start[0]
                    else if (endflag)
                        update.offset += crowd.end[0] - cumulative - offset;
                            

                            
                    console.log(offset, update.offset);

                    end_lock = update.offset + cumulative > crowd.end[0] - c.SNAP_THRESHOLD;
                    start_lock = update.offset < crowd.start[0] + c.SNAP_THRESHOLD;

                    Object.assign(update, { cumulative });

                    let new_end = update.end;
                        
                    if (cumulative > crowd.end[0] - crowd.start[0]) {
                            console.log('jump'); 
                            update.offset = crowd.start[0];
                            if (!nudge_cache) {
                                measure.temp.offset = update.offset;
                                let nudge = nudge_factory(measure, update.slope, crowd.end[0], measure.timesig, 0, 16);
                                nudge_cache = nudge(crowd.end[0] - (crowd.start[0] + cumulative), 0.01, 0);
                            }
                            update.start = nudge_cache.start;
                            update.end = nudge_cache.start + update.slope;
                            update.beats = [];
                            update.ticks = [];
                            cumulative = 0;
                            measure.ticks.forEach((__, i) => {
                                if (!(i%CONSTANTS.PPQ))
                                    update.beats.push(cumulative);
                                update.ticks.push(cumulative);
                                if (i%PPQ_mod === 0) 
                                    last = K / (nudge_cache.start + inc*i);
                                cumulative += last;
                            });
                            update.beats.push(cumulative);
                            Object.assign(update, { cumulative });
                    } else {
                        nudge_cache = false;
                        /*if (end_lock)
                            measure.temp.offset = crowd.end[0] - cumulative;
                            */
                    }
                        
                    let temprange = [Math.min(update.start, range.tempo[0]), Math.max(update.end, range.tempo[1])];
                    Object.assign(range, { temprange });
                    Object.assign(measure.temp, update);
                    return;
                }





                let fresh_slope = (new_slope - pivot) / (Mouse.grabbed - locked_beat);
                let temp_start = (new_slope + measure.start) - fresh_slope*Mouse.grabbed;
                let inc = fresh_slope/CONSTANTS.PPQ;

                
                let cumulative = 0.0;
                let K = 60000.0 / CONSTANTS.PPQ;
                let last = 0;

                let new_beats = [];
                let new_ticks = [];
                measure.ticks.forEach((__, i) => {
                    if (!(i%CONSTANTS.PPQ))
                        new_beats.push(cumulative);
                    new_ticks.push(cumulative);
                    if (i%PPQ_mod === 0) 
                        last = K / (temp_start + inc*i);
                    cumulative += last;
                });
                new_beats.push(cumulative);

                let temp_offset = measure.offset + measure.beats[locked_beat] - new_beats[locked_beat];
                
                let crowd = crowding(measure.gaps, temp_offset, cumulative);
                // HOW TO MAKE THIS SKIP WORK?
                /*if (!nudge_cache && (crowd.start[1] < 0 || crowd.end[1] < 0))
                    return;
                    */

                let update = {
                    start: temp_start,
                    slope: fresh_slope * measure.timesig,
                    offset: temp_offset
                };

                if (measure.offset > (crowd.start[0] + c.NUDGE_THRESHOLD)
                    && crowd.start[1] < c.SNAP_THRESHOLD
                ) {
                    if (!nudge_cache) {
                        measure.temp.start = temp_start;
                        let nudge = nudge_factory(measure, fresh_slope*measure.timesig, crowd.start[0], measure.timesig-1, 0, locks);
                        nudge_cache = nudge(crowd.start[1], 0.01, 0);
                    }
                    Object.assign(update, nudge_cache); 
                } else if ((measure.offset + measure.ms) < (crowd.end[0] - c.NUDGE_THRESHOLD)
                    && crowd.end[1] < c.SNAP_THRESHOLD
                ) {

                    if (!nudge_cache) {
                        measure.temp.start = temp_start;
                        let nudge = nudge_factory(measure, fresh_slope, crowd.end[0], measure.timesig, beat_lock[0], locks);
                        nudge_cache = nudge(crowd.end[1], 0.001, 0);
                    }
                    Object.assign(update, nudge_cache); 
                } else 
                    nudge_cache = false;

                if (nudge_cache) 
                    Object.assign(update, nudge_cache);


                new_beats = [];
                new_ticks = [];
                cumulative = 0.0;
                last = 0;
                inc = update.slope / (CONSTANTS.PPQ * measure.timesig);
                
                measure.ticks.forEach((__, i) => {
                    if (!(i%CONSTANTS.PPQ))
                        new_beats.push(cumulative);
                    new_ticks.push(cumulative);
                    if (i%PPQ_mod === 0) 
                        last = K / (update.start + inc*i);
                    cumulative += last;
                });
                new_beats.push(cumulative);


                update.end = update.start + update.slope;
                update.ticks = new_ticks;
                update.beats = new_beats;
                update.ms = cumulative;
                if (locked_beat)
                    update.offset = measure.offset + measure.beats[locked_beat] - new_beats[locked_beat];
                let temprange = [Math.min(update.start, range.tempo[0]), Math.max(update.end, range.tempo[1])];
                Object.assign(range, { temprange });

                Object.assign(measure.temp, update);
            }

            API.updateEdit(measure.temp.start, measure.temp.end, measure.timesig, measure.temp.offset);
            return;
        }

      
        Mouse.drag.x += event.movementX;
        if (Math.abs(Mouse.drag.x) < c.DRAG_THRESHOLD_X) {
            delete measure.temp;
            return;
        } 

        if (Mouse.drag.mode === 'measure') {
            let position = measure.offset + Mouse.drag.x/scale;
            let close = snap_eval(position, measure.beats);

            // determine whether start or end are closer
            // negative numbers signify conflicts
            let crowd = crowding(measure.gaps, position, measure.ms);
            let update = {
                ticks: measure.ticks.slice(0),
                beats: measure.beats.slice(0),
                offset: position
            };

            if (Math.abs(crowd.start[1]) < Math.abs(crowd.end[1])) {
                if (crowd.start[1] - c.SNAP_THRESHOLD*2 < 0)
                    update.offset = crowd.start[0];
            } else {
                if (crowd.end[1] - c.SNAP_THRESHOLD*2 < 0)
                    update.offset = crowd.end[0] - measure.ms;
            }

            if (close.index !== -1) {
                let gap = close.target - (measure.beats[close.index] + position);
                if (Math.abs(gap) < 50) {
                    snaps.snapped_inst = { ...close, origin: selected.inst };
                    update.offset = position + gap;
                } else
                    snaps.snapped_inst = {};
            };
            
            Object.assign(measure.temp, update);
            return;
        };

        

        let beatscale = (-Mouse.drag.x*scale); // /p.width

        // divide this by scale? depending on zoom?
        let slope = measure.end - measure.start;
        var temp_start;

        let perc = Math.abs(slope) < c.FLAT_THRESHOLD ?
            ((dir === 1) ? -c.FLAT_THRESHOLD : c.FLAT_THRESHOLD) :
            Mouse.grabbed/Math.abs(slope);

        let amp_lock = beatscale/perc;


        // if START is locked
        // change slope, preserve start
        if (locks & (1 << 1)) {
            slope += amp_lock;
            temp_start = measure.start;
        }
        // if END is locked
        // change slope, preserve end by changing start to compensate
        else if (locks & (1 << 2)) {
            slope -= amp_lock;
            temp_start = measure.start + amp_lock;
        // if SLOPE is locked
        // split change between start and end
        } else if (locks & (1 << 4)) {
            //slope += amp_lock/2; 
            temp_start = measure.start + amp_lock;
        } else {
            slope += amp_lock/2; 
            temp_start = measure.start + amp_lock/2;
        };


        console.log('from regular calc:', snapper);
        let [ms, lock, grabbed] = quickCalc(temp_start, slope, measure.beats.length - 1, beat_lock[0], snapper);

        if (Math.abs(ms - measure.ms) < c.DRAG_THRESHOLD_X) {
            measure.temp.offset = measure.offset;
            measure.temp.start = measure.start;
            slope = measure.end - measure.start;
            return;
        };


        let temp_offset = lock ?
            measure.offset + measure.beats[beat_lock[0]] - lock :
            measure.offset;

        let loc = grabbed + temp_offset;


        // check for overlaps
        let crowd = crowding(measure.gaps, temp_offset, ms);
        if (crowd.start[1] < 0 || crowd.end[1] < 0)
            return;

        let snap_to = closest(loc, selected.inst, snaps.div_index).target;
        
        let gap = loc - snap_to;

        /*if (crowd.start[1] < c.SNAP_THRESHOLD) {
            snapper = 0;
            snap_to = crowd.start[0];
            gap = crowd.start[1];
        } else if (crowd.end[1] < c.SNAP_THRESHOLD) {
            snapper = (measure.beats.length - 1) * CONSTANTS.PPQ_tempo;
            snap_to = crowd.end[0];
            gap = crowd.end[1];
        }
        */


        if (Math.abs(gap) < c.SNAP_THRESHOLD) {
            // if initial snap, update measure.temp.start 
            // for the last time and nudge.
            if (!nudge_cache) {
                measure.temp.start = temp_start;

                console.log({snapper});
        //var nudge_factory = (measure, oldSlope, target, snapper, anchor, locks) => {
                let nudge = nudge_factory(measure, slope, snap_to, snapper, beat_lock[0], locks); 
                nudge_cache = nudge(gap, 0.001, 0);
                Object.assign(measure.temp, nudge_cache);
            };
            Object.assign(measure.temp, nudge_cache);
        } else {
            nudge_cache = false;
            measure.temp.start = temp_start;
            measure.temp.slope = slope;
        }

                   
        // INVERT THIS DRAG AT SOME POINT?

        var SNAP_THRESH = 2.0;

        // if DIRECTION is locked
        if (locks & (1 << 3)) {
            // flat measure can't change direction
            if (!dir)
                return;
            if (measure.temp.slope * dir < SNAP_THRESH) {
                measure.temp.slope = 0;
                if (locks & (1 << 2))
                    measure.temp.start = measure.end;
                else if (locks & (1 << 1))
                    measure.temp.end = measure.start;
            }
            /*inc = (dir === 1) ?
                Math.max(inc, 0) : inc;
            if (locks & (1 << 2))
                measure.temp.start = (dir === 1) ?
                    Math.min(measure.temp.start, measure.end) :
                    Math.max(measure.temp.start, measure.end);
                    */
        };

        let inc = measure.temp.slope/measure.ticks.length;
        let cumulative = 0.0;
        let K = 60000.0 / CONSTANTS.PPQ;
        let last = 0;

        let new_beats = [];
        let new_ticks = [];
        measure.ticks.forEach((__, i) => {
            if (!(i%CONSTANTS.PPQ))
                new_beats.push(cumulative);
            new_ticks.push(cumulative);
            if (i%PPQ_mod === 0) 
                last = K / (measure.temp.start + inc*i);
            cumulative += last;
        });
        new_beats.push(cumulative);


        measure.temp.end = measure.temp.start + measure.temp.slope;
        measure.temp.ms = cumulative;
        measure.temp.offset = measure.offset;
        if (beat_lock.length === 1)
            measure.temp.offset += measure.beats[beat_lock[0]] - new_beats[beat_lock[0]];

        Object.assign(range, { temprange: [
            Math.min(measure.temp.start, range.tempo[0]),
            Math.max(measure.temp.end, range.tempo[1])
        ] });

        measure.temp.ticks = new_ticks;
        measure.temp.beats = new_beats;

    };

    p.mouseReleased = function(event) {
        if (Mouse.outside_origin) {
            Mouse.drag.mode = '';
            return;
        }

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
            if (selected.meas)
                delete selected.meas.temp;
            Object.assign(Mouse.drag, { x: 0, y: 0, mode: '' });
            return;
        };

        if (!('meas' in selected)) {
            Mouse.drag.mode = '';
            return;
        }

        let measure = selected.meas;
        range.tempo = range.temprange;
        delete range.temprange;

        if (Mouse.drag.mode === 'tempo') {
            API.updateMeasure(selected.inst, selected.meas.id, measure.temp.start, measure.temp.end, measure.beats.length - 1, measure.temp.offset);
            console.log(measure.temp);
            delete selected.meas.temp;
            Object.assign(Mouse.drag, { x: 0, y: 0, mode: '' });
            return;
        };

        if (Mouse.drag.mode === 'measure') {
            API.updateMeasure(selected.inst, selected.meas.id, measure.start, measure.end, measure.beats.length - 1, measure.temp.offset);

            Object.assign(Mouse.drag, { x: 0, y: 0, mode: '' });
            return;
        };

        if (Mouse.drag.mode === 'tick') {
            let end = measure.temp.start + measure.temp.slope;
            measure.temp.ticks = [];
            Object.assign(Mouse.drag, { x: 0, y: 0, mode: '' });
            if (end < 10)
                return;
            
            API.updateMeasure(selected.inst, selected.meas.id, measure.temp.start, end, measure.beats.length - 1, measure.temp.offset);
        };
    }

    p.mouseMoved = function(event) {
        API.newCursor((p.mouseX - viewport)/scale);
        return false;
    };
    
}

