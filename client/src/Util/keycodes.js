const [SHIFT, ALT, SPACE, DEL, BACK, ESC] = [16, 18, 32, 46, 8, 27];
let mac = window.navigator.platform.indexOf('Mac') >= 0;
const CTRL = mac ? 224 : 17;
const MOD = mac ? 17 : 91;
const [KeyC, KeyI, KeyV, KeyH, KeyJ, KeyK, KeyL, KeyZ] = [67, 73, 86, 72, 74, 75, 76, 90];
//const [LEFT, UP, RIGHT, DOWN] = [37, 38, 39, 40];
const NUM = []
for (let i=48; i < 58; i++)
    NUM.push(i);

module.exports = {
    SHIFT, ALT, SPACE, DEL, BACK, ESC, CTRL, MOD,
    KeyC, KeyI, KeyV, KeyH, KeyJ, KeyK, KeyL, KeyZ,
    NUM
};
