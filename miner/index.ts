import { Address, AddressStr, Data, DataB, DataConstr, DataI, DataList, Hash28, ITxBuildOutput, PaymentCredentials, PrivateKey, TxBuilder, UTxO, Value, dataToCbor, eqData, isData } from "@harmoniclabs/plu-ts";
import { tryGetValidMinerConfig } from "./config";
import { KupmiosPluts } from "../kupmios-pluts";
import { readFile } from "fs/promises";
import { fromAscii, fromHex } from "@harmoniclabs/uint8array-utils";
import { createHash } from "crypto";
import { calculateDifficultyNumber, calculateInterlink, getDifficulty, getDifficultyAdjustement, incrementU8Array } from "./utils";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";

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
    const cfg = await tryGetValidMinerConfig();

    console.log( "Running miner with config: ", JSON.stringify( cfg, undefined, 4 ) + "\n" );

    const minerPrivateKey = PrivateKey.fromCbor(
        JSON.parse(
            await readFile(
                cfg.path_to_miner_private_key,
                { encoding: "utf-8" }
            )
        ).cborHex
    );

    const minerAddress = new Address(
        cfg.network === "mainnet" ? "mainnet" : "testnet",
        PaymentCredentials.pubKey( minerPrivateKey.derivePublicKey().hash )
    );

    const changeAddress = Address.fromString( cfg.change_address );

    const changeAddressIsMiner = changeAddress.toString() === minerAddress.toString();

    const kupmios = new KupmiosPluts( cfg.kupo_url, "" /* cfg.ogmios_url */ );
    process.once( "beforeExit", () => kupmios.close() );

    const blockfrost = new BlockfrostPluts({
        projectId: cfg.blockfrost_api_key
    });

    const genesis: GenesisFile = JSON.parse(
        await readFile(
            `./tempura-genesis/${cfg.network}.json`,
            { encoding: "utf-8" }
        )
    );

    const validatorHash = new Hash28( genesis.validatorHash );
    const tokenName = fromAscii("TEMPURA");
    const masterTokenName = fromAscii("itamae")
    const validatorAddress = Address.fromString( genesis.validatorAddress );

    console.log(`looking for utxo at miner address (${minerAddress.toString()})...`);
    const minerUtxos = await kupmios.getUtxosAt( minerAddress );

    console.log(`looking for reference script utxo...`);
    const deployedScriptRefUtxo = await kupmios.resolveUtxo( genesis.deployedRefScript );

    console.log(`querying protocol parameters...`);
    const pps = await blockfrost.getProtocolParameters();

    console.log(`looking for genesis informations...`);
    const txBuilder = new TxBuilder(
        pps,
        await blockfrost.getGenesisInfos()
    );

    let consecutiveErrors = 0;
    
    // program loop (not mining)
    while( true )
    {
        console.log(`looking for master utxo...`);
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

        // mine loop
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

            // if found hash break
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
            (state.fields[0] as DataI).int % BigInt(2016) === BigInt(0) &&
            (state.fields[0] as DataI).int > 0
        ) {
            const adjustment = getDifficultyAdjustement(epoch_time, BigInt(1_209_600_000) );
    
            epoch_time = BigInt(0);
    
            const new_difficulty = calculateDifficultyNumber(
                {
                    leadingZeros: (state.fields[2] as DataI).int,
                    difficulty_number: (state.fields[3] as DataI).int,
                },
                adjustment.numerator,
                adjustment.denominator,
            );
    
            difficulty_number = new_difficulty.difficulty_number;
            leading_zeros = new_difficulty.leadingZeros;
        }

        const outDat = new DataConstr(
            0, 
            [
                new DataI(
                    (state.fields[0] as DataI).int + BigInt(1)
                ),
                new DataB(targetHash),
                new DataI( leading_zeros ),
                new DataI( difficulty_number ),
                new DataI( epoch_time ),
                new DataI( BigInt(90000 + realTimeNow) ),
                new DataI( 0 ),
                new DataList(
                    interlink.map(b => new DataB( b ))
                )
            ]
        );

        try {
            const outputs: ITxBuildOutput[] = [
                {
                    address: validatorAddress,
                    value: validatorMasterUtxo.resolved.value,
                    datum: outDat
                }
            ];

            // send minted tokens to specified changeAddress if not the miner
            // (miner is set as default change address)
            if( !changeAddressIsMiner )
            {
                outputs.push({
                    address: changeAddress,
                    value: new Value([
                        Value.lovelaceEntry( 2_000_000 ),
                        Value.singleAssetEntry( validatorHash, tokenName, 5_000_000_000 )
                    ])
                });
            }

            const minerInput = minerUtxos.shift();

            if( !minerInput )
            {
                throw new Error("missing utxos at miner address; could not mint new block");
            }

            const tx = txBuilder.buildSync({
                inputs: [
                    {
                        utxo: validatorMasterUtxo,
                        referenceScriptV2: {
                            refUtxo: deployedScriptRefUtxo,
                            datum: "inline",
                            redeemer: new DataConstr( 1, [ new DataB( nonce ) ])
                        }
                    },
                    { utxo: minerInput }
                ],
                collaterals: [ minerInput ],
                mints: [
                    {
                        value: Value.singleAsset( validatorHash, tokenName, 5_000_000_000 ),
                        script: {
                            ref: deployedScriptRefUtxo,
                            policyId: validatorHash,
                            redeemer: new DataConstr( 0, [] )
                        }
                    }
                ],
                outputs,
                invalidBefore: txBuilder.posixToSlot( realTimeNow ),
                invalidAfter: txBuilder.posixToSlot( realTimeNow + 180_000 ),
                changeAddress: minerAddress
            });

            tx.signWith( minerPrivateKey );

            await blockfrost.submitTx( tx );

            console.log(
                "found next block!" + 
                "\ndatum: " + dataToCbor( outDat ) + 
                ";\ntx hash: " + tx.hash.toString() + 
                "\n"
            );

            minerUtxos.push(
                ...tx.body.outputs
                .map( (out, i) =>
                    out.address.toString() === minerAddress.toString() ?
                    new UTxO({
                        utxoRef: {
                            id: tx.hash.toString(),
                            index: i
                        },
                        resolved: out
                    }) : undefined
                ).filter( out => out instanceof UTxO ) as UTxO[]
            );

            await kupmios.waitTxConfirmation( tx.hash.toString() );

            timer = -5001; // make sure we reset the validator next cycle
            consecutiveErrors = 0;
        }
        catch( e )
        {
            consecutiveErrors++;

            if( consecutiveErrors > 3 ) throw e;

            console.log(
                "!!!! ERROR Submittig mining transaction !!!!\n",
                e
            );
        }
    }

    kupmios.close();
}

if( process.argv[1].includes("miner/index") )
{
    main();
}

export function nodeSha256( data: Uint8Array ): Uint8Array
{
    return createHash("sha256")
    .update(data)
    .digest()
}