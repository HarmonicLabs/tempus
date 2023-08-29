import { createInteractionContext } from '@cardano-ogmios/client'
import { OGMIOS_URL } from '../env';

export const createContext = () => createInteractionContext(
    err => console.error(err),
    () => console.log("Connection closed."),
    {
        connection: {
            host: OGMIOS_URL,
            port: 1337
        }
    }
);