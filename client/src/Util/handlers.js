import uuidv4 from 'uuid/v4';

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

export default (schedule) => {
    // register draw loop
    schedule('draw', () => 
        Object.keys(displays).some(key => 
            displays[key]()
        )
    );

    // register event listeners
    schedule('event', () =>
        Object.keys(events).some(key =>
            (events[key]) ? events[key]() : false
        )
    );

    return ({
        register,
        unregister
    });
}

