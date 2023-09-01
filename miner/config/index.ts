import { config as dotenv_config } from "dotenv";
import { isValidPath } from "../isValidPath";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { Address, AddressStr, PaymentCredentials, PrivateKey } from "@harmoniclabs/plu-ts";

// export const KUPO_URL = process.env.KUPO_URL ?? "";
// export const OGMIOS_URL = process.env.OGMIOS_URL ?? "";
// export const CHANGE_ADDRESS = process.env.CHANGE_ADDRESS ?? "";

export type MinerConfig = {
    readonly network: "preview" | "mainnet",
    readonly blockfrost_api_key: string,
    readonly kupo_url: string,
    readonly ogmios_url: string,
    readonly path_to_miner_private_key: string,
    readonly change_address?: string | null
}

export type ValidatedMinerConfig = {
    readonly network: "preview" | "mainnet",
    readonly blockfrost_api_key: string,
    readonly kupo_url: string,
    readonly ogmios_url: string,
    readonly path_to_miner_private_key: string,
    readonly change_address: AddressStr,
    // only to keep track of the validation in the type
    // (`MinerConfig` not assignable to `ValidatedMinerConfig`)
    readonly __validated__: never
}

export function tryGetMinerNetworkFromEnv(): "preview" | "mainnet"
{
    let net: string | undefined = process.argv[2];
    if( typeof net !== "string" )
    {
        net = process.env.TEMPURA_MINER_NETWORK ?? "preview"
    }

    if(!(
        net === "preview" ||
        net === "mainnet"
    ))
    throw new Error("cant use \"" + net + "\" as miner network");

    return net;
}

export async function parseMinerConfig( path?: string ): Promise<MinerConfig>
{
    if(
        typeof path !== "string" || 
        !isValidPath( path )
    )
    {
        if( existsSync("./miner.config.local.json") )
            path = "./miner.config.local.json";
        else if( existsSync("./miner.local.config.json") )
            path = "./miner.local.config.json";
        else if( existsSync("./miner.config.json") )
            path = "./miner.config.json";
        else path = undefined
    }

    const config: MinerConfig =
        typeof path === "string" ?
        JSON.parse(
            await readFile( path, { encoding: "utf-8" })
        ) :
        (
            void dotenv_config(), // comma operator for side effects
            {
                kupo_url: process.env.KUPO_URL ?? "",
                ogmios_url: process.env.OGMIOS_URL ?? "",
                path_to_miner_private_key: process.env.MINER_PRIVATE_KEY_PATH ?? "",
                change_address: process.env.CHANGE_ADDRESS,
                network: tryGetMinerNetworkFromEnv()
            }
        );

    if( typeof config.change_address !== "string" )
    {
        const prvKey = PrivateKey.fromCbor(
            JSON.parse(
                await readFile( config.path_to_miner_private_key, { encoding: "utf-8" } )
            ).cborHex
        );

        const pubKeyHash = prvKey.derivePublicKey().hash;

        (config as any).change_address = new Address(
            config.network === "mainnet" ? "mainnet" : "testnet",
            PaymentCredentials.pubKey( pubKeyHash.toBuffer() )
        ).toString()
    }

    return Object.freeze( config );
}

export function isValidMinerConfig( cfg: MinerConfig ): cfg is ValidatedMinerConfig
{
    return (
        ( cfg.network === "preview" || cfg.network === "mainnet" ) &&

        typeof cfg.blockfrost_api_key === "string" &&
        cfg.blockfrost_api_key.startsWith( cfg.network ) &&
        
        typeof cfg.kupo_url === "string" &&
        cfg.kupo_url.startsWith("https://") &&

        typeof cfg.ogmios_url === "string" &&
        cfg.ogmios_url.startsWith("wss://") &&

        isValidPath( cfg.path_to_miner_private_key ) &&
        existsSync( cfg.path_to_miner_private_key ) &&

        typeof cfg.change_address === "string" && cfg.change_address.startsWith("addr")
    );
}

export async function tryGetValidMinerConfig( path?: string ): Promise<ValidatedMinerConfig>
{
    const cfg = await parseMinerConfig( path );
    
    if( !isValidMinerConfig( cfg ) )
    {
        console.log( cfg );
        throw new Error("invalid miner configuration");
    }

    return cfg;
}