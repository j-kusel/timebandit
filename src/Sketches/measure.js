export default function measure(p) {

    let start = 0;
    let end = 0;
    let timesig = 0;
    let PPQ = 24;
    let ms = 600;
    let beats = [];

    p.setup = function () {
        p.createCanvas(600, 100);
        p.background(0);
        console.log(p.width);
        console.log(p.height);
    };

    p.myCustomRedrawAccordingToNewPropsHandler = function (props) {
        start = props.start;
        end = props.end;
        timesig = props.beats;
        PPQ = props.PPQ;

        
        let ticks = props.PPQ * props.beats;
        let cumulative = 0.0;
        let inc = (props.end-props.start)/ticks;
        for (var i=0; i<ticks; i++) {
            let elapsed = (60000.0/(props.start + inc*i))/props.PPQ;
            if (!(i%props.PPQ)) beats.push(cumulative);
            cumulative += elapsed;
        }
        ms = cumulative;
        console.log({
            canvasSize: ms*props.scope/props.sizing,
            beats: beats
        });

        p.resizeCanvas(ms*props.scope/props.sizing, 100);

    }

    p.draw = function () {
        p.stroke(255, 0, 0);
        beats.forEach((beat) => {
            let loc = p.width/ms*beat;
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

