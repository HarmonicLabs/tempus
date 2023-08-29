import { config } from "dotenv";

config();

export const KUPO_URL = process.env.KUPO_URL ?? "";
export const OGMIOS_URL = process.env.OGMIOS_URL ?? "";
export const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY ?? "";