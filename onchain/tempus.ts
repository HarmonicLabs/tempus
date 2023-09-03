import { PCurrencySymbol, PInt, PTokenName, PValue, PValueEntry, Term, TermList, bool, data, fn, int, lam, list, pInt, pList, pfn, phoist, pif, pisEmpty, plam, plet, pnilData, precursive, bs, pstrictIf, pmatchList, pdelay, pchooseList, pstrictChooseList, pforce, delayed } from "@harmoniclabs/plu-ts";
import { fromAscii } from "@harmoniclabs/uint8array-utils";

export const master_tn = PTokenName.from( fromAscii("itamae") );

export const tn = PTokenName.from( fromAscii("TEMPURA") );

export const halving_number = pInt( 210_000 );

export const epoch_number = pInt( 2016 );

export const epoch_target = pInt( 1_209_600_000 );

export const initial_payout = pInt( 5_000_000_000 );

export const padding = pInt( 16 );


export function pListPairInt( arg: Term<PInt>[] | [ number, number ] ): TermList<PInt>
{
    return pList( int )( typeof arg[0] === "number" ? arg.map( pInt as any ) as any : arg);
}


export const find_first_nonzero_byte = phoist(
    plam( bs, int )
    ( b =>
        precursive(
            pfn([
                lam( int, int  ),
                int,
            ],  int)
            (( find_first_nonzero_byte, i ) => {

                const curr_byte = plet( b.at( i ) );

                return pif( int )
                .$( curr_byte.eq( 0 ) )
                .then( find_first_nonzero_byte.$( i.add( 1 ) ).add( 2 ) )
                .else(
                    pstrictIf( int )
                    .$( curr_byte.lt( 16 ) )
                    .$( 1 )
                    .$( 0 )
                )
            })
        )
        .$( 0 )
    )
);

export const format_found_bytearray = phoist(
    plam( bs, list( int ) )
    ( b => {

        const leading_zeroes = plet(
            find_first_nonzero_byte.$( b )
        );

        const bytearray_position = plet(
            leading_zeroes.div( 2 )
        );

        // inlined
        const even_diff_num = 
            b.at( bytearray_position ).mult( 256 )
            .add( b.at( bytearray_position.add( 1 ) ) );

        // inlined
        const odd_diff_num = 
            b.at( bytearray_position ).mult( 4096 )
            .add(
                b.at( bytearray_position.add( 1 ) ).mult( 16 )
            )
            .add(
                b.at( bytearray_position.add( 2 ) ).div( 16 )
            );

        return pListPairInt([
            pif( int ).$( leading_zeroes.mod( 2 ).eq( 0 ) )
            .then( even_diff_num )
            .else( odd_diff_num ),
            leading_zeroes
        ]);
    })
);


export const do_exp2 = phoist(
    precursive(
        pfn([
            lam( int, int ),
            int
        ], int )
        ( ( self, exp ) =>
            pif( int ).$( exp.ltEq(0) )
            .then( 1 )
            .else(
                self.$( exp.sub( 1 ) ).mult( 2 )
            )
        )
    )
);

export const exp2 = phoist(
    precursive(
        pfn([
            lam( int, int ),
            int
        ], int )
        ( ( self, exp ) =>
            pif( int ).$( exp.gtEq( 5 ) )
            .then(
                self.$( exp.sub( 5 ) ).mult( 32 )
            )
            .else( do_exp2.$( exp ) )
        )
    )
);

export const value_has_only_master_and_lovelaces = phoist(
    pfn([
        PValue.type,
        PCurrencySymbol.type
    ],  bool)
    (( value, own_policy ) => {
    
        // inlined
        const onlyTwoEntries = pisEmpty.$( value.tail.tail );
    
        const fstEntry = plet( value.head );
        const sndEntry = plet( value.tail.head );

        const checkMasterAssets = plet(
            plam( PValueEntry.type, bool )
            (({ fst: policy, snd: assets }) => {

                // inlined
                const onlySigleAsset = pisEmpty.$( assets.tail );

                const { tokenName, quantity } = assets.head;

                return onlySigleAsset
                .and(  policy.eq( own_policy ) )
                .and(  tokenName.eq( master_tn ) )
                .and(  quantity.eq(1) );
            })
        )
    
        // inlined
        const correctAmount = pif( bool ).$( fstEntry.fst.eq("") )
        .then( checkMasterAssets.$( sndEntry ) )
        .else( checkMasterAssets.$( fstEntry ) );

        return onlyTwoEntries
        .and(  correctAmount )
    })
);

export const value_contains_master = phoist(
    pfn([
        PValue.type,
        PCurrencySymbol.type
    ],  bool)
    ( ( value, own_policy ) => {

        return value.some(({ fst: policy, snd: assets }) => {

            // inlined
            const singleAssetEntry = pisEmpty.$( assets.tail );

            const { fst: tokenName, snd: quantity } = assets.head;

            return policy.eq( own_policy )
            .and( singleAssetEntry )
            .and( tokenName.eq( master_tn ) )
            .and( quantity.eq( 1 ) )
        });
    })
);

export const get_difficulty_adjustment = phoist(
    plam( int, list( int ) )
    ( tot_epoch_time =>
        pif( list( int ) )
        .$(
            epoch_target.div( tot_epoch_time ).gtEq( 4 )
            .and(
                tot_epoch_time.mod( epoch_target ).gt( 0 )
            )
        )
        .then(
            pListPairInt([ 1, 4 ])
        )
        .else(

            pif( list( int ) )
            .$(
                tot_epoch_time.div( epoch_target ).gtEq( 4 )
                .and(
                    tot_epoch_time.mod( epoch_target ).gt( 0 )
                )
            )
            .then(
                pListPairInt([ 4, 1 ])
            )
            .else(
                pListPairInt([ tot_epoch_time, epoch_target ])
            )

        )
    )
);

