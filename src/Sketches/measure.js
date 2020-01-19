export default function measure(p) {

    var len = 600;
    var rollover = -1;
    var clicked = 0;
    var dragged = 0;
    var callback, wheelCallback;
    var init = true;
    var selected = {inst: -1, meas: -1};
    var scale = 1.0;
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
        measures.forEach((measure) => {
            measure.temp_beats = [];
            measure.temp_ticks = [];
        });
        selected = props.selected;
        console.log('props');
        //p.resizeCanvas(props.len*props.scope/props.sizing, 100);
        wheelCallback = props.wheelCallback;
        callback = props.callback;
    }

    p.draw = function () {
        // draw grid
        p.stroke(240);
        measures.forEach(measure => {
            var which = '';
            if (measure.temp_ticks.length)
                which = 'temp_';

            measure[which + 'ticks'].forEach((tick) => {
                let loc = tick*scale;
                if (loc > p.width)
                    return
                p.line(loc, 0, loc, p.height);
            });
        });

        p.stroke(255, 0, 0);
        p.fill(255, 255, 255, selected ? 100 : 0);
        p.rect(0, 0, p.width-1, p.height-1);
        cursor = 'default';
      
        measures.forEach((measure) => {
            p.stroke(255, 0, 0);
            var coord;
            var which = '';
            if (measure.temp_ticks.length)
                which = 'temp_';

            measure[which + 'beats'].forEach((beat) => {
                coord = beat*scale;
                p.line(coord, 0, coord, p.height);
            });
            measure.beats.forEach(beat_rollover);
            coord = measure.beats[0]*scale;
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
        scale = scale*(1.0-event.delta/200.0);
        wheelCallback(scale);
    }

    p.mousePressed = function(e) {
        if (p.mouseX === Infinity || p.mouseY === Infinity)
            return
        clicked = p.mouseX;
        dragged = 0;
        console.log(`clicked: x = ${p.mouseX} y = ${p.mouseY}`);
        var change = 0;
        measures.forEach((measure) => {
            var left = measure.beats[0]*scale;
            var right = measure.ms*scale;
            if (p.mouseX > left && p.mouseX < right && p.mouseY > 0 && p.mouseY < p.height) {
                change = measure.id;
            };
            console.log(rollover);

        });
        selected = {inst: -1, meas: change || -1};
    }

    p.mouseDragged = function(event) {
        dragged += event.movementX;
        measures.forEach((measure) => {
            if (measure.id === selected.meas) {
                let beatscale = (dragged)/(measure.beats[rollover]*scale);
                measure.temp_ticks = measure.ticks.map((tick) => tick * (1.0 + beatscale));
                measure.temp_beats = measure.beats.map((beat) => beat * (1.0 + beatscale));
            }
        });
    };

    p.mouseReleased = function(event) {
        var refresh = false;
        measures.forEach((measure, index) => {
            if (measure.id === selected.meas) {
                measure.ticks = measure.temp_ticks;
                measure.beats = measure.temp_beats;
                let change = rollover;
                callback(index, measure, change);
            };
            measure.temp_ticks = [];
            measure.temp_beats = [];
        });
        dragged = 0;
    }

}

