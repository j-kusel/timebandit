import lib from '../lib';


export default (p, registration) => {
    const { Tutorial, Step } = lib(p, registration);
    //return new Tutorial()
    let tut = new Tutorial();
    tut
        .add(new Step({
            highlight: { x: 200, y: 100, x2: 400, y2: 150 },
            coords: { x: 400, y: 100, x2: 600, y2: 150 },
            criteria: [],
            text: 'window number 1'
        }));
    tut
        .add(new Step({
            highlight: { x: 400, y: 200, x2: 800, y2: 350 },
            coords: { x: 800, y: 200, x2: 1000, y2: 300 },
            criteria: [],
            text: 'window number 2'
        }));
    console.log(tut.steps);
    return tut
        .begin();
};

