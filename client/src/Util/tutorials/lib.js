import uuidv4 from 'uuid/v4';
// each step should have flags set for criteria to be met.
//

var init = (p, sub, unsub) => {
    var displays = {};
    var events = {};
    var register = (type, callback) => {
        let id = uuidv4();
        if (type === 'display')
            displays[id] = callback
        else if (type === 'event')
            events[id] = callback;
        return id;
    }

    var unregister = (type, ID) => {
        if (type === 'display')
            delete displays[ID]
        else if (type === 'event') 
            delete events[ID];
    }

    // register draw loop
    sub('draw', () => 
        Object.keys(displays).some(key => 
            displays[key]()
        )
    );

    // register event listeners
    sub('event', () =>
        Object.keys(events).some(key =>
            (events[key]) ? events[key]() : false
        )
    );

    class Button {
        constructor(text, coords, alt, callback) {
            // coords relative to window origin
            this.coords = coords;
            this.text = text;
            this.alt = alt;
            this.callback = callback;

            this.eventID = '';
        }

        register() {
            this.eventID = register('event', () => {
                if (p.mouseX > this.coords.x &&
                    p.mouseX < this.coords.x + this.coords.width &&
                    p.mouseY > this.coords.y &&
                    p.mouseY < this.coords.y + this.coords.height &&
                    events[this.eventID]
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
            p.translate(this.coords.x, this.coords.y);
            p.stroke(0);
            p.fill(255);
            p.rect(0, 0, this.coords.width, this.coords.height);
            p.fill(0);
            p.textSize(8);
            p.text(this.text, 2, 2); 
            p.pop();
        }
    }


    class Step {
        constructor(options) {
            this.next = null;
            this.previous = null;
            this.highlight = options.highlight;
            this.coords = options.coords;
            this.criteria = options.criteria;
            this.text = options.text;
            this.drawID = '';

            this.buttons = [
                new Button('X', {
                    x: this.coords.x2 - 18, y: this.coords.y + 18,
                    width: 10, height: 10,
                }, 'exit tutorial', () => this.hide()),
                new Button('next', {
                    x: this.coords.x2 - 18, y: this.coords.y2 - 18,
                    width: 10, height: 10,
                }, 'next window', () => this.forward()),
                new Button('back', {
                    x: this.coords.x + 8, y: this.coords.y2 - 18,
                    width: 10, height: 10,
                }, 'last window', () => this.backward())
            ];
        }

        show() {
            var panel = () => {
                p.push();
                p.fill("rgba(140, 114, 114, 0.44)");
                p.stroke("rgba(140, 114, 114, 0)");
                // four boxes around 
                let { x, y, x2, y2 } = this.highlight;
                p.rect(0, 0, p.width, y);
                p.rect(0, y, x, y2-y);
                p.rect(x2, y, p.width-x2, y2-y);
                p.rect(0, y2, p.width, p.height-y2)

                p.translate(this.coords.x, this.coords.y);
                p.fill(255);
                p.stroke(0);
                p.rect(0, 0, this.coords.x2 - this.coords.x, this.coords.y2 - this.coords.y);
                p.pop();
                this.buttons.forEach(button => button.draw());
            }
            this.buttons.forEach(button => button.register());

            this.drawID = register('display', panel);
        }

        hide() {
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
        constructor(steps) {
            this.steps = [];
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
        }
    }


    return ({
        Tutorial,
        Step
    });
};



export default init;
