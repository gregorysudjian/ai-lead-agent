import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type { DemoShare } from "@/lib/demo-share";

import type { DemoShareTableGateway } from "./share-gateway";
import { demoShareToRow, rowToDemoShare } from "./share-mapping";
import { SupabaseDemoShareTableGateway } from "./share-table";
import {
  DemoShareRepositoryError,
  type CreateShareInput,
  type DemoShareRepository,
} from "./share-types";

/**
 * How much entropy a share token carries.
 *
 * 32 bytes from the platform CSPRNG, base64url-encoded to 43 characters. This
 * is the ONLY thing standing between a stranger and a demo carrying a named
 * business, so it is sized to be unguessable rather than to be short --
 * `sharePath` keeps the prefix short instead.
 */
const TOKEN_BYTES = 32;

/**
 * Mint a token.
 *
 * `randomBytes` rather than `Math.random`, and generated HERE rather than
 * accepted from a caller: a token supplied by a route handler is a token an
 * attacker can propose. Nothing about it is derived from the demo id, so
 * holding one share of a demo tells you nothing about another.
 */
function mintToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Demo-share persistence, backed by whichever gateway is supplied.
 *
 * The rules live here rather than in the gateway, so both the Supabase and the
 * in-memory backing behave identically: tokens are minted server-side, revoke
 * is idempotent, and reads return a share in whatever state it is in.
 */
export function createDemoShareRepository(
  gateway: DemoShareTableGateway,
  options: { now?: () => Date } = {},
): DemoShareRepository {
  const now = options.now ?? (() => new Date());

  return {
    async create(input: CreateShareInput): Promise<DemoShare> {
      const share: DemoShare = {
        id: randomUUID(),
        demoId: input.demoId,
        token: mintToken(),
        createdAt: now().toISOString(),
        expiresAt: input.expiresAt,
        revokedAt: null,
        note: input.note,
      };

      try {
        await gateway.insertRow(demoShareToRow(share));
      } catch (error) {
        // Includes a unique-token collision, which at 32 bytes means something
        // is wrong with the generator rather than that we were unlucky. Failing
        // is right: silently retrying would hide it.
        throw new DemoShareRepositoryError("Could not create the share link.", { cause: error });
      }
      return share;
    },

    async findByToken(token: string): Promise<DemoShare | null> {
      try {
        const row = await gateway.findRowByToken(token);
        // Returned whatever its state. The caller decides what a visitor is
        // told, and every unusable state must present identically.
        return row === null ? null : rowToDemoShare(row);
      } catch (error) {
        throw new DemoShareRepositoryError("Could not read the share link.", { cause: error });
      }
    },

    async listForDemo(demoId: string): Promise<DemoShare[]> {
      try {
        const rows = await gateway.listRowsForDemo(demoId);
        return rows.map(rowToDemoShare);
      } catch (error) {
        throw new DemoShareRepositoryError("Could not read share links.", { cause: error });
      }
    },

    async revoke(id: string): Promise<DemoShare | null> {
      try {
        const existing = await gateway.findRowById(id);
        if (existing === null) return null;

        await gateway.markRevoked(id, now().toISOString());

        // Re-read rather than assuming: the gateway keeps an existing
        // `revoked_at` rather than overwriting it, so what is stored is the
        // authority on when the link actually stopped working.
        const updated = await gateway.findRowById(id);
        return updated === null ? null : rowToDemoShare(updated);
      } catch (error) {
        throw new DemoShareRepositoryError("Could not revoke the share link.", { cause: error });
      }
    },
  };
}

export function supabaseDemoShareRepository(): DemoShareRepository {
  return createDemoShareRepository(new SupabaseDemoShareTableGateway());
}
