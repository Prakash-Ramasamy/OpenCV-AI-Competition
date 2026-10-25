# ECS authentication requirements

The backend uses two independent authentication paths:

- S3 JSON storage uses Boto3's standard credential chain. In ECS, assign a dedicated application `taskRoleArn` to the task definition revision. Grant that task role only the required `s3:GetObject`, `s3:PutObject`, and (for document listing) `s3:ListBucket` permissions for the configured bucket and prefixes. This repository does not create or modify the role.
- Bedrock Gemma validation uses the `AWS_BEARER_TOKEN_BEDROCK` API key. Store the key in AWS Secrets Manager and inject it through the backend container's ECS `secrets` configuration. The ECS task execution role needs `secretsmanager:GetSecretValue` (and `kms:Decrypt` when a customer-managed KMS key is used) for that specific secret.

Do not set `AWS_PROFILE`, mount `~/.aws`, mount an AWS CLI login cache, or place long-lived AWS access keys in the image. The current task definition's `taskRoleArn: null` must be replaced with the dedicated application role before ECS deployment.

For local development, `AUDITVISION_STORAGE_BACKEND=local` requires no AWS credentials. Set it to `s3` only for an intentional S3 integration test with valid standard-chain credentials; a failed S3 credential lookup is reported as an error and is not silently redirected to local storage.
