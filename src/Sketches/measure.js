export default function measure(p) {

    var len = 600;
    let beats = [];
    var rollover = -1;
    var callback;
    var init = true;
    var selected = false;
    const ROLLOVER_TOLERANCE = 3;


    p.setup = function () {
        p.createCanvas(600, 100);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        len = props.len;
        callback = props.callback;
        selected = props.selected;
        p.resizeCanvas(props.len*props.scope/props.sizing, 100);
        beats = props.beats.map(beat => p.width/len*beat);
        p.background(0);
    }

    p.draw = function () {

        p.background(0);
        p.background(0);
        p.stroke(255, 0, 0);
        let cursor = 'default';
        rollover = -1;
        beats.forEach((beat, index) => { 
            if (p.mouseX > beat-ROLLOVER_TOLERANCE && p.mouseX < beat+ROLLOVER_TOLERANCE) {
                cursor = "pointer";
                rollover = index;
            }             
            p.line(beat, 0, beat, p.height);
        });
        document.body.style.cursor = cursor;

        p.noFill();
        p.stroke(0, 0, 255);
        p.strokeWeight(4);
        p.rect(0, 0, p.width-1, p.height-1);
        p.stroke(0, 255, 0);
        p.line(0, 0, 0, p.height);

        selected ? p.tint(255, 100) : p.tint(255, 0);
        p.fill(255, 255, 255, selected ? 100 : 0);
        p.rect(0, 0, p.width-1, p.height-1);
    }

    /*p.mousePressed = function() {
        callback({x: p.mouseX, y: p.mouseY});
    }
    */

}

