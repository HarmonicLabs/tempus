
export function getDifficulty(
    hash: Uint8Array,
  ): { leadingZeros: bigint; difficulty_number: bigint } {
    let leadingZeros = 0;
    let difficulty_number = 0;
    for (const [indx, chr] of hash.entries()) {
        if (chr !== 0) {
            if ((chr & 0x0F) === chr) {
                leadingZeros += 1;
                difficulty_number += chr * 4096;
                difficulty_number += hash[indx + 1] * 16;
                difficulty_number += Math.floor(hash[indx + 2] / 16);
                return {
                    leadingZeros: BigInt(leadingZeros),
                    difficulty_number: BigInt(difficulty_number),
                };
            } else {
                difficulty_number += chr * 256;
                difficulty_number += hash[indx + 1];
                return {
                    leadingZeros: BigInt(leadingZeros),
                    difficulty_number: BigInt(difficulty_number),
                };
            }
        } else {
            leadingZeros += 2;
        }
    }
    return { leadingZeros: BigInt( 32 ), difficulty_number: BigInt( 0 ) };
}

export function incrementU8Array( x: Uint8Array ): void
{
    if( x[0] === 255 ) 
    {
        crypto.getRandomValues( x );
        return;
    }
    for (let i = 0; i < x.length; i++) {
        if (x[i] === 255) {
            x[i] = 0;
        } else {
            x[i] += 1;
            break;
        }
    }
}

export function calculateInterlink(
    currentHash: Uint8Array,
    a: { leadingZeros: bigint; difficulty_number: bigint },
    b: { leadingZeros: bigint; difficulty_number: bigint },
    currentInterlink: Uint8Array[],
  ): Uint8Array[] {
    let b_half = halfDifficultyNumber(b);
  
    const interlink: Uint8Array[] = currentInterlink;
  
    let currentIndex = 0;
  
    while (
        b_half.leadingZeros < a.leadingZeros ||
        (
            b_half.leadingZeros == a.leadingZeros &&
            b_half.difficulty_number > a.difficulty_number
        )
    ) {
        if (currentIndex < interlink.length) {
            interlink[currentIndex] = currentHash;
        } else {
            interlink.push(currentHash);
        }
    
        b_half = halfDifficultyNumber(b_half);
        currentIndex += 1;
    }
  
    return interlink;
}

export function halfDifficultyNumber(
    a: { leadingZeros: bigint; difficulty_number: bigint }
): { leadingZeros: bigint; difficulty_number: bigint }
{
    const new_a = a.difficulty_number / BigInt(2);
    if (new_a < BigInt(4096)) {
        return {
            leadingZeros: a.leadingZeros + BigInt(1),
            difficulty_number: new_a * BigInt(16),
        };
    } else {
        return {
            leadingZeros: a.leadingZeros,
            difficulty_number: new_a,
        };
    }
}

export function getDifficultyAdjustement(
  total_epoch_time: bigint,
  epoch_target: bigint,
): { numerator: bigint; denominator: bigint } {
    if (
        epoch_target / total_epoch_time >= 4 && epoch_target % total_epoch_time > 0
    ) {
        return { numerator: BigInt( 1 ), denominator: BigInt( 4 ) };
    } else if (
        total_epoch_time / epoch_target >= 4 && total_epoch_time % epoch_target > 0
    ) {
        return { numerator: BigInt( 4 ), denominator: BigInt( 1 ) };
    } else {
        return { numerator: total_epoch_time, denominator: epoch_target };
    }
}

export function calculateDifficultyNumber(
    a: { leadingZeros: bigint; difficulty_number: bigint },
    numerator: bigint,
    denominator: bigint,
  ): { leadingZeros: bigint; difficulty_number: bigint } {
    
    const n16 = BigInt(16);
    const n62 = BigInt(62);
    const n4096 = BigInt(4096);
    const n0 = BigInt(0);
    const n65536 = BigInt(65536);
    const n65535 = BigInt(65535);

    const new_padded_difficulty = a.difficulty_number * n16 * numerator /
    denominator;

    const new_difficulty = new_padded_difficulty / n16;

    if (new_padded_difficulty / n65536 == n0) {
        if (a.leadingZeros >= 62) {
            return { difficulty_number: n4096, leadingZeros: n62 };
        } else {
            return {
            difficulty_number: new_padded_difficulty,
            leadingZeros: a.leadingZeros + BigInt( 1 ),
            };
        }   
    } else if (new_difficulty / n65536 > n0) {
        if (a.leadingZeros <= 2) {
            return { difficulty_number: n65535, leadingZeros: BigInt(2) };
        } else {
            return {
            difficulty_number: new_difficulty / n16,
            leadingZeros: a.leadingZeros - BigInt(1),
            };
        }
        } else {
        return {
            difficulty_number: new_difficulty,
            leadingZeros: a.leadingZeros,
        };
    }
}  