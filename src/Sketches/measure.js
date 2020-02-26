
var scale = 1.0;
var offset = 0.0;
var range = [0, 100];
var scaleY = () => 50.0;


const DRAG_THRESHOLD_X = 10;

export default function measure(p) {

    var len = 600;
    var rollover;
    var clicked = 0;
    var dragged = 0;
    var API, CONSTANTS;
    var init = true;
    var selected = {inst: -1};
    var scope = window.innerWidth;
    var score = [[], []];
    const ROLLOVER_TOLERANCE = 3;
    var measures = [];
    var cursor = 'default';

    var beat_rollover = (beat, index) => {
        if (dragged)
            return
        if (p.mouseX > beat*scale-ROLLOVER_TOLERANCE && p.mouseX < beat*scale+ROLLOVER_TOLERANCE) {
            cursor = "pointer";
            rollover = index;
        }             
        p.line(beat, 0, beat, p.height);
    }


    p.setup = function () {
        p.createCanvas(600, 100);
        p.background(0);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        measures = props.measures;
        console.log(measures);
        Object.keys(measures).forEach((key) => {
            let measure = measures[key];
            measure.temp_beats = [];
            measure.temp_ticks = [];
        });

        let ranged = [];
        Object.keys(measures).forEach((key) => {
            ranged.push(measures[key].start);
            ranged.push(measures[key].end);
        });
        range = [Math.min(...ranged), Math.max(...ranged)];
        console.log(ranged);

        //selected = props.selected;
        console.log('props');
        //p.resizeCanvas(props.len*props.scope/props.sizing, 100);
        API = props.API;
        CONSTANTS = props.CONSTANTS;

    }

    p.draw = function () {
        // draw grid, tempo
        Object.keys(measures).forEach(key => {
            p.stroke(240);
            var which = '';
            let measure = measures[key];
            if (measure.temp_ticks && measure.temp_ticks.length)
                which = 'temp_';

            measure[which + 'ticks'].forEach((tick) => {
                let loc = (measure.offset + tick + offset)*scale;
                if (loc > p.width)
                    return
                p.line(loc, 0, loc, p.height);
            });


            p.stroke(240, 200, 200);
            let scaleY = (input) => p.height - (input - range[0])/(range[1] - range[0])*p.height;

            p.line((measure.offset + offset)*scale, scaleY(measure.start), (measure.offset + measure.beats.slice(-1)[0] + offset)*scale, scaleY(measure.end));
        });




        p.stroke(255, 0, 0);
        p.fill(255, 255, 255, selected ? 100 : 0);
        p.rect(0, 0, p.width-1, p.height-1);
        cursor = 'default';
      
        Object.keys(measures).forEach(key => {
            let measure = measures[key];
            p.stroke(255, 0, 0);
            var coord;
            var which = '';
            if (measure.temp_ticks && measure.temp_ticks.length)
                which = 'temp_';

            measure[which + 'beats'].forEach((beat) => {
                coord = (measure.offset + beat)*scale;
                p.line(coord, 0, coord, p.height);
            });
            measure.beats.forEach((beat, index) => beat_rollover(beat+measure.offset, index));
            coord = (measure.offset + measure.beats[0])*scale;
            p.stroke(0, 255, 0);
            p.line(coord, 0, coord, p.height);

            if (measure.id === selected) {
                p.fill(255, 255, 255, 100);
                p.rect(0, 0, measure.ms, p.height-1);
            }
        });
        document.body.style.cursor = cursor;
        // don't forget the end!

                

        /*p.noFill();
        p.stroke(0, 0, 255);
        p.strokeWeight(4);
        p.rect(0, 0, p.width-1, p.height-1);
        p.stroke(0, 255, 0);
        p.line(0, 0, 0, p.height);
        */

    }

    p.mouseWheel = function(event) {
        let change = 1.0-event.delta/200.0;
        scale = scale*change;
        // ??????????????????????????????????
        offset = (p.mouseX - offset)*change;
        API.newScaling(scale);
    }

    p.mousePressed = function(e) {
        if (p.mouseX === Infinity || p.mouseY === Infinity)
            return;
        if (p.mouseY < 0 || p.mouseY > p.height)
            return;

        clicked = p.mouseX;
        dragged = 0;
        console.log(`clicked: x = ${p.mouseX} y = ${p.mouseY}`);
        var change = 0;
        Object.keys(measures).forEach((key) => {
            let measure = measures[key];
            var left = (measure.offset + measure.beats[0])*scale;
            var right = (measure.offset + measure.ms)*scale;
            if (p.mouseX > left && p.mouseX < right && p.mouseY > 0 && p.mouseY < p.height) {
                change = key;
            };
        });
        
        selected = change ?
            ({inst: -1, meas: change}) :
            ({inst: -1 });
        console.log(selected);
    }

    p.mouseDragged = function(event) {
        if (p.mouseY < 0 || p.mouseY > p.height)
            return;
        dragged += event.movementX;
        if (Math.abs(dragged) < DRAG_THRESHOLD_X) {
            console.log('NOT DRAGGED');
            if (selected.meas !== -1) {
                measures[selected.meas].temp_ticks = [];
            };
            return;
        };

        if (!selected.meas)
            return
        let measure = measures[selected.meas];
        let grabbed = 60000.0/(measure.ticks[(rollover * CONSTANTS.PPQ)]);
        let beatscale = grabbed*(dragged/p.width*-0.01);
        var beats = [];
        var ticks = [];
        var cumulative = 0;
        for (var i=0; i<measure.ticks.length; i++) {
            let elapsed = (60000.0/(measure.start + (beatscale*grabbed)*i))/CONSTANTS.PPQ;
            if (!(i%CONSTANTS.PPQ)) {
                beats.push(cumulative);
            };
            ticks.push(cumulative);
            cumulative += elapsed;
        }

        measure.temp_ticks = ticks;
        measure.temp_beats = beats;
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
        var refresh = false;

        if (!selected.meas)
            return
        let measure = measures[selected.meas];
        let tick = measure.temp_ticks.pop() - measure.temp_ticks.pop();
        console.log(tick);
        let BPM = 60000.0/(tick * CONSTANTS.PPQ);
        console.log(BPM);
        API.updateMeasure(selected.meas, measure.start, BPM, measure.beats.length - 1);

        dragged = 0;
    }

}

