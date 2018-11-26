export default function measure(p) {

    var len = 600;
    let beats = [];
    var rollover = -1;
    var callback;
    var init = true;
    var selected = {inst: -1, meas: -1};
    var scale = 0;
    var scope = window.innerWidth;
    var score = [[], []];
    const ROLLOVER_TOLERANCE = 3;
    var measures = [];
    var cursor = 'default';

    var beat_rollover = (beat, index) => {
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
        selected = props.selected;
        scale = scope / props.sizing;
        //p.resizeCanvas(props.len*props.scope/props.sizing, 100);
    }

    p.draw = function () {
        p.stroke(255, 0, 0);
        p.fill(255, 255, 255, selected ? 100 : 0);
        p.rect(0, 0, p.width-1, p.height-1);
        rollover = -1;
        cursor = 'default';
      
        measures.forEach((measure) => {
            p.stroke(255, 0, 0);
            var coord;
            measure.beats.forEach((beat) => {
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

    /*p.mousePressed = function() {
        callback({x: p.mouseX, y: p.mouseY});
    }
    */

}

