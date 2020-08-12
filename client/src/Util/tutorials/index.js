import quickstart from './tuts/quickstart';

export default (p, registration) => {
    console.log(typeof(registration));
    return ({
    quickstart: () => quickstart(p, registration),
})};
