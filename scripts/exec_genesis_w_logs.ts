import { execSync } from "child_process"
import { createWriteStream, openSync } from "fs";
import { tryGetValidMinerConfig } from "../miner/config";
import { withDir } from "./utils";

void async function main()
{
    const cfg = await tryGetValidMinerConfig();
    const network = process.argv[3] ?? cfg.network;

    const envDir = `./${network}`;
    await withDir( envDir );

    let cmd = "node " + __dirname + "/genesis.js";
    if( process.argv[2] )
    {
        cmd += " " + process.argv.slice( 2 ).join(" ");
    }

    const log_file = openSync(`./tempura-genesis/${network}.logs.txt`, "w");
    execSync( cmd, {
        stdio: [
            "ignore", // stdin
            log_file, // stdout
            log_file  // stderr
        ]
    } );
    
}()