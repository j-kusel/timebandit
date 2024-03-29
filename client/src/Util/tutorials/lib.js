import handlers from '../handlers';
import { colors } from 'bandit-lib';
// each step should have flags set for criteria to be met.
//


// in the process of revising this to use HTML windows instead.
var init = (p, hook) => {
    var { register, unregister } = handlers(hook);

    class Button {
        constructor(text, coords, alt, callback, parent) {
            // coords relative to window origin
            this._coords = Object.keys(coords).reduce((acc, key) =>
                ({ ...acc, [key]: typeof(coords[key]) === 'function' ?
                    coords[key] : () => coords[key]
                }),
            {});

            this._html = p.createButton(text);
            this._html.parent(parent);
            this._html.position(this._coords.x(), this._coords.y());
            this._html.style(`
                background-color: ${colors.secondary};
                color: ${colors.primary};
                border: 1px solid ${colors.primary};
                width: ${this._coords.width()};
                height: ${this._coords.height()};
                font-size: 12;
            `);
            this._html.mouseOver(() =>
                this._html.style(`
                    background-color: ${colors.secondary};
                    color: ${colors.primary};
                `));
            /*this._html.mouseOut(
                this._html.style(`
                    background-color: ${colors.primary};
                    color: ${colors.secondary};
                `));
                */
            this._html.mousePressed(callback);

            this._text = text;
            this._alt = alt;
            this._callback = callback;

            this._eventID = '';
        }

        destroy() {
            this._html.remove();
        }
    }


    /*
    class Button {
        constructor(text, coords, alt, callback) {
            // coords relative to window origin
            this.coords = Object.keys(coords).reduce((acc, key) =>
                ({ ...acc, [key]: typeof(coords[key]) === 'function' ?
                    coords[key] : () => coords[key]
                }),
            {});
            this.text = text;
            this.alt = alt;
            this.callback = callback;

            this.eventID = '';
        }

        register() {
            this.eventID = register('event', () => {
                if (p.mouseX > this.coords.x() &&
                    p.mouseX < this.coords.x() + this.coords.width() &&
                    p.mouseY > this.coords.y() &&
                    p.mouseY < this.coords.y() + this.coords.height()
                ) {
                    this.callback();
                    return true;
                }
                return false;
            });
        }

        unregister() {
            unregister('event', this.eventID);
        }
            
        draw() {
            p.push();
            p.translate(this.coords.x(), this.coords.y());
            p.stroke(0);
            p.fill(255);
            p.rect(0, 0, this.coords.width(), this.coords.height());
            p.fill(0);
            p.textSize(12);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(this.text, this.coords.width()/2, this.coords.height()/2); 
            p.pop();
        }
    }*/


    class Step {
        constructor(options) {
            this.next = null;
            this.previous = null;
            this.html = null;
            this.preparation = options.preparation || (() => null);
            this.highlight = options.highlight;
            this.coords = options.coords;
            this.criteria = options.criteria;
            this.text = options.text;
            this.reporter = options.reporter;
            this.parent = null;
            this.drawID = '';

            this.buttons = [];
        }

        _add_panel() {
            this.html = p.createDiv();

            let { x, y, x2, y2 } = Object.keys(this.coords).reduce((acc, key) =>
                    ({ ...acc, [key]: typeof(this.coords[key]) === 'function' ?
                        this.coords[key]() : this.coords[key]
                    }),
                {});

            this.html.position(x, y);
            this.html.style(`
                width: ${x2 - x}px;
                height: ${y2 - y}px;
                color: ${colors.primary};
                background-color: ${colors.secondary};
                border: 1px solid ${colors.primary};
                padding: 40px;
                font-size: 12pt;
                line-height: 14pt;
                font-family: 'Work Sans', sans-serif;
                z-index: 100;
            `);
            this.html.html(`<p>${this.text.join(' ')}</p>`);
        }

        _add_buttons() {
            let { x, y, x2, y2 } = Object.keys(this.coords).reduce((acc, key) =>
                ({ ...acc, [key]: typeof(this.coords[key]) === 'function' ?
                    this.coords[key] : () => this.coords[key]
                }),
            {});

            this.buttons = [
                new Button('X', {
                    x: () => (x2()-x()) - 42, y: () => 8,
                    width: 20, height: 20,
                }, 'exit tutorial', () => this.parent.end(), this.html),
                new Button('next', {
                    x: () => x2()-x() - 72, y: () => y2()-y() - 44,
                    width: 40, height: 20,
                }, 'next window', () => this.forward(), this.html),
                new Button('back', {
                    x: () => 8, y: () => (y2() - y()) - 44,
                    width: 40, height: 20,
                }, 'last window', () => this.backward(), this.html)
            ];
        }

        show() {
            this.preparation();
            this.reporter(this);
            this.parent.blockerSet(this.coords);
            var panel = () => {

                p.push();
                p.fill("rgba(140, 114, 114, 0.44)");
                p.stroke("rgba(140, 114, 114, 0)");
                // four boxes around 
                // initialize functions if need be
                if (!this.highlight)
                    p.rect(0, 0, p.width, p.height)
                else {
                    let { x, y, x2, y2 } = Object.keys(this.highlight).reduce((acc, key) =>
                        ({ ...acc, [key]: typeof(this.highlight[key]) === 'function' ?
                            this.highlight[key]() : this.highlight[key]
                        }),
                    {});
                    p.rect(0, 0, p.width, y);
                    p.rect(0, y, x, y2-y);
                    p.rect(x2, y, p.width-x2, y2-y);
                    p.rect(0, y2, p.width, p.height-y2);

                    ({ x, y, x2, y2 } = Object.keys(this.coords).reduce((acc, key) =>
                        ({ ...acc, [key]: typeof(this.coords[key]) === 'function' ?
                            this.coords[key]() : this.coords[key]
                        }),
                    {}));
                }
                p.pop();

                /*
                p.translate(x, y);
                p.fill(255);
                p.stroke(colors.primary);
                p.rect(0, 0, x2 - x, y2 - y);
                p.fill(colors.primary);

                p.textSize(18);
                //p.textAlign(p.TOP, p.LEFT);
                this.text.forEach((line, i) => p.text(line, 30, 60 + 18*i));
                p.pop();
                */
                //this.buttons.forEach(button => button.draw());
            }
            //this.buttons.forEach(button => button.register());

            this._add_panel();
            this._add_buttons();

            this.drawID = register('display', panel);
        }

        hide() {
            this.reporter(null);
            unregister('display', this.drawID);
            this.buttons.forEach(button => button.destroy());
            this.html.remove();
            //this.eventIDs.forEach(id => unregister('event', id));
            //this.eventIDs = [];
        }

        forward() {
            this.hide();
            if (this.next) {
                this.parent._current = this.next;
                this.next.show();
            } else
                this.parent.end();
        }

        backward() {
            if (this.previous) {
                this.hide();
                this.parent._current = this.previous;
                this.previous.show();
            }
        }

        append(step) {
            this.next = step;
        }

        preclude(step) {
            this.previous = step;
        }
    }
            
    class Tutorial {
        constructor(blockerSet) {
            this.steps = [];
            this._current = null;
            this.blockerSet = blockerSet;
            this.description = '';
        }

        add(step) {
            step.parent = this;
            if (this.steps.length) {
                let next = this.steps[this.steps.length-1];
                next.append(step);
                step.preclude(next);
            } else
                this._current = step;
            this.steps.push(step);
            return this;
        }

        begin() {
            this.steps[0].show();
            return this;
        }

        end() {
            this.blockerSet(false);
            this.steps = [];
            this._current.hide();
            this._current = null;
        }

        describe(desc) {
            this.description = desc;
            return this;
        }

    }


    return ({
        Tutorial,
        Step
    });
};



export default init;
