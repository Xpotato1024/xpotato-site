import type { ExternalAiDisclosurePolicyProfile } from "../disclosure.js";

export const externalAiDisclosureProfileV1 = {
  schemaVersion: 1,
  id: "article-external-ai-disclosure-v1",
  providerNeutral: true,
  unknownDefault: "deny",
  classes: {
    public_anonymous_web_v1: {
      mode: "allow_exact",
      basis: "repository_policy",
      requiresExplicitAuthorization: false,
      hardDeny: false,
    },
    public_github_revision_v1: {
      mode: "allow_exact",
      basis: "repository_policy",
      requiresExplicitAuthorization: false,
      hardDeny: false,
    },
    article_job_brief_v1: {
      mode: "deny",
      basis: "user_authorized",
      requiresExplicitAuthorization: true,
      hardDeny: false,
    },
    user_note_or_log_v1: {
      mode: "deny",
      basis: "user_authorized",
      requiresExplicitAuthorization: true,
      hardDeny: false,
    },
    private_repository_or_document_v1: {
      mode: "deny",
      basis: "user_authorized",
      requiresExplicitAuthorization: true,
      hardDeny: false,
    },
    raw_user_image_v1: {
      mode: "deny",
      basis: "user_authorized",
      requiresExplicitAuthorization: true,
      hardDeny: false,
    },
    approved_publication_derivative_v1: {
      mode: "allow_exact",
      basis: "repository_policy",
      requiresExplicitAuthorization: false,
      hardDeny: false,
    },
    secret_or_capability_material_v1: {
      mode: "deny",
      basis: "system_policy",
      requiresExplicitAuthorization: false,
      hardDeny: true,
    },
    unknown_v1: {
      mode: "deny",
      basis: "system_policy",
      requiresExplicitAuthorization: false,
      hardDeny: false,
    },
  },
  hardDenyKinds: [
    "api_token",
    "password",
    "private_key",
    "session_cookie",
    "authorization_header",
    "mfa_code",
    "recovery_code",
    "signed_capability_url",
    "decrypted_secret_store",
  ],
} as const satisfies ExternalAiDisclosurePolicyProfile;