export const get_new_difficulty = phoist(
    pfn([ int, int, int, int ], list( int ) )
    ((
        difficulty_num,
        curr_leading_zeros,
        adj_num,
        adj_den
    ) => {

        const new_padded_difficulty = plet(
            difficulty_num.mult( padding ).mult( adj_num ).div( adj_den )
        );

        const new_difficulty = plet(
            new_padded_difficulty.div( padding )
        );

        return pif( list( int ) )
        .$( new_padded_difficulty.div( 65536 ).eq( 0 ) )
        .then(
            pif( list( int ) ).$( curr_leading_zeros.gtEq( 62 ) )
            .then( pListPairInt([ 4096, 62 ]) )
            .else( pListPairInt([ new_padded_difficulty, curr_leading_zeros.add( 1 ) ]) )
        )
        .else(
            pif( list( int ) )
            .$( new_difficulty.div( 65536 ).gt( 0 ) )
            .then(
                pif( list( int ) )
                .$( curr_leading_zeros.ltEq( 2 ) )
                .then( pListPairInt([ 65535, 2 ]) )
                .else(
                    pListPairInt([ 
                        new_difficulty.div( padding ),
                        curr_leading_zeros.sub( 1 ) 
                    ])
                )
            )
            .else(
                pListPairInt([
                    new_difficulty,
                    curr_leading_zeros
                ])
            )
        );
    })
);

const do_calculate_interlink_t = fn([
    list( data ),
    data,
    int,
    int,
    int,
    int
], list( data ));

export const do_calculate_interlink = phoist(
    precursive(
        pfn([
            do_calculate_interlink_t,
            list( data ),
            data,
            int,
            int,
            int,
            int
        ], list( data ))
        ((
            do_calculate_interlink,
            interlink,
            curr_hash,
            found_leading_zeros,
            found_difficulty_num,
            difficulty_num,
            leading_zeroes
        ) => {

            const new_diff = plet(
                get_new_difficulty
                .$( difficulty_num )
                .$( leading_zeroes )
                .$( 1 )
                .$( 2 )
            );

            const halved_diff = new_diff.head;
            const halved_leading_zeros = new_diff.tail.head;

            return pif( list( data ) )
            // if 
            // found_leading_zeros > halved_leading_zeroes || 
            // found_leading_zeros == halved_leading_zeroes && 
            // found_difficulty_number < halved_difficulty{
            .$(
                found_leading_zeros.gt( halved_leading_zeros )
                .or(
                    found_leading_zeros.eq( halved_leading_zeros )
                    .and(
                        found_difficulty_num.lt( halved_diff )
                    )
                )
            )
            .then(
                do_calculate_interlink
                .$(
                    pmatchList( list( data ), data )
                    .$( pdelay( pnilData ) )
                    .$( ( _, rest ) => rest )
                    .$( interlink )
                )
                .$( curr_hash )
                .$( found_leading_zeros )
                .$( found_difficulty_num )
                .$( halved_diff )
                .$( halved_leading_zeros )
                .prepend( curr_hash )
            )
            .else(
                interlink
            );
        })
    )
);

export const calculate_interlink = phoist(
    precursive(
        pfn([
            do_calculate_interlink_t,
            list( data ),
            data,
            int,
            int,
            int,
            int
        ], list( data ))
        ((
            calculate_interlink,
            interlink,
            curr_hash,
            found_leading_zeros,
            found_difficulty_num,
            difficulty_num,
            leading_zeroes
        ) => {

            const new_diff = plet(
                get_new_difficulty
                .$( difficulty_num )
                .$( leading_zeroes )
                .$( 1 )
                .$( 4 )
            );

            const quarter_diff = new_diff.head;
            const quarter_leading_zeros = new_diff.tail.head;

            return pif( list( data ) )
            // if 
            // found_leading_zeros > quarter_leading_zeroes || 
            // found_leading_zeros == quarter_leading_zeroes && 
            // found_difficulty_number < quarter_difficulty{
            .$(
                found_leading_zeros.gt( quarter_leading_zeros )
                .or(
                    found_leading_zeros.eq( quarter_leading_zeros )
                    .and(
                        found_difficulty_num.lt( quarter_diff )
                    )
                )
            )
            .then(
                calculate_interlink
                .$(
                    pchooseList( data , list( data ) )
                    .$( interlink )
                    // [] ->
                    .$( pnilData )
                    .$( 
                        plet( interlink.tail ).in( rest => 
                            pchooseList( data , list( data ) )
                            .$( rest )
                            // [_] ->
                            .$( pnilData )
                            // [_, _, ..rest] ->
                            .$( rest.tail )
                        )
                    )
                )
                .$( curr_hash )
                .$( found_leading_zeros )
                .$( found_difficulty_num )
                .$( quarter_diff )
                .$( quarter_leading_zeros )
                .prepend( curr_hash )
                .prepend( curr_hash )
            )
            .else(
                do_calculate_interlink
                .$( interlink )
                .$( curr_hash )
                .$( found_leading_zeros )
                .$( found_difficulty_num )
                .$( difficulty_num )
                .$( leading_zeroes )
            );
        })
    )
);