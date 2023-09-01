export function isValidPath( str: string ): boolean
{
    if(!(typeof str === "string")) return false;
    if( str.length === 0 ) return false;

    return /^(\.(\/|\\)|\.\.(\/|\\))*([\w\.]*(\/|\\)*)*$/.test(str);
}