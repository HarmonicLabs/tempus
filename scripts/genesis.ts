import { PTxOutRef, compile, pData, Script, Address, NetworkT, PaymentCredentials, dataToCbor, DataConstr, DataI, DataB, DataList, TxOutRef, Hash28, Data, UTxO, Value, TxBuilder, TxOut, PrimType, PrivateKey, Tx } from "@harmoniclabs/plu-ts";
import { tempura } from "../onchain/tempura";
import { TxOutRef_fromString, withDir } from "./utils";
import { sha2_256 } from "@harmoniclabs/crypto";
import { fromAscii, toHex } from "@harmoniclabs/uint8array-utils";
import { writeFile } from "fs/promises";
import { KupmiosPluts } from "../kupmios-pluts";
import { tryGetValidMinerConfig } from "../miner/config";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { readFile } from "fs/promises";

const ADA = 1_000_000;

const itamae_tn = fromAscii("itamae");

void async function main()
{
    const cfg = await tryGetValidMinerConfig();

    const kupmios = new KupmiosPluts( cfg.kupo_url, "" /* cfg.ogmios_url */ );
    process.on("beforeExit", () => kupmios.close() );

    const blockfrost = new BlockfrostPluts({
        projectId: cfg.blockfrost_api_key,
        network: cfg.network
    });
    // const utxoRefStr = process.argv[2];
// 
    // const utxoRef = TxOutRef_fromString( utxoRefStr );

    const privateKey = PrivateKey.fromCbor(
        JSON.parse(
            await readFile(
                cfg.path_to_miner_private_key,
                { encoding: "utf-8" }
            )
        ).cborHex
    )

    const changeAddress = new Address(
        cfg.network === "mainnet" ? "mainnet" : "testnet",
        PaymentCredentials.pubKey( privateKey.derivePublicKey().hash )
    );

    const minerUtxo = await blockfrost.addressUtxos( changeAddress ).then(([ u ]) => u);
    
    const utxoRef = minerUtxo.utxoRef;
    const utxoRefStr = utxoRef.toString();

    console.log( utxoRefStr );

    const inputUtxo = minerUtxo; // await blockfrost.resolveUtxos([ utxoRef ]).then(([ u ]) => u);

    const pps = await blockfrost.getProtocolParameters();
    const genesisInfos = await blockfrost.getGenesisInfos();
    // genesisInfos.systemStartPOSIX = BigInt(genesisInfos.systemStartPOSIX) * BigInt( 1000 );
    console.log( genesisInfos );

    const txBuilder = new TxBuilder( pps, genesisInfos );

    const utxoRefData = utxoRef.toData();
    
    const network = process.argv[3] ?? cfg.network;

    const envDir = `./${network}`;
    await withDir( envDir );

    console.log("compiling contract...");
    const compiledContract = compile(
        tempura
        .$(
            PTxOutRef.fromData( 
                pData( utxoRefData )
            )
        )
    );

    const tempuraScript = new Script(
        "PlutusScriptV2",
        compiledContract
    );

    const tempuraHash = tempuraScript.hash;

    const tempuraScriptAddress = new Address(
        network === "mainnet" ? "mainnet" : "testnet",
        PaymentCredentials.script( tempuraHash )
    );

    const bootstrapHash = new Uint8Array(
        sha2_256(
            sha2_256(
                dataToCbor(
                    utxoRefData 
                ).toBuffer()
            )
        )
    );

    const now = Date.now() - 2_000;
    const in3Mins = now + 180_000;

    const invalidBefore = txBuilder.posixToSlot( now ) + 1;
    const invalidAfter =  txBuilder.posixToSlot( in3Mins ) - 2;

    console.log( "now", now );
    console.log( "now", new Date( now ).toString() );
    console.log( "in3Mins", in3Mins );
    console.log( "in3Mins", new Date( in3Mins ).toString() );
    console.log( "invalidBefore", invalidBefore );
    console.log( "invalidAfter", invalidAfter );

    const lower_range = txBuilder.slotToPOSIX( invalidBefore );
    const upper_range = txBuilder.slotToPOSIX( invalidAfter );

    const avg_time = ( ( ( upper_range - lower_range ) / 2 ) + lower_range );

    /*
    SpendingState.SpendingState({
        block_number: pDataI( 0 ),
        current_hash: pBSToData.$( bootstrap_hash ),
        leading_zeros: pDataI( 5 ),
        difficulty_number:  pDataI( 65535 ),
        epoch_time: pDataI( 0 ),
        current_posix_time: pIntToData.$( averaged_current_time ),
        extra: pDataI( 0 ),
        interlink: pListToData.$( pnilData )
    })
    */
    const datum = new DataConstr(
        0,
        [
            new DataI( 0 ),
            new DataB( bootstrapHash ),
            new DataI( 5 ),
            new DataI( 65535 ),
            new DataI( 0 ),
            new DataI( avg_time ),
            new DataI( 0 ),
            new DataList([]),
        ]
    );

    let minOutAda = BigInt(pps.utxoCostPerByte) * BigInt(
        new TxOut({
            address: tempuraScriptAddress,
            value: new Value([
                Value.lovelaceEntry( 1024 * ADA ),
                Value.singleAssetEntry( tempuraHash, itamae_tn, 1 )
            ]),
            datum
        }).toCbor().toBuffer().length
    ) + BigInt( 1_000_000 );

    console.log("creating the transaciton...");
    //*
    const tx = await txBuilder.build({
        inputs: [{ utxo: inputUtxo }],
        collaterals: [ inputUtxo ],
        collateralReturn: {
            address: inputUtxo.resolved.address,
            value: Value.sub(
                inputUtxo.resolved.value,
                Value.lovelaces( 15_000_000 )
            )
        },
        mints: [
            {
                script: {
                    inline: tempuraScript,
                    policyId: tempuraHash,
                    // MintingState.Genesis({})
                    redeemer: new DataConstr( 1, [] )
                },
                value: Value.singleAsset( tempuraHash, itamae_tn, 1 )
            }
        ],
        invalidBefore,
        invalidAfter,
        outputs: [
            {
                address: tempuraScriptAddress,
                value: new Value([
                    Value.lovelaceEntry( minOutAda ),
                    Value.singleAssetEntry( tempuraHash, itamae_tn, 1 )
                ]),
                datum
            }
        ],
        changeAddress 
    });

    // tx = new Tx({
    //     ...tx,
    //     body: {
    //         ...tx.body,
    //         ttl: invalidAfter
    //     }
    // });
    
    const txCbor = tx.toCbor().toString();
    const txHash = tx.hash.toString();

    console.log( "tx invalidBefore slot: ", tx.body.validityIntervalStart );
    console.log( "tx invalidBefore posix: ",
        new Date(
            txBuilder.slotToPOSIX(
                Number(tx.body.validityIntervalStart)
            )
        ).toString()
    );

    const invalidAfterSlot = Number(tx.body.validityIntervalStart) + Number(tx.body.ttl)
    console.log( "tx invalidAfter slot: ", invalidAfterSlot );
    console.log( "tx invalidAfter posix: ",
        new Date(
            txBuilder.slotToPOSIX( invalidAfterSlot )
        ).toString()
    );
    
    console.log( txCbor );

    tx.signWith( privateKey );

    await blockfrost.submitTx( tx );
    await kupmios.waitTxConfirmation( tx.hash.toString() );

    minOutAda = BigInt(pps.utxoCostPerByte) * BigInt(
        new TxOut({
            address: tempuraScriptAddress,
            value: Value.lovelaces( 15_000 * ADA ),
            // invalid datum, locked forever
            datum: new DataI( 0 ),
            refScript: tempuraScript
        }).toCbor().toBuffer().length
    ) + BigInt( 1_000_000 );

    const deployTx = await txBuilder.build({
        inputs: [{
            utxo: new UTxO({
                utxoRef: {
                    id: txHash,
                    index: 1
                },
                resolved: tx.body.outputs[1]
            })
        }],
        outputs: [
            {
                address: tempuraScriptAddress,
                value: Value.lovelaces( minOutAda ),
                // invalid datum, locked forever
                datum: new DataI( 0 ),
                refScript: tempuraScript
            }
        ],
        changeAddress
    });

    console.log( "\n\n" + deployTx.toCbor().toString() );

    await blockfrost.submitTx( deployTx );

    await writeTempuraGenesis(
        network,
        compiledContract,
        tempuraHash,
        tempuraScriptAddress,
        bootstrapHash,
        datum,
        utxoRef,
        new TxOutRef({ id: deployTx.hash.toString(), index: 0 }),
        txHash
    );

    await kupmios.waitTxConfirmation( deployTx.hash.toString() );
    //*/

    kupmios.close();
}()

async function writeTempuraGenesis(
    network: string,
    validator: Uint8Array,
    validatorHash: Hash28,
    validatorAddress: Address,
    bootstrapHash: Uint8Array,
    datum: Data,
    utxoRef: TxOutRef,
    deployedRefScript: TxOutRef,
    txHash: string
): Promise<void>
{
    await withDir("./tempura-genesis");
    await writeFile(
        `./tempura-genesis/${network}.json`,
        JSON.stringify(
            {
                validator: toHex( validator ),
                validatorHash: validatorHash.toString(),
                validatorAddress: validatorAddress.toString(),
                bootstrapHash: toHex( bootstrapHash ),
                datum: dataToCbor( datum ).toString(),
                txHash,
                utxoRef: utxoRef.toJson(),
                deployedRefScript: deployedRefScript.toJson()
            },
            undefined,
            4
        ),
        { encoding: "utf8" }
    );
}