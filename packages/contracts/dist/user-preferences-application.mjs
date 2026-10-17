// Generated self-contained browser receiver. No authority or deployment acceptance.
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
function serializeString(value) {
	if (!value.isWellFormed()) throw new Error("Lone surrogate is not allowed");
	return JSON.stringify(value);
}
function serializePrimitive(value) {
	switch (typeof value) {
		case "number":
			if (isNaN(value)) throw new Error("NaN is not allowed");
			if (!isFinite(value)) throw new Error("Infinity is not allowed");
			return JSON.stringify(value);
		case "string": return serializeString(value);
		case "boolean": return value ? "true" : "false";
		default: return JSON.stringify(value);
	}
}
function enterValue(value, seen) {
	let wrappers = null;
	while (value !== null && typeof value === "object" && typeof value.toJSON === "function") {
		if (seen.has(value)) throw new Error("Circular reference detected");
		seen.add(value);
		(wrappers ??= []).push(value);
		value = value.toJSON();
	}
	if (value instanceof Number || value instanceof String || value instanceof Boolean) value = value.valueOf();
	if (value === null || typeof value !== "object") {
		if (wrappers !== null) for (const wrapper of wrappers) seen.delete(wrapper);
		return serializePrimitive(value);
	}
	if (seen.has(value)) throw new Error("Circular reference detected");
	seen.add(value);
	return {
		container: value,
		keys: Array.isArray(value) ? null : Object.keys(value).sort(),
		index: 0,
		first: true,
		wrappers
	};
}
function canonicalize(object) {
	if (object === null || typeof object !== "object") return serializePrimitive(object);
	const seen = /* @__PURE__ */ new Set();
	const root = enterValue(object, seen);
	if (typeof root !== "object") return root;
	let result = root.keys === null ? "[" : "{";
	const stack = [root];
	outer: while (stack.length > 0) {
		const frame = stack[stack.length - 1];
		const container = frame.container;
		if (frame.keys === null) {
			while (frame.index < container.length) {
				const i = frame.index++;
				if (i > 0) result += ",";
				const element = container[i];
				const value = element === void 0 || typeof element === "symbol" || typeof element === "function" ? null : element;
				if (value === null || typeof value !== "object") {
					result += serializePrimitive(value);
					continue;
				}
				const child = enterValue(value, seen);
				if (typeof child !== "object") {
					result += child === void 0 ? "null" : child;
					continue;
				}
				result += child.keys === null ? "[" : "{";
				stack.push(child);
				continue outer;
			}
			result += "]";
		} else {
			const keys = frame.keys;
			while (frame.index < keys.length) {
				const key = keys[frame.index++];
				const value = container[key];
				if (value === void 0 || typeof value === "symbol" || typeof value === "function") continue;
				if (value === null || typeof value !== "object") {
					if (frame.first) frame.first = false;
					else result += ",";
					result += serializeString(key) + ":" + serializePrimitive(value);
					continue;
				}
				const child = enterValue(value, seen);
				if (child === void 0) continue;
				if (frame.first) frame.first = false;
				else result += ",";
				result += serializeString(key) + ":";
				if (typeof child !== "object") {
					result += child;
					continue;
				}
				result += child.keys === null ? "[" : "{";
				stack.push(child);
				continue outer;
			}
			result += "}";
		}
		seen.delete(container);
		if (frame.wrappers !== null) for (const wrapper of frame.wrappers) seen.delete(wrapper);
		stack.pop();
	}
	return result;
}
var require_ucs2length = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	function ucs2length(str) {
		const len = str.length;
		let length = 0;
		let pos = 0;
		let value;
		while (pos < len) {
			length++;
			value = str.charCodeAt(pos++);
			if (value >= 55296 && value <= 56319 && pos < len) {
				value = str.charCodeAt(pos);
				if ((value & 64512) === 56320) pos++;
			}
		}
		return length;
	}
	exports.default = ucs2length;
	ucs2length.code = "require(\"ajv/dist/runtime/ucs2length\").default";
}));
const validateUserPreferences = validate31;
const schema33 = {
	"type": "object",
	"properties": {
		"theme": {
			"type": "string",
			"enum": [
				"system",
				"light",
				"dark"
			]
		},
		"density": {
			"type": "string",
			"enum": ["comfortable", "compact"]
		},
		"timezone": {
			"type": ["string", "null"],
			"maxLength": 64
		},
		"notifications": {
			"type": "object",
			"properties": {
				"runCompleted": { "type": "boolean" },
				"approvalRequested": { "type": "boolean" },
				"memoryReviewed": { "type": "boolean" }
			},
			"required": [
				"runCompleted",
				"approvalRequested",
				"memoryReviewed"
			],
			"additionalProperties": false
		},
		"defaultClientId": { "anyOf": [{
			"type": "string",
			"pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
		}, { "type": "null" }] }
	},
	"required": [
		"theme",
		"density",
		"timezone",
		"notifications",
		"defaultClientId"
	],
	"additionalProperties": false
};
const func1 = require_ucs2length().default;
const pattern4 = /* @__PURE__ */ new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
function validate31(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate31.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.theme === void 0 && (missing0 = "theme") || data.density === void 0 && (missing0 = "density") || data.timezone === void 0 && (missing0 = "timezone") || data.notifications === void 0 && (missing0 = "notifications") || data.defaultClientId === void 0 && (missing0 = "defaultClientId")) {
				validate31.errors = [{
					instancePath,
					schemaPath: "#/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				}];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) if (!(key0 === "theme" || key0 === "density" || key0 === "timezone" || key0 === "notifications" || key0 === "defaultClientId")) {
					validate31.errors = [{
						instancePath,
						schemaPath: "#/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					}];
					return false;
				}
				if (_errs1 === errors) {
					if (data.theme !== void 0) {
						let data0 = data.theme;
						const _errs2 = errors;
						if (typeof data0 !== "string") {
							validate31.errors = [{
								instancePath: instancePath + "/theme",
								schemaPath: "#/properties/theme/type",
								keyword: "type",
								params: { type: "string" },
								message: "must be string"
							}];
							return false;
						}
						if (!(data0 === "system" || data0 === "light" || data0 === "dark")) {
							validate31.errors = [{
								instancePath: instancePath + "/theme",
								schemaPath: "#/properties/theme/enum",
								keyword: "enum",
								params: { allowedValues: schema33.properties.theme.enum },
								message: "must be equal to one of the allowed values"
							}];
							return false;
						}
						var valid0 = _errs2 === errors;
					} else var valid0 = true;
					if (valid0) {
						if (data.density !== void 0) {
							let data1 = data.density;
							const _errs4 = errors;
							if (typeof data1 !== "string") {
								validate31.errors = [{
									instancePath: instancePath + "/density",
									schemaPath: "#/properties/density/type",
									keyword: "type",
									params: { type: "string" },
									message: "must be string"
								}];
								return false;
							}
							if (!(data1 === "comfortable" || data1 === "compact")) {
								validate31.errors = [{
									instancePath: instancePath + "/density",
									schemaPath: "#/properties/density/enum",
									keyword: "enum",
									params: { allowedValues: schema33.properties.density.enum },
									message: "must be equal to one of the allowed values"
								}];
								return false;
							}
							var valid0 = _errs4 === errors;
						} else var valid0 = true;
						if (valid0) {
							if (data.timezone !== void 0) {
								let data2 = data.timezone;
								const _errs6 = errors;
								if (typeof data2 !== "string" && data2 !== null) {
									validate31.errors = [{
										instancePath: instancePath + "/timezone",
										schemaPath: "#/properties/timezone/type",
										keyword: "type",
										params: { type: schema33.properties.timezone.type },
										message: "must be string,null"
									}];
									return false;
								}
								if (errors === _errs6) {
									if (typeof data2 === "string") {
										if (func1(data2) > 64) {
											validate31.errors = [{
												instancePath: instancePath + "/timezone",
												schemaPath: "#/properties/timezone/maxLength",
												keyword: "maxLength",
												params: { limit: 64 },
												message: "must NOT have more than 64 characters"
											}];
											return false;
										}
									}
								}
								var valid0 = _errs6 === errors;
							} else var valid0 = true;
							if (valid0) {
								if (data.notifications !== void 0) {
									let data3 = data.notifications;
									const _errs8 = errors;
									if (errors === _errs8) {
										if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
											let missing1;
											if (data3.runCompleted === void 0 && (missing1 = "runCompleted") || data3.approvalRequested === void 0 && (missing1 = "approvalRequested") || data3.memoryReviewed === void 0 && (missing1 = "memoryReviewed")) {
												validate31.errors = [{
													instancePath: instancePath + "/notifications",
													schemaPath: "#/properties/notifications/required",
													keyword: "required",
													params: { missingProperty: missing1 },
													message: "must have required property '" + missing1 + "'"
												}];
												return false;
											} else {
												const _errs10 = errors;
												for (const key1 in data3) if (!(key1 === "runCompleted" || key1 === "approvalRequested" || key1 === "memoryReviewed")) {
													validate31.errors = [{
														instancePath: instancePath + "/notifications",
														schemaPath: "#/properties/notifications/additionalProperties",
														keyword: "additionalProperties",
														params: { additionalProperty: key1 },
														message: "must NOT have additional properties"
													}];
													return false;
												}
												if (_errs10 === errors) {
													if (data3.runCompleted !== void 0) {
														const _errs11 = errors;
														if (typeof data3.runCompleted !== "boolean") {
															validate31.errors = [{
																instancePath: instancePath + "/notifications/runCompleted",
																schemaPath: "#/properties/notifications/properties/runCompleted/type",
																keyword: "type",
																params: { type: "boolean" },
																message: "must be boolean"
															}];
															return false;
														}
														var valid1 = _errs11 === errors;
													} else var valid1 = true;
													if (valid1) {
														if (data3.approvalRequested !== void 0) {
															const _errs13 = errors;
															if (typeof data3.approvalRequested !== "boolean") {
																validate31.errors = [{
																	instancePath: instancePath + "/notifications/approvalRequested",
																	schemaPath: "#/properties/notifications/properties/approvalRequested/type",
																	keyword: "type",
																	params: { type: "boolean" },
																	message: "must be boolean"
																}];
																return false;
															}
															var valid1 = _errs13 === errors;
														} else var valid1 = true;
														if (valid1) {
															if (data3.memoryReviewed !== void 0) {
																const _errs15 = errors;
																if (typeof data3.memoryReviewed !== "boolean") {
																	validate31.errors = [{
																		instancePath: instancePath + "/notifications/memoryReviewed",
																		schemaPath: "#/properties/notifications/properties/memoryReviewed/type",
																		keyword: "type",
																		params: { type: "boolean" },
																		message: "must be boolean"
																	}];
																	return false;
																}
																var valid1 = _errs15 === errors;
															} else var valid1 = true;
														}
													}
												}
											}
										} else {
											validate31.errors = [{
												instancePath: instancePath + "/notifications",
												schemaPath: "#/properties/notifications/type",
												keyword: "type",
												params: { type: "object" },
												message: "must be object"
											}];
											return false;
										}
									}
									var valid0 = _errs8 === errors;
								} else var valid0 = true;
								if (valid0) {
									if (data.defaultClientId !== void 0) {
										let data7 = data.defaultClientId;
										const _errs17 = errors;
										const _errs18 = errors;
										let valid2 = false;
										const _errs19 = errors;
										if (errors === _errs19) {
											if (typeof data7 === "string") {
												if (!pattern4.test(data7)) {
													const err0 = {
														instancePath: instancePath + "/defaultClientId",
														schemaPath: "#/properties/defaultClientId/anyOf/0/pattern",
														keyword: "pattern",
														params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
														message: "must match pattern \"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$\""
													};
													if (vErrors === null) vErrors = [err0];
													else vErrors.push(err0);
													errors++;
												}
											} else {
												const err1 = {
													instancePath: instancePath + "/defaultClientId",
													schemaPath: "#/properties/defaultClientId/anyOf/0/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												};
												if (vErrors === null) vErrors = [err1];
												else vErrors.push(err1);
												errors++;
											}
										}
										var _valid0 = _errs19 === errors;
										valid2 = valid2 || _valid0;
										const _errs21 = errors;
										if (data7 !== null) {
											const err2 = {
												instancePath: instancePath + "/defaultClientId",
												schemaPath: "#/properties/defaultClientId/anyOf/1/type",
												keyword: "type",
												params: { type: "null" },
												message: "must be null"
											};
											if (vErrors === null) vErrors = [err2];
											else vErrors.push(err2);
											errors++;
										}
										var _valid0 = _errs21 === errors;
										valid2 = valid2 || _valid0;
										if (!valid2) {
											const err3 = {
												instancePath: instancePath + "/defaultClientId",
												schemaPath: "#/properties/defaultClientId/anyOf",
												keyword: "anyOf",
												params: {},
												message: "must match a schema in anyOf"
											};
											if (vErrors === null) vErrors = [err3];
											else vErrors.push(err3);
											errors++;
											validate31.errors = vErrors;
											return false;
										} else {
											errors = _errs18;
											if (vErrors !== null) {
												if (_errs18) vErrors.length = _errs18;
												else vErrors = null;
											}
										}
										var valid0 = _errs17 === errors;
									} else var valid0 = true;
								}
							}
						}
					}
				}
			}
		} else {
			validate31.errors = [{
				instancePath,
				schemaPath: "#/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			}];
			return false;
		}
	}
	validate31.errors = vErrors;
	return errors === 0;
}
validate31.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateUserPreferencesOwner = validate32;
function validate32(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate32.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.tenantId === void 0 && (missing0 = "tenantId") || data.actorId === void 0 && (missing0 = "actorId")) {
			validate32.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "tenantId" || key0 === "actorId")) {
				validate32.errors = [{
					instancePath,
					schemaPath: "#/additionalProperties",
					keyword: "additionalProperties",
					params: { additionalProperty: key0 },
					message: "must NOT have additional properties"
				}];
				return false;
			}
			if (data.tenantId !== void 0) {
				let data0 = data.tenantId;
				if (typeof data0 === "string") {
					if (func1(data0) > 128) {
						validate32.errors = [{
							instancePath: instancePath + "/tenantId",
							schemaPath: "#/properties/tenantId/maxLength",
							keyword: "maxLength",
							params: { limit: 128 },
							message: "must NOT have more than 128 characters"
						}];
						return false;
					} else if (func1(data0) < 1) {
						validate32.errors = [{
							instancePath: instancePath + "/tenantId",
							schemaPath: "#/properties/tenantId/minLength",
							keyword: "minLength",
							params: { limit: 1 },
							message: "must NOT have fewer than 1 characters"
						}];
						return false;
					}
				} else {
					validate32.errors = [{
						instancePath: instancePath + "/tenantId",
						schemaPath: "#/properties/tenantId/type",
						keyword: "type",
						params: { type: "string" },
						message: "must be string"
					}];
					return false;
				}
				var valid0 = true;
			} else var valid0 = true;
			if (valid0) {
				if (data.actorId !== void 0) {
					let data1 = data.actorId;
					if (typeof data1 === "string") {
						if (func1(data1) > 128) {
							validate32.errors = [{
								instancePath: instancePath + "/actorId",
								schemaPath: "#/properties/actorId/maxLength",
								keyword: "maxLength",
								params: { limit: 128 },
								message: "must NOT have more than 128 characters"
							}];
							return false;
						} else if (func1(data1) < 1) {
							validate32.errors = [{
								instancePath: instancePath + "/actorId",
								schemaPath: "#/properties/actorId/minLength",
								keyword: "minLength",
								params: { limit: 1 },
								message: "must NOT have fewer than 1 characters"
							}];
							return false;
						}
					} else {
						validate32.errors = [{
							instancePath: instancePath + "/actorId",
							schemaPath: "#/properties/actorId/type",
							keyword: "type",
							params: { type: "string" },
							message: "must be string"
						}];
						return false;
					}
					var valid0 = true;
				} else var valid0 = true;
			}
		}
	} else {
		validate32.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate32.errors = vErrors;
	return true;
}
validate32.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateUserPreferencesReadRequest = validate33;
function validate33(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate33.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) for (const key0 in data) {
		validate33.errors = [{
			instancePath,
			schemaPath: "#/additionalProperties",
			keyword: "additionalProperties",
			params: { additionalProperty: key0 },
			message: "must NOT have additional properties"
		}];
		return false;
	}
	else {
		validate33.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate33.errors = vErrors;
	return true;
}
validate33.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateUserPreferencesSaveRequest = validate34;
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate34.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.expectedRevision === void 0 && (missing0 = "expectedRevision") || data.preferences === void 0 && (missing0 = "preferences")) {
				validate34.errors = [{
					instancePath,
					schemaPath: "#/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				}];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) if (!(key0 === "expectedRevision" || key0 === "preferences")) {
					validate34.errors = [{
						instancePath,
						schemaPath: "#/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					}];
					return false;
				}
				if (_errs1 === errors) {
					if (data.expectedRevision !== void 0) {
						let data0 = data.expectedRevision;
						const _errs2 = errors;
						if (!(typeof data0 == "number" && !(data0 % 1) && !isNaN(data0) && isFinite(data0))) {
							validate34.errors = [{
								instancePath: instancePath + "/expectedRevision",
								schemaPath: "#/properties/expectedRevision/type",
								keyword: "type",
								params: { type: "integer" },
								message: "must be integer"
							}];
							return false;
						}
						if (errors === _errs2) {
							if (typeof data0 == "number" && isFinite(data0)) {
								if (data0 > 9007199254740990 || isNaN(data0)) {
									validate34.errors = [{
										instancePath: instancePath + "/expectedRevision",
										schemaPath: "#/properties/expectedRevision/maximum",
										keyword: "maximum",
										params: {
											comparison: "<=",
											limit: 9007199254740990
										},
										message: "must be <= 9007199254740990"
									}];
									return false;
								} else if (data0 < 0 || isNaN(data0)) {
									validate34.errors = [{
										instancePath: instancePath + "/expectedRevision",
										schemaPath: "#/properties/expectedRevision/minimum",
										keyword: "minimum",
										params: {
											comparison: ">=",
											limit: 0
										},
										message: "must be >= 0"
									}];
									return false;
								}
							}
						}
						var valid0 = _errs2 === errors;
					} else var valid0 = true;
					if (valid0) {
						if (data.preferences !== void 0) {
							let data1 = data.preferences;
							const _errs4 = errors;
							if (errors === errors) {
								if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
									let missing1;
									if (data1.theme === void 0 && (missing1 = "theme") || data1.density === void 0 && (missing1 = "density") || data1.timezone === void 0 && (missing1 = "timezone") || data1.notifications === void 0 && (missing1 = "notifications") || data1.defaultClientId === void 0 && (missing1 = "defaultClientId")) {
										validate34.errors = [{
											instancePath: instancePath + "/preferences",
											schemaPath: "#/$defs/UserPreferences/required",
											keyword: "required",
											params: { missingProperty: missing1 },
											message: "must have required property '" + missing1 + "'"
										}];
										return false;
									} else {
										const _errs7 = errors;
										for (const key1 in data1) if (!(key1 === "theme" || key1 === "density" || key1 === "timezone" || key1 === "notifications" || key1 === "defaultClientId")) {
											validate34.errors = [{
												instancePath: instancePath + "/preferences",
												schemaPath: "#/$defs/UserPreferences/additionalProperties",
												keyword: "additionalProperties",
												params: { additionalProperty: key1 },
												message: "must NOT have additional properties"
											}];
											return false;
										}
										if (_errs7 === errors) {
											if (data1.theme !== void 0) {
												let data2 = data1.theme;
												const _errs8 = errors;
												if (typeof data2 !== "string") {
													validate34.errors = [{
														instancePath: instancePath + "/preferences/theme",
														schemaPath: "#/$defs/UserPreferences/properties/theme/type",
														keyword: "type",
														params: { type: "string" },
														message: "must be string"
													}];
													return false;
												}
												if (!(data2 === "system" || data2 === "light" || data2 === "dark")) {
													validate34.errors = [{
														instancePath: instancePath + "/preferences/theme",
														schemaPath: "#/$defs/UserPreferences/properties/theme/enum",
														keyword: "enum",
														params: { allowedValues: schema33.properties.theme.enum },
														message: "must be equal to one of the allowed values"
													}];
													return false;
												}
												var valid2 = _errs8 === errors;
											} else var valid2 = true;
											if (valid2) {
												if (data1.density !== void 0) {
													let data3 = data1.density;
													const _errs10 = errors;
													if (typeof data3 !== "string") {
														validate34.errors = [{
															instancePath: instancePath + "/preferences/density",
															schemaPath: "#/$defs/UserPreferences/properties/density/type",
															keyword: "type",
															params: { type: "string" },
															message: "must be string"
														}];
														return false;
													}
													if (!(data3 === "comfortable" || data3 === "compact")) {
														validate34.errors = [{
															instancePath: instancePath + "/preferences/density",
															schemaPath: "#/$defs/UserPreferences/properties/density/enum",
															keyword: "enum",
															params: { allowedValues: schema33.properties.density.enum },
															message: "must be equal to one of the allowed values"
														}];
														return false;
													}
													var valid2 = _errs10 === errors;
												} else var valid2 = true;
												if (valid2) {
													if (data1.timezone !== void 0) {
														let data4 = data1.timezone;
														const _errs12 = errors;
														if (typeof data4 !== "string" && data4 !== null) {
															validate34.errors = [{
																instancePath: instancePath + "/preferences/timezone",
																schemaPath: "#/$defs/UserPreferences/properties/timezone/type",
																keyword: "type",
																params: { type: schema33.properties.timezone.type },
																message: "must be string,null"
															}];
															return false;
														}
														if (errors === _errs12) {
															if (typeof data4 === "string") {
																if (func1(data4) > 64) {
																	validate34.errors = [{
																		instancePath: instancePath + "/preferences/timezone",
																		schemaPath: "#/$defs/UserPreferences/properties/timezone/maxLength",
																		keyword: "maxLength",
																		params: { limit: 64 },
																		message: "must NOT have more than 64 characters"
																	}];
																	return false;
																}
															}
														}
														var valid2 = _errs12 === errors;
													} else var valid2 = true;
													if (valid2) {
														if (data1.notifications !== void 0) {
															let data5 = data1.notifications;
															const _errs14 = errors;
															if (errors === _errs14) {
																if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
																	let missing2;
																	if (data5.runCompleted === void 0 && (missing2 = "runCompleted") || data5.approvalRequested === void 0 && (missing2 = "approvalRequested") || data5.memoryReviewed === void 0 && (missing2 = "memoryReviewed")) {
																		validate34.errors = [{
																			instancePath: instancePath + "/preferences/notifications",
																			schemaPath: "#/$defs/UserPreferences/properties/notifications/required",
																			keyword: "required",
																			params: { missingProperty: missing2 },
																			message: "must have required property '" + missing2 + "'"
																		}];
																		return false;
																	} else {
																		const _errs16 = errors;
																		for (const key2 in data5) if (!(key2 === "runCompleted" || key2 === "approvalRequested" || key2 === "memoryReviewed")) {
																			validate34.errors = [{
																				instancePath: instancePath + "/preferences/notifications",
																				schemaPath: "#/$defs/UserPreferences/properties/notifications/additionalProperties",
																				keyword: "additionalProperties",
																				params: { additionalProperty: key2 },
																				message: "must NOT have additional properties"
																			}];
																			return false;
																		}
																		if (_errs16 === errors) {
																			if (data5.runCompleted !== void 0) {
																				const _errs17 = errors;
																				if (typeof data5.runCompleted !== "boolean") {
																					validate34.errors = [{
																						instancePath: instancePath + "/preferences/notifications/runCompleted",
																						schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/runCompleted/type",
																						keyword: "type",
																						params: { type: "boolean" },
																						message: "must be boolean"
																					}];
																					return false;
																				}
																				var valid3 = _errs17 === errors;
																			} else var valid3 = true;
																			if (valid3) {
																				if (data5.approvalRequested !== void 0) {
																					const _errs19 = errors;
																					if (typeof data5.approvalRequested !== "boolean") {
																						validate34.errors = [{
																							instancePath: instancePath + "/preferences/notifications/approvalRequested",
																							schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/approvalRequested/type",
																							keyword: "type",
																							params: { type: "boolean" },
																							message: "must be boolean"
																						}];
																						return false;
																					}
																					var valid3 = _errs19 === errors;
																				} else var valid3 = true;
																				if (valid3) {
																					if (data5.memoryReviewed !== void 0) {
																						const _errs21 = errors;
																						if (typeof data5.memoryReviewed !== "boolean") {
																							validate34.errors = [{
																								instancePath: instancePath + "/preferences/notifications/memoryReviewed",
																								schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/memoryReviewed/type",
																								keyword: "type",
																								params: { type: "boolean" },
																								message: "must be boolean"
																							}];
																							return false;
																						}
																						var valid3 = _errs21 === errors;
																					} else var valid3 = true;
																				}
																			}
																		}
																	}
																} else {
																	validate34.errors = [{
																		instancePath: instancePath + "/preferences/notifications",
																		schemaPath: "#/$defs/UserPreferences/properties/notifications/type",
																		keyword: "type",
																		params: { type: "object" },
																		message: "must be object"
																	}];
																	return false;
																}
															}
															var valid2 = _errs14 === errors;
														} else var valid2 = true;
														if (valid2) {
															if (data1.defaultClientId !== void 0) {
																let data9 = data1.defaultClientId;
																const _errs23 = errors;
																const _errs24 = errors;
																let valid4 = false;
																const _errs25 = errors;
																if (errors === _errs25) {
																	if (typeof data9 === "string") {
																		if (!pattern4.test(data9)) {
																			const err0 = {
																				instancePath: instancePath + "/preferences/defaultClientId",
																				schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/0/pattern",
																				keyword: "pattern",
																				params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
																				message: "must match pattern \"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$\""
																			};
																			if (vErrors === null) vErrors = [err0];
																			else vErrors.push(err0);
																			errors++;
																		}
																	} else {
																		const err1 = {
																			instancePath: instancePath + "/preferences/defaultClientId",
																			schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/0/type",
																			keyword: "type",
																			params: { type: "string" },
																			message: "must be string"
																		};
																		if (vErrors === null) vErrors = [err1];
																		else vErrors.push(err1);
																		errors++;
																	}
																}
																var _valid0 = _errs25 === errors;
																valid4 = valid4 || _valid0;
																const _errs27 = errors;
																if (data9 !== null) {
																	const err2 = {
																		instancePath: instancePath + "/preferences/defaultClientId",
																		schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/1/type",
																		keyword: "type",
																		params: { type: "null" },
																		message: "must be null"
																	};
																	if (vErrors === null) vErrors = [err2];
																	else vErrors.push(err2);
																	errors++;
																}
																var _valid0 = _errs27 === errors;
																valid4 = valid4 || _valid0;
																if (!valid4) {
																	const err3 = {
																		instancePath: instancePath + "/preferences/defaultClientId",
																		schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf",
																		keyword: "anyOf",
																		params: {},
																		message: "must match a schema in anyOf"
																	};
																	if (vErrors === null) vErrors = [err3];
																	else vErrors.push(err3);
																	errors++;
																	validate34.errors = vErrors;
																	return false;
																} else {
																	errors = _errs24;
																	if (vErrors !== null) {
																		if (_errs24) vErrors.length = _errs24;
																		else vErrors = null;
																	}
																}
																var valid2 = _errs23 === errors;
															} else var valid2 = true;
														}
													}
												}
											}
										}
									}
								} else {
									validate34.errors = [{
										instancePath: instancePath + "/preferences",
										schemaPath: "#/$defs/UserPreferences/type",
										keyword: "type",
										params: { type: "object" },
										message: "must be object"
									}];
									return false;
								}
							}
							var valid0 = _errs4 === errors;
						} else var valid0 = true;
					}
				}
			}
		} else {
			validate34.errors = [{
				instancePath,
				schemaPath: "#/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			}];
			return false;
		}
	}
	validate34.errors = vErrors;
	return errors === 0;
}
validate34.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateUserPreferencesResponse = validate35;
function validate35(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate35.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.owner === void 0 && (missing0 = "owner") || data.revision === void 0 && (missing0 = "revision") || data.preferences === void 0 && (missing0 = "preferences")) {
				validate35.errors = [{
					instancePath,
					schemaPath: "#/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				}];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) if (!(key0 === "owner" || key0 === "revision" || key0 === "preferences")) {
					validate35.errors = [{
						instancePath,
						schemaPath: "#/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					}];
					return false;
				}
				if (_errs1 === errors) {
					if (data.owner !== void 0) {
						let data0 = data.owner;
						const _errs2 = errors;
						if (errors === errors) {
							if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
								let missing1;
								if (data0.tenantId === void 0 && (missing1 = "tenantId") || data0.actorId === void 0 && (missing1 = "actorId")) {
									validate35.errors = [{
										instancePath: instancePath + "/owner",
										schemaPath: "#/$defs/UserPreferencesOwner/required",
										keyword: "required",
										params: { missingProperty: missing1 },
										message: "must have required property '" + missing1 + "'"
									}];
									return false;
								} else {
									const _errs5 = errors;
									for (const key1 in data0) if (!(key1 === "tenantId" || key1 === "actorId")) {
										validate35.errors = [{
											instancePath: instancePath + "/owner",
											schemaPath: "#/$defs/UserPreferencesOwner/additionalProperties",
											keyword: "additionalProperties",
											params: { additionalProperty: key1 },
											message: "must NOT have additional properties"
										}];
										return false;
									}
									if (_errs5 === errors) {
										if (data0.tenantId !== void 0) {
											let data1 = data0.tenantId;
											const _errs6 = errors;
											if (errors === _errs6) {
												if (typeof data1 === "string") {
													if (func1(data1) > 128) {
														validate35.errors = [{
															instancePath: instancePath + "/owner/tenantId",
															schemaPath: "#/$defs/UserPreferencesOwner/properties/tenantId/maxLength",
															keyword: "maxLength",
															params: { limit: 128 },
															message: "must NOT have more than 128 characters"
														}];
														return false;
													} else if (func1(data1) < 1) {
														validate35.errors = [{
															instancePath: instancePath + "/owner/tenantId",
															schemaPath: "#/$defs/UserPreferencesOwner/properties/tenantId/minLength",
															keyword: "minLength",
															params: { limit: 1 },
															message: "must NOT have fewer than 1 characters"
														}];
														return false;
													}
												} else {
													validate35.errors = [{
														instancePath: instancePath + "/owner/tenantId",
														schemaPath: "#/$defs/UserPreferencesOwner/properties/tenantId/type",
														keyword: "type",
														params: { type: "string" },
														message: "must be string"
													}];
													return false;
												}
											}
											var valid2 = _errs6 === errors;
										} else var valid2 = true;
										if (valid2) {
											if (data0.actorId !== void 0) {
												let data2 = data0.actorId;
												const _errs8 = errors;
												if (errors === _errs8) {
													if (typeof data2 === "string") {
														if (func1(data2) > 128) {
															validate35.errors = [{
																instancePath: instancePath + "/owner/actorId",
																schemaPath: "#/$defs/UserPreferencesOwner/properties/actorId/maxLength",
																keyword: "maxLength",
																params: { limit: 128 },
																message: "must NOT have more than 128 characters"
															}];
															return false;
														} else if (func1(data2) < 1) {
															validate35.errors = [{
																instancePath: instancePath + "/owner/actorId",
																schemaPath: "#/$defs/UserPreferencesOwner/properties/actorId/minLength",
																keyword: "minLength",
																params: { limit: 1 },
																message: "must NOT have fewer than 1 characters"
															}];
															return false;
														}
													} else {
														validate35.errors = [{
															instancePath: instancePath + "/owner/actorId",
															schemaPath: "#/$defs/UserPreferencesOwner/properties/actorId/type",
															keyword: "type",
															params: { type: "string" },
															message: "must be string"
														}];
														return false;
													}
												}
												var valid2 = _errs8 === errors;
											} else var valid2 = true;
										}
									}
								}
							} else {
								validate35.errors = [{
									instancePath: instancePath + "/owner",
									schemaPath: "#/$defs/UserPreferencesOwner/type",
									keyword: "type",
									params: { type: "object" },
									message: "must be object"
								}];
								return false;
							}
						}
						var valid0 = _errs2 === errors;
					} else var valid0 = true;
					if (valid0) {
						if (data.revision !== void 0) {
							let data3 = data.revision;
							const _errs10 = errors;
							if (!(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3) && isFinite(data3))) {
								validate35.errors = [{
									instancePath: instancePath + "/revision",
									schemaPath: "#/properties/revision/type",
									keyword: "type",
									params: { type: "integer" },
									message: "must be integer"
								}];
								return false;
							}
							if (errors === _errs10) {
								if (typeof data3 == "number" && isFinite(data3)) {
									if (data3 > 9007199254740991 || isNaN(data3)) {
										validate35.errors = [{
											instancePath: instancePath + "/revision",
											schemaPath: "#/properties/revision/maximum",
											keyword: "maximum",
											params: {
												comparison: "<=",
												limit: 9007199254740991
											},
											message: "must be <= 9007199254740991"
										}];
										return false;
									} else if (data3 < 0 || isNaN(data3)) {
										validate35.errors = [{
											instancePath: instancePath + "/revision",
											schemaPath: "#/properties/revision/minimum",
											keyword: "minimum",
											params: {
												comparison: ">=",
												limit: 0
											},
											message: "must be >= 0"
										}];
										return false;
									}
								}
							}
							var valid0 = _errs10 === errors;
						} else var valid0 = true;
						if (valid0) {
							if (data.preferences !== void 0) {
								let data4 = data.preferences;
								const _errs12 = errors;
								if (errors === errors) {
									if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
										let missing2;
										if (data4.theme === void 0 && (missing2 = "theme") || data4.density === void 0 && (missing2 = "density") || data4.timezone === void 0 && (missing2 = "timezone") || data4.notifications === void 0 && (missing2 = "notifications") || data4.defaultClientId === void 0 && (missing2 = "defaultClientId")) {
											validate35.errors = [{
												instancePath: instancePath + "/preferences",
												schemaPath: "#/$defs/UserPreferences/required",
												keyword: "required",
												params: { missingProperty: missing2 },
												message: "must have required property '" + missing2 + "'"
											}];
											return false;
										} else {
											const _errs15 = errors;
											for (const key2 in data4) if (!(key2 === "theme" || key2 === "density" || key2 === "timezone" || key2 === "notifications" || key2 === "defaultClientId")) {
												validate35.errors = [{
													instancePath: instancePath + "/preferences",
													schemaPath: "#/$defs/UserPreferences/additionalProperties",
													keyword: "additionalProperties",
													params: { additionalProperty: key2 },
													message: "must NOT have additional properties"
												}];
												return false;
											}
											if (_errs15 === errors) {
												if (data4.theme !== void 0) {
													let data5 = data4.theme;
													const _errs16 = errors;
													if (typeof data5 !== "string") {
														validate35.errors = [{
															instancePath: instancePath + "/preferences/theme",
															schemaPath: "#/$defs/UserPreferences/properties/theme/type",
															keyword: "type",
															params: { type: "string" },
															message: "must be string"
														}];
														return false;
													}
													if (!(data5 === "system" || data5 === "light" || data5 === "dark")) {
														validate35.errors = [{
															instancePath: instancePath + "/preferences/theme",
															schemaPath: "#/$defs/UserPreferences/properties/theme/enum",
															keyword: "enum",
															params: { allowedValues: schema33.properties.theme.enum },
															message: "must be equal to one of the allowed values"
														}];
														return false;
													}
													var valid4 = _errs16 === errors;
												} else var valid4 = true;
												if (valid4) {
													if (data4.density !== void 0) {
														let data6 = data4.density;
														const _errs18 = errors;
														if (typeof data6 !== "string") {
															validate35.errors = [{
																instancePath: instancePath + "/preferences/density",
																schemaPath: "#/$defs/UserPreferences/properties/density/type",
																keyword: "type",
																params: { type: "string" },
																message: "must be string"
															}];
															return false;
														}
														if (!(data6 === "comfortable" || data6 === "compact")) {
															validate35.errors = [{
																instancePath: instancePath + "/preferences/density",
																schemaPath: "#/$defs/UserPreferences/properties/density/enum",
																keyword: "enum",
																params: { allowedValues: schema33.properties.density.enum },
																message: "must be equal to one of the allowed values"
															}];
															return false;
														}
														var valid4 = _errs18 === errors;
													} else var valid4 = true;
													if (valid4) {
														if (data4.timezone !== void 0) {
															let data7 = data4.timezone;
															const _errs20 = errors;
															if (typeof data7 !== "string" && data7 !== null) {
																validate35.errors = [{
																	instancePath: instancePath + "/preferences/timezone",
																	schemaPath: "#/$defs/UserPreferences/properties/timezone/type",
																	keyword: "type",
																	params: { type: schema33.properties.timezone.type },
																	message: "must be string,null"
																}];
																return false;
															}
															if (errors === _errs20) {
																if (typeof data7 === "string") {
																	if (func1(data7) > 64) {
																		validate35.errors = [{
																			instancePath: instancePath + "/preferences/timezone",
																			schemaPath: "#/$defs/UserPreferences/properties/timezone/maxLength",
																			keyword: "maxLength",
																			params: { limit: 64 },
																			message: "must NOT have more than 64 characters"
																		}];
																		return false;
																	}
																}
															}
															var valid4 = _errs20 === errors;
														} else var valid4 = true;
														if (valid4) {
															if (data4.notifications !== void 0) {
																let data8 = data4.notifications;
																const _errs22 = errors;
																if (errors === _errs22) {
																	if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
																		let missing3;
																		if (data8.runCompleted === void 0 && (missing3 = "runCompleted") || data8.approvalRequested === void 0 && (missing3 = "approvalRequested") || data8.memoryReviewed === void 0 && (missing3 = "memoryReviewed")) {
																			validate35.errors = [{
																				instancePath: instancePath + "/preferences/notifications",
																				schemaPath: "#/$defs/UserPreferences/properties/notifications/required",
																				keyword: "required",
																				params: { missingProperty: missing3 },
																				message: "must have required property '" + missing3 + "'"
																			}];
																			return false;
																		} else {
																			const _errs24 = errors;
																			for (const key3 in data8) if (!(key3 === "runCompleted" || key3 === "approvalRequested" || key3 === "memoryReviewed")) {
																				validate35.errors = [{
																					instancePath: instancePath + "/preferences/notifications",
																					schemaPath: "#/$defs/UserPreferences/properties/notifications/additionalProperties",
																					keyword: "additionalProperties",
																					params: { additionalProperty: key3 },
																					message: "must NOT have additional properties"
																				}];
																				return false;
																			}
																			if (_errs24 === errors) {
																				if (data8.runCompleted !== void 0) {
																					const _errs25 = errors;
																					if (typeof data8.runCompleted !== "boolean") {
																						validate35.errors = [{
																							instancePath: instancePath + "/preferences/notifications/runCompleted",
																							schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/runCompleted/type",
																							keyword: "type",
																							params: { type: "boolean" },
																							message: "must be boolean"
																						}];
																						return false;
																					}
																					var valid5 = _errs25 === errors;
																				} else var valid5 = true;
																				if (valid5) {
																					if (data8.approvalRequested !== void 0) {
																						const _errs27 = errors;
																						if (typeof data8.approvalRequested !== "boolean") {
																							validate35.errors = [{
																								instancePath: instancePath + "/preferences/notifications/approvalRequested",
																								schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/approvalRequested/type",
																								keyword: "type",
																								params: { type: "boolean" },
																								message: "must be boolean"
																							}];
																							return false;
																						}
																						var valid5 = _errs27 === errors;
																					} else var valid5 = true;
																					if (valid5) {
																						if (data8.memoryReviewed !== void 0) {
																							const _errs29 = errors;
																							if (typeof data8.memoryReviewed !== "boolean") {
																								validate35.errors = [{
																									instancePath: instancePath + "/preferences/notifications/memoryReviewed",
																									schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/memoryReviewed/type",
																									keyword: "type",
																									params: { type: "boolean" },
																									message: "must be boolean"
																								}];
																								return false;
																							}
																							var valid5 = _errs29 === errors;
																						} else var valid5 = true;
																					}
																				}
																			}
																		}
																	} else {
																		validate35.errors = [{
																			instancePath: instancePath + "/preferences/notifications",
																			schemaPath: "#/$defs/UserPreferences/properties/notifications/type",
																			keyword: "type",
																			params: { type: "object" },
																			message: "must be object"
																		}];
																		return false;
																	}
																}
																var valid4 = _errs22 === errors;
															} else var valid4 = true;
															if (valid4) {
																if (data4.defaultClientId !== void 0) {
																	let data12 = data4.defaultClientId;
																	const _errs31 = errors;
																	const _errs32 = errors;
																	let valid6 = false;
																	const _errs33 = errors;
																	if (errors === _errs33) {
																		if (typeof data12 === "string") {
																			if (!pattern4.test(data12)) {
																				const err0 = {
																					instancePath: instancePath + "/preferences/defaultClientId",
																					schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/0/pattern",
																					keyword: "pattern",
																					params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
																					message: "must match pattern \"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$\""
																				};
																				if (vErrors === null) vErrors = [err0];
																				else vErrors.push(err0);
																				errors++;
																			}
																		} else {
																			const err1 = {
																				instancePath: instancePath + "/preferences/defaultClientId",
																				schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/0/type",
																				keyword: "type",
																				params: { type: "string" },
																				message: "must be string"
																			};
																			if (vErrors === null) vErrors = [err1];
																			else vErrors.push(err1);
																			errors++;
																		}
																	}
																	var _valid0 = _errs33 === errors;
																	valid6 = valid6 || _valid0;
																	const _errs35 = errors;
																	if (data12 !== null) {
																		const err2 = {
																			instancePath: instancePath + "/preferences/defaultClientId",
																			schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/1/type",
																			keyword: "type",
																			params: { type: "null" },
																			message: "must be null"
																		};
																		if (vErrors === null) vErrors = [err2];
																		else vErrors.push(err2);
																		errors++;
																	}
																	var _valid0 = _errs35 === errors;
																	valid6 = valid6 || _valid0;
																	if (!valid6) {
																		const err3 = {
																			instancePath: instancePath + "/preferences/defaultClientId",
																			schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf",
																			keyword: "anyOf",
																			params: {},
																			message: "must match a schema in anyOf"
																		};
																		if (vErrors === null) vErrors = [err3];
																		else vErrors.push(err3);
																		errors++;
																		validate35.errors = vErrors;
																		return false;
																	} else {
																		errors = _errs32;
																		if (vErrors !== null) {
																			if (_errs32) vErrors.length = _errs32;
																			else vErrors = null;
																		}
																	}
																	var valid4 = _errs31 === errors;
																} else var valid4 = true;
															}
														}
													}
												}
											}
										}
									} else {
										validate35.errors = [{
											instancePath: instancePath + "/preferences",
											schemaPath: "#/$defs/UserPreferences/type",
											keyword: "type",
											params: { type: "object" },
											message: "must be object"
										}];
										return false;
									}
								}
								var valid0 = _errs12 === errors;
							} else var valid0 = true;
						}
					}
				}
			}
		} else {
			validate35.errors = [{
				instancePath,
				schemaPath: "#/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			}];
			return false;
		}
	}
	validate35.errors = vErrors;
	return errors === 0;
}
validate35.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateUserPreferencesErrorResponse = validate36;
const schema46 = {
	"type": "object",
	"properties": { "error": {
		"type": "object",
		"properties": {
			"code": {
				"type": "string",
				"enum": [
					"INVALID_REQUEST",
					"UNAUTHENTICATED",
					"ACCESS_DENIED",
					"MEMBERSHIP_REVOKED",
					"NOT_FOUND",
					"METHOD_NOT_ALLOWED",
					"DEADLINE",
					"MEMBERSHIP_CHANGED",
					"REQUEST_TOO_LARGE",
					"UNSUPPORTED_MEDIA_TYPE",
					"CANCELLED",
					"PRODUCT_UNAVAILABLE",
					"SETTINGS_REQUEST_INVALID",
					"SETTINGS_DOCUMENT_INVALID",
					"SETTINGS_FIELD_INVALID",
					"SETTINGS_CLIENT_REFUSED",
					"SETTINGS_REVISION_CONFLICT",
					"SETTINGS_STORE_UNAVAILABLE",
					"SETTINGS_STORE_STATE",
					"SETTINGS_COMMIT_UNKNOWN",
					"SETTINGS_UNAVAILABLE",
					"USER_PREFERENCES_UNAVAILABLE"
				]
			},
			"outcome": {
				"type": "string",
				"enum": ["UNKNOWN", "RESULT_NOT_RELEASED"]
			},
			"field": {
				"type": "string",
				"pattern": "^[A-Za-z][A-Za-z0-9_.-]{0,127}$"
			}
		},
		"required": ["code"],
		"additionalProperties": false
	} },
	"required": ["error"],
	"additionalProperties": false
};
const pattern7 = /* @__PURE__ */ new RegExp("^[A-Za-z][A-Za-z0-9_.-]{0,127}$", "u");
function validate36(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate36.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.error === void 0 && (missing0 = "error")) {
			validate36.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "error")) {
				validate36.errors = [{
					instancePath,
					schemaPath: "#/additionalProperties",
					keyword: "additionalProperties",
					params: { additionalProperty: key0 },
					message: "must NOT have additional properties"
				}];
				return false;
			}
			if (data.error !== void 0) {
				let data0 = data.error;
				if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
					let missing1;
					if (data0.code === void 0 && (missing1 = "code")) {
						validate36.errors = [{
							instancePath: instancePath + "/error",
							schemaPath: "#/properties/error/required",
							keyword: "required",
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'"
						}];
						return false;
					} else {
						for (const key1 in data0) if (!(key1 === "code" || key1 === "outcome" || key1 === "field")) {
							validate36.errors = [{
								instancePath: instancePath + "/error",
								schemaPath: "#/properties/error/additionalProperties",
								keyword: "additionalProperties",
								params: { additionalProperty: key1 },
								message: "must NOT have additional properties"
							}];
							return false;
						}
						if (data0.code !== void 0) {
							let data1 = data0.code;
							if (typeof data1 !== "string") {
								validate36.errors = [{
									instancePath: instancePath + "/error/code",
									schemaPath: "#/properties/error/properties/code/type",
									keyword: "type",
									params: { type: "string" },
									message: "must be string"
								}];
								return false;
							}
							if (!(data1 === "INVALID_REQUEST" || data1 === "UNAUTHENTICATED" || data1 === "ACCESS_DENIED" || data1 === "MEMBERSHIP_REVOKED" || data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "DEADLINE" || data1 === "MEMBERSHIP_CHANGED" || data1 === "REQUEST_TOO_LARGE" || data1 === "UNSUPPORTED_MEDIA_TYPE" || data1 === "CANCELLED" || data1 === "PRODUCT_UNAVAILABLE" || data1 === "SETTINGS_REQUEST_INVALID" || data1 === "SETTINGS_DOCUMENT_INVALID" || data1 === "SETTINGS_FIELD_INVALID" || data1 === "SETTINGS_CLIENT_REFUSED" || data1 === "SETTINGS_REVISION_CONFLICT" || data1 === "SETTINGS_STORE_UNAVAILABLE" || data1 === "SETTINGS_STORE_STATE" || data1 === "SETTINGS_COMMIT_UNKNOWN" || data1 === "SETTINGS_UNAVAILABLE" || data1 === "USER_PREFERENCES_UNAVAILABLE")) {
								validate36.errors = [{
									instancePath: instancePath + "/error/code",
									schemaPath: "#/properties/error/properties/code/enum",
									keyword: "enum",
									params: { allowedValues: schema46.properties.error.properties.code.enum },
									message: "must be equal to one of the allowed values"
								}];
								return false;
							}
							var valid1 = true;
						} else var valid1 = true;
						if (valid1) {
							if (data0.outcome !== void 0) {
								let data2 = data0.outcome;
								if (typeof data2 !== "string") {
									validate36.errors = [{
										instancePath: instancePath + "/error/outcome",
										schemaPath: "#/properties/error/properties/outcome/type",
										keyword: "type",
										params: { type: "string" },
										message: "must be string"
									}];
									return false;
								}
								if (!(data2 === "UNKNOWN" || data2 === "RESULT_NOT_RELEASED")) {
									validate36.errors = [{
										instancePath: instancePath + "/error/outcome",
										schemaPath: "#/properties/error/properties/outcome/enum",
										keyword: "enum",
										params: { allowedValues: schema46.properties.error.properties.outcome.enum },
										message: "must be equal to one of the allowed values"
									}];
									return false;
								}
								var valid1 = true;
							} else var valid1 = true;
							if (valid1) {
								if (data0.field !== void 0) {
									let data3 = data0.field;
									if (typeof data3 === "string") {
										if (!pattern7.test(data3)) {
											validate36.errors = [{
												instancePath: instancePath + "/error/field",
												schemaPath: "#/properties/error/properties/field/pattern",
												keyword: "pattern",
												params: { pattern: "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" },
												message: "must match pattern \"^[A-Za-z][A-Za-z0-9_.-]{0,127}$\""
											}];
											return false;
										}
									} else {
										validate36.errors = [{
											instancePath: instancePath + "/error/field",
											schemaPath: "#/properties/error/properties/field/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
									var valid1 = true;
								} else var valid1 = true;
							}
						}
					}
				} else {
					validate36.errors = [{
						instancePath: instancePath + "/error",
						schemaPath: "#/properties/error/type",
						keyword: "type",
						params: { type: "object" },
						message: "must be object"
					}];
					return false;
				}
			}
		}
	} else {
		validate36.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate36.errors = vErrors;
	return true;
}
validate36.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validators = {
	UserPreferences: validateUserPreferences,
	UserPreferencesOwner: validateUserPreferencesOwner,
	UserPreferencesReadRequest: validateUserPreferencesReadRequest,
	UserPreferencesSaveRequest: validateUserPreferencesSaveRequest,
	UserPreferencesResponse: validateUserPreferencesResponse,
	UserPreferencesErrorResponse: validateUserPreferencesErrorResponse
};
/** Canonical pure user preference document. Membership and persistence remain server owners. */
const freeze$1 = (value) => {
	if (value && typeof value === "object") {
		Object.values(value).forEach(freeze$1);
		Object.freeze(value);
	}
	return value;
};
const USER_PREFERENCE_THEMES = Object.freeze([
	"system",
	"light",
	"dark"
]);
const USER_PREFERENCE_DENSITIES = Object.freeze(["comfortable", "compact"]);
const USER_PREFERENCE_NOTIFICATIONS = Object.freeze([
	"runCompleted",
	"approvalRequested",
	"memoryReviewed"
]);
const USER_PREFERENCE_UUID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
const uuid = new RegExp(USER_PREFERENCE_UUID_PATTERN, "u");
const failures = /* @__PURE__ */ new WeakMap();
var UserPreferencesDocumentError = class extends Error {
	constructor(code, field = null) {
		super(code);
		this.name = "UserPreferencesDocumentError";
		failures.set(this, Object.freeze({
			code,
			field
		}));
	}
};
const userPreferencesDocumentFailure = (error) => failures.get(error) ?? null;
const fail$2 = (code, field) => {
	throw new UserPreferencesDocumentError(code, field);
};
const field = (name) => fail$2("SETTINGS_FIELD_INVALID", name);
function closed(value, keys, code, name) {
	try {
		if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail$2(code, name);
		const descriptors = Object.getOwnPropertyDescriptors(value), ownKeys = Reflect.ownKeys(descriptors);
		if (ownKeys.length !== keys.length || keys.some((key) => !Object.hasOwn(descriptors, key)) || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key) || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) fail$2(code, name);
		return Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
	} catch (error) {
		if (userPreferencesDocumentFailure(error)) throw error;
		fail$2(code, name);
	}
}
function userPreferencesTimezone(value, name = "timezone") {
	if (typeof value !== "string" || value.length > 64) field(name);
	let resolved;
	try {
		resolved = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
	} catch {
		field(name);
	}
	if (resolved !== value && !(value === "UTC" && resolved === "UTC")) field(name);
	return value;
}
const fields = {
	theme: {
		schema: {
			type: "string",
			enum: USER_PREFERENCE_THEMES
		},
		default: "system",
		parse: (value) => {
			if (!USER_PREFERENCE_THEMES.includes(value)) field("theme");
			return value;
		}
	},
	density: {
		schema: {
			type: "string",
			enum: USER_PREFERENCE_DENSITIES
		},
		default: "comfortable",
		parse: (value) => {
			if (!USER_PREFERENCE_DENSITIES.includes(value)) field("density");
			return value;
		}
	},
	timezone: {
		schema: {
			type: ["string", "null"],
			maxLength: 64
		},
		default: null,
		parse: (value) => value === null ? null : userPreferencesTimezone(value)
	},
	notifications: {
		schema: {
			type: "object",
			properties: Object.fromEntries(USER_PREFERENCE_NOTIFICATIONS.map((name) => [name, { type: "boolean" }])),
			required: USER_PREFERENCE_NOTIFICATIONS,
			additionalProperties: false
		},
		default: Object.fromEntries(USER_PREFERENCE_NOTIFICATIONS.map((name) => [name, true])),
		parse: (value) => {
			const n = closed(value, USER_PREFERENCE_NOTIFICATIONS, "SETTINGS_FIELD_INVALID", "notifications");
			for (const key of USER_PREFERENCE_NOTIFICATIONS) if (typeof n[key] !== "boolean") field("notifications." + key);
			return Object.freeze(n);
		}
	},
	defaultClientId: {
		schema: { anyOf: [{
			type: "string",
			pattern: USER_PREFERENCE_UUID_PATTERN
		}, { type: "null" }] },
		default: null,
		parse: (value) => {
			if (value === null) return null;
			if (typeof value !== "string" || !uuid.test(value.toLowerCase())) field("defaultClientId");
			return value.toLowerCase();
		}
	}
};
const USER_PREFERENCE_FIELDS = Object.freeze(Object.keys(fields));
const USER_PREFERENCE_DEFAULTS = freeze$1(Object.fromEntries(Object.entries(fields).map(([name, definition]) => [name, definition.default])));
freeze$1({
	type: "object",
	properties: Object.fromEntries(Object.entries(fields).map(([name, definition]) => [name, definition.schema])),
	required: USER_PREFERENCE_FIELDS,
	additionalProperties: false
});
/** Assumes external boundaries separately reject executable objects. Returns the canonical normalized document. */
function userPreferencesDocument(value) {
	const input = closed(value, USER_PREFERENCE_FIELDS, "SETTINGS_DOCUMENT_INVALID");
	return Object.freeze(Object.fromEntries(Object.entries(fields).map(([name, definition]) => [name, definition.parse(input[name])])));
}
const USER_PREFERENCES_SCHEMA_ID = "urn:meri:user-preferences-application:0.1.0";
/** Receiving metadata describes isolated source routes; it is not deployment or membership evidence. */
const userPreferencesVersion = "0.1.0";
const freeze = (value) => {
	if (value && typeof value === "object") {
		Object.values(value).forEach(freeze);
		Object.freeze(value);
	}
	return value;
};
const createUserPreferencesMetadata = ({ paths, limits, errorStatuses, errorOutcomes }) => freeze({
	contractVersion: userPreferencesVersion,
	schemaId: USER_PREFERENCES_SCHEMA_ID,
	routes: Object.fromEntries(Object.entries(paths).map(([route, path]) => [route, {
		method: "POST",
		path,
		response: "json"
	}])),
	authentication: {
		scheme: "Bearer",
		expectedOwner: "independently current Core tenantId and actorId; never response owner or Clerk identity"
	},
	limits: {
		requestBytes: limits.maxRequestBytes,
		responseBytes: limits.maxResponseBytes,
		requestMs: limits.maxRequestMs,
		jsonDepth: 64,
		jsonNodes: 1e5
	},
	errorStatuses,
	errorOutcomes,
	semantics: {
		document: "complete canonical user preferences; unknown fields refuse",
		save: "captured expectedRevision plus one and exact captured document",
		uncertainty: "UNKNOWN and RESULT_NOT_RELEASED require read-only reconciliation; never blind retry",
		membership: "server owns current membership and default-client eligibility",
		integration: "isolated source contract; runtime mounting and persistence qualification remain handoff work"
	}
});
const userPreferencesPaths = Object.freeze({
	"read": "/api/settings/user/read",
	"save": "/api/settings/user/save"
});
const userPreferencesMetadata = createUserPreferencesMetadata({
	"paths": {
		"read": "/api/settings/user/read",
		"save": "/api/settings/user/save"
	},
	"limits": {
		"maxRequestMs": 1e4,
		"maxRequestBytes": 8192,
		"maxResponseBytes": 16384
	},
	"errorStatuses": {
		"INVALID_REQUEST": 400,
		"UNAUTHENTICATED": 401,
		"ACCESS_DENIED": 403,
		"MEMBERSHIP_REVOKED": 403,
		"NOT_FOUND": 404,
		"METHOD_NOT_ALLOWED": 405,
		"DEADLINE": 408,
		"MEMBERSHIP_CHANGED": 409,
		"REQUEST_TOO_LARGE": 413,
		"UNSUPPORTED_MEDIA_TYPE": 415,
		"CANCELLED": 499,
		"PRODUCT_UNAVAILABLE": 502,
		"SETTINGS_REQUEST_INVALID": 400,
		"SETTINGS_DOCUMENT_INVALID": 400,
		"SETTINGS_FIELD_INVALID": 400,
		"SETTINGS_CLIENT_REFUSED": 403,
		"SETTINGS_REVISION_CONFLICT": 409,
		"SETTINGS_STORE_UNAVAILABLE": 503,
		"SETTINGS_STORE_STATE": 500,
		"SETTINGS_COMMIT_UNKNOWN": 503,
		"SETTINGS_UNAVAILABLE": 503,
		"USER_PREFERENCES_UNAVAILABLE": 503
	},
	"errorOutcomes": ["UNKNOWN", "RESULT_NOT_RELEASED"],
	"fieldPattern": "^[A-Za-z][A-Za-z0-9_.-]{0,127}$"
});
const errors = /* @__PURE__ */ new WeakSet();
var DocumentResponseError = class extends Error {
	constructor(code) {
		super(code);
		this.name = "DocumentResponseError";
		this.code = code;
		errors.add(this);
	}
};
const isFailure = (error) => errors.has(error);
const fail$1 = (code) => {
	throw new DocumentResponseError(code);
};
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const get = (name) => Object.getOwnPropertyDescriptor(typed, name).get;
const tag = Object.getOwnPropertyDescriptor(typed, Symbol.toStringTag).get;
const length = get("byteLength");
const offset = get("byteOffset");
const buffer = get("buffer");
const ordinaryBuffer = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
function copyBytes(value, cap) {
	try {
		if (tag.call(value) !== "Uint8Array") fail$1("INVALID_BYTES");
		const n = length.call(value), b = buffer.call(value), o = offset.call(value);
		ordinaryBuffer.call(b);
		if (n > cap) fail$1("BYTE_LIMIT");
		const copy = new Uint8Array(n);
		Uint8Array.prototype.set.call(copy, new Uint8Array(b, o, n));
		return copy;
	} catch (error) {
		if (isFailure(error)) throw error;
		fail$1("INVALID_BYTES");
	}
}
function parseBytes(value, cap) {
	const bytes = copyBytes(value, cap);
	let text, data;
	try {
		text = new TextDecoder("utf-8", {
			fatal: true,
			ignoreBOM: true
		}).decode(bytes);
		data = JSON.parse(text);
	} catch {
		fail$1("INVALID_JSON_UTF8");
	}
	const stack = [[data, 0]], objects = [];
	let nodes = 0;
	while (stack.length) {
		const [v, depth] = stack.pop();
		if (++nodes > 1e5 || depth > 64) fail$1("JSON_LIMIT");
		if (typeof v === "number" && !Number.isFinite(v)) fail$1("INVALID_NUMBER");
		if (typeof v === "string" && !v.isWellFormed()) fail$1("INVALID_UNICODE");
		if (v && typeof v === "object") {
			objects.push(v);
			for (const [k, x] of Object.entries(v)) {
				if ([
					"__proto__",
					"prototype",
					"constructor"
				].includes(k)) fail$1("DANGEROUS_KEY");
				stack.push([x, depth + 1]);
			}
		}
	}
	for (const v of objects) Object.freeze(v);
	return data;
}
var UserPreferencesResponseError = class extends Error {
	constructor(code) {
		super(code);
		this.name = "UserPreferencesResponseError";
		this.code = code;
	}
};
const fail = (code) => {
	throw new UserPreferencesResponseError(code);
};
function parseText(value, cap) {
	if (typeof value !== "string") fail("USER_PREFERENCES_JSON");
	if (value.length > cap) fail("USER_PREFERENCES_LIMIT");
	if (!value.isWellFormed()) fail("USER_PREFERENCES_JSON");
	try {
		return parseBytes(new TextEncoder().encode(value), cap);
	} catch (error) {
		fail(["BYTE_LIMIT", "JSON_LIMIT"].includes(error.code) ? "USER_PREFERENCES_LIMIT" : "USER_PREFERENCES_JSON");
	}
}
/** Independent caller owner and captured request are copied as data; accessors are never invoked. */
function expectedData(value, cap) {
	let nodes = 0;
	const visit = (v, depth) => {
		if (++nodes > 1e5 || depth > 64) fail("USER_PREFERENCES_EXPECTATION");
		if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return v;
		if (!v || typeof v !== "object" || ![
			Object.prototype,
			null,
			Array.prototype
		].includes(Object.getPrototypeOf(v))) fail("USER_PREFERENCES_EXPECTATION");
		const descriptors = Object.getOwnPropertyDescriptors(v), array = Array.isArray(v), out = array ? [] : {};
		for (const key of Reflect.ownKeys(descriptors)) {
			if (array && key === "length") continue;
			const d = descriptors[key];
			if (typeof key !== "string" || [
				"__proto__",
				"prototype",
				"constructor"
			].includes(key) || !d.enumerable || !Object.hasOwn(d, "value")) fail("USER_PREFERENCES_EXPECTATION");
			out[key] = visit(d.value, depth + 1);
		}
		return out;
	};
	try {
		return parseText(JSON.stringify(visit(value, 0)), cap);
	} catch (error) {
		if (error instanceof UserPreferencesResponseError) throw error;
		fail("USER_PREFERENCES_EXPECTATION");
	}
}
const routes = Object.freeze({
	read: "UserPreferencesReadRequest",
	save: "UserPreferencesSaveRequest"
});
const selected = (route) => {
	if (typeof route !== "string" || !Object.hasOwn(routes, route)) fail("USER_PREFERENCES_ROUTE");
	return routes[route];
};
const check = (name, value) => {
	if (!validators[name](value)) fail("USER_PREFERENCES_SHAPE");
};
const same = (a, b) => canonicalize(a) === canonicalize(b);
function document(value) {
	try {
		if (!same(value, userPreferencesDocument(value))) fail("USER_PREFERENCES_DOCUMENT");
	} catch {
		fail("USER_PREFERENCES_DOCUMENT");
	}
}
/** The complete JSON document is schema/semantically canonical, not an authority or membership grant. */
async function receiveUserPreferencesRequest(route, jsonText) {
	const name = selected(route), value = parseText(jsonText, userPreferencesMetadata.limits.requestBytes);
	check(name, value);
	if (route === "save") document(value.preferences);
	return value;
}
/** Read Response.text(). The independent owner must be captured with the request and still current at display time. */
async function receiveUserPreferencesResponse(route, httpStatus, jsonText, expected) {
	const name = selected(route);
	if (!Number.isInteger(httpStatus)) fail("USER_PREFERENCES_STATUS");
	const expectation = expectedData(expected, userPreferencesMetadata.limits.requestBytes), keys = Object.keys(expectation ?? {}), required = route === "save" ? ["owner", "request"] : ["owner"];
	if (keys.length !== required.length || required.some((key) => !keys.includes(key))) fail("USER_PREFERENCES_EXPECTATION");
	check("UserPreferencesOwner", expectation.owner);
	if (route === "save") {
		check(name, expectation.request);
		document(expectation.request.preferences);
	}
	const value = parseText(jsonText, userPreferencesMetadata.limits.responseBytes);
	if (httpStatus !== 200) {
		check("UserPreferencesErrorResponse", value);
		if (userPreferencesMetadata.errorStatuses[value.error.code] !== httpStatus || httpStatus === 502 && Object.hasOwn(value.error, "field")) fail("USER_PREFERENCES_STATUS");
		return value;
	}
	check("UserPreferencesResponse", value);
	document(value.preferences);
	if (!same(value.owner, expectation.owner) || route === "save" && (value.revision !== expectation.request.expectedRevision + 1 || !same(value.preferences, expectation.request.preferences))) fail("USER_PREFERENCES_CORRELATION");
	return value;
}
export { USER_PREFERENCE_DEFAULTS, USER_PREFERENCE_DENSITIES, USER_PREFERENCE_NOTIFICATIONS, USER_PREFERENCE_THEMES, UserPreferencesResponseError, receiveUserPreferencesRequest, receiveUserPreferencesResponse, userPreferencesMetadata, userPreferencesPaths, userPreferencesVersion };
