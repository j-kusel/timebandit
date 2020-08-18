import handlers from '../handlers';
// each step should have flags set for criteria to be met.
//


var init = (p, hook) => {
    var { register, unregister } = handlers(hook);

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
            p.textSize(8);
            p.text(this.text, 2, 8); 
            p.pop();
        }
    }


    class Step {
        constructor(options) {
            this.next = null;
            this.previous = null;
            this.preparation = options.preparation || (() => null);
            this.highlight = options.highlight;
            this.coords = options.coords;
            this.criteria = options.criteria;
            this.text = options.text;
            this.reporter = options.reporter;
            this.drawID = '';
            let { x, y, x2, y2 } = Object.keys(this.coords).reduce((acc, key) =>
                ({ ...acc, [key]: typeof(this.coords[key]) === 'function' ?
                    this.coords[key] : () => this.coords[key]
                }),
            {});

            this.buttons = [
                new Button('X', {
                    x: () => x2() - 18, y: () => y() + 18,
                    width: 10, height: 10,
                }, 'exit tutorial', () => this.hide()),
                new Button('next', {
                    x: () => x2() - 18, y: () => y2() - 18,
                    width: 10, height: 10,
                }, 'next window', () => this.forward()),
                new Button('back', {
                    x: () => x() + 8, y: () => y2() - 18,
                    width: 10, height: 10,
                }, 'last window', () => this.backward())
            ];
        }

        show() {
            this.preparation();
            this.reporter(this);
            var panel = () => {
                p.push();
                p.fill("rgba(140, 114, 114, 0.44)");
                p.stroke("rgba(140, 114, 114, 0)");
                // four boxes around 
                // initialize functions if need be
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

                p.translate(x, y);
                p.fill(255);
                p.stroke(0);
                p.rect(0, 0, x2 - x, y2 - y);
                p.fill(0);
                //p.textAlign(p.TOP, p.LEFT);
                this.text.forEach((line, i) => p.text(line, 30, 60 + 12*i));
                p.pop();
                this.buttons.forEach(button => button.draw());
            }
            this.buttons.forEach(button => button.register());

            this.drawID = register('display', panel);
        }

        hide() {
            this.reporter(null);
            unregister('display', this.drawID);
            this.buttons.forEach(button => button.unregister());
            //this.eventIDs.forEach(id => unregister('event', id));
            //this.eventIDs = [];
        }

        forward() {
            this.hide();
            if (this.next)
                this.next.show();
        }

        backward() {
            this.hide();
            if (this.previous)
                this.previous.show();
        }

        append(step) {
            this.next = step;
        }

        preclude(step) {
            this.previous = step;
        }
    }
            
    class Tutorial {
        constructor() {
            this.steps = [];
            this.current = null;
        }

        add(step) {
            if (this.steps.length) {
                let next = this.steps[this.steps.length-1];
                next.append(step);
                step.preclude(next);
            }
            this.steps.push(step);
            return this;
        }

        begin() {
            this.steps[0].show();
            return this;
        }

        mouseChecker() {
            return (!this.current) ||
                (p.mouseX > this.current.highlight.x()
                && p.mouseX < this.current.highlight.x2()
                && p.mouseY > this.current.highlight.y()
                && p.mouseY < this.current.highlight.y2()) ||
                (p.mouseX > this.current.coords.x()
                && p.mouseX < this.current.coords.x2()
                && p.mouseY > this.current.coords.y()
                && p.mouseY < this.current.coords.y2())
        }



    }


    return ({
        Tutorial,
        Step
    });
};



export default init;
