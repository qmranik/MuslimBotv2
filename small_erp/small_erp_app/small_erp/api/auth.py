import frappe
from frappe.auth import check_password
from frappe.rate_limiter import rate_limit


def _enforce_tls():
    """Reject non-HTTPS credential exchange when the site opts in.

    Enable in production via site_config: {"enforce_tls_login": 1}. Left off in
    dev so http://small.localhost keeps working. See MUSLIMBOT_PRODUCTION_PLAN W7.
    """
    if not frappe.conf.get("enforce_tls_login"):
        return
    proto = frappe.get_request_header("X-Forwarded-Proto")
    if not proto and getattr(frappe.local, "request", None) is not None:
        proto = frappe.local.request.scheme
    if proto != "https":
        frappe.throw("A secure (HTTPS) connection is required.", frappe.PermissionError)


def _audit(event, usr, success, note=""):
    """Structured auth audit trail (queryable via the muslimbot_auth logger)."""
    try:
        ip = getattr(frappe.local, "request_ip", None)
        frappe.logger("muslimbot_auth", allow_site=True).info(
            {"event": event, "usr": usr, "success": success, "ip": ip, "note": note}
        )
    except Exception:
        pass


@frappe.whitelist(allow_guest=True)
@rate_limit(key="usr", limit=8, seconds=60)
def login_to_get_keys(usr, pwd):
    """Authenticate with username/email + password and return API key/secret.

    Hardened (MUSLIMBOT_PRODUCTION_PLAN W1.2): TLS-only when enforced,
    rate-limited (8/min per usr), and audited. This flow is a bridge until
    OAuth2/PKCE against Authentik lands; the returned secret is long-lived, so
    keep it TLS-only and prefer `revoke_keys` on device loss.
    """
    _enforce_tls()

    try:
        check_password(usr, pwd)
    except frappe.AuthenticationError:
        _audit("login", usr, False, "bad credentials")
        frappe.throw("Invalid login credentials", frappe.AuthenticationError)

    # Resolve user if usr was an email
    user_id = usr
    if not frappe.db.exists("User", usr):
        user_id = frappe.db.get_value("User", {"email": usr}, "name")
        if not user_id:
            _audit("login", usr, False, "no such user")
            frappe.throw("Invalid login credentials", frappe.AuthenticationError)

    user_doc = frappe.get_doc("User", user_id)

    # Ensure api_key exists
    if not user_doc.api_key:
        user_doc.api_key = frappe.generate_hash(length=15)
        user_doc.save(ignore_permissions=True)
        frappe.db.commit()

    # Ensure api_secret exists
    api_secret = user_doc.get_password("api_secret", raise_exception=False)
    if not api_secret:
        # Generate new keys (the secret is not retrievable if never set)
        from frappe.core.doctype.user.user import generate_keys

        # Temporarily set the session user to bypass "Guest" permission errors during key generation
        original_user = frappe.session.user
        frappe.set_user(user_doc.name)
        try:
            api_secret = generate_keys(user_doc.name)
        finally:
            frappe.set_user(original_user)
        user_doc.reload()
        frappe.db.commit()

    _audit("login", user_doc.name, True)
    return {
        "api_key": user_doc.api_key,
        "api_secret": api_secret,
        "username": user_doc.name,
        "full_name": user_doc.full_name,
    }


@frappe.whitelist()
def revoke_keys(user=None):
    """Revoke a user's API key/secret (e.g. on device loss).

    A user may revoke their own keys; System Managers may revoke anyone's.
    After revocation the next `login_to_get_keys` mints fresh credentials, so
    any leaked key is invalidated. See MUSLIMBOT_PRODUCTION_PLAN W1.2/W7.
    """
    target = user or frappe.session.user
    if target != frappe.session.user and "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted to revoke another user's keys.", frappe.PermissionError)

    user_doc = frappe.get_doc("User", target)
    user_doc.api_key = None
    user_doc.api_secret = None
    user_doc.save(ignore_permissions=True)
    frappe.db.commit()

    _audit("revoke_keys", target, True, f"by {frappe.session.user}")
    return {"status": "revoked", "user": target}
