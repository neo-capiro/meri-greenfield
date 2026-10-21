#!/usr/bin/env node
/** The schema migrations provision-postgres.sh applies to its throwaway databases: the conversation, gateway budget and artifact
 * migrations of the deployed migration plan (infra/product-preview/first-chat-migrate.mjs PLAN), in plan order, each byte-checked
 * against its pin (loadPlan). Derived, never listed by hand, so the local schema cannot drift from what deploys apply. Plan entries
 * outside these families (grant phases, the budget seed, other owners' tables) are not schema the local fixtures build on.
 * Prints one repository-relative path per line; performs no connection. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPlan} from '../../../infra/product-preview/first-chat-migrate.mjs';

export const FAMILIES=Object.freeze(['apps/control/conversations/migrations/','apps/gateway/budget/migrations/','apps/artifacts/migrations/']);
export const planMigrations=(plan=loadPlan())=>plan.filter(e=>e.kind==='migration'&&FAMILIES.some(f=>e.path.startsWith(f))).map(e=>e.path);

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.stdout.write(planMigrations().join('\n')+'\n');
