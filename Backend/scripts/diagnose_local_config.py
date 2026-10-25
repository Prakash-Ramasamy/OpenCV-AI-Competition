"""Print a deliberately sanitized local Docker configuration diagnostic."""

from __future__ import annotations

import os


def enabled(name: str) -> bool:
    return os.getenv(name, "false").lower() in {"1", "true", "yes", "on"}


def main() -> int:
    print(f"Bedrock token present: {'yes' if bool(os.getenv('AWS_BEARER_TOKEN_BEDROCK')) else 'no'}")
    print(f"AI validation enabled: {'yes' if enabled('AUDITVISION_AI_VALIDATION_ENABLED') else 'no'}")
    print(f"AI model: {os.getenv('AUDITVISION_AI_MODEL', 'google.gemma-4-e2b')}")
    print(f"Storage backend: {os.getenv('AUDITVISION_STORAGE_BACKEND', 'local')}")
    print(f"S3 bucket: {os.getenv('AUDITVISION_S3_BUCKET', '(not configured)')}")
    print(f"S3 region: {os.getenv('AUDITVISION_S3_REGION', os.getenv('AWS_DEFAULT_REGION', 'us-east-1'))}")
    if os.getenv("AUDITVISION_STORAGE_BACKEND", "local").lower() == "s3":
        try:
            import boto3

            credentials = boto3.Session().get_credentials()
            print(f"AWS SDK credentials resolvable: {'yes' if credentials else 'no'}")
        except Exception as error:
            print(f"AWS SDK credentials resolvable: no ({type(error).__name__})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
