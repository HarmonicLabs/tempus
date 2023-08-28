import { Machine, data, pBSToData, pByteString, pInt, pList, plet, pnilData, prettyIR, prettyUPLC } from "@harmoniclabs/plu-ts";
import { calculate_interlink, exp2, format_found_bytearray, get_difficulty_adjustment, get_new_difficulty, pListPairInt } from "../tempus";
import { fromHex } from "@harmoniclabs/uint8array-utils";


describe("tempus", () => {

    describe("exp2", () => {

        function _exp2( n: number ): number
        {
            return n < 1 ? 1 : 2 ** n;
        }
        
        function testExp2( n: number )
        {
            const expected = _exp2( n );
            test("2 ** " + n + " === " + expected,() => {

                expect(
                    Machine.evalSimple(
                        exp2.$( n )
                    )
                ).toEqual(
                    Machine.evalSimple(
                        pInt( expected )
                    )
                );

            });
        }

        testExp2( 0 );
        testExp2( 5 );
        testExp2( 27 );
        testExp2( 1 );
        testExp2( 29 );

    });

    describe("get_difficulty_adjustment", () => {

        function testAdjustment( n: number, expected: [ number, number ] )
        {
            test(`get_difficulty_adjustment.$(${ n }) === (${expected[0]}, ${expected[1]})`,() => {

                expect(
                    Machine.evalSimple(
                        get_difficulty_adjustment.$( n )
                    )
                ).toEqual(
                    Machine.evalSimple(
                        pListPairInt( expected )
                    )
                );

            });
        }

        testAdjustment( 1_209_600_000  , [1_209_600_000, 1_209_600_000] );
        testAdjustment( 1_200_600_000  , [1_200_600_000, 1_209_600_000] );
        testAdjustment( 50_000_000_000 , [4, 1] );
        testAdjustment( 200_000_000    , [1, 4] );
    });

    describe("get_new_difficulty", () => {

        function testNewDiff(
            [ a, b, c ,d ]: [ number, number, number, number ],
            expected: [ number, number ]
        )
        {
            test(`get_new_difficulty.$(${ a }).$(${ b }).$(${ c }).$(${ d }) === (${expected[0]}, ${expected[1]})`,() => {
                expect(
                    Machine.evalSimple(
                        get_new_difficulty
                        .$( a )
                        .$( b )
                        .$( c )
                        .$( d )
                    )
                ).toEqual(
                    Machine.evalSimple(
                        pListPairInt( expected )
                    )
                );
            })
        }

        testNewDiff(
            [ 20001, 4, 4, 1 ],
            [ 5000,  3 ]
        );
        testNewDiff(
            [ 20001, 4, 1, 4 ],
            [ 5000,  4 ]
        );
        testNewDiff(
            [ 5005, 4, 1, 4 ],
            [ 20020, 5 ]
        );
        testNewDiff(
            [ 9000, 6, 57, 37 ],
            [ 13864, 6 ]
        );
        testNewDiff(
            [ 30000, 4, 3, 1 ],
            [ 5625, 3 ]
        );
        testNewDiff(
            [ 9000, 4, 1, 3 ],
            [ 48000, 5 ]
        );
        testNewDiff(
            [ 9000, 62, 1, 3 ],
            [ 4096, 62 ]
        );
        testNewDiff(
            [ 27000, 2, 3, 1 ],
            [ 65535, 2 ]
        );

    });

    describe.only("calculate_interlink", () => {

        test("interlink test 1", () => {

            const currHash = fromHex("0000000000000000009c40000000000012000000000000000000000000000000");

            const curr_hash_bs = pByteString( currHash );

            const formatted = plet( format_found_bytearray.$( curr_hash_bs ) );

            const found_difficulty_num = formatted.head;
            const found_leading_zeros= formatted.tail.head;

            const current_hash = pBSToData.$( curr_hash_bs );

            console.log(
                Machine.eval(
                    calculate_interlink
                    .$( pnilData )
                    .$( current_hash )
                    .$( found_leading_zeros )
                    .$( found_difficulty_num )
                    .$( 40000 )
                    .$( 5 )
                )
            )

            /*
            expect(
                Machine.evalSimple(
                    calculate_interlink
                    .$( pnilData )
                    .$( current_hash )
                    .$( found_leading_zeros )
                    .$( found_difficulty_num )
                    .$( 40000 )
                    .$( 5 )
                )
            ).toEqual(
                Machine.evalSimple(
                    pList( data )([
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                        current_hash,
                      ])
                )
            );
            //*/

        })
    })
})