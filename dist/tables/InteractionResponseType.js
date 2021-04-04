"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const table = new Map();
table.set(1, 'Pong');
table.set(4, 'ChannelMessageWithSource');
table.set(5, 'DeferredChannelMessageWithSource');
const reverseTable = new Map();
for (const [key, value] of table)
    reverseTable.set(value, key);
class InteractionResponseTable {
    static to(type) {
        return reverseTable.get(type);
    }
    static from(type) {
        return table.get(type);
    }
}
exports.default = InteractionResponseTable;
