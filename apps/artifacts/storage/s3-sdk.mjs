/** The upstream S3 SDK classes this package pins (package.json), resolved from this package's own install.
 * Callers that construct the borrowed client or recognize its commands import them here, so one SDK copy serves
 * the adapter and its callers in a clean checkout and in the image. Credential selection stays with the caller. */
export {S3Client,GetBucketVersioningCommand,PutObjectCommand,HeadObjectCommand,GetObjectCommand,ListObjectVersionsCommand} from '@aws-sdk/client-s3';
