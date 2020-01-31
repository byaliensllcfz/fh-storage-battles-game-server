'use strict';

const fs = require('fs');

const kubernetesEnv = process.env.KUBERNETES_ENV;
const envPath = `configs/${kubernetesEnv}/.env`;

try {
    if (fs.existsSync(envPath)) {
        /* eslint-disable-next-line */
        console.log(`- Using environment variables from ${envPath}`);
        require('dotenv').config({ path: envPath });
    }
    else {
        /* eslint-disable-next-line */
        console.log(`- Cant find .env from ${envPath} - is KUBERNETES_ENV set?`);
        process.exit(1);
    }
} catch(err) {
    /* eslint-disable-next-line */
    console.log(`- ERROR ${err} Finding file: ${envPath}`);
    process.exit(1);
}