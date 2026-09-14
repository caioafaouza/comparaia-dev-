
const Minio = require('minio');
require('dotenv').config();

const config = {
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
};

console.log('--- Testing MinIO Connection ---');
console.log('Config:', { ...config, secretKey: '***' });

if (!config.endPoint) {
    console.error('FAIL: MINIO_ENDPOINT is missing');
    process.exit(1);
}

const minioClient = new Minio.Client(config);

(async () => {
    try {
        console.log('Listing buckets...');
        const buckets = await minioClient.listBuckets();
        console.log('PASS: Connection successful. Buckets found:', buckets.length);

        buckets.forEach(b => console.log(' - ' + b.name));

        const bucketName = process.env.MINIO_BUCKET || 'default';
        const exists = await minioClient.bucketExists(bucketName);
        if (exists) {
            console.log(`PASS: Bucket '${bucketName}' exists.`);
        } else {
            console.warn(`WARN: Bucket '${bucketName}' does not exist.`);
        }
    } catch (err) {
        console.error('FAIL: MinIO Error:', err);
        process.exit(1);
    }
})();
