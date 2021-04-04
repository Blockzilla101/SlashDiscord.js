import { Client, Guild, GuildMember, MessageEmbed, TextChannel } from "discord.js";
import { SlashCommandHandler, SlashCommand } from ".";
import { InteractionMessage } from "./InteractionMessage";
export declare type InteractionFunction = (interaction: Interaction) => any | Promise<any>;
export declare class Interaction implements IInteraction {
    id: string;
    type: InteractionType;
    data: InteractionData;
    guild: Guild;
    channel: TextChannel;
    member: GuildMember;
    client: Client;
    handler: SlashCommandHandler;
    token: string;
    reply_send: boolean;
    deferred_reply: boolean;
    constructor(client: Client, handler: SlashCommandHandler, channel: TextChannel, d: any);
    option<T = any>(option: string | string[]): T | undefined | null;
    getOption<T = any>(option: string): InteractionOption<T> | undefined;
    parseOptions(command: SlashCommand): Promise<void>;
    private _parseOptions;
    pong(): Promise<void>;
    send(msg: InteractionMessageType): Promise<InteractionMessage>;
    reply(msg: InteractionMessageType, options?: {
        deferred: boolean;
        ephemeral: boolean;
    }): Promise<InteractionMessage>;
    followUp(content: WebhookMessageType): Promise<void>;
    static parseMessages(msg: InteractionMessageType): InteractionCallbackData;
}
export interface IInteraction {
    id: string;
    type: InteractionType;
    data: InteractionData;
    guild: Guild;
    channel: TextChannel;
    member: GuildMember;
}
export declare type InteractionType = 'Ping' | 'ApplicationCommand';
export interface InteractionData {
    id: string;
    name: string;
    options?: InteractionOption[];
}
export interface InteractionOption<T = any> {
    name: string;
    value?: T;
    options?: InteractionOption[];
}
export declare type InteractionMessageType = MessageEmbed | string | MessageEmbed[];
export declare type WebhookMessageType = string | MessageEmbed | {
    content?: string;
    embeds?: MessageEmbed[];
    file?: any;
};
export interface InteractionResponse {
    type: InteractionResponseType;
    data?: InteractionCallbackData;
}
export declare type InteractionResponseType = 'Pong' | 'ChannelMessageWithSource' | 'DeferredChannelMessageWithSource';
export interface InteractionCallbackData {
    tts?: boolean;
    content?: string;
    embeds?: object[];
    flags?: number;
}
