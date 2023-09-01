import { isValidPath } from "..";

test("not string", () => {

    expect( isValidPath( 2 as any ) ).toBe( false );
    expect( isValidPath( {} as any ) ).toBe( false );
    expect( isValidPath( true as any ) ).toBe( false );
    expect( isValidPath( 2n as any ) ).toBe( false );
    expect( isValidPath( null as any ) ).toBe( false );
    expect( isValidPath( undefined as any ) ).toBe( false );
    expect( isValidPath( NaN as any ) ).toBe( false );

})

test("", () => {

    expect( isValidPath( "" ) ).toBe( false );

});

test(".", () => {

    expect( isValidPath( "." ) ).toBe( true );
    expect( isValidPath( ".." ) ).toBe( true );
    expect( isValidPath( "..." ) ).toBe( true );

});

test("hello", () => {
    
    expect( isValidPath( "hello" ) ).toBe( true );
    expect( isValidPath( "hello.txt" ) ).toBe( true );
    expect( isValidPath( ".hello" ) ).toBe( true );
    expect( isValidPath( "./hello" ) ).toBe( true );
    expect( isValidPath( "./hello.txt" ) ).toBe( true );
    expect( isValidPath( "../hello" ) ).toBe( true );
    expect( isValidPath( "../hello.txt" ) ).toBe( true );
    expect( isValidPath( "../hello.js" ) ).toBe( true );
    expect( isValidPath( "../hello.test.js" ) ).toBe( true );
    
});

test("folder", () => {

    expect( isValidPath( "../path/to/hello.test.js" ) ).toBe( true );

});

test("aNy CaSe", () => {

    expect( isValidPath( "../paTh/tO/heLlo.TESt.jS" ) ).toBe( true );

});

test("w1th numb3r5", () => {

    expect( isValidPath( "../paTh/t0/h3Ll0.T35t.j5" ) ).toBe( true );

});

test("spaces", () => {
    
    expect( isValidPath( "../hello.test .js" ) ).toBe( false );
    expect( isValidPath( ". ./hello.test.js" ) ).toBe( false );
    
});

test("windows", () => {
    
    expect( isValidPath( "hello" ) ).toBe( true );
    expect( isValidPath( "hello.txt" ) ).toBe( true );
    expect( isValidPath( ".hello" ) ).toBe( true );
    expect( isValidPath( ".\\hello" ) ).toBe( true );
    expect( isValidPath( ".\\hello.txt" ) ).toBe( true );
    expect( isValidPath( "..\\hello" ) ).toBe( true );
    expect( isValidPath( "..\\hello.txt" ) ).toBe( true );
    expect( isValidPath( "..\\hello.js" ) ).toBe( true );
    expect( isValidPath( "..\\hello.test.js" ) ).toBe( true );
    
});

test("_", () => {

    expect( isValidPath( "./hello_there.test.js" ) ).toBe( true );
    expect( isValidPath( "./secret_testnet/payment1.skey" ) ).toBe( true );

})