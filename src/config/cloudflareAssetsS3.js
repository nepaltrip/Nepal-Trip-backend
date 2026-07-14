const { S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config();

const assetsS3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ASSETS_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ASSETS_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_ASSETS_SECRET_ACCESS_KEY,
    },
});

module.exports = assetsS3Client;