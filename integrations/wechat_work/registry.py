"""PostgreSQL persistence for WeChat Work org config and user bindings."""

from __future__ import annotations

from integrations.wechat_work.config import WeChatWorkOrgConfig
from memory_layer.knowledge_base.core.db.postgres import pg_conn


def _mask_secret(secret: str) -> str:
    if not secret:
        return ""
    if len(secret) <= 4:
        return "****"
    return secret[:2] + "****" + secret[-2:]


class WeChatWorkRegistry:
    def get_org_config(self, org_id: str) -> WeChatWorkOrgConfig | None:
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT org_id, corp_id, agent_id, secret, token, encoding_aes_key, enabled
                FROM wechat_work_org_config
                WHERE org_id = %s
                """,
                (org_id,),
            ).fetchone()
        if not row:
            return None
        return WeChatWorkOrgConfig(
            org_id=row[0],
            corp_id=row[1],
            agent_id=row[2],
            secret=row[3],
            token=row[4],
            encoding_aes_key=row[5],
            enabled=bool(row[6]),
        )

    def get_org_config_public(self, org_id: str) -> dict | None:
        cfg = self.get_org_config(org_id)
        if not cfg:
            return None
        return {
            "org_id": cfg.org_id,
            "corp_id": cfg.corp_id,
            "agent_id": cfg.agent_id,
            "secret": _mask_secret(cfg.secret),
            "token": cfg.token,
            "encoding_aes_key": _mask_secret(cfg.encoding_aes_key),
            "enabled": cfg.enabled,
        }

    def upsert_org_config(
        self,
        org_id: str,
        corp_id: str,
        agent_id: str,
        secret: str,
        token: str,
        encoding_aes_key: str,
        enabled: bool,
    ) -> None:
        with pg_conn() as conn:
            conn.execute(
                """
                INSERT INTO wechat_work_org_config (
                    org_id, corp_id, agent_id, secret, token, encoding_aes_key, enabled
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (org_id) DO UPDATE SET
                    corp_id = EXCLUDED.corp_id,
                    agent_id = EXCLUDED.agent_id,
                    secret = EXCLUDED.secret,
                    token = EXCLUDED.token,
                    encoding_aes_key = EXCLUDED.encoding_aes_key,
                    enabled = EXCLUDED.enabled,
                    updated_at = NOW()
                """,
                (org_id, corp_id, agent_id, secret, token, encoding_aes_key, enabled),
            )
            conn.commit()

    def resolve_platform_user_id(self, org_id: str, wechat_userid: str) -> str | None:
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT platform_user_id FROM wechat_work_user_bindings
                WHERE org_id = %s AND wechat_userid = %s
                """,
                (org_id, wechat_userid),
            ).fetchone()
        return row[0] if row else None

    def bind_user(
        self,
        org_id: str,
        platform_user_id: str,
        wechat_userid: str,
        wechat_name: str | None = None,
    ) -> int:
        with pg_conn() as conn:
            row = conn.execute(
                """
                INSERT INTO wechat_work_user_bindings
                    (org_id, platform_user_id, wechat_userid, wechat_name)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (org_id, platform_user_id) DO UPDATE SET
                    wechat_userid = EXCLUDED.wechat_userid,
                    wechat_name = EXCLUDED.wechat_name,
                    bound_at = NOW()
                RETURNING id
                """,
                (org_id, platform_user_id, wechat_userid, wechat_name),
            ).fetchone()
            conn.commit()
        return int(row[0])

    def unbind_user(self, org_id: str, binding_id: int) -> bool:
        with pg_conn() as conn:
            cur = conn.execute(
                """
                DELETE FROM wechat_work_user_bindings
                WHERE org_id = %s AND id = %s
                """,
                (org_id, binding_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def list_bindings(self, org_id: str) -> list[dict]:
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT id, org_id, platform_user_id, wechat_userid, wechat_name,
                       bound_at::text
                FROM wechat_work_user_bindings
                WHERE org_id = %s
                ORDER BY bound_at DESC
                """,
                (org_id,),
            ).fetchall()
        return [
            {
                "id": r[0],
                "org_id": r[1],
                "platform_user_id": r[2],
                "wechat_userid": r[3],
                "wechat_name": r[4],
                "bound_at": r[5],
            }
            for r in rows
        ]
