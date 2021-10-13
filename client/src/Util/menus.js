import { colors } from 'bandit-lib';

var p;
var API;
const MENU_TEXT = 10;
const ITEM_HEIGHT = 12;

let B = 4;
let BUFFER_HEIGHT = ITEM_HEIGHT+2*B;

class Item {
    constructor(options) {
        /* options.name
         * options.func
         * options.argv
         */
        this.name = options;
        this.func = () => options.func(options.argv);
        this.width = 0;
        Object.assign(this, options);
    }

    calc() {
        p.push();
        p.textSize(MENU_TEXT);
        this.width = p.textWidth(this.name);
        p.pop();
    }

    prep_argv(argv) {
        this.func = () => this.func(argv);
    }
}

class _Menu {
    constructor() {
        this.API = API;
        this.items = {};
        this.itemsById = [];
        this.width = 0;
        this.height = 0;
    }

    calc_all() {
        this.itemsById.forEach(id => {
            this.items[id].calc();
            this.width = Math.max(this.width, this.items[id].width);
        });
    }

    add_item(name, func, argv) {
        let item = new Item({ name, func, argv });
        this.items[name] = item;
        this.itemsById.push(name);
        this.height += BUFFER_HEIGHT;
    }

    change_item(name, argv) {
        this.items[name].prep_argv(argv);
    }

    clear() {
        this.items = [];
        this.height = 0;
    }

    draw(origin, drag) {
        p.push();
        p.textSize(MENU_TEXT);
        p.textAlign(p.LEFT, p.CENTER);
        p.stroke(colors.primary);
        p.fill(colors.primary);
        p.translate(...origin);
        p.rect(0, 0, this.width+2*B, this.height);
        p.stroke(colors.secondary);
        p.fill(colors.secondary);

        let hover = (drag.x > 0 && drag.x < this.width
            && drag.y > 0 && drag.y < this.height) ?
                Math.floor(drag.y/BUFFER_HEIGHT) : -1;
        this.itemsById.forEach((name, i) => {
            p.push();
            // invert on hover
            if (i === hover) {
                p.rect(0, i*BUFFER_HEIGHT, this.width+2*B, BUFFER_HEIGHT);
                p.stroke(colors.primary);
                p.fill(colors.primary);
            }
            p.text(name, B, BUFFER_HEIGHT * (i+0.5));
            p.pop();
        });


        p.pop();
    }

    press(drag) {
        let hover = (drag.x > 0 && drag.x < this.width
            && drag.y > 0 && drag.y < this.height) ?
                Math.floor(drag.y/BUFFER_HEIGHT) : -1;
        if (hover < 0 || hover >= this.itemsById.length)
            return;
        let id = this.itemsById[hover];
        let item = this.items[id];
        item.func(item.argv);
    }

}

var MenuComposer = (p5js, api) => {
    [p, API] = [p5js, api];

    return (stack) => {
        let Menu = new _Menu();
        stack.forEach(item =>
            Menu.add_item(item.name, item.func, item.argv)
        );
        return Menu;
    }
}


export {
    MenuComposer
}

