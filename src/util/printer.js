'use strict';

const colors = require('colors/safe');

function cprint(msg, color=colors.white) {

    const time = new Date();
    const year = time.getFullYear();
    const mon = time.getMonth() + 1;
    const date_raw = time.getDate();
    const hr = time.getHours();
    const min = time.getMinutes();
    const sec = time.getSeconds();
    const month = mon < 10 ? '0' + mon : mon;
    const date = date_raw < 10 ? '0' + date_raw : date_raw;
    const hour = hr < 10 ? '0' + hr : hr;
    const minute = min < 10 ? '0' + min : min;
    const second = sec < 10 ? '0' + sec : sec;
    console.log(color(` [${year}-${month}-${date} ${hour}:${minute}:${second}]   ${msg}`));
}

module.exports = cprint;
