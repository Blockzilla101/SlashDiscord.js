import chalk from "chalk";
import { Client, Guild, GuildMember, MessageEmbed, TextChannel } from "discord.js";
import { SlashCommandHandler, SlashCommand } from ".";
import { InteractionMessage } from "./InteractionMessage";
import { ApplicationCommandOption } from "./SlashCommand";
import { apiURL } from "./SlashCommandHandler";
import fetch from 'node-fetch';
import FormData from "form-data";
import fs from "fs";

export type InteractionFunction = (interaction: Interaction) => any | Promise<any>;

export class Interaction implements IInteraction {

	/**
	 * ID of this interaction
	 */
	id: string;
	/**
	 * The type of interaction.
	 */
	type: InteractionType;
	/**
	 * The data used by this interaction.
	 */
	data: InteractionData;
	/**
	 * The guild this command has been executed in.
	 */
	guild: Guild;
	/**
	 * The channel this command has been executed in.
	 */
	channel: TextChannel;
	/**
	 * The member that executed this command.
	 */
	member: GuildMember;
	/**
	 * The client this interaction uses.
	 */
	client: Client;
	/**
	 * The command handler this interaction uses.
	 */
	handler: SlashCommandHandler;

	/**
	 * The webhook token for this interaction
	 */
	token: string

	/**
	 * Used to check if a reply has already been send.
	 * There can only be a maximum of 1 reply each interaction.
	 */
	reply_send: boolean = false;
	deferred_reply: boolean = false;


	constructor(client: Client, handler: SlashCommandHandler, channel: TextChannel, d: any) {
		this.id = d.id;
		this.type = d.type;
		this.data = d.data;

		this.guild = channel.guild;
		this.channel = channel;
		this.member = new GuildMember(client, d.member, this.guild);

		this.client = client;
		this.handler = handler;

		this.token = d.token;
	}


	/**
	 *
	 * @param option the desired option.
	 * @returns {T | undefined | null}
	 * 	Returns the type when found and the value is set.
	 * 	Returns undefined when the type is found but the value not set.
	 * 	Returns null when the type is not found.
	 */
	option<T = any>(option: string | string[]): T | undefined | null {
		const optionSplitted = typeof option === 'string'
			? option.split(' ')
			: option;

		let options = this.data.options;
		while(options != undefined) {
			const option = options.find(o=>o.name.toLowerCase() === optionSplitted[0].toLowerCase());

			if(!option)
				return null;

			if(optionSplitted.length <= 1) {
				return option.value;

			}

			optionSplitted.shift();
			options = option.options;
		}
	}


	/**
	 * @deprecated
	 * Get a selected option.
	 * @param option the option, example: 'moderation mute user'
	 */
	getOption<T = any>(option: string): InteractionOption<T> | undefined {
		console.log(chalk.yellow('SlashDiscord.js ') + chalk.red('DeprecationWarning: Interaction.getOption(option) is deprecated, please use Interaction.option(option)'));
		const optionSplitted = option.split(' ');

		let options = this.data.options;
		while(options != undefined) {
			const option = options.find(o=>o.name === optionSplitted[0]);

			if(!option)
				return undefined;
			if(optionSplitted.length <= 1)
				return option;

			optionSplitted.shift();
			options = option.options;
		}
	}


	/**
	 * Parse the options.
	 * @param command command this interaction uses.
	 */
	async parseOptions(command: SlashCommand) {
		const cmdOptions = command.options;
		const options = this.data.options;

		if(!cmdOptions) return;
		if(!options) return;

		await this._parseOptions(options, cmdOptions)
	}


	private async _parseOptions(options: InteractionOption[], commandOptions: ApplicationCommandOption[]) {

		for(const option of options) {
			const cmdOption = commandOptions.find(o=>o.name === option.name)
			if(!cmdOption) continue;

			// Parsing options

			switch(cmdOption.type) {
				case 'CHANNEL':
					option.value = this.client.channels.cache.get(option.value)
						||	await this.client.channels.fetch(option.value)
					break;
				case 'ROLE':
					option.value = this.guild.roles.cache.get(option.value)
						||	await this.guild.roles.fetch(option.value)
					break;
				case 'USER':
					option.value = this.client.users.cache.get(option.value)
						||	await this.client.users.fetch(option.value)
					break;
			}

			//	Parsing embedded options

			if(option.options && cmdOption.options) await this._parseOptions(option.options, cmdOption.options);
		}

	}

