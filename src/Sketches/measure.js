
var scale = 1.0;
var start = 0;
var range = [0, 100];

const DRAG_THRESHOLD_X = 10;
const INST_HEIGHT = 100;
const SCROLL_SENSITIVITY = 100.0;

const [CTRL, SHIFT, MOD, ALT] = [17, 16, 91, 18];

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

    var len = 600;
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
    //var scope = window.innerWidth;
    const ROLLOVER_TOLERANCE = 3;

    var instruments = [];
    var cursor = 'default';

    var beat_rollover = (beat, index) => {
        if (dragged)
            return false;
        if (p.mouseX > beat-ROLLOVER_TOLERANCE && p.mouseX < beat+ROLLOVER_TOLERANCE) {
            rollover = index;
            return true;
        }             
    }

    var mod_check = (keys, mods) => 
        (typeof(keys) === 'object') ?
            keys.reduce((bool, key) =>
                bool && (mods & (1 << key)) !== 0, true)
            : (mods & (1 << keys)) !== 0;

    p.setup = function () {
        p.createCanvas(len, INST_HEIGHT);
        p.background(0);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        instruments = props.instruments;
        if ('locks' in props)
            locks = props.locks.reduce((acc, lock) => (acc |= (1 << lock)), 0); 
        let all_meas = instruments.reduce((acc, inst) => {
            Object.keys(inst.measures).forEach((key) => {
                let measure = inst.measures[key];
                console.log(measure);
                measure.temp_beats = [];
                measure.temp_ticks = [];
            });
            return ({ ...acc, ...(inst.measures) });
        }, {});
        range = calcRange(all_meas);
        
        p.resizeCanvas(p.width, INST_HEIGHT*instruments.length);
        ({ API, CONSTANTS } = props);

    }

    p.draw = function () {

        // reset rollover cursor
        cursor = 'default';

        // key check
        modifiers = [CTRL, SHIFT, MOD, ALT].reduce((acc, mod, ind) =>
            p.keyIsDown(mod) ?
                acc |(1 << (ind + 1)) : acc
            , 0);

        // check if mouse within selected
        var measureBounds = (inst, measure) => {
            let position = (tick) => ((measure.offset + tick)*scale + start);
            return (p.mouseX > position(0) 
                && p.mouseX < position(measure.ms)
                && p.mouseY >= inst*INST_HEIGHT
                && p.mouseY < (inst + 1)*INST_HEIGHT 
                && true);
        };



        
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
                if (measure.temp_ticks && measure.temp_ticks.length) {
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
                p.line(position(0), yloc + scaleY(measure.start), position(measure.beats.slice(-1)[0]), yloc + scaleY(measure.end));

            })
        });

        // draw cursor
        p.stroke(240);
        p.line(p.mouseX, 0, p.mouseX, p.height);

        document.body.style.cursor = cursor;
                
    }

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
        var change = 0;
        let inst = Math.floor(p.mouseY*0.01);
        let meas = instruments[inst].measures;

        Object.keys(meas).forEach((key) => {
            let measure = meas[key];
            var left = (measure.offset + measure.beats[0])*scale + start;
            var right = (measure.offset + measure.ms)*scale + start;
            change = (p.mouseX > left && p.mouseX < right && p.mouseY > 0 && p.mouseY < p.height) ?
                key : -1;
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
        if (!locks)
            drag_mode = 'measure';
    }

    p.mouseDragged = function(event) {
        if (rollover === 0)
            return;
        if (outside_origin)
            return;
       
        /*if (p.mouseY < 0 || p.mouseY > p.height)
            return;
            */
        dragged += event.movementX;

        if (Math.abs(dragged) < DRAG_THRESHOLD_X) {
            if (selected.meas !== -1) {
                instruments[selected.inst].measures[selected.meas].temp_ticks = [];
            };
            return;
        };

        if (selected.meas === -1) 
            return;

        let measure = instruments[selected.inst].measures[selected.meas];
                
        measure.temp_ticks = [];
        measure.temp_beats = [];



        if (drag_mode === 'measure') {
            measure.ticks.forEach((tick, i) => {
                if (!(i%CONSTANTS.PPQ))
                    measure.temp_beats.push(tick + dragged/scale);
                measure.temp_ticks.push(tick + dragged/scale);
            });
            return;
        };


        let beatscale = (-dragged*scale); // /p.width
        var cumulative = 0;

        let perc = grabbed/Math.abs(measure.start-measure.end);
        amp_lock = beatscale/perc;
        let inc;

        // if START is locked
        if (locks & (1 << 1))
            inc = (measure.end-measure.start+amp_lock)/((measure.beats.length-1)*CONSTANTS.PPQ) //(measure.end*beatscale)

        // if END is locked
        else if (locks & (1 << 2))
            inc = (measure.end-(measure.start+amp_lock))/((measure.beats.length-1)*CONSTANTS.PPQ) //(measure.end*beatscale)
        // INVERT THIS DRAG AT SOME POINT?
        //inc = inc * ((dragged < 0

        // if DIRECTION is locked
        if (locks & (1 << 3)) {
            // flat measure can't change direction
            if (!dir)
                return;
            inc = (dir === 1) ?
                Math.max(inc, 0) : inc;
        };

        console.log(amp_lock);
            


        if (locks & (1 << 2)) {
            measure.temp_start = measure.start + amp_lock;
            if (locks & (1 << 3))
                measure.temp_start = (dir === 1) ?
                    Math.min(measure.temp_start, measure.end) : Math.max(measure.temp_start, measure.end)
        };

        measure.ticks.forEach((_, i) => {
            if (!(i%CONSTANTS.PPQ))
                measure.temp_beats.push(cumulative);
            measure.temp_ticks.push(cumulative);

            //if (locks & (1 << 1))
                cumulative += (60000.0/(measure.temp_start + inc*i))/CONSTANTS.PPQ; //(beatscale*grabbed)
            //else if (locks & (1 << 2))
            //    cumulative += (60000.0/(start + inc*i))/CONSTANTS.PPQ 
        });

        var beat_lock = (selected.meas in locked && locked[selected.meas].beats) ?
            parse_bits(locked[selected.meas].beats) : [];


        measure.temp_offset = measure.offset;
        if (beat_lock.length > 1)
            return
        else if (beat_lock.length === 1)
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
            API.updateMeasure(selected.inst, selected.meas, measure.start, measure.end, measure.beats.length - 1, measure.offset + dragged/scale);
            dragged = 0;
            return;
        };

        if (drag_mode === 'tick') {
            let tick = measure.temp_ticks.pop() - measure.temp_ticks.pop();
            let BPM = 60000.0/(tick * CONSTANTS.PPQ);
            measure.temp_ticks = [];
            dragged = 0;
            if (BPM < 10)
                return;
            
            // if start changes, update accordingly.
            //let start = (locks & (1 << 2)) ? measure.start + amp_lock : measure.start;
            
            API.updateMeasure(selected.inst, selected.meas, measure.temp_start, BPM, measure.beats.length - 1, measure.temp_offset);

            amp_lock = 0;
        };
    }

    p.mouseMoved = function(event) {
        API.newCursor((p.mouseX - start)/scale);
        return false;
    };
    
}

