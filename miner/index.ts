import { Address, AddressStr, Data, DataB, DataConstr, DataI, DataList, Hash28, ITxBuildOutput, PaymentCredentials, PrivateKey, TxBuilder, TxOutRef, UTxO, Value, dataToCbor, eqData, isData } from "@harmoniclabs/plu-ts";
import { tryGetValidMinerConfig } from "./config";
import { KupmiosPluts } from "../kupmios-pluts";
import { readFile } from "fs/promises";
import { fromAscii, fromHex, toHex } from "@harmoniclabs/uint8array-utils";
import { createHash, webcrypto } from "crypto";
import { calculateDifficultyNumber, calculateInterlink, getDifficulty, getDifficultyAdjustement, incrementU8Array } from "./utils";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { writeFileSync } from "node:fs";

type GenesisFile = {
    validator: string,
    validatorHash: string,
    validatorAddress: AddressStr,
    bootstrapHash: string,
    datum: string,
    txHash: string,
    parameterUtxoRef: {
        id: string,
        index: number
    },
    deployedScriptUtxoRef: {
        id: string,
        index: number
    }
}

async function main()
{
    const cfg = await tryGetValidMinerConfig( process.argv[2] );

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

    const kupmios = new KupmiosPluts( cfg.kupo_url, undefined /* cfg.ogmios_url */ );
    process.once( "beforeExit", () => kupmios.close() );

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

    console.log(`looking for reference script utxo...`);
    const deployedScriptRefUtxo = await kupmios.resolveUtxo( genesis.deployedScriptUtxoRef );

    if( !deployedScriptRefUtxo )
    {
        console.log( genesis.deployedScriptUtxoRef );
        throw new Error("missing deployed script")
    }

    console.log(`looking for utxo at miner address (${minerAddress.toString()})...`);
    const minerUtxos = await kupmios.getUtxosAt( minerAddress );

    const blockfrost = new BlockfrostPluts({
        projectId: cfg.blockfrost_api_key
    });

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
        let validatorMasterUtxo = (await kupmios.getUtxosAt( validatorAddress )).find(
            u => u.resolved.value.get( validatorHash.toString(), masterTokenName ) === BigInt(1)
        );

        if( !validatorMasterUtxo )
        {
            throw new Error(
                `couldn't find master NFT "${validatorHash.toString()}.${toHex(masterTokenName)}" at address ${validatorAddress.toString()}`
            )
        }
    
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
    
        let nonce = fromHex("a41bf9f630b6910247112d2193c2e243");
        // webcrypto.getRandomValues( nonce );
        
        let targetState = dataToCbor(
            new DataConstr(
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
            )
        ).toBuffer()
    
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
            if( Date.now() - timer > 5_000 )
            {
                validatorMasterUtxo = (await kupmios.getUtxosAt( validatorAddress )).find(
                    u => u.resolved.value.get( validatorHash.toString(), masterTokenName ) === BigInt(1)
                );
                timer = Date.now();

                if( !validatorMasterUtxo )
                {
                    throw new Error(
                        `couldn't find master NFT "${validatorHash.toString()}.${toHex(masterTokenName)}" at address ${validatorAddress.toString()}`
                    )
                }
    
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
                    console.log("someone else found a block; updating state")
                    state = validatorMasterUtxo.resolved.datum;
                    
                    // nonce = new Uint8Array(16);
                    crypto.getRandomValues(nonce);

                    targetState = dataToCbor(
                        new DataConstr(
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
                        )
                    ).toBuffer()
                }
            }

            modifyNonce( targetState, nonce )

            targetHash = nodeSha256(
                nodeSha256( targetState )
            );

            // console.log( toHex( nonce ), toHex( targetHash ) )

            difficulty = getDifficulty( targetHash );
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
            // targetState.fields[0] = new DataB( nonce );
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
            (state.fields[0] as DataI).int % BigInt(2016) === BigInt(0)
        ) {
            const adjustment = getDifficultyAdjustement(epoch_time, BigInt(1_209_600_000) );
    
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
                // block number
                new DataI(
                    (state.fields[0] as DataI).int + BigInt(1)
                ),
                new DataB( targetHash ),
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
                    value: Value.add( validatorMasterUtxo.resolved.value, Value.lovelaces( 1_000_000 ) ),
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

            const nonce_redeemer = new DataConstr( 1, [ new DataB( nonce ) ]);

            writeFileSync("/home/michele/cardano/preview/cbors/nonce_redeemer.cbor",
                dataToCbor( nonce_redeemer ).toBuffer()
            );

            // writeFileSync("/home/michele/cardano/preview/cbors/unit.cbor",
            //     dataToCbor(
            //         new DataConstr( 0, [] )
            //     ).toBuffer()
            // );

            writeFileSync("/home/michele/cardano/preview/cbors/next_state_datum.cbor",
                dataToCbor( outDat ).toBuffer()
            );

            const invalidBefore = txBuilder.posixToSlot( realTimeNow );
            writeFileSync("/home/michele/cardano/preview/other_tx_infos/invalid_before.int.txt",
                invalidBefore.toString(),
                { encoding: "utf8" }
            );

            const invalidAfter = txBuilder.posixToSlot( realTimeNow + 180_000 );
            writeFileSync("/home/michele/cardano/preview/other_tx_infos/invalid_after.int.txt",
                invalidAfter.toString(),
                { encoding: "utf8" }
            );

            writeFileSync("/home/michele/cardano/preview/other_tx_infos/contract_tx_in.txt",
                validatorMasterUtxo.utxoRef.toString(),
                { encoding: "utf-8" }
            );

            writeFileSync("/home/michele/cardano/preview/other_tx_infos/contract_ref_tx_in.txt",
                deployedScriptRefUtxo.utxoRef.toString(),
                { encoding: "utf-8" }
            );

            writeFileSync("/home/michele/cardano/preview/other_tx_infos/miner_tx_in.txt",
                minerInput.utxoRef.toString(),
                { encoding: "utf-8" }
            );

            writeFileSync("/home/michele/cardano/preview/other_tx_infos/mint_policy_id.txt",
                validatorHash.toString(),
                { encoding: "utf-8" }
            );

            const tx = txBuilder.buildSync({
                inputs: [
                    {
                        utxo: validatorMasterUtxo,
                        referenceScriptV2: {
                            refUtxo: deployedScriptRefUtxo,
                            datum: "inline",
                            redeemer: nonce_redeemer
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
                invalidBefore,
                invalidAfter,
                changeAddress: minerAddress
            });

            tx.signWith( minerPrivateKey );

            console.log(
                JSON.stringify(
                    tx.toJson(),
                    undefined,
                    2
                )
            );

            const txHashStr = await blockfrost.submitTx( tx );

            // const res = await fetch(cfg.submit_url, {
            //     method: "POST",
            //     headers: {
            //         "Content-Type": "application/cbor"
            //     },
            //     body: tx.toCbor().toBuffer()
            // });
            // if( !res.ok )
            // {
            //     console.error( res );
            //     throw new Error( res.statusText );
            // }

            // const txHashStr = await res.text();

            console.log(
                "found next block!" + 
                "\ndatum: " + dataToCbor( outDat ) + 
                ";\ntx hash: " + txHashStr + 
                "\n"
            );

            console.log("waiting tx confirmation")
            const success = await kupmios.waitTxConfirmation( txHashStr );

            if( success )
            {
                console.log("ok");
            }
            else
            {
                console.log("timed out");
                throw new Error("timed out");
            }

            timer = -5001; // make sure we reset the validator next cycle
            consecutiveErrors = 0;
        }
        catch( e )
        {
            console.log( "nonce:", toHex( nonce ) );
            console.log( "targetState:", toHex( targetState ) );
            throw e;
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

function modifyNonce( targetState: Uint8Array, nonce: Uint8Array ): void
{
    for( let i = 0; i < 16; i++ )
    {
        targetState[i + 4] = nonce[i];
    }
}