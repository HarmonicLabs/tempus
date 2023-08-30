import { Address, AddressStr, CostModelPlutusV1Array, CostModelPlutusV2Array, CostModels, Data, ExBudget, GenesisInfos, Hash28, Hash32, PaymentCredentials, ProtocolParamters, Script, StakeAddress, StakeAddressBech32, StakeCredentials, UTxO, Value, ValueUnitEntry } from "@harmoniclabs/plu-ts";
import { fromHex, toHex } from "@harmoniclabs/uint8array-utils";
import { WebSocket } from "ws";

export class KupmiosPluts
{
    kupoUrl: string;
    ogmiosUrl: string;
    readonly ogmiosWs!: WebSocket;
    readonly isOgmiosWsReady: boolean

    constructor( kupoUrl: string, ogmiosUrl: string )
    {
        this.kupoUrl = kupoUrl;
        this.ogmiosUrl = ogmiosUrl;
        Object.defineProperty(
            this, "ogmiosWs", {
                value: new WebSocket( this.ogmiosUrl ),
                writable: false,
                enumerable: true,
                configurable: false
            }
        );

        let _isOgmiosReady = false;
        
        this.ogmiosWs.addEventListener("open", () => { _isOgmiosReady = true }, { once: true });
        
        Object.defineProperty(
            this, "isOgmiosWsReady", {
                get: () => _isOgmiosReady,
                set: () => {},
                enumerable: true,
                configurable: false
            }
        );   
    }

    close(): void
    {
        this.ogmiosWs.close();
    }

    async getUtxosAt( address: Address | AddressStr ): Promise<UTxO[]>
    {
        address = address.toString() as AddressStr;

        const result = await fetch(`${this.kupoUrl}/matches/${address}?unspent`).then((res) => res.json());
        
        return this.kupmiosUtxosToUtxos(result);
    }

    async getUtxoByUnit( policy: Hash28 | Uint8Array, tokenName: Uint8Array = new Uint8Array): Promise<UTxO>
    {
        const policyId = policy instanceof Uint8Array ? toHex( policy ) : policy.toString();

        const assetName = toHex( tokenName );

        const result = await fetch(
            `${this.kupoUrl}/matches/${policyId}.${
                assetName.length > 0 ? `${assetName}` : "*"
            }?unspent`
        ).then((res) => res.json());

        const utxos = await this.kupmiosUtxosToUtxos( result );
        
        if( utxos.length !== 1 )
        {
            throw new Error("getUtxoByUnit :: Unit needs to be an NFT or only held by one address.");
        }

        return utxos[0];
    }

    async getGenesisInfos(): Promise<GenesisInfos>
    {
        const res = await this.ogmiosCall(
            "Query",
            { query: "genesisConfig" }
        );

        return {
            systemStartPOSIX: Date.parse( res.systemStart ),
            slotLengthInMilliseconds: parseFloat( res.slotLength ) * 1000
        };
    }

    async getProtocolParameters(): Promise<ProtocolParamters>
    {
        const res = await this.ogmiosCall(
            "Query", 
            { query: "currentProtocolParameters" }
        );

        const costModels: CostModels = {};
          Object.keys(res.costModels).forEach((v) => {
            const version = v.split(":")[1].toUpperCase();
            const plutusVersion = ("PlutusScript" + version) as ("PlutusScriptV1" | "PlutusScriptV2") ;
            costModels[plutusVersion] = res.costModels[v] as (CostModelPlutusV2Array & CostModelPlutusV1Array);
          });

        const [memNum, memDenom] = res.prices.memory.split("/");
        const [stepsNum, stepsDenom] = res.prices.steps.split("/");

        const [ poolInluenceNum, poolInfluenceDen ] = res.poolInfluence.split("/");
        const [ monExpNum, monExpDen ] = res.monetaryExpansion.split("/");
        const [ treasuryCutNum, treasuryCutDen ] = res.treasuryExpansion.split("/");

        return {
            txFeeFixed: BigInt( res.minFeeConstant ),
            txFeePerByte: BigInt( res.minFeeCoefficient ),
            maxTxSize: BigInt( res.maxTxSize ),
            maxValueSize: BigInt( res.maxValueSize ),
            collateralPercentage: BigInt( res.collateralPercentage ),
            stakeAddressDeposit: BigInt( res.stakeKeyDeposit ),
            stakePoolDeposit: BigInt( res.poolDeposit ),
            executionUnitPrices: {
                priceMemory: parseInt(memNum) / parseInt(memDenom),
                priceSteps: parseInt(stepsNum) / parseInt(stepsDenom)
            },
            costModels,
            maxBlockExecutionUnits: new ExBudget({
                cpu: BigInt( res.maxExecutionUnitsPerBlock.steps ),
                mem: BigInt( res.maxExecutionUnitsPerBlock.memory ),
            }),
            maxTxExecutionUnits: new ExBudget({
                cpu: BigInt( res.maxExecutionUnitsPerTransaction.steps ),
                mem: BigInt( res.maxExecutionUnitsPerTransaction.memory )
            }),
            utxoCostPerByte: BigInt( res.coinsPerUtxoByte ),
            maxCollateralInputs: BigInt( res.maxCollateralInputs ),
            maxBlockBodySize: BigInt( res.maxBlockBodySize ),
            maxBlockHeaderSize: BigInt( res.maxBlockHeaderSize ),
            minPoolCost: BigInt( res.minPoolCost ),
            monetaryExpansion: parseInt( monExpNum ) / parseInt( monExpDen ),
            poolPledgeInfluence: parseInt( poolInluenceNum ) / parseInt( poolInfluenceDen ),
            poolRetireMaxEpoch: BigInt( res.poolRetirementEpochBound ),
            protocolVersion: {
                major: res.protocolVersion.major,
                minor: res.protocolVersion.minor
            },
            stakePoolTargetNum: BigInt( res.desiredNumberOfPools ),
            treasuryCut: parseInt( treasuryCutNum ) / parseInt( treasuryCutDen ),
        };
    }

