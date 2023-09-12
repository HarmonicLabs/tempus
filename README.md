<div align="center">
  <img src="./assets/tempus-high-resolution-color-only_logo-transparent-background.svg" alt="Tempus Logo" height="200" />
  <hr />
    <h2 align="center" style="border-bottom: none"><a href="https://github.com/aiken-lang/fortuna" >Fortuna</a>-style token on Cardano written in <a href="https://github.com/HarmonicLabs/plu-ts">plu-ts</a></h2>

[![Licence](https://img.shields.io/github/license/HarmonicLabs/tempus)](https://github.com/aiken-lang/fortuna/blob/main/LICENSE)
  <hr/>
</div>

# !!! **IMPORTANT** !!!

this project is currenly only deployed to the preview testnet

### THERE IS NO MAINNET TOKEN

**THE POLICY WILL CHANGE ONCE DEPLOYED ON MAINNET**

Mainnet deployment will occur with the next stable version of [plu-ts](https://github.com/HarmonicLabs/plu-ts)(v0.6; latest version is: 0.5.5)


# Run a miner

## Requirements

- [NodeJS](https://nodejs.org/en)
> version 18 or greater
- [Kupo](https://cardanosolutions.github.io/kupo/)
> You can easily get access to Kupo and Ogmios with
> [Demeter](https://demeter.run). Once you have a project in Demeter you can
> connect Ogmios and Kupo extensions for mainnet. Make sure to toggle
> `Expose http port` in each extensions' settings.
- [Blockfrost](https://blockfrost.io/)
> You can use the free plan; calls to the blockfrost API are minimal

## Configuration file

The basic congiguration file that you will find [`./miner.config.json`](./miner.config.json) in this repository should look like this:

```json
{
    "network": "preview",
    "blockfrost_api_key": "",
    "kupo_url": "https://",
    "path_to_miner_private_key": "./minerPrivateKey.local.json",
    "change_address": null
}
```

We **strongly** suggest you create a copy of the file in the same directory named `miner.config.local.json` to avoid sharing your kupo url and blockfrost API key by mistake.

> the `.gitignore` file in this repository will ignore anything that matches the `*.local*` expression.

Then modify the new `./miner.config.local.json` as follows:

### `network`

accepted values are either `"preview"` or `"mainnet"`;
however this project has not been deployed on mainnet yet; so you should leave the `network` option with the value `"preview"`;

```json
{
    "network": "preview"
}
```

### `blockfrost_api_key`

specify the blockfrost API key to use to execute API calls to the blockfrost service.

you can get a blockfrost API key by logging in in their platform and creating a new project (remember to select the same network you are working in).

### `kupo_url`

The url to use to execute API calls to a kupo service.

### `path_to_miner_private_key`

the path to a json file that contains the private key used by the miner to automatically sign transactions.

the file is expected to be in `cardano-cli` format (aka. it must specify a `cborHex` field with the CBOR of the private key as value (as hexadecimal string)).

if you do no have already a private key you can use the command `npm run genPrivateKey` to generate one

```
npm run genPrivateKey [network [path]]
```

by default it will generate a private key for the `"preview"` testnet at the path `./minerPrivateKey.local.json`.

running `npm run genPrivateKey` should print to the console something like this:

```
generated a private key!!!
remember to found the following address so that the miner can operate properly:
addr_test1vrk7v5djmt3njdejsdpwuwn66qnw79wjyn9qj40er6kg3eg993lfr
```

### `change_address`

Optionally, you can choose to send the rewards of mining to a different address than the miner.

if you want you can do so by specifying a valid cardano address for the operating network as the `change_address` field.

if no address is specified the one of the miner will be used.

## Running

to run the miner you just need to run `npm run mine`

```
npm run mine [ path_to_config ]
```

optionally you can specify a path to a configuration file for the miner;

during setup; the miner looks for configurations between the follwing values in the order that is reported here:

- `process.argv[2]`
- `"./miner.config.local.json"`
- `"./miner.local.config.json"`
- `"./miner.config.json"`

if all fail the miner throws an error and terminates the program.