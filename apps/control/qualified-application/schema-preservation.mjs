/** Metadata-only preservation of explicitly declared unrelated evidence namespaces. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {requireSchema,sha256} from './schema-contract.mjs';
export const namespaceSQL="SELECT nspname AS name,oid::pg_catalog.text AS oid,pg_catalog.pg_get_userbyid(nspowner) AS owner,nspacl::pg_catalog.text AS acl FROM pg_catalog.pg_namespace WHERE nspname NOT IN ('public','information_schema') AND left(nspname,3)<>'pg_' ORDER BY nspname";
const targets=['meri_qualification','meri_task_lookup'];
export function assertNamespaces(rows,fixture,prepared){
 const allowed=fixture.schemaScope?.namespaces??[],expected=[...allowed,...(prepared?targets.map(name=>({name,owner:fixture.user})):[])];
 requireSchema(rows.length===expected.length&&new Set(rows.map(r=>r.name)).size===rows.length);
 for(const e of expected){const r=rows.find(r=>r.name===e.name);requireSchema(r&&r.owner===e.owner&&(r.acl===null||typeof r.acl==='string'));if(fixture.schemaScope&&!targets.includes(e.name))requireSchema(typeof r.oid==='string'&&/^[1-9][0-9]{0,9}$/.test(r.oid)&&BigInt(r.oid)<=4294967295n);}
 return data(rows.filter(r=>!targets.includes(r.name)).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0));
}
// Only catalog metadata is read. No table rows, sequence last_value or function body.
// OIDs intentionally bind this database's exact metadata, not portable equivalence.
export const preservationSQL=`WITH ns AS (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname=ANY($1::pg_catalog.text[])),
 rel AS (SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace IN (SELECT oid FROM ns)),
 typ AS (SELECT t.* FROM pg_catalog.pg_type t WHERE t.typnamespace IN (SELECT oid FROM ns)),
 objects AS (
 SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::pg_catalog.oid AS classid,oid AS objid FROM rel UNION ALL
 SELECT 'pg_catalog.pg_type'::pg_catalog.regclass::pg_catalog.oid,oid FROM typ UNION ALL
 SELECT 'pg_catalog.pg_constraint'::pg_catalog.regclass::pg_catalog.oid,oid FROM pg_catalog.pg_constraint WHERE conrelid IN (SELECT oid FROM rel) UNION ALL
 SELECT 'pg_catalog.pg_attrdef'::pg_catalog.regclass::pg_catalog.oid,oid FROM pg_catalog.pg_attrdef WHERE adrelid IN (SELECT oid FROM rel) UNION ALL
 SELECT 'pg_catalog.pg_rewrite'::pg_catalog.regclass::pg_catalog.oid,oid FROM pg_catalog.pg_rewrite WHERE ev_class IN (SELECT oid FROM rel) UNION ALL
 SELECT 'pg_catalog.pg_trigger'::pg_catalog.regclass::pg_catalog.oid,oid FROM pg_catalog.pg_trigger WHERE tgrelid IN (SELECT oid FROM rel))
 SELECT
 (SELECT count(*)::pg_catalog.int4 FROM (
 SELECT oid FROM rel WHERE relkind NOT IN ('r','v','i','S') OR relispartition
 UNION ALL SELECT inhrelid FROM pg_catalog.pg_inherits WHERE inhrelid IN (SELECT oid FROM rel) OR inhparent IN (SELECT oid FROM rel)
 UNION ALL SELECT oid FROM typ t WHERE NOT ((t.typtype='c' AND t.typrelid IN (SELECT oid FROM rel WHERE relkind IN ('r','v'))) OR (t.typtype='b' AND t.typelem IN (SELECT oid FROM typ WHERE typtype='c' AND typrelid IN (SELECT oid FROM rel WHERE relkind IN ('r','v')))))
 UNION ALL SELECT d.objid FROM pg_catalog.pg_depend d WHERE d.refclassid='pg_catalog.pg_namespace'::pg_catalog.regclass AND d.refobjid IN (SELECT oid FROM ns) AND d.classid NOT IN ('pg_catalog.pg_class'::pg_catalog.regclass,'pg_catalog.pg_type'::pg_catalog.regclass,'pg_catalog.pg_constraint'::pg_catalog.regclass)
 UNION ALL SELECT oid FROM pg_catalog.pg_proc WHERE pronamespace IN (SELECT oid FROM ns)
 UNION ALL SELECT oid FROM pg_catalog.pg_extension WHERE extnamespace IN (SELECT oid FROM ns)
 UNION ALL SELECT d.objid FROM pg_catalog.pg_depend d JOIN objects o ON o.classid=d.classid AND o.objid=d.objid WHERE d.deptype='e'
 UNION ALL SELECT oid FROM pg_catalog.pg_policy WHERE polrelid IN (SELECT oid FROM rel)
 UNION ALL SELECT oid FROM pg_catalog.pg_trigger WHERE tgrelid IN (SELECT oid FROM rel) AND NOT tgisinternal
 UNION ALL SELECT w.oid FROM pg_catalog.pg_rewrite w JOIN rel ON rel.oid=w.ev_class WHERE rel.relkind<>'v' OR w.rulename<>'_RETURN'
 ) unsupported) AS unsupported,
 jsonb_build_object(
 'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY r.oid) FROM rel r),'[]'::pg_catalog.jsonb),
 'columns',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_catalog.pg_attribute a WHERE a.attrelid IN (SELECT oid FROM rel)),'[]'::pg_catalog.jsonb),
 'defaults',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_catalog.pg_attrdef d WHERE d.adrelid IN (SELECT oid FROM rel)),'[]'::pg_catalog.jsonb),
 'constraints',COALESCE((SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_catalog.pg_constraint k WHERE k.conrelid IN (SELECT oid FROM rel)),'[]'::pg_catalog.jsonb),
 'indexes',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.indexrelid) FROM pg_catalog.pg_index i WHERE i.indrelid IN (SELECT oid FROM rel)),'[]'::pg_catalog.jsonb),
 'views',COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.oid) FROM pg_catalog.pg_rewrite w WHERE w.ev_class IN (SELECT oid FROM rel)),'[]'::pg_catalog.jsonb),
 'types',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM typ t),'[]'::pg_catalog.jsonb),
 'sequences',COALESCE((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('seqstart',s.seqstart::pg_catalog.text,'seqincrement',s.seqincrement::pg_catalog.text,'seqmax',s.seqmax::pg_catalog.text,'seqmin',s.seqmin::pg_catalog.text,'seqcache',s.seqcache::pg_catalog.text) ORDER BY s.seqrelid) FROM pg_catalog.pg_sequence s WHERE s.seqrelid IN (SELECT oid FROM rel)),'[]'::pg_catalog.jsonb),
 'triggers',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t WHERE t.tgrelid IN (SELECT oid FROM rel)),'[]'::pg_catalog.jsonb),
 'dependencies',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype) FROM pg_catalog.pg_depend d JOIN objects o ON o.classid=d.classid AND o.objid=d.objid),'[]'::pg_catalog.jsonb),
 'comments',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classoid,d.objoid,d.objsubid) FROM pg_catalog.pg_description d WHERE EXISTS(SELECT 1 FROM objects o WHERE o.classid=d.classoid AND o.objid=d.objoid) OR (d.classoid='pg_catalog.pg_namespace'::pg_catalog.regclass AND d.objoid IN (SELECT oid FROM ns))),'[]'::pg_catalog.jsonb),
 'labels',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classoid,d.objoid,d.objsubid,d.provider) FROM pg_catalog.pg_seclabel d WHERE EXISTS(SELECT 1 FROM objects o WHERE o.classid=d.classoid AND o.objid=d.objoid) OR (d.classoid='pg_catalog.pg_namespace'::pg_catalog.regclass AND d.objoid IN (SELECT oid FROM ns))),'[]'::pg_catalog.jsonb)
 ) AS metadata`;
const metadataFields=['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'];
export async function preservationSnapshot(query,fixture,namespaces){
 if(!fixture.schemaScope)return null;
 const result=await query(preservationSQL,[fixture.schemaScope.namespaces.map(n=>n.name)]);
 requireSchema(result.length===1);const r=own(result[0],['unsupported','metadata']);
 if(r.unsupported!==0)throw Object.assign(Error('QUALIFICATION_SCHEMA_UNSUPPORTED_EVIDENCE_OBJECT'),{reason:'UNSUPPORTED_EVIDENCE_OBJECT'});
 const metadata=data(own(r.metadata,metadataFields));for(const k of metadataFields)requireSchema(Array.isArray(metadata[k]));
 return data({namespaceCount:namespaces.length,metadataSha256:sha256(JSON.stringify({namespaces,metadata})),coverage:'declared-namespace-catalog-metadata/1'});
}
export function compatibilityBinding(f,preservation){
 if(!f.schemaScope&&!Object.hasOwn(f,'serverAddress'))return {};
 return {fixtureCompatibility:{...(Object.hasOwn(f,'serverAddress')?{host:f.host,port:f.port,serverAddress:f.serverAddress,serverPort:f.serverPort}:{}),...(f.schemaScope?{schemaScope:f.schemaScope,preservation}:{})}};
}
