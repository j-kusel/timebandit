
var scale = 1.0;
var start = 500.0;
var range = [0, 100];

const DRAG_THRESHOLD_X = 10;

var calcRange = (measures) => {
    let ranged = [];
    Object.keys(measures).forEach((key) => {
        ranged.push(measures[key].start);
        ranged.push(measures[key].end);
    });
    return [Math.min(...ranged), Math.max(...ranged)];
};


export default function measure(p) {

    var len = 600;
    var rollover;
    var dragged = 0;
    var API, CONSTANTS;
    var selected = {inst: -1};
    var scope = window.innerWidth;
    var score = [[], []];
    const ROLLOVER_TOLERANCE = 3;
    var measures = [];
    var cursor = 'default';

    var beat_rollover = (beat, index) => {
        if (dragged)
            return
        if (p.mouseX > beat-ROLLOVER_TOLERANCE && p.mouseX < beat+ROLLOVER_TOLERANCE) {
            cursor = "pointer";
            rollover = index;
        }             
        //p.line(beat, 0, beat, p.height);
    }


    p.setup = function () {
        p.createCanvas(len, 100);
        p.background(0);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        measures = props.measures;
        Object.keys(measures).forEach((key) => {
            let measure = measures[key];
            measure.temp_beats = [];
            measure.temp_ticks = [];
        });

        range = calcRange(measures);
        
        //p.resizeCanvas(props.len*props.scope/props.sizing, 100);
        ({ API, CONSTANTS } = props);

    }

    p.draw = function () {

        // reset rollover cursor
        cursor = 'default';

        p.stroke(255, 0, 0);
        p.fill(255, 255, 255);
        p.rect(0, 0, p.width-1, p.height-1);

        // draw selection
        if (selected.inst > -1 && selected.meas !== -1) {
            console.log(selected.inst);
            p.stroke(240, 255, 240);
            p.fill(240, 255, 240); 
            p.rect(measures[selected.meas].offset * scale + start, selected.inst*100, measures[selected.meas].ms * scale, 100);
        };


        Object.keys(measures).forEach(key => {

            let measure = measures[key];
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
                p.line(loc, 0, loc, p.height);
            });

            // draw beats
            p.stroke(255, 0, 0);
            measure[beats].forEach((beat, index) => {
                let coord = position(beat);
                p.line(coord, 0, coord, p.height);

                // handle rollover
                if (beats === 'beats')
                    beat_rollover(position(beat), index);
            });

            // draw tempo graph
            p.stroke(240, 200, 200);
            let scaleY = (input) => p.height - (input - range[0])/(range[1] - range[0])*p.height;
            p.line(position(0), scaleY(measure.start), position(measure.beats.slice(-1)[0]), scaleY(measure.end));

            // draw origin
            p.stroke(0, 255, 0);
            let origin = position(measure.beats[0]);
            p.line(origin, 0, origin, p.height);

            // handle selection
            if (measure.id === selected) {
                p.fill(255, 255, 255, 100);
                p.rect(0, 0, measure.ms, p.height-1);
            }

        });

        document.body.style.cursor = cursor;
                
    }

    p.mouseWheel = function(event) {
        let change = 1.0-event.delta/100.0;
        scale = scale*change;
        start = p.mouseX - change*(p.mouseX - start);
        API.newScaling(scale);
    };

    p.mousePressed = function(e) {
        if (p.mouseX === Infinity 
            || p.mouseY === Infinity 
            || p.mouseY < 0
            || p.mouseY > p.height)
            return;

        dragged = 0;
        var change = 0;
        Object.keys(measures).forEach((key) => {
            let measure = measures[key];
            var left = (measure.offset + measure.beats[0])*scale + start;
            var right = (measure.offset + measure.ms)*scale + start;
            change = (p.mouseX > left && p.mouseX < right && p.mouseY > 0 && p.mouseY < p.height) ?
                key : -1;
        });
        
        selected = {inst: Math.floor(p.mouseY*0.01), meas: change};
        console.log(selected);
        API.displaySelected(selected);
    }

    p.mouseDragged = function(event) {
        if (rollover === 0)
            return;
       
        if (p.mouseY < 0 || p.mouseY > p.height)
            return;
        dragged += event.movementX;

        /*if (Math.abs(dragged) < DRAG_THRESHOLD_X) {
            if (selected.meas !== -1) {
                measures[selected.meas].temp_ticks = [];
            };
            return;
        };
        */

        if (selected.meas === -1) 
            return;

        let measure = measures[selected.meas];
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
                measures[selected.meas].temp_ticks = [];
            };
            dragged = 0;
            return;
        };

        if (selected.meas === -1)
            return

        console.log(selected.meas);
        let measure = measures[selected.meas];
        let tick = measure.temp_ticks.pop() - measure.temp_ticks.pop();
        let BPM = 60000.0/(tick * CONSTANTS.PPQ);
        measure.temp_ticks = [];
        if (BPM < 10)
            return;
        
        API.updateMeasure(selected.meas, measure.start, BPM, measure.beats.length - 1);
        dragged = 0;
    }

}

