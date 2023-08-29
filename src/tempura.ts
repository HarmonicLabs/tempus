import { PAssetsEntry, PCredential, PData, PScriptContext, PScriptPurpose, PTxInfo, PTxOut, PTxOutRef, Term, TermList, bool, bs, data, int, list, pBSToData, pDataI, pDataList, pIntToData, pListToData, palias, peqData, perror, pfn, phoist, pif, pisEmpty, plam, plet, pmakeUnit, pmatch, pnilData, pserialiseData, psha2_256, pstruct, punBData, punsafeConvertType, unit } from "@harmoniclabs/plu-ts";
import { epoch_number, exp2, format_found_bytearray, get_new_difficulty, get_difficulty_adjustment, halving_number, initial_payout, master_tn, tn, value_contains_master, value_has_only_master_and_lovelaces, calculate_interlink } from "./tempus";


export const MintingState = pstruct({
    Mine: {},
    Genesis: {}
});

export const SpendingState = pstruct({
    SpendingState: {
        block_number: int,
        current_hash: bs,
        leading_zeros: int,
        difficulty_number: int,
        epoch_time: int,
        current_posix_time: int,
        extra: data,
        interlink: list( data )
    }
})

export const TargetState = pstruct({
    TargetState: {
        nonce: bs,
        block_number: int,
        current_hash: bs,
        leading_zeros: int,
        difficulty_number: int,
        epoch_time: int,
    }
});

export const Redeemer = pstruct({
    // must be 0
    CtxLike: {
        tx: PTxInfo.type,
        purpose: PScriptPurpose.type
    },
    InputNonce: {
        nonce: bs
    }
});

const passert = phoist(
    plam( bool, unit )
    ( condition =>
        pif( unit ).$( condition )
        .then( pmakeUnit() )
        .else( perror( unit ) )
    )
);

function accessConstIdx( term: TermList<PData>, idx: number ): Term<PData>
{
    idx = Math.round( Number( idx ) );
    if( !Number.isSafeInteger( idx ) ) return term.head;
    
    for( let i = 0; i < idx; i++ )
    {
        term = term.tail;
    }

    return term.head;
}

