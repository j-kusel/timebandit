export default function measure(p) {

    var len = 600;
    let beats = [];
    var rollover = -1;
    var init = true;
    const ROLLOVER_TOLERANCE = 3;


    p.setup = function () {
        p.createCanvas(600, 100);
        console.log(p.width);
        console.log(p.height);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        len = props.len;
        p.resizeCanvas(props.len*props.scope/props.sizing, 100);
        beats = props.beats.map(beat => p.width/len*beat);
        p.background(0);
    }

    p.draw = function () {

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
    }

}

