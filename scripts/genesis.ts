import { PTxOutRef, compile, pData, Script, Address, NetworkT, PaymentCredentials, dataToCbor, DataConstr, DataI, DataB, DataList, TxOutRef, Hash28, Data, UTxO, Value, TxBuilder } from "@harmoniclabs/plu-ts";
import { tempura } from "../onchain/tempura";
import { TxOutRef_fromString, withDir } from "./utils";
import { sha2_256 } from "@harmoniclabs/crypto";
import { fromAscii, toHex } from "@harmoniclabs/uint8array-utils";
import { writeFile } from "fs/promises";
import { KupmiosPluts } from "../kupmios-pluts";
import { tryGetValidMinerConfig } from "../miner/config";

const ADA = 1_000_000;

void async function main()
{
    const cfg = await tryGetValidMinerConfig();

    const utxoRefStr = process.argv[2];

    const utxoRef = TxOutRef_fromString( utxoRefStr );

    // please change this before running
    const changeAddress = "addr_test1qqgdj25j6pj6ac8pe5khv7l6ge337mmm5eyauaj0nq8skdmxqj6zqxuv7k6lu4m8ll4c9zatlxmr2a9wyluhqkz6grhq84r806"

    const inputUtxo = new UTxO({
        utxoRef,
        // please change this before running
        resolved: {
            address: changeAddress,
            value: Value.lovelaces( 10_000 * ADA )
        }
    });

    const kupmios = new KupmiosPluts( cfg.kupo_url, cfg.ogmios_url );

    const pps = await kupmios.getProtocolParameters();

    const txBuilder = new TxBuilder(
        pps,
        await kupmios.getGenesisInfos()
    );

    const utxoRefData = utxoRef.toData();
    
    const network = process.argv[3] ?? cfg.network;

    const envDir = `./${network}`;
    await withDir( envDir );

    // const ogmiosWs = new WebSocket( OGMIOS_URL );
    // ogmiosWs.send()

    console.log("compiling contract...");
    console.time("contract compilation");
    
    const compiledContract = compile(
        tempura
        .$(
            PTxOutRef.fromData( 
                pData( utxoRefData )
            )
        )
    );

    console.timeEnd("contract compilation");

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

    const now = Date.now() + 60_000;
    const in3Mins = now + 180_000;

    const invalidBefore = txBuilder.posixToSlot( now ) + 1;
    const invalidAfter =  txBuilder.posixToSlot( in3Mins ) - 2;

    const lower_range = txBuilder.slotToPOSIX( invalidBefore );
    const upper_range = txBuilder.slotToPOSIX( invalidAfter );

    const avg_time = ( upper_range - lower_range ) / 2 + lower_range;

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

    const itamae_tn = fromAscii("itamae");

    console.log("creating the transaciton...");
    console.time("tx creation");
    //*
    const tx = await txBuilder.build({
        inputs: [{ utxo: inputUtxo }],
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
                    Value.lovelaceEntry( 2 * ADA ),
                    Value.singleAssetEntry( tempuraHash, itamae_tn, 1 )
                ]),
                datum
            }
        ],
        changeAddress 
    });

    console.timeEnd("tx creation");

    const txCbor = tx.toCbor().toString();
    const txHash = tx.hash.toString();

    console.log( txCbor );
    console.log(
        JSON.stringify(
            tx.toJson(),
            undefined,
            4
        )
    )

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
                value: Value.lovelaces( 15 * ADA ),
                // invalid datum, locked forever
                datum: new DataI( 0 ),
                refScript: tempuraScript
            }
        ],
        changeAddress
    });

    console.log( "\n\n" + deployTx.toCbor().toString() );
    console.log(
        JSON.stringify(
            deployTx.toJson(),
            undefined,
            4
        )
    )

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