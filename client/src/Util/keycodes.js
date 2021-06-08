const [SHIFT, ALT, SPACE, DEL, BACK, ESC] = [16, 18, 32, 46, 8, 27];
let mac = window.navigator.platform.indexOf('Mac') >= 0;
let chrome = window.navigator.userAgent.indexOf('Chrome') >= 0;
let firefox = window.navigator.userAgent.indexOf('Firefox') >= 0;


const CTRL = mac ? 17 : 224;
const MOD = firefox ?
    (mac ? 224 : 17) : 91;
const [KeyC, KeyI, KeyV, KeyH, KeyJ, KeyK, KeyL, KeyZ] = [67, 73, 86, 72, 74, 75, 76, 90];
const [LEFT, UP, RIGHT, DOWN] = [37, 38, 39, 40];
const NUM = []
for (let i=48; i < 58; i++)
    NUM.push(i);

module.exports = {
    LEFT, UP, RIGHT, DOWN,
    SHIFT, ALT, SPACE, DEL, BACK, ESC, CTRL, MOD,
    KeyC, KeyI, KeyV, KeyH, KeyJ, KeyK, KeyL, KeyZ,
    NUM
};
