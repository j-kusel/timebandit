var scale = 1.0;
var start = 0;
var range = [0, 100];

const DEBUG = true;

const DEBUG_HEIGHT = 200;
const DEBUG_TEXT = 12;

const WINDOW_PERCENTAGE = 0.80;

const DRAG_THRESHOLD_X = 10;
const FLAT_THRESHOLD = 10;
const NUDGE_THRESHOLD = 1;
const INST_HEIGHT = 100;
const SCROLL_SENSITIVITY = 100.0;
const ROLLOVER_TOLERANCE = 3;
const TIMESIG_PADDING = 5;
const TEMPO_PADDING = 5;
const TEMPO_PT = 8; // font size

const [MOD, SHIFT, CTRL, ALT] = [17, 16, 91, 18];
const [KeyC, KeyV] = [67, 86];
const NUM = []
for (let i=48; i < 58; i++)
    NUM.push(i);

var calcRange = (measures) => {
    let ranged = [];
    Object.keys(measures).forEach((key) => {
        ranged.push(measures[key].start);
        ranged.push(measures[key].end);
    });
    return [Math.min(...ranged), Math.max(...ranged)];
};

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


export default function measure(p) {

    var rollover;
    var grabbed;
    var dragged = 0;
    var outside_origin = true;
    var drag_mode = '';
    var modifiers = 0;
    var API, CONSTANTS;
    var selected = {inst: -1};
    var dir;
    var locked = {};
    var locks = 0;
    var amp_lock = 0;
    var snaps = [];
    var snapped = false;
    var snapped_inst = -1;
    var snap_div = 0;
    var scope = window.innerWidth * WINDOW_PERCENTAGE;

    var debug_message;

    var copied;

    var instruments = [];
    var cursor = 'default';

    var beat_rollover = (beat, index) => {
        if (dragged)
            return false;
        if (p.mouseX > beat-ROLLOVER_TOLERANCE && p.mouseX < beat+ROLLOVER_TOLERANCE) {
            rollover = index;
            return true;
        }             
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
        NUM.reduce((acc, num, ind) =>
            p.keyIsDown(num) ? 
                [...acc, ind] : acc, []);

    p.setup = function () {
        p.createCanvas(scope, INST_HEIGHT + DEBUG_HEIGHT);
        p.background(0);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        instruments = props.instruments;
        ({ API, CONSTANTS } = props);
        console.log(CONSTANTS);

        if ('locks' in props)
            locks = props.locks.reduce((acc, lock) => (acc |= (1 << lock)), 0); 
        snaps = [];

        let add_snaps = {};
        /*let all_meas = instruments.reduce((acc, inst, i_ind) => {
            Object.keys(inst.measures).forEach((key) => {
                let measure = inst.measures[key];
                measure.beats.forEach((beat) => {
                    let loc = (beat + measure.offset).toString();
                    let obj = { inst: i_ind, meas: key };
                    if (loc in add_snaps)
                        add_snaps[loc].push(obj);
                    else
                        add_snaps[loc] = [obj];
                });

                measure.temp_beats = [];
                measure.temp_ticks = [];
            });
            return ({ ...acc, ...(inst.measures) });
        }, {});
        snaps.push(add_snaps);
        */

        NUM.slice(1).forEach((num, n_ind) => {
            add_snaps = {};
            instruments.forEach((inst, i_ind) =>
                Object.keys(inst.measures).forEach((key) => {
                    let measure = inst.measures[key];
                    let div = CONSTANTS.PPQ / (n_ind + 1);
                    for (let i=0; i < measure.ticks.length; i += div) {
                        let tick = Math.round(i);
                        let target = (tick >= measure.ticks.length) ?
                            measure.ms : measure.ticks[tick];
                        let loc = (target + measure.offset).toString();
                        let obj = { inst: i_ind, meas: key };
                        if (loc in add_snaps)
                            add_snaps[loc].push(obj)
                        else
                            add_snaps[loc] = [obj];
                    };
                }) , {});
            snaps.push(add_snaps);
        });
        console.log(snaps);

        // add downbeat snaps
        let all_meas = instruments.reduce((acc, inst) => ({ ...acc, ...(inst.measures) }), {});
        range = calcRange(all_meas);
        
        p.resizeCanvas(p.width, INST_HEIGHT*instruments.length + DEBUG_HEIGHT);

    }

    p.draw = function () {

        // reset rollover cursor
        cursor = 'default';

        // key check
        modifiers = [CTRL, SHIFT, MOD, ALT].reduce(bit_loader, 0);

        // check if mouse within selected
        var measureBounds = (inst, measure) => {
            let position = (tick) => ((measure.offset + tick)*scale + start);
            return (p.mouseX > position(0) 
                && p.mouseX < position(measure.ms)
                && p.mouseY >= inst*INST_HEIGHT
                && p.mouseY < (inst + 1)*INST_HEIGHT 
                && true);
        };

        let nums = num_check();
        snap_div = (nums.length) ?
            nums[0] - 1 : 0;

        
        // check and draw selection
        if (selected.inst > -1 && selected.meas !== -1) {

            // change cursor
            if (mod_check([2], modifiers) && measureBounds(selected.inst, instruments[selected.inst].measures[selected.meas]))
                cursor = 'ew-resize';

            p.stroke(240, 255, 240);
            p.fill(240, 255, 240); 

            // check this later?
            p.rect(instruments[selected.inst].measures[selected.meas].offset * scale + start, selected.inst*INST_HEIGHT, instruments[selected.inst].measures[selected.meas].ms * scale, INST_HEIGHT);
        };


        instruments.forEach((inst, i_ind) => {
            let yloc = i_ind*INST_HEIGHT;
            p.stroke(255, 0, 0);
            p.fill(255, 255, 255);

            // handle inst selection
            if (selected.meas === -1 && selected.inst === i_ind)
                p.fill(230);

            p.rect(0, yloc, p.width-1, yloc+99);

            Object.keys(inst.measures).forEach(key => {

                let measure = inst.measures[key];

                var ticks = 'ticks';
                var beats = 'beats';
                var offset = 'offset';

                let position = (tick) => (((measure[offset] || measure.offset) + tick)*scale + start);
                let origin = position(measure.beats[0]);

                // draw origin
                p.stroke(0, 255, 0);
                p.line(origin, yloc, origin, yloc + INST_HEIGHT);

                // handle selection
                if (key === selected.meas) {
                    p.fill(0, 255, 0, 20);
                    p.rect(origin, yloc, measure.ms*scale, INST_HEIGHT);
                }

                // check for temporary display
                if ((measure.temp_ticks && measure.temp_ticks.length) || measure.temp_offset) {
                    ticks = 'temp_ticks';
                    beats = 'temp_beats';
                    offset = 'temp_offset';
                }

                // draw ticks
                p.stroke(240);
                measure[ticks].forEach((tick) => {
                    let loc = position(tick);
                    if (loc > p.width)
                        return
                    p.line(loc, yloc, loc, yloc + INST_HEIGHT);
                });

                // draw timesig
                p.fill(100);
                p.textSize(INST_HEIGHT*0.5);
                p.textFont('Helvetica');
                p.textAlign(p.LEFT, p.TOP);
                let siglocX = position(0) + TIMESIG_PADDING;
                p.text(measure.timesig, siglocX, yloc + TIMESIG_PADDING);
                p.textAlign(p.LEFT, p.BOTTOM);
                p.text('4', siglocX, yloc + INST_HEIGHT - TIMESIG_PADDING);

                // draw beats
                measure[beats].forEach((beat, index) => {
                    let coord = position(beat);
                    let color = [255, 0, 0];
                    let alpha;
                    if (key in locked && (locked[key].beats & (1 << index)))
                        color = [0, 0, 255];

                    // try rollover
                    let ro = (beats === 'beats'
                        && p.mouseY >= yloc
                        && p.mouseY < yloc + INST_HEIGHT
                        && beat_rollover(coord, index)
                    );

                    alpha = ro ? 
                        100 : 255;

                    // change rollover cursor
                    if (mod_check(1, modifiers)
                        && ro
                        && selected.inst > -1
                        && selected.meas !== -1
                    ) {

                        let shifted = mod_check(2, modifiers)
                        cursor = (shifted) ?
                            'text' : 'pointer';

                        if (selected.meas in locked) {
                            let bits = parse_bits(locked[selected.meas].beats);
                            if ((bits.length >= 2 && (bits.indexOf(rollover) === -1) && !shifted)
                                || (bits.indexOf(rollover) !== -1 && shifted)
                            )
                                cursor = 'not-allowed';
                        };
                    };

                    p.stroke(...color, alpha);
                    p.line(coord, yloc, coord, yloc + INST_HEIGHT);
                });

                // draw tempo graph
                p.stroke(240, 200, 200);
                let scaleY = (input) => INST_HEIGHT - (input - range[0])/(range[1] - range[0])*INST_HEIGHT;
                let ystart = yloc + scaleY(measure.start);
                let yend = yloc + scaleY(measure.end);
                p.line(position(0), ystart, position(measure.beats.slice(-1)[0]), yend);

                // draw tempo markings
                p.fill(100);
                p.textSize(TEMPO_PT);
                let tempo_loc = { x: position(0) + TEMPO_PADDING };
                if (ystart > yloc + TEMPO_PT + TEMPO_PADDING) {
                    p.textAlign(p.LEFT, p.BOTTOM);
                    tempo_loc.y = ystart - TEMPO_PADDING;
                } else {
                    p.textAlign(p.LEFT, p.TOP);
                    tempo_loc.y = ystart + TEMPO_PADDING;
                };
                p.text(measure.start.toFixed(2), tempo_loc.x, tempo_loc.y);

                tempo_loc = { x: position(measure.ms) - TEMPO_PADDING };
                if (yend > yloc + TEMPO_PT + TEMPO_PADDING) {
                    p.textAlign(p.RIGHT, p.BOTTOM);
                    tempo_loc.y = yend - TEMPO_PADDING;
                } else {
                    p.textAlign(p.RIGHT, p.TOP);
                    tempo_loc.y = yend + TEMPO_PADDING;
                };
                p.text(measure.end.toFixed(2), tempo_loc.x, tempo_loc.y);

            });

            // draw snap
            if (snapped_inst) {
                p.stroke(200, 240, 200);
                let x = snapped_inst.target * scale + start;
                p.line(x, Math.min(snapped_inst.origin, snapped_inst.inst)*INST_HEIGHT,
                    x, (Math.max(snapped_inst.origin, snapped_inst.inst) + 1)*INST_HEIGHT);
            };
        });

        // draw snaps
        p.stroke(100, 255, 100);
        Object.keys(snaps[snap_div]).forEach(key => {
            let inst = snaps[snap_div][key][0].inst;
            p.line(key*scale + start, inst * INST_HEIGHT, key*scale + start, (inst+1) * INST_HEIGHT);
        });

        // draw debug

        if (DEBUG) {
            let DEBUG_START = INST_HEIGHT*instruments.length;
            let lineY = (line) => DEBUG_TEXT*line + DEBUG_START + DEBUG_TEXT;

            p.stroke(200, 240, 200);
            p.textSize(DEBUG_TEXT);
            p.textAlign(p.LEFT, p.TOP);
            let lines = [
                `selected: ${selected.inst} - ${selected.meas}`,
                `snapped slope: ${snapped}`,
                debug_message || ''
            ];
            lines.forEach((line, i) => p.text(line, DEBUG_TEXT, lineY(i)));

            p.textAlign(p.CENTER, p.CENTER);


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
                p.rect(5 + ind*25, lineY(lines.length) + 5, 20, 15);
                p.fill(240);
                p.text(key.name, 15 + ind*25, lineY(lines.length) + 12);
            });

            let nums = NUM.map((num, ind) => {
                if (p.keyIsDown(num))
                    p.fill(120);
                p.rect(5 + ind*25, lineY(lines.length) + 25, 20, 15);
                p.fill(240);
                p.text(ind, 15 + ind*25, lineY(lines.length) + 32);

            });

        };

        // draw cursor
        p.stroke(240);
        p.line(p.mouseX, 0, p.mouseX, INST_HEIGHT*instruments.length);

        document.body.style.cursor = cursor;
                
    }

    p.keyPressed = function(e) {
        if (p.keyCode === KeyC
            && selected.inst > -1
            && selected.meas !== -1
        )
            copied = instruments[selected.inst].measures[selected.meas];
        else if (p.keyCode === KeyV && copied)
            API.paste(selected.inst, copied, (p.mouseX-start)/scale);
        return true;
    };

    p.mouseWheel = function(event) {
        let change = 1.0-event.delta/SCROLL_SENSITIVITY;
        scale = scale*change;
        start = p.mouseX - change*(p.mouseX - start);
        API.newScaling(scale);
    };

    p.mousePressed = function(e) {
        // return if outside canvas
        if (p.mouseX === Infinity 
            || p.mouseY === Infinity 
            || p.mouseY < 0
            || p.mouseY > p.height) {
            outside_origin = true;
            return;
        };

        outside_origin = false;

        dragged = 0;
        var change = -1;
        let inst = Math.floor(p.mouseY*0.01);
        let meas = instruments[inst].measures;

        Object.keys(meas).forEach((key) => {
            let measure = meas[key];
            var left = (measure.offset)*scale + start;
            var right = (measure.offset + measure.ms)*scale + start;
            if (p.mouseX > left
                    && p.mouseX < right
                    && p.mouseY > 0 
                    && p.mouseY < p.height)
                change = key;
        });

        selected = {inst, meas: change || -1};
        API.displaySelected(selected);

        if (mod_check([1, 2], modifiers)) {
            let measure = instruments[selected.inst].measures[selected.meas];
            grabbed = 60000.0/(measure.ticks[(rollover * CONSTANTS.PPQ)]);
            dir = 0;
            measure.temp_start = measure.start;
            if (measure.end > measure.start)
                dir = 1;
            if (measure.start > measure.end)
                dir = -1;
            drag_mode = 'tick';
        } else if (mod_check(2, modifiers)) {
            // SHIFT held?
            drag_mode = 'measure';
        } else if (mod_check(1, modifiers)) {
            // LOCKING
            // CTRL held?
            if (!(selected.meas in locked))
                locked[selected.meas] = {
                    beats: [],
                    meta: {}
                };
            // IS THIS DUMB?
            if (parse_bits(locked[selected.meas].beats).length < 2 || parse_bits(locked[selected.meas].beats).indexOf(rollover) !== -1)
                locked[selected.meas].beats = bit_toggle(locked[selected.meas].beats, rollover);
            console.log(locked[selected.meas].beats);
        };

        // if nothing is locked, just drag the measure
        if (!(selected.meas in locked && locked[selected.meas].beats))
            drag_mode = 'measure';
    }

    p.mouseDragged = function(event) {

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

        if (rollover === 0
            || outside_origin
            || selected.meas === -1)
            return;
      
        dragged += event.movementX;

        let measure = instruments[selected.inst].measures[selected.meas];

        if (Math.abs(dragged) < DRAG_THRESHOLD_X) {
            measure.temp_beats = [];
            measure.temp_ticks = [];
            delete measure.temp_start;
            delete measure.temp_slope;
            delete measure.temp_offset;
            return;
        };

                
        measure.temp_ticks = [];
        measure.temp_beats = [];


        if (drag_mode === 'measure') {
            let position = measure.offset + dragged/scale;
            let close = snap_eval(position, measure.beats);

            if (close.index !== -1) {
                let gap = close.target - (measure.beats[close.index] + position);
                if (Math.abs(gap) < 50) {
                    snapped_inst = { ...close, origin: selected.inst };
                    position += gap;
                } else
                    snapped_inst = 0;
            };

            measure.temp_ticks = measure.ticks.slice(0);
            measure.temp_beats = measure.beats.slice(0);
            measure.temp_offset = position;
            
            return;
        };


        let beatscale = (-dragged*scale); // /p.width


        var slope = measure.end - measure.start;
        var temp_start = measure.temp_start || measure.start;

        let perc = Math.abs(slope) < FLAT_THRESHOLD ?
            ((dir === 1) ? -FLAT_THRESHOLD : FLAT_THRESHOLD) :
            grabbed/Math.abs(slope);

        // divide this by scale? depending on zoom?
        amp_lock = beatscale/perc;


        let ticks = (measure.beats.length - 1) * CONSTANTS.PPQ_tempo;
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


        let PPQ_mod = CONSTANTS.PPQ / CONSTANTS.PPQ_tempo;
        let C = (delta) => 60000.0 * (measure.beats.length - 1) / (delta);
        let sigma = (start, constant) => ((n) => (1.0 / ((start * CONSTANTS.PPQ_tempo * constant / 60000.0) + n)));

        let C1 = C(slope);
        let ms = C1 * tick_array.reduce((sum, _, i) => sum + sigma(temp_start, C1)(i), 0);
        if (Math.abs(ms - measure.ms) < DRAG_THRESHOLD_X) {
            measure.temp_offset = measure.offset;
            measure.temp_start = measure.start;
            slope = measure.end - measure.start;
            return;
        };
        
        let diff = slope;

        let loc = (ms + (measure.temp_offset || measure.offset));
        let snap_to = closest(loc, selected.inst, snap_div).target;
        let gap = loc - snap_to;

        // LENGTH GRADIENT DESCENT
        // ADD SELF-MONITORING HERE

        var nudgeS = (gap, alpha, depth) => {
            if (depth > 99 || Math.abs(gap) < NUDGE_THRESHOLD)
                return diff;
            diff *= (gap > NUDGE_THRESHOLD) ?
                (1 + alpha) : (1 - alpha);
            let new_C = C(diff);
            let ms = new_C * tick_array.reduce((sum, _, i) => sum + sigma(measure.temp_start, new_C)(i), 0);
            let new_gap = ms + (measure.temp_offset || measure.offset) - snap_to;
            alpha = monitor(gap, new_gap, alpha);
            return nudgeS(new_gap, alpha, depth + 1);
        };

        var nudgeE = (gap, alpha, depth) => {
            if (depth > 99 || Math.abs(gap) < NUDGE_THRESHOLD)
                return diff;
            measure.temp_start *= (gap > NUDGE_THRESHOLD) ?
                (1 + alpha) : (1 - alpha);
            diff = measure.end - measure.temp_start;
            let new_C = C(diff);
            let ms = new_C * tick_array.reduce((sum, _, i) => sum + sigma(measure.temp_start, new_C)(i), 0);
            let new_gap = ms + (measure.temp_offset || measure.offset) - snap_to;
            alpha = monitor(gap, new_gap, alpha);
            return nudgeE(new_gap, alpha, depth + 1);
        };

        var nudgeSE = (gap, alpha, depth) => {
            if (depth > 99 || Math.abs(gap) < NUDGE_THRESHOLD)
                return diff;
            measure.temp_start *= (gap > NUDGE_THRESHOLD) ?
                (1 + alpha*0.5) : (1 - alpha*0.5);
            // slope (diff) doesn't change.
            let new_C = C(diff);
            let ms = new_C * tick_array.reduce((sum, _, i) => sum + sigma(measure.temp_start, new_C)(i), 0);
            let new_gap = ms + (measure.temp_offset || measure.offset) - snap_to;
            alpha = monitor(gap, new_gap, alpha);
            return nudgeSE(new_gap, alpha, depth + 1);
        };

        if (Math.abs(gap) < 50) {
            // if initial snap, update measure.temp_start 
            // for the last time and nudge.
            if (!snapped) {
                measure.temp_start = temp_start;
                // check what's locked to determine nudge algo
                let nudge = (locks & (1 << 1)) ?
                    nudgeS :
                    (locks & (1 << 2)) ? nudgeE : nudgeSE;
                // invert learning rate depending on slope
                snapped = nudge(gap, 0.001, 0);
            };
            slope = snapped;
        } else {
            snapped = 0;
            measure.temp_start = temp_start;
        };

            
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
                measure.temp_start = (dir === 1) ?
                    Math.min(measure.temp_start, measure.end) :
                    Math.max(measure.temp_start, measure.end);
        };

        let cumulative = 0.0;
        let K = 60000.0 / CONSTANTS.PPQ;
        let last = 0;
        measure.ticks.forEach((_, i) => {
            if (!(i%CONSTANTS.PPQ))
                measure.temp_beats.push(cumulative);
            measure.temp_ticks.push(cumulative);
            if (i%PPQ_mod === 0) 
                last = K / (measure.temp_start + inc*i);
            cumulative += last;
        });
        measure.temp_beats.push(cumulative);

        var beat_lock = (selected.meas in locked && locked[selected.meas].beats) ?
            parse_bits(locked[selected.meas].beats) : [];

        measure.temp_slope = slope;
        measure.temp_offset = measure.offset;
        if (beat_lock.length === 1)
            measure.temp_offset += measure.beats[beat_lock[0]] - measure.temp_beats[beat_lock[0]];

    };

    p.mouseReleased = function(event) {
        if (p.mouseY < 0 || p.mouseY > p.height)
            return;
        // handle threshold
        if (Math.abs(dragged) < DRAG_THRESHOLD_X) {
            if (selected.meas !== -1) {
                instruments[selected.inst].measures[selected.meas].temp_ticks = [];
            };
            dragged = 0;
            return;
        };

        if (selected.meas === -1)
            return

        let measure = instruments[selected.inst].measures[selected.meas];

        if (drag_mode === 'measure') {
            API.updateMeasure(selected.inst, selected.meas, measure.start, measure.end, measure.beats.length - 1, measure.temp_offset);
            dragged = 0;
            return;
        };

        if (drag_mode === 'tick') {
            let end = measure.temp_start + measure.temp_slope;
            measure.temp_ticks = [];
            dragged = 0;
            if (end < 10)
                return;
            
            // if start changes, update accordingly.
            //let start = (locks & (1 << 2)) ? measure.start + amp_lock : measure.start;
            
            API.updateMeasure(selected.inst, selected.meas, measure.temp_start, end, measure.beats.length - 1, measure.temp_offset);

            amp_lock = 0;
        };
    }

    p.mouseMoved = function(event) {
        API.newCursor((p.mouseX - start)/scale);
        return false;
    };
    
}

