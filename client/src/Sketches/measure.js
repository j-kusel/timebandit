import { order_by_key, check_proximity_by_key } from '../Util/index.js';
import c from '../config/CONFIG.json';
import { primary, secondary, secondary_light, secondary_light2 } from '../config/CONFIG.json';

var scale = 1.0;
var start = 0;
var range = [0, 100];
var span = [Infinity, -Infinity];

const DEBUG = true;
const SLOW = true;

const [MOD, SHIFT, CTRL, ALT, SPACE, DEL, ESC] = [17, 16, 91, 18, 32, 46, 27];
const [KeyC, KeyI, KeyV, KeyZ, KeyH, KeyJ, KeyK, KeyL] = [67, 73, 86, 90, 72, 74, 75, 76];
const [LEFT, UP, RIGHT, DOWN] = [37, 38, 39, 40];
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
    ticks: measure.ticks,
    beats: measure.beats,
    offset: measure.offset
});




var checkSelect = (selected) => selected.inst > -1 && selected.meas !== -1;

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
        this.dragged = 0;
        this.drag_mode = ''; // measure, tick, 
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
    var mode = 0;
    var panels = false;
    var cursor = 'default';
    var locks = 0;



    var selected = { };

    var modifiers = 0;
    var dir;
    var locked = {};
    var snaps = [];
    var temp_slope = false;
    var snapped_inst = {};
    var snap_div = 0;
    var tracking_start = {
        time: 0,
        location: 0
    };
    var isPlaying = false;
    

    var debug_message;

    var copied;


    // modes: ESC, INS, EDITOR

    var beat_rollover = (beat, index) => {
        if (Mouse.dragged)
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

    p.setup = function () {
        p.createCanvas(p.windowWidth - c.CANVAS_PADDING * 2, p.windowHeight - c.FOOTER_HEIGHT);
        p.background(255);
    };

    p.windowResized = function () {
        p.resizeCanvas(p.windowWidth - c.CANVAS_PADDING * 2, p.windowHeight - c.FOOTER_HEIGHT);
    }

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 

        instruments = props.instruments;
        insertMeas = props.insertMeas;
        panels = props.panels;
        mode = props.mode;
        ({ API, CONSTANTS } = props);

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
        snaps = NUM.slice(1).reduce((acc, num, n_ind) => {
            let add_snaps = {};
            instruments.forEach((inst, i_ind) =>
                inst.ordered.forEach((measure) => {
                    let div = CONSTANTS.PPQ / (n_ind + 1);
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
        if (SLOW)
            p.frameRate(2);

        // reset Mouse.rollover cursor
        Mouse.cursor = 'default';

        // key check
        modifiers = [CTRL, SHIFT, MOD, ALT].reduce(bit_loader, 0);
        let nums = num_check();
        snap_div = (nums.length) ?
            nums[0] - 1 : 0;


        // check if Mouse within selected
        var measureBounds = (inst, measure, translate) => {
            let position = (tick) => ((measure.offset + tick)*scale + start);
            let t_mouseX = translate ? p.mouseX - (translate.X || 0) : p.mouseX;
            let t_mouseY = translate ? p.mouseY - (translate.Y || 0) : p.mouseY;
            return (t_mouseX > position(0)
                && t_mouseX < position(measure.ms)
                && t_mouseY >= inst*c.INST_HEIGHT
                && t_mouseY < (inst + 1)*c.INST_HEIGHT
                && true);
        };


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

        let select;

        if ('meas' in selected && 
            mod_check([2], modifiers) &&
            measureBounds(selected.inst, selected.meas, { X: c.PANES_WIDTH, Y: c.PLAYBACK_HEIGHT })
        )
                Mouse.cursor = 'ew-resize';

        // push below playback bar
        p.push();
        
        p.translate(0, c.PLAYBACK_HEIGHT);
        p.stroke(primary);
        p.fill(primary);
        p.rect(0, 0, c.PANES_WIDTH, p.height);
        p.translate(c.PANES_WIDTH, 0);


        // update Mouse location
        Mouse.push({ x: c.PANES_WIDTH, y: c.PLAYBACK_HEIGHT });
        instruments.forEach((inst, i_ind) => {
            var yloc = i_ind*c.INST_HEIGHT + c.PLAYBACK_HEIGHT;
            // push into instrument channel
            p.push();
            p.translate(0, yloc - c.PLAYBACK_HEIGHT);
            p.stroke(255, 0, 0);
            p.fill(secondary_light2);

            // handle inst selection
            if (selected.meas === -1 && selected.inst === i_ind)
                p.fill(230);

            p.rect(0, 0, p.width-1, 99);

            Object.keys(inst.measures).forEach((key, m_ind) => {
                let measure = inst.measures[key];

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
                var [ticks, beats, offset] = temp ?
                    [measure.temp.ticks, measure.temp.beats, measure.temp.offset] :
                    [measure.ticks, measure.beats, measure.offset];

                let origin = (offset || measure.offset)*scale + start;
                let final = measure.ms * scale;

                p.push()
                p.stroke(primary);
                p.stroke(primary);
                //debug_message = ([ticks, beats, offset].join(' '));
                p.pop();
                


                let position = (tick) => (tick*scale + start);
                
                // push into first beat
                p.push();
                p.translate(origin, 0);
                Mouse.push({ x: origin, y: yloc - c.PLAYBACK_HEIGHT });

                // draw origin
                p.stroke(0, 255, 0);
                p.line(0, 0, 0, c.INST_HEIGHT);

                // handle selection
                if ('meas' in selected && key === selected.meas.id) {
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
                p.textSize(c.INST_HEIGHT*0.5);
                p.textFont('Helvetica');
                p.textAlign(p.LEFT, p.TOP);
                let siglocX = position(0);
                p.text(measure.timesig, 0, 0);
                p.textAlign(p.LEFT, p.BOTTOM);
                p.text('4', 0, c.INST_HEIGHT - c.TIMESIG_PADDING);
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

                    if (ro) {
                        alpha = 100;
                        Mouse.rollover = {
                            type: 'beat',
                            inst: i_ind,
                            meas: measure,
                            beat: index
                        }
                            
                        if (mod_check(1, modifiers)
                            && 'meas' in selected
                        ) {

                            // change Mouse.rollover cursor
                            let shifted = mod_check(2, modifiers)
                            Mouse.cursor = (shifted) ?
                                'text' : 'pointer';

                            if (key in locked) {
                                let bits = parse_bits(locked[key].beats);
                                if ((bits.length >= 2 && (bits.indexOf(Mouse.rollover) === -1) && !shifted)
                                    || (bits.indexOf(Mouse.rollover) !== -1 && shifted)
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
                let scaleY = (input) => c.INST_HEIGHT - (input - range.tempo[0])/(range.tempo[1] - range.tempo[0])*c.INST_HEIGHT;
                let ystart = scaleY(measure.start);
                let yend = scaleY(measure.end);
                p.line(0, ystart, measure.ms*scale, yend);

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
                p.text(measure.start.toFixed(2), c.TEMPO_PADDING, tempo_loc.y);

                tempo_loc = { x: position(measure.ms) - c.TEMPO_PADDING };
                if (yend > c.TEMPO_PT + c.TEMPO_PADDING) {
                    p.textAlign(p.RIGHT, p.BOTTOM);
                    tempo_loc.y = yend - c.TEMPO_PADDING;
                } else {
                    p.textAlign(p.RIGHT, p.TOP);
                    tempo_loc.y = yend + c.TEMPO_PADDING;
                };
                p.text(measure.end.toFixed(2), measure.ms*scale - c.TEMPO_PADDING, tempo_loc.y);

                // return from measure translate
                p.pop();
                Mouse.translate.pop();

            });

            // draw snap
            if (snapped_inst) {
                p.stroke(200, 240, 200);
                let x = snapped_inst.target * scale + start;
                p.line(x, Math.min(snapped_inst.origin, snapped_inst.inst)*c.INST_HEIGHT,
                    x, (Math.max(snapped_inst.origin, snapped_inst.inst) + 1)*c.INST_HEIGHT);
            };

            p.pop();
        });

        // draw snaps
        p.stroke(100, 255, 100);
        if (snap_div > 1)
            Object.keys(snaps[snap_div]).forEach(key => {
                let inst = snaps[snap_div][key][0].inst;
                let xloc = key*scale + start;
                let yloc = inst * c.INST_HEIGHT;
                p.line(xloc, yloc, xloc, yloc + c.INST_HEIGHT);
            });

        // draw debug

        let mouse = (p.mouseX - start)/scale;
        let cursor_loc = [parseInt(Math.abs(mouse / 3600000), 10)];
        cursor_loc = cursor_loc.concat([60000, 1000].map((num) =>
            parseInt(Math.abs(mouse / num), 10).toString().padStart(2, "0")))
            .join(':');
        cursor_loc += '.' + parseInt(Math.abs(mouse % 1000), 10).toString().padStart(3, "0");
        if (mouse < 0.0)
           cursor_loc = '-' + cursor_loc;

        if (DEBUG) {
            p.push();
            p.translate(0, (instruments.length+1)*c.INST_HEIGHT);

            p.stroke(primary); //200, 240, 200);
            p.textSize(c.DEBUG_TEXT);
            p.textAlign(p.LEFT, p.TOP);
            let lines = ('meas' in selected) ?
                [`selected: ${selected.meas.timesig} beats - ${selected.meas.ms.toFixed(1)} ms`] :
                [''];

            lines.push(`location: ${cursor_loc}`);
            lines.push(debug_message || '');
            blockText(lines, { x: 0, y: c.DEBUG_TEXT }, c.DEBUG_TEXT);

            p.textAlign(p.CENTER, p.CENTER);


            let lineY = (line) => c.DEBUG_TEXT*line + c.DEBUG_HEIGHT;

            p.push();
            p.translate(0, lineY(lines.length) + 5);
            p.fill(240);
            p.textSize(8);
            let keys = [
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
            let nums = NUM.map((num, ind) => {
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


        var scaleY = (input, scale) => scale - (input - range.tempo[0])/(range.tempo[1] - range.tempo[0])*scale;

        // draw editor frame
        if (mode === 2) {
            p.push();
            let opac = p.color(primary);
            opac.setAlpha(180);
            p.stroke(opac);
            p.fill(opac);
            if (select) {
                let x = select.offset * scale + start;
                let y = selected.inst*c.INST_HEIGHT;
                p.translate(x, y);

                let ystart = scaleY(select.start, c.PREVIEW_HEIGHT);
                let yend = scaleY(select.end, c.PREVIEW_HEIGHT);
                let t_X = p.mouseX - c.PANES_WIDTH;
                if (t_X > x - 5 &&
                    t_X < x + 5 &&
                    p.mouseY > (y + c.PLAYBACK_HEIGHT + ystart - 5) &&
                    p.mouseY < (y + c.PLAYBACK_HEIGHT + ystart + 5) 
                ) {
                    p.ellipse(0, 0, 10, 10); 
                    Mouse.cursor = 'pointer';
                }


                p.translate(0, c.INST_HEIGHT);
                //p.translate(-c.PANES_WIDTH, -c.PANES_WIDTH / 3);
                p.rect(0, 0, c.PANES_WIDTH*2 + select.ms*scale, c.PANES_WIDTH *2);

                

                p.stroke(secondary);
                p.fill(secondary);
                p.textSize(10);
                p.textAlign(p.LEFT, p.CENTER);
                p.text(`${select.start} -> ${select.end} / ${select.timesig}`, 5, c.PANES_WIDTH);

            }
                
            p.pop();
        }
            

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
            //let time = tracking_start.time || API.exposeTracking().currentTime;
            let tracking = API.exposeTracking().locator();
            // check for final measure here;
            if (tracking > range.span[1] + 1000) {
                isPlaying = false;
                API.play(isPlaying, null);
            };
            let tracking_vis = tracking*scale+start;
            p.line(tracking_vis, c.PLAYBACK_HEIGHT, tracking_vis, c.INST_HEIGHT*2 + c.PLAYBACK_HEIGHT);
        };
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
            if (checkSelect(selected)) {
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

        if ('meas' in selected) {

            // DIRECTIONAL KEYS
            if (p.keyCode === KeyJ || p.keyCode === DOWN) {
                if (selected.inst >= instruments.length - 1)
                    return;
                let ind = check_proximity_by_key(selected.meas, instruments[selected.inst + 1].ordered, 'offset');

                selected = {
                    inst: Math.min(selected.inst + 1, instruments.length - 1),
                    meas: instruments[selected.inst + 1].ordered[ind],
                    ind
                };
                return;
            }

            if (p.keyCode === KeyK || p.keyCode === UP) {
                if (selected.inst <= 0)
                    return;
                let ind = check_proximity_by_key(selected.meas, instruments[selected.inst - 1].ordered, 'offset');
                selected = {
                    inst: Math.max(selected.inst - 1, 0),
                    meas: instruments[selected.inst -1].ordered[ind],
                    ind
                };
                return;
            };

            if (p.keyCode === KeyH || p.keyCode === LEFT) {
                let ind = Math.max(selected.ind - 1, 0);
                selected = {
                    ind,
                    inst: selected.inst,
                    meas: instruments[selected.inst].ordered[ind]
                };
                return;
            };

            if (p.keyCode === KeyL || p.keyCode === RIGHT) {
                let ind =  Math.min(selected.ind + 1, instruments[selected.inst].ordered.length - 1);
                selected = {
                    ind,
                    inst: selected.inst,
                    meas: instruments[selected.inst].ordered[ind]
                };
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
            API.updateMode(mode);
            return;
        };


        if (p.keyCode === DEL
            && 'meas' in selected
        ) {
            API.deleteMeasure(selected);
            return;
        }

        if (p.keyCode === SPACE) {
            (mode === 1) ?
                API.preview((p.mouseX-start)/scale) :
                API.play((p.mouseX-start)/scale);
            return;
        }

        // CTRL/MOD functions
        if (p.keyIsDown(MOD)) {
            if (p.keyCode === KeyC
                && 'meas' in selected
            )
                copied = instruments[selected.inst].measures[selected.meas];
            else if (p.keyCode === KeyV && copied)
                API.paste(selected.inst, copied, (p.mouseX-start)/scale);
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
            console.log('CTRL');
            let change = 1.0-event.delta/c.SCROLL_SENSITIVITY;
            scale = scale*change;
            start = p.mouseX - change*(p.mouseX - start);
            API.newScaling(scale);
        };
        start -= event.deltaX;
    };

    p.mousePressed = function(e) {
        console.log(Mouse.rollover);

        // return if outside canvas
        if (p.mouseX === Infinity 
            || p.mouseX < 0
            || p.mouseY === Infinity 
            || p.mouseY < 0
            || p.mouseY > p.height) {
            Mouse.outside_origin = true;
            return;
        } else
            Mouse.outside_origin = false;

        let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)*0.01);
        if (inst >= instruments.length || inst < 0)
            return;

        if (API.pollSelecting()) {
            insertMeas.temp_offset = API.confirmSelecting(inst);
            insertMeas.inst = inst;
            return;
        }

        Mouse.dragged = 0;
        var change = -1;

        let measures = instruments[inst].ordered;

        
        API.displaySelected(selected);

        console.log(Mouse.rollover);
        if (mod_check([1, 2], modifiers)) {
            let measure = selected.meas;
            measure.temp = initialize_temp(measure);
            Mouse.grabbed = Mouse.rollover.beat === measure.beats.length - 1 ?
                60000.0/measure.beats.slice(-1)[0]
                : 60000.0/(measure.ticks[(Mouse.rollover.beat * CONSTANTS.PPQ)]);
            console.log(Mouse.rollover);
            dir = 0;
            measure.temp.start = measure.start;
            if (measure.end > measure.start)
                dir = 1;
            if (measure.start > measure.end)
                dir = -1;
            Mouse.drag_mode = 'tick';
        } else if (mod_check(2, modifiers)) {
            // SHIFT held?
            measure.temp = initialize_temp(measure);
            Mouse.drag_mode = 'measure';
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

        // if nothing is locked, just drag the measure
        if (!('meas' in selected) || !(selected.meas.id in locked && locked[selected.meas.id].beats))
            Mouse.drag_mode = 'measure';


        selected = { inst };
        for (let m=0; m<measures.length; m++) {
            var left = measures[m].offset*scale + start + c.PANES_WIDTH;
            var right = left + measures[m].ms*scale; 
            if (p.mouseX > left
                && p.mouseX < right
                && p.mouseY > 0 
                && p.mouseY < p.height
            ) {
                Object.assign(selected, {
                    meas: measures[m],
                    ind: m
                });
                break;
            } 
        };

    }

    p.mouseDragged = function(event) {

        if (!('meas' in selected))
            return;
        /*if ('temp' in selected.meas)
            console.log(selected.meas.temp.offset);
            */

        var closest = (position, inst, div) =>
            Object.keys(snaps[div]).reduce((acc, key, ind, keys) => {
                if (snaps[div][key][0].inst === inst)
                    return acc;
                let gap = parseFloat(key, 10) - position;
                return (Math.abs(gap) < Math.abs(acc.gap) ? 
                    { target: parseFloat(key, 10), gap, inst: snaps[div][key][0].inst } :
                    acc);
            }, { target: -1, gap: Infinity, inst: -1 });

        var snap_eval = (position, candidates) =>
            candidates.reduce((acc, candidate, index) => {
                let next = position + candidate;
                let target, gap, inst;
                ({ target, gap, inst } = closest(next, selected.inst, snap_div));
                if (Math.abs(gap) < Math.abs(acc.gap)) 
                    return { index, target, gap, inst };
                return acc;
            }, { index: -1, target: Infinity, gap: Infinity, inst: -1 });

        if (Mouse.rollover.beat === 0
            || Mouse.outside_origin
            || selected.meas === -1)
            return;
      
        Mouse.dragged += event.movementX;

        let measure = selected.meas;

        if (Math.abs(Mouse.dragged) < c.DRAG_THRESHOLD_X) {
            delete measure.temp;
            return;
        } else if (!('temp' in measure))
            measure.temp = initialize_temp(measure);
        // CACHE THIS
        if (!('gaps' in measure))
            measure.gaps = calcGaps(instruments[selected.inst].ordered, selected.meas.id);

        if (Mouse.drag_mode === 'measure') {
            let position = measure.offset + Mouse.dragged/scale;
            let close = snap_eval(position, measure.beats);

            // check for overlaps
            let crowding = measure.gaps
                .reduce((acc, gap) => {
                    // does it even fit in the gap?
                    if (gap[1] - gap[0] < measure.ms)
                        return acc;
                    let start = [gap[0], position - gap[0]];
                    let end = [gap[1], gap[1] - (position + measure.ms)];
                    if (Math.abs(start[1]) < Math.abs(acc.start[1]))
                        acc.start = start;
                    if (Math.abs(end[1]) < Math.abs(acc.end[1]))
                        acc.end = end;
                    return acc;
                }, { start: [0, Infinity], end: [0, Infinity], gap: [] });

            // determine whether start or end are closer
            // negative numbers signify conflicts
            if (Math.abs(crowding.start[1]) < Math.abs(crowding.end[1])) {
                if (crowding.start[1] - c.SNAP_THRESHOLD < 0) {
                    measure.temp.offset = crowding.start[0];
                    measure.temp.ticks = measure.ticks.slice(0);
                    measure.temp.beats = measure.beats.slice(0);
                    return;
                }
            } else {
                if (crowding.end[1] - c.SNAP_THRESHOLD < 0) {
                    measure.temp.offset = crowding.end[0] - measure.ms;
                    measure.temp.ticks = measure.ticks.slice(0);
                    measure.temp.beats = measure.beats.slice(0);
                    return;
                }
            }

            if (close.index !== -1) {
                let gap = close.target - (measure.beats[close.index] + position);
                if (Math.abs(gap) < 50) {
                    snapped_inst = { ...close, origin: selected.inst };
                    position += gap;
                } else
                    snapped_inst = {};
            };

            measure.temp.ticks = measure.ticks.slice(0);
            measure.temp.beats = measure.beats.slice(0);
            measure.temp.offset = position;
            
            return;
        };


        let beatscale = (-Mouse.dragged*scale); // /p.width


        var slope = measure.end - measure.start;
        var temp_start = ('temp' in measure) ?
            measure.temp.start || measure.start :
            measure.start;

        let perc = Math.abs(slope) < c.FLAT_THRESHOLD ?
            ((dir === 1) ? -c.FLAT_THRESHOLD : c.FLAT_THRESHOLD) :
            Mouse.grabbed/Math.abs(slope);


        // divide this by scale? depending on zoom?
        let amp_lock = beatscale/perc;


        let ticks = (Mouse.rollover.beat) * CONSTANTS.PPQ_tempo;
        let tick_array = Array.from({length: ticks}, (_, i) => i);


        // if START is locked
        // change slope, preserve start
        if (locks & (1 << 1)) {
            slope += amp_lock;
            temp_start = measure.start;
        }

        // if END is locked
        // change slope, preserve end by changing start to compensate
        else if (locks & (1 << 2)) {
            console.log('ONE');
            slope -= amp_lock;
            temp_start = measure.start + amp_lock;
        // if SLOPE is locked
        // split change between start and end
        } else if (locks & (1 << 4)) {

            console.log('TWO');
            //slope += amp_lock/2; 
            temp_start = measure.start + amp_lock;
        } else {

            console.log('THREE');
            slope += amp_lock/2; 
            temp_start = measure.start + amp_lock/2;
        };


        let PPQ_mod = CONSTANTS.PPQ / CONSTANTS.PPQ_tempo;
        let C = (delta) => 60000.0 * (measure.beats.length - 1) / (delta);
        let sigma = (start, constant) => ((n) => (1.0 / ((start * CONSTANTS.PPQ_tempo * constant / 60000.0) + n)));

        let C1 = C(slope);
        var beat_lock = (selected.meas.id in locked && locked[selected.meas.id].beats) ?
            parse_bits(locked[selected.meas.id].beats) : [];
        let lock = 0;
        let ms = C1 * tick_array.reduce((sum, _, i) => {
            if (beat_lock.length && (i === beat_lock[0]*CONSTANTS.PPQ_tempo))
                lock = sum*C1;
            return sum + sigma(temp_start, C1)(i);
        }, 0);

        if (Math.abs(ms - measure.ms) < c.DRAG_THRESHOLD_X) {
            measure.temp.offset = measure.offset;
            measure.temp.start = measure.start;
            slope = measure.end - measure.start;

            return;
        };


        let temp_offset = measure.offset;
        if (lock)
            temp_offset += measure.beats[beat_lock] - lock;

        let loc = ms + temp_offset;

        // check for gap
        /*let crowding = measure.gaps
            .filter((gap) => {
                return (temp_offset > gap[0] && loc < gap[1]);
            });
        if (!crowding.length)
            return;
            */

        let snap_to = closest(loc, selected.inst, snap_div).target;
        let gap = loc - snap_to;
        let diff = slope;

        // LENGTH GRADIENT DESCENT

        // check what's locked to determine nudge algo
        let delta = (!(locks & (1 << 1)) && !(locks & (1 << 2))) ? 
            1.0 : 0.5;
        let diff_null = !!(locks & (1 << 2));

        var nudge = (gap, alpha, depth) => {
            if (depth > 99 || Math.abs(gap) < c.NUDGE_THRESHOLD)
                return diff;

            // if END is locked
            if (diff_null) {
                measure.temp.start *= (gap > c.NUDGE_THRESHOLD) ?
                    (1 + alpha) : (1 - alpha);
                diff = measure.end - measure.temp.start;
            // else change alpha multiplier based on start or slope lock
            } else
                diff *= (gap > c.NUDGE_THRESHOLD) ?
                    (1 + alpha*delta) : (1 - alpha*delta);
            
            let new_C = C(diff);
            let locked = 0;
            let lock_target = beat_lock[0] * CONSTANTS.PPQ_tempo;
            let ms = new_C * tick_array.reduce((sum, _, i) => {
                if (i === lock_target)
                    locked = sum*new_C;
                return sum + sigma(measure.temp.start, new_C)(i);
            }, 0);
            if (locked)
                measure.temp.offset = measure.offset + measure.beats[beat_lock[0]] - locked;
            let new_gap = ms + (measure.temp.offset || measure.offset) - snap_to;
            alpha = monitor(gap, new_gap, alpha);
            return nudge(new_gap, alpha, depth + 1);
        };


        if (Math.abs(gap) < c.SNAP_THRESHOLD) {
            // if initial snap, update measure.temp.start 
            // for the last time and nudge.
            if (!temp_slope) {
                measure.temp.start = temp_start;
                temp_slope = nudge(gap, 0.001, 0);
            };
            slope = temp_slope;
        } else {
            temp_slope = 0;
            measure.temp.start = temp_start;
        }

                   
        // INVERT THIS DRAG AT SOME POINT?
        let inc = slope/(measure.ticks.length);

        // if DIRECTION is locked
        if (locks & (1 << 3)) {
            // flat measure can't change direction
            if (!dir)
                return;
            inc = (dir === 1) ?
                Math.max(inc, 0) : inc;
            if (locks & (1 << 2))
                measure.temp.start = (dir === 1) ?
                    Math.min(measure.temp.start, measure.end) :
                    Math.max(measure.temp.start, measure.end);
        };

        let cumulative = 0.0;
        let K = 60000.0 / CONSTANTS.PPQ;
        let last = 0;

        let new_beats = [];
        let new_ticks = [];
        measure.ticks.forEach((_, i) => {
            if (!(i%CONSTANTS.PPQ))
                new_beats.push(cumulative);
            new_ticks.push(cumulative);
            if (i%PPQ_mod === 0) 
                last = K / (measure.temp.start + inc*i);
            cumulative += last;
        });
        new_beats.push(cumulative);


        measure.temp.slope = slope;
        measure.temp.offset = measure.offset;
        console.log(beat_lock);
        if (beat_lock.length === 1)
            measure.temp.offset += measure.beats[beat_lock[0]] - new_beats[beat_lock[0]];


        measure.temp.ticks = new_ticks;
        measure.temp.beats = new_beats;

        console.log(measure.temp);

    };

    p.mouseReleased = function(event) {
        if (p.mouseY < 0 || p.mouseY > p.height)
            return;
        // handle threshold
        if (Math.abs(Mouse.dragged) < c.DRAG_THRESHOLD_X) {
            if ('meas' in selected)
                delete selected.meas.temp;
            Mouse.dragged = 0;
            return;
        };

        if (selected.meas === -1)
            return

        let measure = selected.meas;

        if (Mouse.drag_mode === 'measure') {
            API.updateMeasure(selected.inst, selected.meas.id, measure.start, measure.end, measure.beats.length - 1, measure.temp.offset);
            Mouse.dragged = 0;
            return;
        };

        if (Mouse.drag_mode === 'tick') {
            let end = measure.temp.start + measure.temp.slope;
            measure.temp.ticks = [];
            Mouse.dragged = 0;
            if (end < 10)
                return;
            
            API.updateMeasure(selected.inst, selected.meas.id, measure.temp.start, end, measure.beats.length - 1, measure.temp.offset);
        };
    }

    p.mouseMoved = function(event) {
        API.newCursor((p.mouseX - start)/scale);
        return false;
    };
    
}

