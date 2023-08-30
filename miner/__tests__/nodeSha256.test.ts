import { sha2_256 } from "@harmoniclabs/crypto"
import { fromAscii, fromUtf8, toHex } from "@harmoniclabs/uint8array-utils"
import { nodeSha256 } from "..";

describe("nodeSha256", () => {

    function tst( msg: string | Uint8Array ): void
    {
        const title = typeof msg === "string" ? msg : "data: " + toHex( msg );
        const data = typeof msg === "string" ? fromUtf8( msg ) : msg;
        let timer: number;
        test( title, () => {
            timer = performance.now();
            const a = new Uint8Array( sha2_256( data ) );
            // console.log( "lib", performance.now() - timer );
            timer = performance.now();
            const b = new Uint8Array( nodeSha256( data ) );
            // console.log( "node", performance.now() - timer );

            expect( a )
            .toEqual( b )
        });
    }

    tst("hello");
    tst("hello1");
    tst("hello2");
    tst("hello3");
    const bytes = new Uint8Array( 64 );
    for( let i = 0; i < 10; i++ )
    {
        crypto.getRandomValues( bytes );
        tst( bytes );
    }
})