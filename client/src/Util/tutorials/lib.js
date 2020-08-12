import uuidv4 from 'uuid/v4';
// each step should have flags set for criteria to be met.
//

var init = (p, sub, unsub) => {
    var hole = (coords) => {
        p.rect(0, 0, p.width, coords.y);
        p.rect(0, coords.y, coords.x, coords.y2-coords.y);
        p.rect(coords.x2, coords.y, p.width-coords.x2, coords.y2-coords.y);
        p.rect(0, coords.y2, p.width, p.height-coords.y2)
    }

    var displays = {};
    var events = {};
    var register = (type, callback) => {
        let id = uuidv4();
        if (type === 'display') {
            console.log('registering display');
            displays[id] = callback;
        }
        else if (type === 'event') {
            console.log('registering event');
            events[id] = callback;
        }
        return id;
    }
    var unregister = (type, ID) => {
        if (type === 'display') {
            console.log('unregistering display ', ID);
            delete displays[ID];
        } else if (type === 'event') {
            console.log('unregistering event ', ID);
            delete events[ID];
        }
    }

    // register draw loop
    sub('draw', () => 
        Object.keys(displays).some(key => 
            displays[key]()
        )
    );

    // register event listeners
    sub('event', () => {
        console.log(Object.keys(events).join(' | '));
        return Object.keys(events).some(key => {
            if (events[key])
                return events[key]()
            else
                return false;
        });
    });

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
                console.log('doin the callback!');
                if (p.mouseX > this.coords.x &&
                    p.mouseX < this.coords.x + this.coords.width &&
                    p.mouseY > this.coords.y &&
                    p.mouseY < this.coords.y + this.coords.height
                ) {
                    console.log('clicked: ', this.text);
                    if (!events[this.eventID]) {
                        console.log('wrong window!');
                        return false;
                    };
                    this.callback();
                    return true;
                }
                console.log('missed');
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
            var self = this;


            
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
            console.log('showing');
            var panel = () => {
                p.push();
                p.fill("rgba(140, 114, 114, 0.44)");
                p.stroke("rgba(140, 114, 114, 0)");
                // four boxes around 
                hole(this.highlight);
                p.translate(this.coords.x, this.coords.y);
                p.fill(255);
                p.stroke(0);
                p.rect(0, 0, this.coords.x2 - this.coords.x, this.coords.y2 - this.coords.y);
                p.pop();
                this.buttons.forEach(button => button.draw());
            }
            this.buttons.forEach(button => button.register());

            this.drawID = register('display', panel);
            /*this.eventIDs = this.buttons.map(button => {
                console.log('registering ', button.text, ' for ' + this.text);
                button.eventID = register('event', button.callback);
                return button.eventID;
            });
            */
            //console.log(this.eventIDs.join(' | '));
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
            console.log('going backward');
            console.log(this.previous);
            console.log(this.text);
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
            console.log('creating tutorial');
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
