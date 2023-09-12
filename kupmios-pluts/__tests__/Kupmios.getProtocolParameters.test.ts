import { config } from "dotenv"
import { KupmiosPluts } from "../KupmiosPluts";
import { isPartialProtocolParameters, isProtocolParameters } from "@harmoniclabs/plu-ts";

// config();

test.skip("Kupmios.getProtocolParameters", async () => {

    const kupmios = new KupmiosPluts(
        process.env.KUPO_URL ?? "" ,
        process.env.OGMIOS_URL ?? ""
    );

    const pps = await kupmios.getProtocolParameters();

    expect( isPartialProtocolParameters( pps ) ).toBe( true );
    expect( isProtocolParameters( pps ) ).toBe( true );

    kupmios.close();
})