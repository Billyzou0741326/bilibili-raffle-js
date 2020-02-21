(function() {

    'use strict';

    class LLNode {

        constructor(item) {
            this._next = null;
            this._item = item;
        }

        get next() {
            return this._next;
        }

        get value() {
            return this._item;
        }

        set next(n) {
            this._next = n;
        }

        set value(v) {
            this._item = v;
        }

    }


    class Queue {

        constructor() {
            this._size = 0;
            this._rear = null;
        }

        push(item) {
            const node = new LLNode(item);
            node.next = node;
            if (this._rear !== null) {
                node.next = this._rear.next;
                this._rear.next = node;
            }
            this._rear = node;
            ++this._size;
            return this;
        }

        pop() {
            let result = null;
            if (this._rear !== null && this._rear.next !== null) {
                result = this._rear.next.value;
                if (this._rear !== this._rear.next) {
                    this._rear.next = this._rear.next.next;
                }
                else {
                    this._rear = null;
                }
                --this._size;
            }
            return result;
        }

        front() {
            let result = null;
            if (this._rear !== null && this._rear.next !== null) {
                result = this._rear.next.value;
            }
            return result;
        }

        get length() {
            return this._size;
        }
    }

    module.exports = Queue;

})();
