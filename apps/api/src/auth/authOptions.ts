import type { BetterAuthOptions } from "better-auth"
import { PostgresDialect } from "kysely"
import type { Pool } from "pg"

export interface AuthSettings {
  readonly pool: Pool
  /** Public origin of the app, e.g. https://june.example.com. Same origin serves web and api. */
  readonly baseURL: string
  /** Better Auth's signing secret. */
  readonly secret: string
  readonly google: { readonly clientId: string; readonly clientSecret: string }
  /** Runs after a User row exists; June creates the Capture Token here. */
  readonly onUserCreated?: (userId: string) => Promise<void>
}

/**
 * Better Auth configuration for June. See docs/mvp-scope.md, "Auth".
 *
 * Better Auth's `user` table is the User. June's own profile fields live on it as
 * additional fields, and every domain table's user_id references it. Table and column
 * names are snake_case, ids are uuids, and `account` is renamed `oauth_account` so the
 * bare word never appears in the schema (CONTEXT.md).
 *
 * The schema Better Auth expects is generated from this object into June's own
 * migrations (apps/api/src/migrations); Better Auth never migrates on its own.
 */
export const authOptions = (settings: AuthSettings) =>
  ({
  appName: "June",
  baseURL: settings.baseURL,
  basePath: "/api/auth",
  secret: settings.secret,
  database: {
    dialect: new PostgresDialect({ pool: settings.pool }),
    type: "postgres"
  },
  advanced: {
    database: { generateId: "uuid" }
  },
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: settings.google.clientId,
      clientSecret: settings.google.clientSecret
    }
  },
  // Better Auth names columns in camelCase; June's schema is snake_case, so every column is mapped.
  user: {
    fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" },
    additionalFields: {
      defaultCurrency: {
        type: "string",
        fieldName: "default_currency",
        required: false,
        defaultValue: "USD",
        input: false
      }
    }
  },
  session: {
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  account: {
    modelName: "oauth_account",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  verification: {
    fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" }
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await settings.onUserCreated?.(user.id)
        }
      }
    }
  }
}) satisfies BetterAuthOptions
