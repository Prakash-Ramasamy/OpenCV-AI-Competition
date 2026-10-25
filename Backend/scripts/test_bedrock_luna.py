"""One-request smoke test for Gemma 4 E2B through Amazon Bedrock Mantle.

This remains isolated from the FastAPI application and OpenCV pipeline. The
bearer token is read only from AWS_BEARER_TOKEN_BEDROCK and is never printed.
"""

from __future__ import annotations

import os
import sys

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI


BASE_URL = "https://bedrock-mantle.us-east-1.api.aws/openai/v1"
MODEL = "google.gemma-4-e2b"


def _safe_error_message(error: Exception) -> str:
    message = getattr(error, "message", None)
    return str(message or error)


def main() -> int:
    bearer_token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
    if not bearer_token:
        print("Request failed: AWS_BEARER_TOKEN_BEDROCK was not provided.")
        return 2

    client = OpenAI(
        api_key=bearer_token,
        base_url=BASE_URL,
        max_retries=0,
        timeout=60.0,
    )
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": "Hello! Introduce yourself briefly."}],
        )
    except APIStatusError as error:
        print(f"Request failed (HTTP {error.status_code}): {_safe_error_message(error)}")
        return 1
    except (APIConnectionError, APITimeoutError) as error:
        print(f"Request failed (connection/timeout): {_safe_error_message(error)}")
        return 1
    except Exception as error:
        print(f"Request failed: {_safe_error_message(error)}")
        return 1

    content = response.choices[0].message.content or ""
    print(f"Model: {MODEL}")
    print("Request successful: yes")
    print(f"Response: {content.strip()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
