import { AddressStr, Data, DataB, DataConstr, DataI, DataList, dataToCbor, eqData, isData } from "@harmoniclabs/plu-ts";
import { KUPO_URL, OGMIOS_URL } from "../env";
import { KupmiosPluts } from "../kupmios-pluts";
import { readFile } from "fs/promises";
import { fromAscii, fromHex, toHex } from "@harmoniclabs/uint8array-utils";
import { createHash } from "crypto";
import { calculateInterlink, getDifficulty, incrementU8Array } from "./utils";

type GenesisFile = {
    validator: string,
    validatorHash: string,
    validatorAddress: AddressStr,
    bootstrapHash: string,
    datum: string,
    txHash: string,
    utxoRef: {
        id: string,
        index: number
    },
    deployedRefScript: {
        id: string,
        index: number
    }
}

const master_tn = fromAscii("itamae");

async function main()
{
    const network: "preview" | "mainnet" = process.argv[2] === "preview" ? "preview" : "mainnet";

    const kupmios = new KupmiosPluts( KUPO_URL, OGMIOS_URL );
    process.once( "beforeExit", () => kupmios.close() );

    const genesis = JSON.parse(
        await readFile(
            `./tempura-genesis/${network}.json`,
            { encoding: "utf-8" }
        )
    ) as GenesisFile;

    while( true )
    {

        let validatorMasterUtxo = await kupmios.getUtxoByUnit(
            fromHex( genesis.validatorHash ),
            master_tn
        );
    
        let state: Data = validatorMasterUtxo.resolved.datum as Data;
        
        if( !( state instanceof DataConstr ) )
        {
            console.error(
                JSON.stringify(
                    validatorMasterUtxo.toJson(),
                    undefined,
                    4
                )
            );
            throw new Error(`${validatorMasterUtxo.utxoRef.toString()} was missing master token "itamae"`);
        }
    
        let nonce = new Uint8Array( 16 );
    
        crypto.getRandomValues( nonce );
    
        let targetState = new DataConstr(
            0,
            [
                // nonce: ByteArray
                new DataB( nonce ),
                // block_number: Int
                state.fields[0],
                // current_hash: ByteArray
                state.fields[1],
                // leading_zeros: Int
                state.fields[2],
                // difficulty_number: Int
                state.fields[3],
                // epoch_time: Int
                state.fields[4]
            ]
        );
    
        let targetHash: Uint8Array;
    
        let difficulty: {
            leadingZeros: bigint;
            difficulty_number: bigint;
        };
    
        console.log("Mining...");

        let timer = Date.now();
        while( true )
        {
            if( Date.now() - timer > 5000 )
            {
                console.log("No block found in the last 5 seconds, updating state...");
                timer = Date.now();
                validatorMasterUtxo = await kupmios.getUtxoByUnit(
                    fromHex( genesis.validatorHash ),
                    master_tn
                );
    
                if( !( validatorMasterUtxo.resolved.datum instanceof DataConstr ) )
                {
                    console.error(
                        JSON.stringify(
                            validatorMasterUtxo.toJson(),
                            undefined,
                            4
                        )
                    );
                    throw new Error(`${validatorMasterUtxo.utxoRef.toString()} was missing master token "itamae"`);
                }
    
                // if someone else found a block
                if( !eqData( validatorMasterUtxo.resolved.datum, state ) )
                {
                    state = validatorMasterUtxo.resolved.datum;
                    
                    // nonce = new Uint8Array(16);
                    crypto.getRandomValues(nonce);
        
                    targetState = new DataConstr(
                        0,
                        [
                            // nonce: ByteArray
                            new DataB( nonce ),
                            // block_number: Int
                            state.fields[0],
                            // current_hash: ByteArray
                            state.fields[1],
                            // leading_zeros: Int
                            state.fields[2],
                            // difficulty_number: Int
                            state.fields[3],
                            // epoch_time: Int
                            state.fields[4]
                        ]
                    );
                }
            }

            targetHash = nodeSha256(
                nodeSha256(
                    dataToCbor(
                        targetState 
                    ).toBuffer()
                )
            );

            difficulty = getDifficulty(targetHash);
            const { leadingZeros, difficulty_number } = difficulty;

            if (
                leadingZeros > (state.fields[2] as DataI).int ||
                (
                    leadingZeros == (state.fields[2] as DataI).int &&
                    difficulty_number < (state.fields[3] as DataI).int
                )
            ) {
                break;
            }

            incrementU8Array( nonce );

            targetState.fields[0] = new DataB( nonce );
        }

        const realTimeNow = Number((Date.now() / 1000).toFixed(0)) * 1000 - 60000;

        const interlink = calculateInterlink(
            targetHash, 
            difficulty, 
            {
                leadingZeros: (state.fields[2] as DataI).int,
                difficulty_number: (state.fields[3] as DataI).int,
            }, 
            (state.fields[7] as DataList).list.map( ({ bytes }: DataB) => bytes.toBuffer() ) 
        );
    
        let epoch_time = (state.fields[4] as DataI).int +
            BigInt(90000 + realTimeNow) -
            (state.fields[5] as DataI).int;

        let difficulty_number = (state.fields[3] as DataI).int;
        let leading_zeros = (state.fields[2] as DataI).int;

        if (
            state.fields[0] as bigint % 2016n === 0n &&
            state.fields[0] as bigint > 0
        ) {
            const adjustment = getDifficultyAdjustement(epoch_time, 1_209_600_000n);
    
            epoch_time = 0n;
    
            const new_difficulty = calculateDifficultyNumber(
            {
                leadingZeros: state.fields[2] as bigint,
                difficulty_number: state.fields[3] as bigint,
            },
            adjustment.numerator,
            adjustment.denominator,
            );
    
            difficulty_number = new_difficulty.difficulty_number;
            leading_zeros = new_difficulty.leadingZeros;
        }
    }

    kupmios.close();
}

if( process.argv[1].includes("miner/index.js") )
{
    main();
}

export function nodeSha256( data: Uint8Array ): Uint8Array
{
    return createHash("sha256")
    .update(data)
    .digest()
}