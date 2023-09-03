import { Machine, PScriptContext, PTxOutRef, TxOutRef, UPLCConst, data, dataFromCbor, lam, pData, punsafeConvertType, unit } from "@harmoniclabs/plu-ts";
import { Redeemer, tempura } from "../tempura";

describe("tempra", () => {

    test("mine", () => {

        const contract = tempura.$(
            PTxOutRef.fromData(
                pData(
                    new TxOutRef({
                        "id": "1cd30f11c3d774fa1cb43620810a405e6048c8ecea2e85ff43f5c3ad08096e46",
                        "index": 1
                    }).toData()
                )
            )
        );

        const datumData = dataFromCbor("d8799f00582071eb1a4896739027745df976a065ded7ffd4e6371a2a9256999f59371b50b36a0519ffff001b0000018a5b512a340080ff");
        const rdmrData  = dataFromCbor("d87a9f50842b09bb0f88bf1232901043701534ceff");
        const ctxData   = dataFromCbor(
            "d8799fd8799f9fd8799fd8799fd8799f582012cc3906a43731477e63522a24cbb5eaf74046bf7b44f600d8f062ecac331b71ff00ffd8799fd8799fd87a9f581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278ffd87a80ffbf40bf401a001898f4ff581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278bf466974616d616501ffffd87b9fd8799f00582071eb1a4896739027745df976a065ded7ffd4e6371a2a9256999f59371b50b36a0519ffff001b0000018a5b512a340080ffffd87a80ffffd8799fd8799fd8799f5820fbbce31d47e45af499baff9446c99ccbc2e80db613467dbc5ffea2f3bb10a8a2ff01ffd8799fd8799fd8799f581c13867b04db054caa9655378fe37fedee7029924fbe1243887dc35fd8ffd87a80ffbf40bf401b000000024efc84ffffffd87980d87a80ffffff9fd8799fd8799fd8799f5820fbbce31d47e45af499baff9446c99ccbc2e80db613467dbc5ffea2f3bb10a8a2ff00ffd8799fd8799fd87a9f581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278ffd87a80ffbf40bf401a0128cce6ffffd87b9f00ffd8799f581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278ffffffd8799fd8799fd8799f5820fbbce31d47e45af499baff9446c99ccbc2e80db613467dbc5ffea2f3bb10a8a2ff00ffd8799fd8799fd87a9f581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278ffd87a80ffbf40bf401a0128cce6ffffd87b9f00ffd8799f581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278ffffffff9fd8799fd8799fd87a9f581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278ffd87a80ffbf40bf401a001898f4ff581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278bf466974616d616501ffffd87b9fd8799f01582000000f3b69e1436d48366f34c2e217cf598dc2f886d7dc5bb56688b8365a748b0519ffff1a000a75bc1b0000018a5b5b9ff00080ffffd87a80ffd8799fd8799fd8799f581c13867b04db054caa9655378fe37fedee7029924fbe1243887dc35fd8ffd87a80ffbf40bf401b000000024ef9ac02ff581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278bf4754454d505552411b000000012a05f200ffffd87980d87a80ffffbf40bf401a0002d8fdffffbf40bf4000ff581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278bf4754454d505552411b000000012a05f200ffff80a0d8799fd8799fd87a9f1b0000018a5b5a4060ffd87980ffd8799fd87a9f1b0000018a5b5cff80ffd87980ffff80bfd87a9fd8799fd8799f582012cc3906a43731477e63522a24cbb5eaf74046bf7b44f600d8f062ecac331b71ff00ffffd87a9f50842b09bb0f88bf1232901043701534ceffd8799f581cc9981006c4abf1eab96a0c87b0ee3d40b8007cd4c9b3d0dea357c278ffd87980ffa05820198ca261bc2c0f39e64132c19cd2b2e38dffc4f5594ec195d8750013f73f1b7bffd87a9fd8799fd8799f582012cc3906a43731477e63522a24cbb5eaf74046bf7b44f600d8f062ecac331b71ff00ffffff"
        );

        const res = Machine.eval(
            punsafeConvertType(
                contract
                .$( pData( datumData ) )
                .$( Redeemer.fromData( pData( rdmrData ) ) ),
                lam( data, unit )
            )
            .$( pData( ctxData ) )
        );

        console.log( res );

        expect( res.result instanceof UPLCConst ).toBe( true );
    })
})