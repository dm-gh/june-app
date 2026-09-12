import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import { Tag } from "../domain.js"
import { Authentication } from "./auth.js"

/** Tags have no life of their own: this lists the distinct Tags on the User's Transactions, for suggestions. */
export class TagsGroup extends HttpApiGroup.make("tags")
  .add(HttpApiEndpoint.get("list", "/tags").addSuccess(Schema.Array(Tag)))
  .middleware(Authentication) {}
