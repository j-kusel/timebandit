export default function measure(p) {

    var len = 600;
    let beats = [];

    p.setup = function () {
        p.createCanvas(600, 100);
        p.background(0);
        console.log(p.width);
        console.log(p.height);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) { 
        len = props.len;
        beats = props.beats;
        
        console.log({canvasBeats: props.beats});
        p.resizeCanvas(props.len*props.scope/props.sizing, 100);
    }

    p.draw = function () {
        p.stroke(255, 0, 0);
        beats.forEach((beat) => {
            let loc = p.width/len*beat;
            p.line(loc, 0, loc, p.height);
        });
        p.noFill();
        p.stroke(0, 0, 255);
        p.strokeWeight(4);
        p.rect(0, 0, p.width-1, p.height-1);
        p.stroke(0, 255, 0);
        p.line(0, 0, 0, p.height);
    }

}