	/**
	 * Close the interaction callback.
	 */
	async pong() {
		if(this.reply_send) throw new Error('Can only execute the callback once.');
		this.reply_send = true
		await this.handler.respond(this.id, this.token, {
			type: 'Pong'
		});
	}


	/**
	 * Send a message back to the user, this is excluding source.
	 * @param msg the message to send
	 */
	async send(msg: InteractionMessageType) {
		const data = await fetch(apiURL + `/webhooks/${this.handler.clientID}/${this.token}`, {
			method: 'POST',
			headers: { ...this.handler.headers, 'Content-Type': 'application/json'},
			body: JSON.stringify(Interaction.parseMessages(msg))
		}).then(r=>r.json());
		return new InteractionMessage(this, data.id);
	}

	/**
	 * Reply to a interaction, this is including source.
	 * @param msg the message to send
	 * @param {{ deferred: boolean } &| { ephemeral: boolean }} options the message to send
	 */
	async reply(msg: InteractionMessageType, options = { deferred: false, ephemeral: false }) {
		if (this.reply_send) return await this.send(msg)
		this.reply_send = true
		this.deferred_reply = options.deferred

		await this.handler.respond(this.id, this.token, {
			type: options.deferred ? 'DeferredChannelMessageWithSource' : 'ChannelMessageWithSource',
			data: Object.assign(Interaction.parseMessages(msg), ( options.ephemeral ? { flags: 64 } : { } ))
		});
		return new InteractionMessage(this);
	}

	/**
	 * Follow up message to the deferred reply
	 * @param {WebhookMessageType} content
	 */
	async followUp(content: WebhookMessageType) {
		if (typeof content === 'string') content = { content: content }
		if (content instanceof MessageEmbed) content = { embeds: [content] }
		if (content.file) {
			let form = new FormData()
			form.append('file', fs.createReadStream(content.file))
			if (content.embeds || content.content) form.append('payload_json', JSON.stringify({ embeds: content.embeds ?? [], content: content.content ?? null }))
			await fetch(apiURL + `/webhooks/${this.handler.clientID}/${this.token}/messages/@original`, {
				method: 'PATCH',
				headers: this.handler.headers,
				body: form
			})
		} else {
			await fetch(apiURL + `/webhooks/${this.handler.clientID}/${this.token}/messages/@original`, {
				method: 'PATCH',
				headers: { ...this.handler.headers, 'Content-Type': 'application/json'},
				body: JSON.stringify(content)
			})
		}
	}

	/**
	 * Parse the message to a InteractionCallbackData object
	 */
	static parseMessages(msg: InteractionMessageType): InteractionCallbackData {
		if (typeof msg === 'string') return { content: msg, embeds: [] }
		if (msg instanceof MessageEmbed) return { embeds: [msg] }
		return { embeds: msg }
	}
}


export interface IInteraction {
	/**
	 * ID of this interaction.
	 */
	id: string
	/**
	 * The type of interaction.
	 */
	type: InteractionType
	/**
	 * The data used by this interaction.
	 */
	data: InteractionData
	/**
	 * The guild this command has been executed in.
	 */
	guild: Guild
	/**
	 * The channel this command has been executed in.
	 */
	channel: TextChannel
	/**
	 * The command handler this interaction uses.
	 */
	member: GuildMember
}


export type InteractionType = 'Ping' | 'ApplicationCommand'

export interface InteractionData {
	/**
	 * ID of the ApplicationCommand of this interaction.
	 */
	id: string
	/**
	 * Name of the ApplicationCommand of this interaction.
	 */
	name: string
	/**
	 * The options of this interaction.
	 */
	options?: InteractionOption[]
}

export interface InteractionOption<T = any> {
	/**
	 * The name of this option.
	 */
	name: string
	/**
	 * The value of this option.
	 */
	value?: T
	/**
	 * The child options of this option.
	 */
	options?: InteractionOption[]
}

export type InteractionMessageType = MessageEmbed | string | MessageEmbed[];
export type WebhookMessageType = string | MessageEmbed | {
	content?: string,
	embeds?: MessageEmbed[],
	file?: any
};


//
//	Interaction Response
//


export interface InteractionResponse {
	type: InteractionResponseType,
	data?: InteractionCallbackData
}


export type InteractionResponseType =
	'Pong' |
	'ChannelMessageWithSource' |
	'DeferredChannelMessageWithSource'
;


export interface InteractionCallbackData {
	tts?: boolean
	content?: string
	embeds?: object[],
	flags?: number
}