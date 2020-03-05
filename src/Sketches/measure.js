
var scale = 1.0;
var start = 0;
var range = [0, 100];

const DRAG_THRESHOLD_X = 10;
const INST_HEIGHT = 100;
const SCROLL_SENSITIVITY = 100.0;

var calcRange = (measures) => {
    let ranged = [];
    Object.keys(measures).forEach((key) => {
        ranged.push(measures[key].start);
        ranged.push(measures[key].end);
    });
    return [Math.min(...ranged), Math.max(...ranged)];
};

// takes mouse location and boundaries, returns boolean for if mouse is inside
/*var mouseBounding = (p, bounds) =>
    
    */


export default function measure(p) {

    var len = 600;
    var rollover;
    var dragged = 0;
    var API, CONSTANTS;
    var selected = {inst: -1};
    var scope = window.innerWidth;
    var score = [[], []];
    const ROLLOVER_TOLERANCE = 3;

    var instruments = [];
    var measures = [];
    var cursor = 'default';

    var beat_rollover = (beat, index) => {
        if (dragged)
            return false;
        if (p.mouseX > beat-ROLLOVER_TOLERANCE && p.mouseX < beat+ROLLOVER_TOLERANCE) {
            cursor = "pointer";
            rollover = index;
            return true;
        }             
    }


    p.setup = function () {
        p.createCanvas(len, INST_HEIGHT);
        p.background(0);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        instruments = props.instruments;
        //measures = props.measures;
        console.log(instruments);
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

        
        // draw selection
        if (selected.inst > -1 && selected.meas !== -1) {
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
                let position = (tick) => ((measure.offset + tick)*scale + start);

                var ticks = 'ticks';
                var beats = 'beats';

                // check for temporary display
                if (measure.temp_ticks && measure.temp_ticks.length) {
                    ticks = 'temp_ticks';
                    beats = 'temp_beats';
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

                    // try rollover
                    (beats === 'beats'
                        && p.mouseY >= yloc
                        && p.mouseY < yloc + INST_HEIGHT
                        && beat_rollover(coord, index)
                    ) ?
                        p.stroke(255, 0, 0, 100) : p.stroke(255, 0, 0);
                    p.line(coord, yloc, coord, yloc + INST_HEIGHT);
                });

                // draw tempo graph
                p.stroke(240, 200, 200);
                let scaleY = (input) => INST_HEIGHT - (input - range[0])/(range[1] - range[0])*INST_HEIGHT;
                p.line(position(0), yloc + scaleY(measure.start), position(measure.beats.slice(-1)[0]), yloc + scaleY(measure.end));

                // draw origin
                p.stroke(0, 255, 0);
                let origin = position(measure.beats[0]);
                p.line(origin, yloc, origin, yloc + INST_HEIGHT);

                // handle selection
                if (key === selected.meas) {
                    p.fill(0, 255, 0, 100);
                    p.rect(origin, yloc, measure.ms*scale, INST_HEIGHT);
                }

            })
        });

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
            || p.mouseY > p.height)
            return;

        dragged = 0;
        var change = 0;
        let inst = Math.floor(p.mouseY*0.01);
        let meas = instruments[inst].measures;
        console.log(inst);

        Object.keys(meas).forEach((key) => {
            let measure = meas[key];
            var left = (measure.offset + measure.beats[0])*scale + start;
            var right = (measure.offset + measure.ms)*scale + start;
            change = (p.mouseX > left && p.mouseX < right && p.mouseY > 0 && p.mouseY < p.height) ?
                key : -1;
        });

        selected = {inst, meas: change || -1};
        
        API.displaySelected(selected);
    }

    p.mouseDragged = function(event) {
        if (rollover === 0)
            return;
       
        if (p.mouseY < 0 || p.mouseY > p.height)
            return;
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
        let grabbed = 60000.0/(measure.ticks[(rollover * CONSTANTS.PPQ)]);
        let origin = p.mouseX - dragged;
        console.log(origin);
        let beatscale = grabbed*(dragged/p.width * -scale);
        
        measure.temp_ticks = [];
        measure.temp_beats = [];

        var cumulative = 0;
        measure.ticks.forEach((_, i) => {
            if (!(i%CONSTANTS.PPQ))
                measure.temp_beats.push(cumulative);
            measure.temp_ticks.push(cumulative);
            cumulative += (60000.0/(measure.start + (beatscale*grabbed)*i))/CONSTANTS.PPQ;
        });

    };

    p.mouseReleased = function(event) {
        if (p.mouseY < 0 || p.mouseY > p.height)
            return;
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
        let tick = measure.temp_ticks.pop() - measure.temp_ticks.pop();
        let BPM = 60000.0/(tick * CONSTANTS.PPQ);
        measure.temp_ticks = [];
        if (BPM < 10)
            return;
        
        API.updateMeasure(selected.inst, selected.meas, measure.start, BPM, measure.beats.length - 1);
        dragged = 0;
    }

    p.mouseMoved = function(event) {
        API.newCursor((p.mouseX - start)/scale);
        return false;
    };

}

