import uuidv4 from 'uuid/v4';
// each step should have flags set for criteria to be met.
//

var init = (p, registration) => {
    var hole = (coords) => {
        p.rect(0, 0, p.width, coords.y);
        p.rect(0, coords.y, coords.x, coords.y2-coords.y);
        p.rect(coords.x2, coords.y, p.width-coords.x2, coords.y2-coords.y);
        p.rect(0, coords.y2, p.width, p.height-coords.y2)
        
        //p.rect(200, 200, 800, 600);
    }

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
    registration('draw', () =>
        Object.keys(displays).forEach(key => {
            displays[key]();
        })
        //p.rect(100, 100, 100, 100)
    );

    registration('event', () =>
        Object.keys(events).forEach(key => {
            events[key]();
        })
    );


    class Button {
        constructor(text, coords, alt, callback) {
            // coords relative to window origin
            this.coords = coords;
            this.text = text;
            this.alt = alt;
            this.callback = callback;
            register('event', () => {
                console.log(p.mouseX, this.coords.x);
                console.log(p.mouseY, this.coords.y);
                if (p.mouseX > this.coords.x &&
                    p.mouseX < this.coords.x + this.coords.width &&
                    p.mouseY > this.coords.y &&
                    p.mouseY < this.coords.y + this.coords.height
                ) {
                    this.callback();
                    return true;
                }
                return false;
            });
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
        constructor(previous, options) {
            this.next = null;
            this.previous = previous;
            this.highlight = options.highlight;
            this.coords = options.coords;
            this.criteria = options.criteria;
            
            this.drawID = '';
            this.eventIDs = [];
            this.buttons = [
                new Button('X', {
                    x: this.coords.x2 - 18, y: this.coords.y + 18,
                    width: 10, height: 10,
                }, 'exit tutorial', () => {console.log('exiting');/* close tutorial */}),
                new Button('next', {
                    x: this.coords.x2 - 18, y: this.coords.y2 - 18,
                    width: 10, height: 10,
                }, 'next window', () => this.forward()),
                new Button('back', {
                    x: this.coords.x + 8, y: this.coords.y2 - 18,
                    width: 10, height: 10,
                }, 'last window', () => this.backward())
            ]
        }

        show() {
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

            this.drawID = register('display', panel);
            //this.eventIDs = this.buttons.map(button => register('event', button.callback));
        }

        hide() {
            unregister('display', this.drawID);
            this.drawID = '';
            while (this.eventIDs.length)
                unregister('event', this.eventIDs.pop());
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
    }
            
    class Tutorial {
        constructor(steps) {
            this.steps = steps;
        }
    }

    let tut = new Tutorial([
        new Step(null, {
            highlight: { x: 200, y: 100, x2: 400, y2: 150 },
            coords: { x: 400, y: 100, x2: 600, y2: 150 },
            criteria: []
        })
    ]);
    tut.steps[0].show();

};



export default init;
