/**
 * Module for gathering tutorials in /src/Util/tutorials/tuts folder
 * @module tutorials
 */
import quickstart from './tuts/quickstart';

export default (p, registration, API, Window) => {
    let blocker = false;
    /**
     * Checks an internal blocking variable for a boolean value or mouse coordinate object
     * @returns {Boolean}
     * @public
     */
    var mouseBlocker = () => {
        if (typeof(blocker) === 'boolean')
            return blocker;
        if (blocker &&
            p.mouseX > blocker.x() && p.mouseX < blocker.x2() &&
            p.mouseY > blocker.y() && p.mouseY < blocker.y2())
            return false;
        return true;
    };

    var blockerSet = (_blocker) => {
        blocker = _blocker;
    }

    return ({ 
        quickstart: quickstart(p, registration, API, Window, blockerSet),
        mouseBlocker
    });
}
