import { PTxOutRef, compile, pData, Script, Address, NetworkT, PaymentCredentials, dataToCbor, DataConstr, DataI, DataB, DataList, TxOutRef, Hash28, Data, UTxO, Value, TxBuilder } from "@harmoniclabs/plu-ts";
import { tempura } from "../onchain/tempura";
import { TxOutRef_fromString, withDir } from "./utils";
import { sha2_256 } from "@harmoniclabs/crypto";
import { fromAscii, toHex } from "@harmoniclabs/uint8array-utils";
import { writeFile } from "fs/promises";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BLOCKFROST_API_KEY } from "../env";

const ADA = 1_000_000;

void async function main()
{

    const utxoRefStr = process.argv[3];

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

    const blockfrost = new BlockfrostPluts({
        projectId: BLOCKFROST_API_KEY
    });

    const pps = await blockfrost.getProtocolParameters();

    const txBuilder = new TxBuilder(
        pps,
        await blockfrost.getGenesisInfos()
    );

    const utxoRefData = utxoRef.toData();
    
    const network = process.argv[2] as NetworkT ?? "mainnet";

    const envDir = `./${network}`;
    await withDir( envDir );

    // const ogmiosWs = new WebSocket( OGMIOS_URL );
    // ogmiosWs.send()

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
        network,
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

    const now = Date.now() + 1;
    const in3Mins = now + 180_000 - 2;

    const avg_time = Math.round( (now + in3Mins) / 2 );

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
            new DataI( avg_time ),
            new DataI( 0 ),
            new DataList([]),
        ]
    );

    const itamae_tn = fromAscii("itamae");
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
        invalidBefore: now,
        invalidAfter: in3Mins,
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

    const txCbor = tx.toCbor().toString();
    const txHash = tx.hash.toString();

    console.log( txCbor );

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

    writeTempuraGenesis(
        network,
        compiledContract,
        tempuraHash,
        tempuraScriptAddress,
        bootstrapHash,
        datum,
        utxoRef,
        new TxOutRef({ id: deployTx.hash, index: 0 }),
        txHash
    );
    //*/
}()

async function writeTempuraGenesis(
    network: NetworkT,
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
        `./tempura-gensis/${network}.json`,
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
        )
    );
}