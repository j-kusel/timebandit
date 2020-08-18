import lib from '../lib';
import c from '../../../config/CONFIG.json';

let mac = window.navigator.platform.indexOf('Mac') >= 0;

export default (p, registration, API, Window) => {
    const { Tutorial, Step } = lib(p, registration);
    let tut = new Tutorial();

    let intro = new Step({
        reporter: (id) => {
            console.log(id);
            tut.current = id;
        },
        highlight: { x: () => p.width/3.0, y: () => p.height/3.0, x2: () => p.width*2.0/3.0, y2: () => p.height*2.0/3.0 },
        coords: { x: () => p.width/3, y: () => p.height/3, x2: () => p.width*2/3, y2: () => p.height*2/3 },
        preparation: () => {
            API.newFile();
            API.newInstrument('default');
        },
        criteria: [],
        text: [
            "Here's a brief tutorial to walk you through some basic functions."
        ]
    });

    let selectInst = new Step({
        reporter: (id) => tut.current = id,
        highlight: {
            x: () => c.PANES_WIDTH,
            x2: () => p.width,
            y: () => c.PLAYBACK_HEIGHT,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT
        },
        coords: {
            x: () => p.width/3,
            y: () => p.height/3,
            x2: () => p.width*2/3,
            y2: () => p.height*2/3
        },
        preparation: () => {
            Window.focus({ viewport: 180, scale: 0.2 });
        },
        criteria: [],
        text: [
            `To enter a new measure, first select the target instrument`,
            `by clicking in the instrument row.`
        ]
    });


    let cMdimsX = 350;
    let cMdimsY = 200;
    let createMeasure = new Step({
        reporter: (id) => tut.current = id,
        highlight: {
            x: () => (p.width - c.TOOLBAR_WIDTH) / 3.0,
            y: () => p.height - c.TRACKING_HEIGHT,
            x2: () => (p.width - c.TOOLBAR_WIDTH) / 3.0 + c.INSERT_WIDTH,
            y2: () => p.height
        },
        coords: {
            x: () => (p.width - c.TOOLBAR_WIDTH) / 3.0 + c.INSERT_WIDTH*0.5,
            y: () => p.height - c.TRACKING_HEIGHT - cMdimsY - c.INSERT_HEIGHT,
            x2: () => (p.width - c.TOOLBAR_WIDTH) / 3.0 + c.INSERT_WIDTH*0.5 + cMdimsX,
            y2: () => p.height - c.TRACKING_HEIGHT - c.INSERT_HEIGHT
        },
        preparation: () => {
            API.updateMode(0);
            Window.select({ inst: 0, meas: undefined });
            API.displaySelected({ inst: 0, meas: undefined });
        },
        criteria: [
            /*() => ((p.mouseDown 
                && p.mouseDown.x > (p.width - c.TOOLBAR_WIDTH) / 3.0
                && p.mouseDown.x < (p.width - c.TOOLBAR_WIDTH) / 3.0 + c.INSERT_WIDTH
                && p.mouseDown.y > p.height - c.TRACKING_HEIGHT - cMdimsY
                && p.mouseDown.y < p.height - c.TRACKING_HEIGHT
            ))*/ 
        ],
        text: [
            "To add a measure,",
            "first enter INSERT mode by clicking the bar or",
            "pressing the 'i' key",
        ]
    });

    let newMeas = new Step({
        reporter: (id) => tut.current = id,
        highlight: { 
            x: () => (p.width - c.TOOLBAR_WIDTH) / 3.0,
            y: () => p.height - c.TRACKING_HEIGHT - c.INSERT_HEIGHT,
            x2: () => (p.width - c.TOOLBAR_WIDTH) / 3.0 + c.INSERT_WIDTH*2,
            y2: () => p.height - c.TRACKING_HEIGHT
        },
        coords: {
            x: () => (p.width - c.TOOLBAR_WIDTH) / 3.0 + c.INSERT_WIDTH*0.5,
            y: () => p.height - c.TRACKING_HEIGHT - c.INSERT_HEIGHT - cMdimsY,
            x2: () => (p.width - c.TOOLBAR_WIDTH) / 3.0 + c.INSERT_WIDTH*0.5 + cMdimsX,
            y2: () => p.height - c.TRACKING_HEIGHT - c.INSERT_HEIGHT
        },

        preparation: () => {
            Window.select('clear');
            API.newFile();
            API.newInstrument('default2');
            API.displaySelected({ inst: 0, meas: undefined });
            API.updateMode(1);
        },
        criteria: [],
        text: [
            "Here you can enter the details for your measure.",
            "This includes starting tempo, ending tempo if there",
            "is a change, time signature, and 'offset' (absolute",
            "location in milliseconds). Then click the button to submit."
        ]
    });

    let offset = 500;
    let fMdimX = 400;
    let fMdimY = 150;
    let finishedMeas = new Step({
        reporter: (id) => tut.current = id,
        highlight: {
            x: () => Window.scaleX(offset) + c.PANES_WIDTH,
            x2: () => Window.scaleX(offset + 3529.02) + c.PANES_WIDTH,
            y: () => c.PLAYBACK_HEIGHT,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT,
        },
        coords: {
            x: () => Window.scaleX(offset + 2000),
            x2: () => Window.scaleX(offset + 2000) + fMdimX,
            y: () => c.TRACKING_HEIGHT + c.INST_HEIGHT,
            y2: () => c.TRACKING_HEIGHT + c.INST_HEIGHT + fMdimY,
        },
        preparation: () => {
            Window.select('clear');
            API.newFile();
            API.newInstrument('default2');
            API.displaySelected({ inst: 0, meas: undefined });
            Window.focus({ viewport: 180, scale: 0.2 });
            API.newMeasure(0, 60, 120, 5, offset);
            API.updateMode(0);
        },
        criteria: [],
        text: [
            "We've created a 5/4 measure that ramps from 60 - 120BPM.",
            "Measures are displayed on an adaptive grid, showing",
            "downbeats, divisions (or individual midi ticks when",
            "zoomed in), and a tempo curve."
        ]
            
    });

    let zoom = new Step({
        reporter: (id) => tut.current = id,
        highlight: {
            x: () => c.PANES_WIDTH,
            x2: () => p.width,
            y: () => c.PLAYBACK_HEIGHT,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT
        },
        coords: {
            x: () => p.width/3,
            y: () => p.height/3,
            x2: () => p.width*2/3,
            y2: () => p.height*2/3
        },
        preparation: () => {
            Window.select('clear');
            API.newFile();
            API.newInstrument('default2');
            API.displaySelected({ inst: 0, meas: undefined });
            Window.focus({ viewport: 180, scale: 0.2 });
            API.newMeasure(0, 60, 120, 5, offset);
            API.updateMode(0);
        },
        criteria: [],
        text: [
            `To zoom, hold ${mac ? 'CMD' : 'CTRL'} and scroll up or down.`,
            `Zooming will center at your cursor location.`
        ]
    });

    let createInst = new Step({
        reporter: (id) => tut.current = id,
        highlight: {
            x: () => c.PANES_WIDTH,
            x2: () => c.PANES_WIDTH + 100,
            y: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT + 30
        },
        coords: {
            x: () => c.PANES_WIDTH + 100,
            x2: () => c.PANES_WIDTH + 450,
            y: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT + 220
        },
        preparation: () => {},
        criteria: [],
        text: [
            `Instruments can be added by clicking the plus sign,`,
            `entering a name for reference, and clicking the arrow.`
        ]
    });

    let moveMeasure = new Step({
        reporter: (id) => tut.current = id,
        highlight: {
            x: () => c.PANES_WIDTH,
            x2: () => p.width,
            y: () => c.PLAYBACK_HEIGHT,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT*2
        },
        coords: {
            x: () => p.width/3,
            y: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT*2,
            x2: () => p.width*2/3,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT*2 + 200,
        },
        preparation: () => {
            Window.select('clear');
            API.newFile();
            API.newInstrument('default');
            API.newInstrument('default2');
            API.newMeasure(0, 60, 120, 5, offset-100);
            API.newMeasure(1, 60, 120, 5, offset+100);
            Window.focus({ viewport: 180, scale: 0.2 });
        },
        criteria: [],
        text: [
            `We've made some measures to move around. Click a measure`,
            `to select it, then hold SHIFT and drag left and right.`,
            '',
            `Measure beats will snap to adjacent measures in other instruments.`
        ]
    });

    let editMeasure = new Step({
        reporter: (id) => tut.current = id,
        highlight: {
            x: () => Window.scaleX(offset+100) + c.PANES_WIDTH,
            x2: () => Window.scaleX(offset + 3629.02) + c.PANES_WIDTH,
            y: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT*2,
        },
        coords: {
            x: () => Window.scaleX(offset + 2000),
            x2: () => Window.scaleX(offset + 2000) + fMdimX,
            y: () => c.TRACKING_HEIGHT + c.INST_HEIGHT*2 + 28,
            y2: () => c.TRACKING_HEIGHT + c.INST_HEIGHT*2 + 28 + fMdimY,
        },
        preparation: () => {
            Window.select('clear');
            API.newFile();
            API.newInstrument('default');
            API.newInstrument('default2');
            API.newMeasure(0, 60, 120, 5, offset-100);
            API.newMeasure(1, 60, 120, 5, offset+100);
            Window.focus({ viewport: 180, scale: 0.2 });
        },
        criteria: [],
        text: [
            `Let's edit a measure by selecting it and pressing the 'v' key.`
        ],
    });

    let tweakTempo = new Step({
        reporter: (id) => tut.current = id,
        highlight: {
            x: () => Window.scaleX(offset+100) + c.PANES_WIDTH,
            x2: () => Window.scaleX(offset + 3629.02) + c.PANES_WIDTH,
            y: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT,
            y2: () => c.PLAYBACK_HEIGHT + c.INST_HEIGHT*2,
        },
        coords: {
            x: () => Window.scaleX(offset + 2000),
            x2: () => Window.scaleX(offset + 2000) + fMdimX,
            y: () => c.TRACKING_HEIGHT + c.INST_HEIGHT*2 + 28,
            y2: () => c.TRACKING_HEIGHT + c.INST_HEIGHT*2 + 28 + fMdimY,
        },
        preparation: () => {
            Window.select('clear');
            API.newFile();
            API.newInstrument('default');
            API.newInstrument('default2');
            API.newMeasure(0, 60, 120, 5, offset-100);
            let selected = {
                inst: 1,
                meas: API.newMeasure(1, 60, 120, 5, offset+100)
            };
            Window.select(selected);
            API.displaySelected(selected);
            API.updateMode(2);
            Window.focus({ viewport: 180, scale: 0.2 });
        },
        criteria: [],
        text: [
            `Hover over a beat at the tempo graph line and drag to`,
            `adjust tempo while preserving slope. Hold ${mac ? 'CMD' : 'CTRL'} and click`,
            `a beat to lock it, then drag the tempo graph line to`,
            `make adjustments to slope.`
        ],
    });



    tut
        .add(intro)
        .add(selectInst)
        .add(createMeasure)
        .add(newMeas)
        .add(finishedMeas)
        .add(zoom)
        .add(createInst)
        .add(moveMeasure)
        .add(editMeasure)
        .add(tweakTempo);



        /*.add(new Step({
            highlight: { x: 400, y: 200, x2: 800, y2: 350 },
            coords: { x: 800, y: 200, x2: 1000, y2: 300 },
            criteria: [],
            text: ['window number 2']
        }));
        */
    return tut;
};