    async waitOgmiosReady(): Promise<void>
    {
        while( !this.isOgmiosWsReady )
        {
            await new Promise( r => setTimeout( r, 500 ) );
        }
    }
    async ogmiosCall(
        methodname: string,
        args: any
    ): Promise<any>
    {
        await this.waitOgmiosReady();

        const promise: Promise<any> = new Promise((res, rej) => {
            this.ogmiosWs.addEventListener("message", ( msg ) => {
                try {
                    res( JSON.parse( msg.data.toString() ).result  );
                }
                catch(e) {
                    rej( e );
                }
            }, { once: true })
        });

        this.ogmiosWs.send(JSON.stringify({
            type: "jsonwsp/request",
            version: "1.0",
            servicename: "ogmios",
            methodname,
            args,
        }));

        return promise;
    }

    async resolveDatumHash( datumHash: Hash32 | Uint8Array | string ): Promise<Data> {

        datumHash = datumHash instanceof Uint8Array ? toHex( datumHash ) : datumHash.toString();
        
        const result = await fetch(
          `${this.kupoUrl}/datums/${datumHash}`,
        ).then((res) => res.json());

        if (!result || !result.datum) {
          throw new Error(`No datum found for datum hash: ${datumHash}`);
        }

        return result.datum;
    }

    async resolveScriptHash( hash: Hash28 | Uint8Array | string ): Promise<Script> {

        hash = hash instanceof Uint8Array ? toHex( hash ) : hash.toString();
        
        const {
            script,
            language,
        } = await fetch(`${this.kupoUrl}/scripts/${hash}`).then((res) => res.json());

        const bytes = fromHex( script );

        if (language === "native")
        {
            return new Script(
                "NativeScript",
                bytes
            );
        } 
        else if (language === "plutus:v1")
        {
            return new Script(
                "PlutusScriptV1",
                bytes
            );
        }
        else if (language === "plutus:v2")
        {
            return new Script(
                "PlutusScriptV2",
                bytes
            );
        }

        throw new Error("unsupported script language: " + language);
    }

    private async kupmiosUtxosToUtxos(utxos: any[]): Promise<UTxO[]> {
        return Promise.all(
            utxos.map( async utxo => {

                const assets: { [unit: string ]: number } = utxo.value.assets;

                return new UTxO({
                    utxoRef: {
                        id: utxo.transaction_id,
                        index: parseInt(utxo.output_index)
                    },
                    resolved: {
                        address: utxo.address,
                        value: Value.add(
                            Value.lovelaces( utxo.value.coins ),
                            Value.fromUnits(
                                Object.keys( assets ).map( unit => ({
                                    unit: unit.replace(".", ""),
                                    quantity: assets[unit]
                                }))
                            )
                        ),
                        datum:
                            utxo.datum_type === "hash" ? new Hash32( utxo.datum_hash ) :
                            utxo.datum_type === "inline" ? await this.resolveDatumHash( utxo.datum_hash ) :
                            undefined,
                        refScript: typeof utxo.script_hash === "string" ? await this.resolveScriptHash( utxo.script_hash ) : undefined
                    }
                });
            })
        );
    }
}