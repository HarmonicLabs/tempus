import { Address, PaymentCredentials, PrivateKey } from "@harmoniclabs/plu-ts";
import { toHex } from "@harmoniclabs/uint8array-utils";
import { webcrypto } from "crypto";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";

const slash = process.platform === "win32" ? "\\" : "/";

async function main()
{
    const path = process.argv[3] ?? `.${slash}minerPrivateKey.local.json`;
    
    let tmp = path.split(slash);
    tmp.pop();
    const parentDir = tmp.join( slash );

    if( !existsSync( parentDir ) )
    {
        await mkdir( parentDir );
    }

    const privateKeyBytes = webcrypto.getRandomValues(new Uint8Array(32));

    await writeFile(
        path,
        JSON.stringify({
            cborHex: "5820" + toHex( privateKeyBytes )
        })
    );
    
    console.log("generated a private key!!!");
    console.log("remember to found the following address so that the miner can operate properly:");

    let network: "mainnet" | "testnet" = process.argv[2] as any;

    if( network !== "mainnet" ) network = "testnet";

    const minerAddr = new Address(
        network,
        PaymentCredentials.pubKey( new PrivateKey( privateKeyBytes ).derivePublicKey().hash )
    );
    
    console.log( minerAddr.toString() )
}

if( process.argv[1].includes("genPrivateKey.js") )
{
    main();
}