import { fromHex, toHex } from "@harmoniclabs/uint8array-utils"
import { incrementU8Array } from "../utils";

describe("incrementU8Array", () => {

    function tst( x: Uint8Array )
    {
        if( x.every( n => n === 255 ))
        {
            const res = new Uint8Array( x.length );
            test(`${toHex( x )} -> ${toHex(res)}`, () => {
                incrementU8Array( x )
                expect( toHex( x ) ).toEqual( toHex( res ) )
            });
            return;
        }

        const hex = toHex( x );
        let bi = BigInt( "0x" + hex ) + BigInt( 1 );
        const resHex = bi.toString( 16 ).padStart( hex.length, '0' );
        const res = fromHex( resHex );

        test(`${hex} -> ${resHex}`, () => {
            incrementU8Array( x )
            expect( toHex( x ) ).toEqual( resHex )
        });
    }

    tst(new Uint8Array([1]));
    tst(new Uint8Array([1,2]));
    tst(new Uint8Array([1,2,3]));
    tst(new Uint8Array([1,2,3,4]));
    tst(fromHex("ffffff"));
    tst(fromHex("efffff"));

    function tstIncr( x: Uint8Array, incr: number )
    {
        const hex = toHex( x );
        let bi = BigInt( "0x" + hex ) + BigInt( incr );
        let resHex = bi.toString( 16 ).padStart( hex.length, '0' );
        resHex = resHex.slice( resHex.length - (x.length * 2) );
        const res = fromHex( resHex );

        test(`${hex} -> ${resHex}`, () => {
            incrementU8Array( x, incr )
            expect( toHex( x ) ).toEqual( resHex )
        });
    }

    tstIncr(new Uint8Array([1]), 2);
    tstIncr(new Uint8Array([1,2]), 2);
    tstIncr(new Uint8Array([1,2,3]), 2);
    tstIncr(new Uint8Array([1,2,3,4]), 2);
    tstIncr(fromHex("ffffff"), 2);
    tstIncr(fromHex("efffff"), 2);
})