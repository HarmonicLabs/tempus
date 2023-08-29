import { TxOutRef } from "@harmoniclabs/plu-ts";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";

export function TxOutRef_fromString( str: string ): TxOutRef
{
    str = String( str );
    const [ id, idx ] = str.split("#");

    if( typeof id !== "string" || typeof idx !== "string" )
    throw new Error("TxOutRef.fromScript expects a valid TxOutRefStr as argument");

    let index!: number;

    try {
        index = parseInt( idx );
    }
    catch {
        throw new Error("TxOutRef.fromScript expects a valid TxOutRefStr as argument; index was not a number");
    }

    if(!(
        index >= 0 &&
        Number.isSafeInteger( index )
    ))
    throw new Error("TxOutRef.fromScript expects a valid TxOutRefStr as argument; index was not a valid integer");

    return new TxOutRef({ id, index });
}

export async function withDir( path: string ): Promise<void>
{
    if( !existsSync( path ) )
    {
        await mkdir( path );
    }
}