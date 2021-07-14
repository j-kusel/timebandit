//import { SHIFT, ALT, SPACE, DEL, BACK, ESC, CTRL, MOD } from './keycodes.js';
import { KeyH, KeyJ, KeyK, KeyL, LEFT, RIGHT, UP, DOWN } from './keycodes.js';
//import { KeyC, KeyI, KeyV, KeyZ } from './keycodes.js';
import { NUM } from './keycodes.js';

export default (p) => {
    class _Keyboard {
        constructor() {
            this.held_nums = [];
            this.num_counter = 0;
        }

        checkNumPress() {
            let numpress = NUM.indexOf(p.keyCode);
            if (numpress >= 0) {
                this.held_nums.push(numpress);
                this.num_counter++;
                return true;
            }
            return false;
        }

        checkNumRelease() {
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

        checkDirection(type) {
            if (type === 'arrows') {
                if (p.keyCode === LEFT)
                    return 'LEFT';
                if (p.keyCode === RIGHT)
                    return 'RIGHT';
            } else {
                if (p.keyCode === KeyJ || p.keyCode === DOWN)
                    return 'DOWN';
                if (p.keyCode === KeyK || p.keyCode === UP)
                    return 'UP';
                if (p.keyCode === KeyH || p.keyCode === LEFT)
                    return 'LEFT';
                if (p.keyCode === KeyL || p.keyCode === RIGHT)
                    return 'RIGHT';
            }
            return false;
        }
    }
    return new _Keyboard();
}

