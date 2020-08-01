import { SHIFT, ALT, SPACE, DEL, BACK, ESC, CTRL, MOD } from './keycodes.js';
import { KeyC, KeyI, KeyV, KeyH, KeyJ, KeyK, KeyL, KeyZ } from './keycodes.js';
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
                console.log(this.held_nums, this.num_counter);
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

        checkDirection() {
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
    }
    return new _Keyboard();
}