const validator = pfn([
    PTxOutRef.type,
    data,
    Redeemer.type
],  unit)
(( utxoParam, _state, rdmr ) =>
    pmatch( rdmr )
    // minting policy
    .onCtxLike(({ tx, purpose }) => {

        const state = punsafeConvertType( _state, MintingState.type );

        const own_policy = plet(
            pmatch( purpose )
            .onMinting(({ currencySym }) => currencySym )
            ._( _ => perror( bs ) )
        );

        return pmatch( state )
        .onGenesis( _ => {

            const { inputs: ins, outputs: outs, mint, interval } = tx;

            // inlined
            const upper_range = 
                pmatch( interval.to.bound )
                .onPFinite(({ _0 }) => _0 )
                ._ (  _ => perror( int ) )

            const lower_range = plet(
                pmatch( interval.from.bound )
                .onPFinite(({ _0 }) => _0 )
                ._ (  _ => perror( int ) )
            );

            const time_diff = plet(
                upper_range.sub( lower_range )
            );

            // inlined
            // Mint(0) Genesis requirement: Time range span is 3 minutes or less and inclusive
            const timerangeIn3Mins = time_diff.lt( 180_000 );

            // inlined
            const averaged_current_time = time_diff.div( 2 ).add( lower_range );

            // inlined 
            // Mint(1) Genesis requirement: Contract has initial entropy hash. No need for difficulty check
            const spendsUtxoParam = ins.some( i => i.utxoRef.eq( utxoParam ) );

            const bootstrap_hash = plet(
                psha2_256.$(
                    psha2_256.$(
                        pserialiseData.$(
                            punsafeConvertType( utxoParam, data )
                        )
                    ) 
                )
            );

            const outsToSelf = plet(
                outs.filter( out => 
                    out.address.credential.eq( 
                        PCredential.PScriptCredential({ 
                            valHash: pBSToData.$( own_policy ) 
                        })
                    )
                )
            );

            // inlined
            // Mint(2) Genesis requirement: Expect one ouput with payment credential matching policy id
            const singleOutToSelf = pisEmpty.$( outsToSelf.tail );

            const outToSelf = plet( outsToSelf.head );

            // inlined
            // Mint(3) Genesis requirement: Mints master token
            const mintsMaster = value_contains_master.$( mint ).$( own_policy );

            // inlined
            // Mint(4) Genesis requirement: Master token goes to only script output
            const outToSelfHasMaster = value_has_only_master_and_lovelaces.$( outToSelf.value ).$( own_policy );

            // inlined
            const outState =
                pmatch( outToSelf.datum )
                .onInlineDatum(({ datum }) => punsafeConvertType( datum, SpendingState.type ) )
                ._( _ => perror( SpendingState.type ) );

            // inlined
            // Mint(5) Genesis requirement: Check initial datum state is set to default
            const correctInitialState = outState.eq(
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
            )

            return passert.$(
                // Mint(0) Genesis requirement: Time range span is 3 minutes or less and inclusive
                timerangeIn3Mins
                // Mint(1) Genesis requirement: Contract has initial entropy hash. No need for difficulty check
                .and( spendsUtxoParam )
                // Mint(2) Genesis requirement: Expect one ouput with payment credential matching policy id
                .and( singleOutToSelf )
                // Mint(3) Genesis requirement: Mints master token
                .and( mintsMaster )
                // Mint(4) Genesis requirement: Master token goes to only script output
                .and( outToSelfHasMaster )
                // Mint(5) Genesis requirement: Check initial datum state is set to default
                .and( correctInitialState )
            );
        })
        .onMine( _ =>
            // forwards to validator
            passert.$(
                tx.inputs.some( i =>
                    i.resolved.address.credential.eq(
                        PCredential.PScriptCredential({
                            valHash: pBSToData.$( own_policy )
                        })
                    )
                )
            )
        );
    })
    // spending validator
    .onInputNonce(({ nonce }) =>
        punsafeConvertType(
            plam( PScriptContext.type, unit )
            (({ tx, purpose }) => {
                
                const state = punsafeConvertType( _state, SpendingState.type );

                const {
                    block_number,
                    current_hash,
                    leading_zeros,
                    difficulty_number,
                    epoch_time,
                    current_posix_time,
                    interlink
                } = state;

                const spendingUtxoRef = plet(
                    pmatch( purpose )
                    .onSpending(({ utxoRef }) => utxoRef )
                    ._( _ => perror( PTxOutRef.type ) )
                );

                const { inputs: ins, outputs: outs, mint, interval } = tx;

                const ownIn = plet(
                    pmatch(
                        ins.find( i => i.utxoRef.eq( spendingUtxoRef ) )
                    )
                    .onJust(({ val }) => val.resolved )
                    .onNothing( _ => perror( PTxOut.type ) )
                );

                const own_validator_hash = plet(
                    punBData.$( ownIn.address.credential.raw.fields.head )
                );

                const ownOuts = plet(
                    outs.filter( out => out.address.eq( ownIn.address ) )
                );

                // inlined
                // Spend(0) requirement: Contract has only one output going back to itself
                const singleOutToSelf = pisEmpty.$( ownOuts.tail );

                const ownOut = plet( ownOuts.head );

                // inlined
                const upper_range = 
                pmatch( interval.to.bound )
                .onPFinite(({ _0 }) => _0 )
                ._ (  _ => perror( int ) )

                const lower_range = plet(
                    pmatch( interval.from.bound )
                    .onPFinite(({ _0 }) => _0 )
                    ._ (  _ => perror( int ) )
                );

                const time_diff = plet(
                    upper_range.sub( lower_range )
                );

                // inlined
                // Spend(1) requirement: Time range span is 3 minutes or less and inclusive
                const timerangeIn3Mins = time_diff.lt( 180_000 );

                // inlined
                const averaged_current_time = time_diff.div( 2 ).add( lower_range );

                /*
                SpendingState: {
                    0: block_number: int,
                    1: current_hash: bs,
                    2: leading_zeros: int,
                    3: difficulty_number: int,
                    4: epoch_time: int,
                    5: current_posix_time: int,
                    6: extra: data,
                    7: interlink: list( data )
                }
                */
               // inlined
                const target_state = // plet(
                    TargetState.TargetState({
                        nonce: rdmr.raw.fields.head,
                        epoch_time: accessConstIdx( state.raw.fields, 4 ),
                        block_number: accessConstIdx( state.raw.fields, 0 ),
                        current_hash: accessConstIdx( state.raw.fields, 1 ),
                        leading_zeros: accessConstIdx( state.raw.fields, 2 ),
                        difficulty_number: accessConstIdx( state.raw.fields, 3 ),
                    })
                // );

                const found_bytearray = plet(
                    psha2_256.$(
                        psha2_256.$(
                            pserialiseData.$(
                                punsafeConvertType( target_state, data )
                            )
                        ) 
                    )
                );

                const formatted = format_found_bytearray.$( found_bytearray );

                const found_difficulty_num = plet( formatted.head );
                const found_leading_zeros = plet( formatted.tail.head );

                // inlined
                // Spend(2) requirement: Found difficulty is less than or equal to the current difficulty
                // We do this by checking the leading zeros and the difficulty number
                const meetsDifficulty = found_leading_zeros.gt( leading_zeros )
                .or(
                    found_leading_zeros.eq( leading_zeros )
                    .and(
                        found_difficulty_num.lt( difficulty_number )
                    )
                );

                // inlined
                // Spend(3) requirement: Input has master token
                const inputHasMasterToken = ownIn.value.amountOf( own_validator_hash as any, master_tn as any ).eq( 1 );

                const ownMints = plet(
                    pmatch(
                        mint.find(({ policy }) => policy.eq( own_validator_hash ) )
                    )
                    .onJust(({ val }) => val.snd )
                    .onNothing( _ => perror( list( PAssetsEntry.type ) ) )
                );

                // inlined
                // Spend(4) requirement: Only one type of token minted under the validator policy
                const singleMintEntry = pisEmpty.$( ownMints.tail );

                const { tokenName: ownMint_tn, quantity: ownMint_qty } = ownMints.head;

                const halving_exponent = plet( block_number.div( halving_number ) );

                // inlined
                const expected_quantity =
                    pif( int ).$( halving_exponent.gt( 29 ) )
                    .then( 0 )
                    .else(
                        initial_payout.div( exp2.$( halving_exponent ) )
                    );

                // inlined
                // Spend(5) requirement: Minted token is the correct name and amount
                const correctMint = ownMint_tn.eq( tn ).and( ownMint_qty.eq( expected_quantity ) )

                // inlined
                // Spend(6) requirement: Output has only master token and ada
                const outHasOnlyMaster = value_has_only_master_and_lovelaces.$( ownOut.value ).$( own_validator_hash );

                // Check output datum contains correct epoch time, block number, hash, and leading zeros
                // Check for every divisible by 2016 block: 
                // - Epoch time resets
                // - leading zeros is adjusted based on percent of hardcoded target time for 2016 blocks vs epoch time
                const out_datum =
                    pmatch( ownOut.datum )
                    .onInlineDatum(({ datum }) => punsafeConvertType( datum, SpendingState.type) )
                    ._( _ => perror( SpendingState.type ) );

                // Spend(7) requirement: Expect Output Datum to be of type State
                // (implicit: fails field extraction if it is not)
                const {
                    block_number: out_block_number,
                    current_hash: out_current_hash,
                    leading_zeros: out_leading_zeros,
                    epoch_time: out_epoch_time,
                    current_posix_time: out_current_posix_time,
                    // interlink: out_interlink,
                    extra,
                    difficulty_number: out_difficulty_number
                } = out_datum;

                // inlined
                const tot_epoch_time =
                    epoch_time
                    .add( averaged_current_time )
                    .sub( current_posix_time );

                const diff_adjustment = plet(
                    get_difficulty_adjustment.$( tot_epoch_time )
                );

                const adjustment_num = diff_adjustment.head;
                const adjustment_den = diff_adjustment.tail.head;

                const new_diff = plet(
                    get_new_difficulty
                    .$( difficulty_number )
                    .$( leading_zeros )
                    .$( adjustment_num )
                    .$( adjustment_den )
                );

                const new_difficulty = new_diff.head;
                const new_leading_zeros = new_diff.tail.head;

                // inlined
                const new_epoch_time = epoch_time.add( averaged_current_time ).sub( current_posix_time );

                // inlined
                // Spend(8) requirement: Check output has correct difficulty number, leading zeros, and epoch time
                const correctOutDatum = 
                new_leading_zeros.eq( out_leading_zeros )
                .and( new_difficulty.eq( out_difficulty_number ) )
                .and(
                    out_epoch_time.eq(
                        pif( int ).$(
                            block_number.mod( epoch_number ).eq( 0 )
                            .and( block_number.gt( 0 ) )
                        )
                        .then( 0 )
                        .else( new_epoch_time )
                    )
                );

                return passert.$(
                    // Spend(0) requirement: Contract has only one output going back to itself
                    singleOutToSelf
                    // Spend(1) requirement: Time range span is 3 minutes or less and inclusive
                    .and( timerangeIn3Mins )
                    // Spend(2) requirement: Found difficulty is less than or equal to the current difficulty
                    .and( meetsDifficulty )
                    // Spend(3) requirement: Input has master token
                    .and( inputHasMasterToken )
                    // Spend(4) requirement: Only one type of token minted under the validator policy
                    .and( singleMintEntry )
                    // Spend(5) requirement: Minted token is the correct name and amount
                    .and( correctMint )
                    // Spend(6) requirement: Output has only master token and ada
                    .and( outHasOnlyMaster )
                    // Spend(7) requirement: Expect Output Datum to be of type State
                    // (implicit: fails field extraction if it is not)
                    // Spend(8) requirement: Check output has correct difficulty number, leading zeros, and epoch time
                    .and( correctOutDatum )
                    // Spend(9) requirement: Output posix time is the averaged current time
                    .and( out_current_posix_time.eq( averaged_current_time ) )
                    // Spend(10) requirement: Output block number is the input block number + 1 
                    .and( out_block_number.eq( block_number.add( 1 ) ) )
                    // Spend(11) requirement: Output current hash is the target hash
                    .and( out_current_hash.eq( found_bytearray ) )
                    //Spend(12) requirement: Check output extra field is within a certain size
                    .and( pserialiseData.$( extra ).length.ltEq( 512 ) )
                    // Spend(13) requirement: Check output interlink is correct
                    .and(
                        peqData
                        .$(
                            // out_interlink
                            accessConstIdx( state.raw.fields, 7 )
                        )
                        .$(
                            pListToData.$(
                                calculate_interlink
                                .$( interlink )
                                .$( pBSToData.$( found_bytearray ) )
                                .$( found_leading_zeros )
                                .$( found_difficulty_num )
                                .$( difficulty_number )
                                .$( leading_zeros )
                            )
                        )
                    )
                );
            }),
            unit
        )
    )
);