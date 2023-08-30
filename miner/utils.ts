
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