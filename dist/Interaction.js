"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Interaction = void 0;
const chalk_1 = __importDefault(require("chalk"));
const discord_js_1 = require("discord.js");
const InteractionMessage_1 = require("./InteractionMessage");
const SlashCommandHandler_1 = require("./SlashCommandHandler");
const node_fetch_1 = __importDefault(require("node-fetch"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
class Interaction {
    constructor(client, handler, channel, d) {
        this.reply_send = false;
        this.deferred_reply = false;
        this.id = d.id;
        this.type = d.type;
        this.data = d.data;
        this.guild = channel.guild;
        this.channel = channel;
        this.member = new discord_js_1.GuildMember(client, d.member, this.guild);
        this.client = client;
        this.handler = handler;
        this.token = d.token;
    }
    option(option) {
        const optionSplitted = typeof option === 'string'
            ? option.split(' ')
            : option;
        let options = this.data.options;
        while (options != undefined) {
            const option = options.find(o => o.name.toLowerCase() === optionSplitted[0].toLowerCase());
            if (!option)
                return null;
            if (optionSplitted.length <= 1) {
                return option.value;
            }
            optionSplitted.shift();
            options = option.options;
        }
    }
    getOption(option) {
        console.log(chalk_1.default.yellow('SlashDiscord.js ') + chalk_1.default.red('DeprecationWarning: Interaction.getOption(option) is deprecated, please use Interaction.option(option)'));
        const optionSplitted = option.split(' ');
        let options = this.data.options;
        while (options != undefined) {
            const option = options.find(o => o.name === optionSplitted[0]);
            if (!option)
                return undefined;
            if (optionSplitted.length <= 1)
                return option;
            optionSplitted.shift();
            options = option.options;
        }
    }
    async parseOptions(command) {
        const cmdOptions = command.options;
        const options = this.data.options;
        if (!cmdOptions)
            return;
        if (!options)
            return;
        await this._parseOptions(options, cmdOptions);
    }
    async _parseOptions(options, commandOptions) {
        for (const option of options) {
            const cmdOption = commandOptions.find(o => o.name === option.name);
            if (!cmdOption)
                continue;
            switch (cmdOption.type) {
                case 'CHANNEL':
                    option.value = this.client.channels.cache.get(option.value)
                        || await this.client.channels.fetch(option.value);
                    break;
                case 'ROLE':
                    option.value = this.guild.roles.cache.get(option.value)
                        || await this.guild.roles.fetch(option.value);
                    break;
                case 'USER':
                    option.value = this.client.users.cache.get(option.value)
                        || await this.client.users.fetch(option.value);
                    break;
            }
            if (option.options && cmdOption.options)
                await this._parseOptions(option.options, cmdOption.options);
        }
    }
    async pong() {
        if (this.reply_send)
            throw new Error('Can only execute the callback once.');
        this.reply_send = true;
        await this.handler.respond(this.id, this.token, {
            type: 'Pong'
        });
    }
    async send(msg) {
        const data = await node_fetch_1.default(SlashCommandHandler_1.apiURL + `/webhooks/${this.handler.clientID}/${this.token}`, {
            method: 'POST',
            headers: Object.assign(Object.assign({}, this.handler.headers), { 'Content-Type': 'application/json' }),
            body: JSON.stringify(Interaction.parseMessages(msg))
        }).then(r => r.json());
        return new InteractionMessage_1.InteractionMessage(this, data.id);
    }
    async reply(msg, options = { deferred: false, ephemeral: false }) {
        if (this.reply_send)
            return await this.send(msg);
        this.reply_send = true;
        this.deferred_reply = options.deferred;
        await this.handler.respond(this.id, this.token, {
            type: options.deferred ? 'DeferredChannelMessageWithSource' : 'ChannelMessageWithSource',
            data: Object.assign(Interaction.parseMessages(msg), (options.ephemeral ? { flags: 64 } : {}))
        });
        return new InteractionMessage_1.InteractionMessage(this);
    }
    async followUp(content) {
        var _a, _b;
        if (typeof content === 'string')
            content = { content: content };
        if (content instanceof discord_js_1.MessageEmbed)
            content = { embeds: [content] };
        if (content.file) {
            let form = new form_data_1.default();
            form.append('file', fs_1.default.createReadStream(content.file));
            if (content.embeds || content.content)
                form.append('payload_json', JSON.stringify({ embeds: (_a = content.embeds) !== null && _a !== void 0 ? _a : [], content: (_b = content.content) !== null && _b !== void 0 ? _b : null }));
            await node_fetch_1.default(SlashCommandHandler_1.apiURL + `/webhooks/${this.handler.clientID}/${this.token}/messages/@original`, {
                method: 'PATCH',
                headers: this.handler.headers,
                body: form
            });
        }
        else {
            await node_fetch_1.default(SlashCommandHandler_1.apiURL + `/webhooks/${this.handler.clientID}/${this.token}/messages/@original`, {
                method: 'PATCH',
                headers: Object.assign(Object.assign({}, this.handler.headers), { 'Content-Type': 'application/json' }),
                body: JSON.stringify(content)
            });
        }
    }
    static parseMessages(msg) {
        if (typeof msg === 'string')
            return { content: msg, embeds: [] };
        if (msg instanceof discord_js_1.MessageEmbed)
            return { embeds: [msg] };
        return { embeds: msg };
    }
}
exports.Interaction = Interaction;
