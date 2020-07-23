const [SHIFT, ALT, SPACE, DEL, BACK, ESC] = [16, 18, 32, 46, 8, 27];
let mac = window.navigator.platform.indexOf('Mac') >= 0;
const CTRL = mac ? 224 : 17;
const MOD = mac ? 17 : 91;
const [KeyC, KeyI, KeyV, KeyH, KeyJ, KeyK, KeyL] = [67, 73, 86, 72, 74, 75, 76];
//const [KeyZ] = [90];
//const [LEFT, UP, RIGHT, DOWN] = [37, 38, 39, 40];
const NUM = []
for (let i=48; i < 58; i++)
    NUM.push(i);


export default class _Keyboard {
    constructor() {
        this.held_nums = [];
        this.num_counter = 0;
    }

    checkNumPress(p) {
        let numpress = NUM.indexOf(p.keyCode);
        if (numpress >= 0) {
            this.held_nums.push(numpress);
            this.num_counter++;
            console.log(this.held_nums, this.num_counter);
            return true;
        }
        return false;
    }

    checkNumRelease(p) {
        let numpress = NUM.indexOf(p.keyCode);
        if (numpress >= 0 &&
            this.held_nums.indexOf(numpress) >= 0
        ) {
            this.num_counter--;
            if (!this.num_counter)
                this.held_nums = [];
            console.log(this.held_nums, this.num_counter);
            return true;
        }
        return false;
    }

    checkDirection(p) {
        if (p.keyCode === KeyJ)
            return 'DOWN';
        if (p.keyCode === KeyK)
            return 'UP';
        if (p.keyCode === KeyH)
            return 'LEFT';
        if (p.keyCode === KeyL)
            return 'RIGHT';
        return false;
    }

};

