(function() {

    'use strict';

    const { sleep } = require('../util/utils.js');

    class VirtualQueue {

        constructor(count=100, unit=1000) {
            this.MAX = count;
            this.slots = 0;

            this.running = true;
            this.slotWaiter = Promise.resolve();
            this.resetWaiter = () => {};
            this.slotWaiter = new Promise(resolve => {
                this.resetWaiter = resolve;
            });

            (async () => {
                while (this.running) {
                    await sleep(unit);
                    this.resetWaiter();
                    this.slotWaiter = new Promise(resolve => {
                        this.resetWaiter = resolve;
                    });
                    this.slots = 0;
                }
            })();
        }

        add() {
            return (async () => {
                while (this.slots >= this.MAX) {
                    await this.slotWaiter;
                }
                ++this.slots;
            })();
        }

    }

    module.exports = VirtualQueue;

})();
