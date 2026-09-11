"""Bedrock satellite: cross-account STS assume-role + Bedrock invoke.

Reimplemented fresh here (NOT imported from AA-CIS-App) per tech.md — it
is a small, well-understood pattern: assume a cross-account role that is
trusted to call Bedrock, then invoke the model with those temporary
credentials.

Account strategy: try the primary account (acc3, 786888028788) first;
if assuming its role fails (auth/permission/availability), fall back to
acc1 (867490540162). Both roles are added as trusted principals via
Terraform in AA-CIS-Infra (human-applied) — this module does not create
any trust; it only consumes it.

Testability: all AWS access goes through an injectable client factory
(`ClientFactory`). Unit tests pass a stub factory so no live AWS call is
made. Nothing here reads AWS access keys — credentials come from the
Lambda execution role's ambient chain (IAM role only).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Iterator, Optional, Protocol

from backend import config


class BedrockError(RuntimeError):
    """Raised when both primary and fallback accounts fail."""


class _StsClient(Protocol):
    def assume_role(self, *, RoleArn: str, RoleSessionName: str) -> dict: ...


class _BedrockClient(Protocol):
    def invoke_model(self, *, modelId: str, body: str, **kwargs: Any) -> dict: ...
    def invoke_model_with_response_stream(
        self, *, modelId: str, body: str, **kwargs: Any
    ) -> dict: ...


@dataclass
class Credentials:
    access_key_id: str
    secret_access_key: str
    session_token: str

    @classmethod
    def from_sts_response(cls, resp: dict) -> "Credentials":
        c = resp["Credentials"]
        return cls(
            access_key_id=c["AccessKeyId"],
            secret_access_key=c["SecretAccessKey"],
            session_token=c["SessionToken"],
        )


# A factory that, given a service name and (optional) credentials, returns
# a client. In production this wraps boto3.client; in tests it's a stub.
ClientFactory = Callable[..., Any]


def _default_client_factory(service: str, *, creds: Optional[Credentials] = None,
                            region: Optional[str] = None) -> Any:
    import boto3  # imported lazily so tests never need boto3 installed

    kwargs: dict[str, Any] = {"region_name": region or config.BEDROCK_REGION}
    if creds is not None:
        kwargs.update(
            aws_access_key_id=creds.access_key_id,
            aws_secret_access_key=creds.secret_access_key,
            aws_session_token=creds.session_token,
        )
    return boto3.client(service, **kwargs)


def _role_arn(account_id: str) -> str:
    role = config.BEDROCK_ROLE_NAME
    if not role:
        raise BedrockError(
            "BEDROCK_ROLE_NAME is not configured — cannot assume a "
            "cross-account Bedrock role."
        )
    return f"arn:aws:iam::{account_id}:role/{role}"


def _assume(account_id: str, client_factory: ClientFactory) -> Credentials:
    sts: _StsClient = client_factory("sts")
    resp = sts.assume_role(
        RoleArn=_role_arn(account_id),
        RoleSessionName="tripplanner-bedrock",
    )
    return Credentials.from_sts_response(resp)


def _bedrock_for_account(account_id: str, client_factory: ClientFactory) -> _BedrockClient:
    creds = _assume(account_id, client_factory)
    return client_factory("bedrock-runtime", creds=creds, region=config.BEDROCK_REGION)


def _with_failover(
    op: Callable[[_BedrockClient], Any],
    client_factory: ClientFactory,
) -> Any:
    """Run `op` against primary account; on failure, retry against fallback."""
    accounts = [config.BEDROCK_ACCT_PRIMARY, config.BEDROCK_ACCT_FALLBACK]
    last_err: Optional[Exception] = None
    for acct in accounts:
        try:
            client = _bedrock_for_account(acct, client_factory)
            return op(client)
        except Exception as e:  # noqa: BLE001 — deliberately broad, we failover
            last_err = e
            continue
    raise BedrockError(
        f"Bedrock invoke failed on both {accounts[0]} and {accounts[1]}: {last_err}"
    ) from last_err


def invoke(
    model_id: str,
    body: dict,
    *,
    client_factory: ClientFactory = _default_client_factory,
) -> dict:
    """Invoke a Bedrock model and return the parsed JSON response body."""

    def op(client: _BedrockClient) -> dict:
        resp = client.invoke_model(modelId=model_id, body=json.dumps(body))
        raw = resp["body"].read() if hasattr(resp["body"], "read") else resp["body"]
        return json.loads(raw)

    return _with_failover(op, client_factory)


def invoke_stream(
    model_id: str,
    body: dict,
    *,
    client_factory: ClientFactory = _default_client_factory,
) -> Iterator[dict]:
    """Invoke with response streaming; yields parsed chunk dicts.

    Materializes the stream inside the failover boundary so that a failure
    to establish the stream triggers fallback, but iteration itself is
    lazy to the caller.
    """

    def op(client: _BedrockClient) -> list[dict]:
        resp = client.invoke_model_with_response_stream(
            modelId=model_id, body=json.dumps(body)
        )
        chunks: list[dict] = []
        for event in resp["body"]:
            payload = event.get("chunk", {}).get("bytes")
            if payload is None:
                continue
            chunks.append(json.loads(payload))
        return chunks

    for chunk in _with_failover(op, client_factory):
        yield chunk


def embed(
    text: str,
    *,
    model_id: Optional[str] = None,
    client_factory: ClientFactory = _default_client_factory,
) -> list[float]:
    """Return an embedding vector for `text` (Titan-style response shape)."""
    model = model_id or config.BEDROCK_MODEL_EMBED
    resp = invoke(model, {"inputText": text}, client_factory=client_factory)
    vec = resp.get("embedding")
    if not isinstance(vec, list):
        raise BedrockError(f"Unexpected embedding response shape: {list(resp)[:5]}")
    return vec
