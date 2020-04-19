import { order_by_key } from '../Util/index.js';
import c from '../config/CONFIG.json';
import { primary, secondary } from '../config/CONFIG.json';

var scale = 1.0;
var start = 0;
var range = [0, 100];

const DEBUG = true;

const [MOD, SHIFT, CTRL, ALT, SPACE, DEL] = [17, 16, 91, 18, 32, 46];
const [KeyC, KeyV, KeyZ] = [67, 86, 90];
const NUM = []
for (let i=48; i < 58; i++)
    NUM.push(i);

var calcRange = (measures) => {
    let tempo = [];
    let span = [];
    Object.keys(measures).forEach((key) => {
        tempo.push(measures[key].start);
        tempo.push(measures[key].end);
        span.push(measures[key].offset);
        span.push(measures[key].offset + measures[key].ms);
    });
    return {
        tempo: [Math.min(...tempo), Math.max(...tempo)],
        span: [Math.min(...span), Math.max(...span)],
    };
};


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
    var scope = window.innerWidth * c.WINDOW_PERCENTAGE;
    var tracking_start = {
        time: 0,
        location: 0
    };
    var isPlaying = false;

    var debug_message;

    var copied;

    var instruments = [];
    var cursor = 'default';

    var beat_rollover = (beat, index) => {
        if (dragged)
            return false;
        if (p.mouseX > beat-c.ROLLOVER_TOLERANCE && p.mouseX < beat+c.ROLLOVER_TOLERANCE) {
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
        p.createCanvas(scope, c.INST_HEIGHT + c.DEBUG_HEIGHT);
        p.background(0);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        instruments = props.instruments;
        ({ API, CONSTANTS } = props);
        

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
        
        // REFACTOR ORDERING INTO NUM ITERATIONS LATER
        instruments.forEach((inst) => inst.ordered = order_by_key(inst.measures, 'offset'));

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
        
        p.resizeCanvas(p.width, c.INST_HEIGHT*instruments.length + c.DEBUG_HEIGHT);

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
                && p.mouseY >= inst*c.INST_HEIGHT
                && p.mouseY < (inst + 1)*c.INST_HEIGHT 
                && true);
        };


        let nums = num_check();
        snap_div = (nums.length) ?
            nums[0] - 1 : 0;

        
        // check and draw selection
        if (checkSelect(selected)) {
            let select = instruments[selected.inst].measures[selected.meas];
            // change cursor
            if (mod_check([2], modifiers) && measureBounds(selected.inst, instruments[selected.inst].measures[selected.meas]))
                cursor = 'ew-resize';

            p.stroke(240, 255, 240);
            p.fill(240, 255, 240); 

            // check this later?
            p.rect(select.offset * scale + start, selected.inst*c.INST_HEIGHT, select.ms * scale, c.INST_HEIGHT);
        };


        instruments.forEach((inst, i_ind) => {
            let yloc = i_ind*c.INST_HEIGHT;
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
                p.line(origin, yloc, origin, yloc + c.INST_HEIGHT);

                // handle selection
                if (key === selected.meas) {
                    p.fill(0, 255, 0, 20);
                    p.rect(origin, yloc, measure.ms*scale, c.INST_HEIGHT);
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
                    p.line(loc, yloc, loc, yloc + c.INST_HEIGHT);
                });

                // draw timesig
                p.fill(100);
                p.textSize(c.INST_HEIGHT*0.5);
                p.textFont('Helvetica');
                p.textAlign(p.LEFT, p.TOP);
                let siglocX = position(0) + c.TIMESIG_PADDING;
                p.text(measure.timesig, siglocX, yloc + c.TIMESIG_PADDING);
                p.textAlign(p.LEFT, p.BOTTOM);
                p.text('4', siglocX, yloc + c.INST_HEIGHT - c.TIMESIG_PADDING);

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
                        && p.mouseY < yloc + c.INST_HEIGHT
                        && beat_rollover(coord, index)
                    );

                    alpha = ro ? 
                        100 : 255;

                    // change rollover cursor
                    if (mod_check(1, modifiers)
                        && ro
                        && checkSelect(selected)
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
                    p.line(coord, yloc, coord, yloc + c.INST_HEIGHT);
                });

                // draw tempo graph
                p.stroke(240, 200, 200);
                let scaleY = (input) => c.INST_HEIGHT - (input - range.tempo[0])/(range.tempo[1] - range.tempo[0])*c.INST_HEIGHT;
                let ystart = yloc + scaleY(measure.start);
                let yend = yloc + scaleY(measure.end);
                p.line(position(0), ystart, position(measure.beats.slice(-1)[0]), yend);

                // draw tempo markings
                p.fill(100);
                p.textSize(c.TEMPO_PT);
                let tempo_loc = { x: position(0) + c.TEMPO_PADDING };
                if (ystart > yloc + c.TEMPO_PT + c.TEMPO_PADDING) {
                    p.textAlign(p.LEFT, p.BOTTOM);
                    tempo_loc.y = ystart - c.TEMPO_PADDING;
                } else {
                    p.textAlign(p.LEFT, p.TOP);
                    tempo_loc.y = ystart + c.TEMPO_PADDING;
                };
                p.text(measure.start.toFixed(2), tempo_loc.x, tempo_loc.y);

                tempo_loc = { x: position(measure.ms) - c.TEMPO_PADDING };
                if (yend > yloc + c.TEMPO_PT + c.TEMPO_PADDING) {
                    p.textAlign(p.RIGHT, p.BOTTOM);
                    tempo_loc.y = yend - c.TEMPO_PADDING;
                } else {
                    p.textAlign(p.RIGHT, p.TOP);
                    tempo_loc.y = yend + c.TEMPO_PADDING;
                };
                p.text(measure.end.toFixed(2), tempo_loc.x, tempo_loc.y);

            });

            // draw snap
            if (snapped_inst) {
                p.stroke(200, 240, 200);
                let x = snapped_inst.target * scale + start;
                p.line(x, Math.min(snapped_inst.origin, snapped_inst.inst)*c.INST_HEIGHT,
                    x, (Math.max(snapped_inst.origin, snapped_inst.inst) + 1)*c.INST_HEIGHT);
            };

        });

        // draw snaps
        p.stroke(100, 255, 100);
        Object.keys(snaps[snap_div]).forEach(key => {
            let inst = snaps[snap_div][key][0].inst;
            p.line(key*scale + start, inst * c.INST_HEIGHT, key*scale + start, (inst+1) * c.INST_HEIGHT);
        });

        // draw debug

        if (DEBUG) {
            let DEBUG_START = c.INST_HEIGHT*instruments.length;
            let lineY = (line) => c.DEBUG_TEXT*line + DEBUG_START + c.DEBUG_TEXT;

            p.stroke(primary); //200, 240, 200);
            p.textSize(c.DEBUG_TEXT);
            p.textAlign(p.LEFT, p.TOP);
            let lines = (checkSelect(selected)) ?
                [`selected: ${instruments[selected.inst].measures[selected.meas].timesig} beats - ${instruments[selected.inst].measures[selected.meas].ms.toFixed(1)} ms`] :
                [''];

            let mouse = (p.mouseX - start)/scale;
            let cursor_loc = [parseInt(Math.abs(mouse / 3600000), 10)];
            cursor_loc = cursor_loc.concat([60000, 1000].map((num) =>
                parseInt(Math.abs(mouse / num), 10).toString().padStart(2, "0")))
                .join(':');
            cursor_loc += '.' + parseInt(Math.abs(mouse % 1000), 10).toString().padStart(3, "0");
            if (mouse < 0.0)
               cursor_loc = '-' + cursor_loc;

            lines.push(`location: ${cursor_loc}`);
            lines.push(debug_message || '');
            lines.forEach((line, i) => p.text(line, c.DEBUG_TEXT, lineY(i)));

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
        p.line(p.mouseX, 0, p.mouseX, c.INST_HEIGHT*instruments.length);



        isPlaying = API.get('isPlaying');

        p.stroke(0);
        p.fill(0);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(12);
        p.text(`${isPlaying}, ${Math.round(start)}`, 0, 0);

        
        if (isPlaying) {
            debug_message = tracking_start.time;
            let time = tracking_start.time || API.exposeTracking().currentTime;
            let tracking = API.exposeTracking().locator();
            // check for final measure here;
            if (tracking > range.span[1] + 1000) {
                console.log('EXPIRED', isPlaying);
                isPlaying = false;
                API.play(isPlaying, null);
            };
            let tracking_vis = tracking*scale+start;
            p.line(tracking_vis, 0, tracking_vis, c.INST_HEIGHT*2);
        };
        document.body.style.cursor = cursor;
                
    }

    p.keyPressed = function(e) {
        if (p.keyCode === DEL
            && checkSelect(selected)
        ) {
            console.log(selected);
            API.deleteMeasure(selected);
        };

        if (p.keyCode === SPACE) {
            let location = (p.mouseX-start)/scale;
            /*tracking_start = {
                time: API.exposeTracking().currentTime*1000.0,
                location
            };
            API.play(!isPlaying, location);
            return true;
            */
            API.play(location);
        }

        // CTRL/MOD functions
        if (p.keyIsDown(MOD)) {
            if (p.keyCode === KeyC
                && checkSelect(selected)
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
        let change = 1.0-event.delta/c.SCc.ROLL_SENSITIVITY;
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

        if (Math.abs(dragged) < c.DRAG_THRESHOLD_X) {
            measure.temp_beats = [];
            measure.temp_ticks = [];
            delete measure.temp_start;
            delete measure.temp_slope;
            delete measure.temp_offset;
            return;
        };

        // CACHE THIS
        if (!('gaps' in measure))
            measure.gaps = calcGaps(instruments[selected.inst].ordered, selected.meas);

        if (drag_mode === 'measure') {
            let position = measure.offset + dragged/scale;
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
                    measure.temp_offset = crowding.start[0];
                    measure.temp_ticks = measure.ticks.slice(0);
                    measure.temp_beats = measure.beats.slice(0);
                    return;
                }
            } else {
                if (crowding.end[1] - c.SNAP_THRESHOLD < 0) {
                    measure.temp_offset = crowding.end[0] - measure.ms;
                    measure.temp_ticks = measure.ticks.slice(0);
                    measure.temp_beats = measure.beats.slice(0);
                    return;
                }
            }

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

        let perc = Math.abs(slope) < c.FLAT_THRESHOLD ?
            ((dir === 1) ? -c.FLAT_THRESHOLD : c.FLAT_THRESHOLD) :
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
        var beat_lock = (selected.meas in locked && locked[selected.meas].beats) ?
            parse_bits(locked[selected.meas].beats) : [];
        let lock = 0;
        let ms = C1 * tick_array.reduce((sum, _, i) => {
            if (beat_lock.length && (i === beat_lock[0]*CONSTANTS.PPQ_tempo))
                lock = sum*C1;
            return sum + sigma(temp_start, C1)(i);
        }, 0);
        if (Math.abs(ms - measure.ms) < c.DRAG_THRESHOLD_X) {
            measure.temp_offset = measure.offset;
            measure.temp_start = measure.start;
            slope = measure.end - measure.start;
            return;
        };


        let temp_offset = measure.offset;
        if (lock)
            temp_offset += measure.beats[beat_lock] - lock;

        let loc = ms + temp_offset;

        // check for gap
        let crowding = measure.gaps
            .filter((gap) => {
                return (temp_offset > gap[0] && loc < gap[1]);
            });
        if (!crowding.length)
            return;

        let snap_to = closest(loc, selected.inst, snap_div).target;
        debug_message = snap_to;
        let gap = loc - snap_to;
        let diff = slope;

        // LENGTH GRADIENT DESCENT

        // check what's locked to determine nudge algo
        let delta = (!(locks & (1 << 1)) && !(locks & (1 << 2))) ? 
            1.0 : 0.5;
        let diff_null = !!(locks & (1 << 2));

        var nudge = (gap, alpha, depth) => {
            if (depth > 99 || Math.abs(gap) < c.NUDGETHRESHOLD)
                return diff;

            // if END is locked
            if (diff_null) {
                measure.temp_start *= (gap > c.NUDGETHRESHOLD) ?
                    (1 + alpha) : (1 - alpha);
                diff = measure.end - measure.temp_start;
            // else change alpha multiplier based on start or slope lock
            } else
                diff *= (gap > c.NUDGETHRESHOLD) ?
                    (1 + alpha*delta) : (1 - alpha*delta);
            
            let new_C = C(diff);
            let locked = 0;
            let lock_target = beat_lock[0] * CONSTANTS.PPQ_tempo;
            let ms = new_C * tick_array.reduce((sum, _, i) => {
                if (i === lock_target)
                    locked = sum*new_C;
                return sum + sigma(measure.temp_start, new_C)(i);
            }, 0);
            if (locked)
                measure.temp_offset = measure.offset + measure.beats[beat_lock[0]] - locked;
            let new_gap = ms + (measure.temp_offset || measure.offset) - snap_to;
            alpha = monitor(gap, new_gap, alpha);
            return nudge(new_gap, alpha, depth + 1);
        };


        if (Math.abs(gap) < c.SNAP_THRESHOLD) {
            // if initial snap, update measure.temp_start 
            // for the last time and nudge.
            if (!snapped) {
                measure.temp_start = temp_start;
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

        let new_beats = [];
        let new_ticks = [];
        measure.ticks.forEach((_, i) => {
            if (!(i%CONSTANTS.PPQ))
                new_beats.push(cumulative);
            new_ticks.push(cumulative);
            if (i%PPQ_mod === 0) 
                last = K / (measure.temp_start + inc*i);
            cumulative += last;
        });
        new_beats.push(cumulative);


        measure.temp_slope = slope;
        measure.temp_offset = measure.offset;
        if (beat_lock.length === 1)
            measure.temp_offset += measure.beats[beat_lock[0]] - new_beats[beat_lock[0]];


        measure.temp_ticks = new_ticks;
        measure.temp_beats = new_beats;


    };

    p.mouseReleased = function(event) {
        if (p.mouseY < 0 || p.mouseY > p.height)
            return;
        // handle threshold
        if (Math.abs(dragged) < c.DRAG_THRESHOLD_X) {
            if (checkSelect(selected)) {
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

