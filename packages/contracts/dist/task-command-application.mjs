// Generated self-contained browser receiving boundary. No authority.
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var require_formats = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
	function fmtDef(validate, compare) {
		return {
			validate,
			compare
		};
	}
	exports.fullFormats = {
		date: fmtDef(date, compareDate),
		time: fmtDef(getTime(true), compareTime),
		"date-time": fmtDef(getDateTime(true), compareDateTime),
		"iso-time": fmtDef(getTime(), compareIsoTime),
		"iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
		duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
		uri,
		"uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
		"uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
		url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
		email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
		hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
		ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
		ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
		regex,
		uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
		"json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
		"json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
		"relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
		byte,
		int32: {
			type: "number",
			validate: validateInt32
		},
		int64: {
			type: "number",
			validate: validateInt64
		},
		float: {
			type: "number",
			validate: validateNumber
		},
		double: {
			type: "number",
			validate: validateNumber
		},
		password: true,
		binary: true
	};
	exports.fastFormats = {
		...exports.fullFormats,
		date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
		time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
		"date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
		"iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
		"iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
		uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
		"uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
		email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
	};
	exports.formatNames = Object.keys(exports.fullFormats);
	function isLeapYear(year) {
		return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	}
	const DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
	const DAYS = [
		0,
		31,
		28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31
	];
	function date(str) {
		const matches = DATE.exec(str);
		if (!matches) return false;
		const year = +matches[1];
		const month = +matches[2];
		const day = +matches[3];
		return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
	}
	function compareDate(d1, d2) {
		if (!(d1 && d2)) return void 0;
		if (d1 > d2) return 1;
		if (d1 < d2) return -1;
		return 0;
	}
	const TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
	function getTime(strictTimeZone) {
		return function time(str) {
			const matches = TIME.exec(str);
			if (!matches) return false;
			const hr = +matches[1];
			const min = +matches[2];
			const sec = +matches[3];
			const tz = matches[4];
			const tzSign = matches[5] === "-" ? -1 : 1;
			const tzH = +(matches[6] || 0);
			const tzM = +(matches[7] || 0);
			if (tzH > 23 || tzM > 59 || strictTimeZone && !tz) return false;
			if (hr <= 23 && min <= 59 && sec < 60) return true;
			const utcMin = min - tzM * tzSign;
			const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
			return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
		};
	}
	function compareTime(s1, s2) {
		if (!(s1 && s2)) return void 0;
		const t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf();
		const t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
		if (!(t1 && t2)) return void 0;
		return t1 - t2;
	}
	function compareIsoTime(t1, t2) {
		if (!(t1 && t2)) return void 0;
		const a1 = TIME.exec(t1);
		const a2 = TIME.exec(t2);
		if (!(a1 && a2)) return void 0;
		t1 = a1[1] + a1[2] + a1[3];
		t2 = a2[1] + a2[2] + a2[3];
		if (t1 > t2) return 1;
		if (t1 < t2) return -1;
		return 0;
	}
	const DATE_TIME_SEPARATOR = /t|\s/i;
	function getDateTime(strictTimeZone) {
		const time = getTime(strictTimeZone);
		return function date_time(str) {
			const dateTime = str.split(DATE_TIME_SEPARATOR);
			return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
		};
	}
	function compareDateTime(dt1, dt2) {
		if (!(dt1 && dt2)) return void 0;
		const d1 = new Date(dt1).valueOf();
		const d2 = new Date(dt2).valueOf();
		if (!(d1 && d2)) return void 0;
		return d1 - d2;
	}
	function compareIsoDateTime(dt1, dt2) {
		if (!(dt1 && dt2)) return void 0;
		const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
		const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
		const res = compareDate(d1, d2);
		if (res === void 0) return void 0;
		return res || compareTime(t1, t2);
	}
	const NOT_URI_FRAGMENT = /\/|:/;
	const URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
	function uri(str) {
		return NOT_URI_FRAGMENT.test(str) && URI.test(str);
	}
	const BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
	function byte(str) {
		BYTE.lastIndex = 0;
		return BYTE.test(str);
	}
	const MIN_INT32 = -(2 ** 31);
	const MAX_INT32 = 2 ** 31 - 1;
	function validateInt32(value) {
		return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
	}
	function validateInt64(value) {
		return Number.isInteger(value);
	}
	function validateNumber() {
		return true;
	}
	const Z_ANCHOR = /[^\\]\\Z/;
	function regex(str) {
		if (Z_ANCHOR.test(str)) return false;
		try {
			new RegExp(str);
			return true;
		} catch (e) {
			return false;
		}
	}
}));
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
var require_fast_deep_equal = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function equal(a, b) {
		if (a === b) return true;
		if (a && b && typeof a == "object" && typeof b == "object") {
			if (a.constructor !== b.constructor) return false;
			var length, i, keys;
			if (Array.isArray(a)) {
				length = a.length;
				if (length != b.length) return false;
				for (i = length; i-- !== 0;) if (!equal(a[i], b[i])) return false;
				return true;
			}
			if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
			if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
			if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
			keys = Object.keys(a);
			length = keys.length;
			if (length !== Object.keys(b).length) return false;
			for (i = length; i-- !== 0;) if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
			for (i = length; i-- !== 0;) {
				var key = keys[i];
				if (!equal(a[key], b[key])) return false;
			}
			return true;
		}
		return a !== a && b !== b;
	};
}));
var require_equal = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	const equal = require_fast_deep_equal();
	equal.code = "require(\"ajv/dist/runtime/equal\").default";
	exports.default = equal;
}));
const validateTaskUpdateRaw = validate56;
const schema33 = {
	"type": "object",
	"properties": {
		"taskId": { "type": "string" },
		"title": { "type": ["string", "null"] },
		"status": { "type": ["string", "null"] },
		"dueDate": { "type": ["string", "null"] }
	},
	"required": ["taskId"],
	"additionalProperties": false
};
function validate56(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate56.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.taskId === void 0 && (missing0 = "taskId")) {
			validate56.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "taskId" || key0 === "title" || key0 === "status" || key0 === "dueDate")) {
				validate56.errors = [{
					instancePath,
					schemaPath: "#/additionalProperties",
					keyword: "additionalProperties",
					params: { additionalProperty: key0 },
					message: "must NOT have additional properties"
				}];
				return false;
			}
			if (data.taskId !== void 0) {
				if (typeof data.taskId !== "string") {
					validate56.errors = [{
						instancePath: instancePath + "/taskId",
						schemaPath: "#/properties/taskId/type",
						keyword: "type",
						params: { type: "string" },
						message: "must be string"
					}];
					return false;
				}
				var valid0 = true;
			} else var valid0 = true;
			if (valid0) {
				if (data.title !== void 0) {
					let data1 = data.title;
					if (typeof data1 !== "string" && data1 !== null) {
						validate56.errors = [{
							instancePath: instancePath + "/title",
							schemaPath: "#/properties/title/type",
							keyword: "type",
							params: { type: schema33.properties.title.type },
							message: "must be string,null"
						}];
						return false;
					}
					var valid0 = true;
				} else var valid0 = true;
				if (valid0) {
					if (data.status !== void 0) {
						let data2 = data.status;
						if (typeof data2 !== "string" && data2 !== null) {
							validate56.errors = [{
								instancePath: instancePath + "/status",
								schemaPath: "#/properties/status/type",
								keyword: "type",
								params: { type: schema33.properties.status.type },
								message: "must be string,null"
							}];
							return false;
						}
						var valid0 = true;
					} else var valid0 = true;
					if (valid0) {
						if (data.dueDate !== void 0) {
							let data3 = data.dueDate;
							if (typeof data3 !== "string" && data3 !== null) {
								validate56.errors = [{
									instancePath: instancePath + "/dueDate",
									schemaPath: "#/properties/dueDate/type",
									keyword: "type",
									params: { type: schema33.properties.dueDate.type },
									message: "must be string,null"
								}];
								return false;
							}
							var valid0 = true;
						} else var valid0 = true;
					}
				}
			}
		}
	} else {
		validate56.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate56.errors = vErrors;
	return true;
}
validate56.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskUpdateArguments = validate57;
const schema35 = {
	"type": "object",
	"properties": {
		"taskId": {
			"type": "string",
			"format": "uuid"
		},
		"mode": { "const": "unconditional_patch" },
		"patch": {
			"type": "object",
			"properties": {
				"title": {
					"type": "string",
					"minLength": 1,
					"maxLength": 240
				},
				"status": { "enum": [
					"todo",
					"in_progress",
					"done",
					"blocked",
					"canceled"
				] },
				"dueDate": {
					"type": "string",
					"format": "date-time",
					"pattern": "Z$"
				}
			},
			"required": [],
			"additionalProperties": false,
			"minProperties": 1
		}
	},
	"required": [
		"taskId",
		"mode",
		"patch"
	],
	"additionalProperties": false
};
const formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const formats2 = require_formats().fullFormats["date-time"];
const func1 = require_ucs2length().default;
const pattern4 = /* @__PURE__ */ new RegExp("Z$", "u");
function validate57(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate57.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.taskId === void 0 && (missing0 = "taskId") || data.mode === void 0 && (missing0 = "mode") || data.patch === void 0 && (missing0 = "patch")) {
			validate57.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "taskId" || key0 === "mode" || key0 === "patch")) {
				validate57.errors = [{
					instancePath,
					schemaPath: "#/additionalProperties",
					keyword: "additionalProperties",
					params: { additionalProperty: key0 },
					message: "must NOT have additional properties"
				}];
				return false;
			}
			if (data.taskId !== void 0) {
				let data0 = data.taskId;
				if (typeof data0 === "string") {
					if (!formats0.test(data0)) {
						validate57.errors = [{
							instancePath: instancePath + "/taskId",
							schemaPath: "#/properties/taskId/format",
							keyword: "format",
							params: { format: "uuid" },
							message: "must match format \"uuid\""
						}];
						return false;
					}
				} else {
					validate57.errors = [{
						instancePath: instancePath + "/taskId",
						schemaPath: "#/properties/taskId/type",
						keyword: "type",
						params: { type: "string" },
						message: "must be string"
					}];
					return false;
				}
				var valid0 = true;
			} else var valid0 = true;
			if (valid0) {
				if (data.mode !== void 0) {
					if ("unconditional_patch" !== data.mode) {
						validate57.errors = [{
							instancePath: instancePath + "/mode",
							schemaPath: "#/properties/mode/const",
							keyword: "const",
							params: { allowedValue: "unconditional_patch" },
							message: "must be equal to constant"
						}];
						return false;
					}
					var valid0 = true;
				} else var valid0 = true;
				if (valid0) {
					if (data.patch !== void 0) {
						let data2 = data.patch;
						if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
							if (Object.keys(data2).length < 1) {
								validate57.errors = [{
									instancePath: instancePath + "/patch",
									schemaPath: "#/properties/patch/minProperties",
									keyword: "minProperties",
									params: { limit: 1 },
									message: "must NOT have fewer than 1 properties"
								}];
								return false;
							} else {
								for (const key1 in data2) if (!(key1 === "title" || key1 === "status" || key1 === "dueDate")) {
									validate57.errors = [{
										instancePath: instancePath + "/patch",
										schemaPath: "#/properties/patch/additionalProperties",
										keyword: "additionalProperties",
										params: { additionalProperty: key1 },
										message: "must NOT have additional properties"
									}];
									return false;
								}
								if (data2.title !== void 0) {
									let data3 = data2.title;
									if (typeof data3 === "string") {
										if (func1(data3) > 240) {
											validate57.errors = [{
												instancePath: instancePath + "/patch/title",
												schemaPath: "#/properties/patch/properties/title/maxLength",
												keyword: "maxLength",
												params: { limit: 240 },
												message: "must NOT have more than 240 characters"
											}];
											return false;
										} else if (func1(data3) < 1) {
											validate57.errors = [{
												instancePath: instancePath + "/patch/title",
												schemaPath: "#/properties/patch/properties/title/minLength",
												keyword: "minLength",
												params: { limit: 1 },
												message: "must NOT have fewer than 1 characters"
											}];
											return false;
										}
									} else {
										validate57.errors = [{
											instancePath: instancePath + "/patch/title",
											schemaPath: "#/properties/patch/properties/title/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
									var valid1 = true;
								} else var valid1 = true;
								if (valid1) {
									if (data2.status !== void 0) {
										let data4 = data2.status;
										if (!(data4 === "todo" || data4 === "in_progress" || data4 === "done" || data4 === "blocked" || data4 === "canceled")) {
											validate57.errors = [{
												instancePath: instancePath + "/patch/status",
												schemaPath: "#/properties/patch/properties/status/enum",
												keyword: "enum",
												params: { allowedValues: schema35.properties.patch.properties.status.enum },
												message: "must be equal to one of the allowed values"
											}];
											return false;
										}
										var valid1 = true;
									} else var valid1 = true;
									if (valid1) {
										if (data2.dueDate !== void 0) {
											let data5 = data2.dueDate;
											if (typeof data5 === "string") {
												if (!pattern4.test(data5)) {
													validate57.errors = [{
														instancePath: instancePath + "/patch/dueDate",
														schemaPath: "#/properties/patch/properties/dueDate/pattern",
														keyword: "pattern",
														params: { pattern: "Z$" },
														message: "must match pattern \"Z$\""
													}];
													return false;
												} else if (!formats2.validate(data5)) {
													validate57.errors = [{
														instancePath: instancePath + "/patch/dueDate",
														schemaPath: "#/properties/patch/properties/dueDate/format",
														keyword: "format",
														params: { format: "date-time" },
														message: "must match format \"date-time\""
													}];
													return false;
												}
											} else {
												validate57.errors = [{
													instancePath: instancePath + "/patch/dueDate",
													schemaPath: "#/properties/patch/properties/dueDate/type",
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
							validate57.errors = [{
								instancePath: instancePath + "/patch",
								schemaPath: "#/properties/patch/type",
								keyword: "type",
								params: { type: "object" },
								message: "must be object"
							}];
							return false;
						}
						var valid0 = true;
					} else var valid0 = true;
				}
			}
		}
	} else {
		validate57.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate57.errors = vErrors;
	return true;
}
validate57.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskUpdateApprovalProposal = validate58;
const schema41 = {
	"type": "object",
	"properties": {
		"tenantId": {
			"type": "string",
			"minLength": 1,
			"maxLength": 128
		},
		"kind": {
			"type": "string",
			"enum": [
				"tenant",
				"client",
				"mailbox",
				"memory",
				"document",
				"private-user",
				"public"
			]
		},
		"resourceId": {
			"type": "string",
			"minLength": 1,
			"maxLength": 256
		},
		"policyRevision": {
			"type": "string",
			"minLength": 1,
			"maxLength": 128
		}
	},
	"required": [
		"tenantId",
		"kind",
		"resourceId",
		"policyRevision"
	],
	"additionalProperties": false
};
const func0 = require_equal().default;
function validate25(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate25.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.commandId === void 0 && (missing0 = "commandId") || data.binding === void 0 && (missing0 = "binding") || data.action === void 0 && (missing0 = "action") || data.arguments === void 0 && (missing0 = "arguments") || data.attachments === void 0 && (missing0 = "attachments") || data.scopes === void 0 && (missing0 = "scopes") || data.idempotencyKey === void 0 && (missing0 = "idempotencyKey")) {
			validate25.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "contractVersion" || key0 === "commandId" || key0 === "binding" || key0 === "action" || key0 === "arguments" || key0 === "attachments" || key0 === "scopes" || key0 === "idempotencyKey")) {
				validate25.errors = [{
					instancePath,
					schemaPath: "#/additionalProperties",
					keyword: "additionalProperties",
					params: { additionalProperty: key0 },
					message: "must NOT have additional properties"
				}];
				return false;
			}
			if (data.contractVersion !== void 0) {
				if ("0.2.0" !== data.contractVersion) {
					validate25.errors = [{
						instancePath: instancePath + "/contractVersion",
						schemaPath: "#/properties/contractVersion/const",
						keyword: "const",
						params: { allowedValue: "0.2.0" },
						message: "must be equal to constant"
					}];
					return false;
				}
				var valid0 = true;
			} else var valid0 = true;
			if (valid0) {
				if (data.commandId !== void 0) {
					let data1 = data.commandId;
					if (typeof data1 === "string") {
						if (!formats0.test(data1)) {
							validate25.errors = [{
								instancePath: instancePath + "/commandId",
								schemaPath: "#/properties/commandId/format",
								keyword: "format",
								params: { format: "uuid" },
								message: "must match format \"uuid\""
							}];
							return false;
						}
					} else {
						validate25.errors = [{
							instancePath: instancePath + "/commandId",
							schemaPath: "#/properties/commandId/type",
							keyword: "type",
							params: { type: "string" },
							message: "must be string"
						}];
						return false;
					}
					var valid0 = true;
				} else var valid0 = true;
				if (valid0) {
					if (data.binding !== void 0) {
						let data2 = data.binding;
						if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
							let missing1;
							if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.attemptId === void 0 && (missing1 = "attemptId") || data2.workerId === void 0 && (missing1 = "workerId") || data2.writerFence === void 0 && (missing1 = "writerFence")) {
								validate25.errors = [{
									instancePath: instancePath + "/binding",
									schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required",
									keyword: "required",
									params: { missingProperty: missing1 },
									message: "must have required property '" + missing1 + "'"
								}];
								return false;
							} else {
								for (const key1 in data2) if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
									validate25.errors = [{
										instancePath: instancePath + "/binding",
										schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties",
										keyword: "additionalProperties",
										params: { additionalProperty: key1 },
										message: "must NOT have additional properties"
									}];
									return false;
								}
								if (data2.tenantId !== void 0) {
									let data3 = data2.tenantId;
									if (typeof data3 === "string") {
										if (func1(data3) > 128) {
											validate25.errors = [{
												instancePath: instancePath + "/binding/tenantId",
												schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength",
												keyword: "maxLength",
												params: { limit: 128 },
												message: "must NOT have more than 128 characters"
											}];
											return false;
										} else if (func1(data3) < 1) {
											validate25.errors = [{
												instancePath: instancePath + "/binding/tenantId",
												schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength",
												keyword: "minLength",
												params: { limit: 1 },
												message: "must NOT have fewer than 1 characters"
											}];
											return false;
										}
									} else {
										validate25.errors = [{
											instancePath: instancePath + "/binding/tenantId",
											schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
									var valid2 = true;
								} else var valid2 = true;
								if (valid2) {
									if (data2.actorId !== void 0) {
										let data4 = data2.actorId;
										if (typeof data4 === "string") {
											if (func1(data4) > 128) {
												validate25.errors = [{
													instancePath: instancePath + "/binding/actorId",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength",
													keyword: "maxLength",
													params: { limit: 128 },
													message: "must NOT have more than 128 characters"
												}];
												return false;
											} else if (func1(data4) < 1) {
												validate25.errors = [{
													instancePath: instancePath + "/binding/actorId",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength",
													keyword: "minLength",
													params: { limit: 1 },
													message: "must NOT have fewer than 1 characters"
												}];
												return false;
											}
										} else {
											validate25.errors = [{
												instancePath: instancePath + "/binding/actorId",
												schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type",
												keyword: "type",
												params: { type: "string" },
												message: "must be string"
											}];
											return false;
										}
										var valid2 = true;
									} else var valid2 = true;
									if (valid2) {
										if (data2.conversationId !== void 0) {
											let data5 = data2.conversationId;
											if (typeof data5 === "string") {
												if (!formats0.test(data5)) {
													validate25.errors = [{
														instancePath: instancePath + "/binding/conversationId",
														schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format",
														keyword: "format",
														params: { format: "uuid" },
														message: "must match format \"uuid\""
													}];
													return false;
												}
											} else {
												validate25.errors = [{
													instancePath: instancePath + "/binding/conversationId",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												}];
												return false;
											}
											var valid2 = true;
										} else var valid2 = true;
										if (valid2) {
											if (data2.runId !== void 0) {
												let data6 = data2.runId;
												if (typeof data6 === "string") {
													if (!formats0.test(data6)) {
														validate25.errors = [{
															instancePath: instancePath + "/binding/runId",
															schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format",
															keyword: "format",
															params: { format: "uuid" },
															message: "must match format \"uuid\""
														}];
														return false;
													}
												} else {
													validate25.errors = [{
														instancePath: instancePath + "/binding/runId",
														schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type",
														keyword: "type",
														params: { type: "string" },
														message: "must be string"
													}];
													return false;
												}
												var valid2 = true;
											} else var valid2 = true;
											if (valid2) {
												if (data2.attemptId !== void 0) {
													let data7 = data2.attemptId;
													if (typeof data7 === "string") {
														if (!formats0.test(data7)) {
															validate25.errors = [{
																instancePath: instancePath + "/binding/attemptId",
																schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format",
																keyword: "format",
																params: { format: "uuid" },
																message: "must match format \"uuid\""
															}];
															return false;
														}
													} else {
														validate25.errors = [{
															instancePath: instancePath + "/binding/attemptId",
															schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type",
															keyword: "type",
															params: { type: "string" },
															message: "must be string"
														}];
														return false;
													}
													var valid2 = true;
												} else var valid2 = true;
												if (valid2) {
													if (data2.workerId !== void 0) {
														let data8 = data2.workerId;
														if (typeof data8 === "string") {
															if (!formats0.test(data8)) {
																validate25.errors = [{
																	instancePath: instancePath + "/binding/workerId",
																	schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format",
																	keyword: "format",
																	params: { format: "uuid" },
																	message: "must match format \"uuid\""
																}];
																return false;
															}
														} else {
															validate25.errors = [{
																instancePath: instancePath + "/binding/workerId",
																schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type",
																keyword: "type",
																params: { type: "string" },
																message: "must be string"
															}];
															return false;
														}
														var valid2 = true;
													} else var valid2 = true;
													if (valid2) {
														if (data2.writerFence !== void 0) {
															let data9 = data2.writerFence;
															if (!(typeof data9 == "number" && !(data9 % 1) && !isNaN(data9) && isFinite(data9))) {
																validate25.errors = [{
																	instancePath: instancePath + "/binding/writerFence",
																	schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type",
																	keyword: "type",
																	params: { type: "integer" },
																	message: "must be integer"
																}];
																return false;
															}
															if (typeof data9 == "number" && isFinite(data9)) {
																if (data9 > 9007199254740991 || isNaN(data9)) {
																	validate25.errors = [{
																		instancePath: instancePath + "/binding/writerFence",
																		schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum",
																		keyword: "maximum",
																		params: {
																			comparison: "<=",
																			limit: 9007199254740991
																		},
																		message: "must be <= 9007199254740991"
																	}];
																	return false;
																} else if (data9 < 1 || isNaN(data9)) {
																	validate25.errors = [{
																		instancePath: instancePath + "/binding/writerFence",
																		schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum",
																		keyword: "minimum",
																		params: {
																			comparison: ">=",
																			limit: 1
																		},
																		message: "must be >= 1"
																	}];
																	return false;
																}
															}
															var valid2 = true;
														} else var valid2 = true;
													}
												}
											}
										}
									}
								}
							}
						} else {
							validate25.errors = [{
								instancePath: instancePath + "/binding",
								schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type",
								keyword: "type",
								params: { type: "object" },
								message: "must be object"
							}];
							return false;
						}
						var valid0 = true;
					} else var valid0 = true;
					if (valid0) {
						if (data.action !== void 0) {
							if ("task.update" !== data.action) {
								validate25.errors = [{
									instancePath: instancePath + "/action",
									schemaPath: "#/properties/action/const",
									keyword: "const",
									params: { allowedValue: "task.update" },
									message: "must be equal to constant"
								}];
								return false;
							}
							var valid0 = true;
						} else var valid0 = true;
						if (valid0) {
							if (data.arguments !== void 0) {
								let data11 = data.arguments;
								if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
									let missing2;
									if (data11.taskId === void 0 && (missing2 = "taskId") || data11.mode === void 0 && (missing2 = "mode") || data11.patch === void 0 && (missing2 = "patch")) {
										validate25.errors = [{
											instancePath: instancePath + "/arguments",
											schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/required",
											keyword: "required",
											params: { missingProperty: missing2 },
											message: "must have required property '" + missing2 + "'"
										}];
										return false;
									} else {
										for (const key2 in data11) if (!(key2 === "taskId" || key2 === "mode" || key2 === "patch")) {
											validate25.errors = [{
												instancePath: instancePath + "/arguments",
												schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/additionalProperties",
												keyword: "additionalProperties",
												params: { additionalProperty: key2 },
												message: "must NOT have additional properties"
											}];
											return false;
										}
										if (data11.taskId !== void 0) {
											let data12 = data11.taskId;
											if (typeof data12 === "string") {
												if (!formats0.test(data12)) {
													validate25.errors = [{
														instancePath: instancePath + "/arguments/taskId",
														schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/taskId/format",
														keyword: "format",
														params: { format: "uuid" },
														message: "must match format \"uuid\""
													}];
													return false;
												}
											} else {
												validate25.errors = [{
													instancePath: instancePath + "/arguments/taskId",
													schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/taskId/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												}];
												return false;
											}
											var valid4 = true;
										} else var valid4 = true;
										if (valid4) {
											if (data11.mode !== void 0) {
												if ("unconditional_patch" !== data11.mode) {
													validate25.errors = [{
														instancePath: instancePath + "/arguments/mode",
														schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/mode/const",
														keyword: "const",
														params: { allowedValue: "unconditional_patch" },
														message: "must be equal to constant"
													}];
													return false;
												}
												var valid4 = true;
											} else var valid4 = true;
											if (valid4) {
												if (data11.patch !== void 0) {
													let data14 = data11.patch;
													if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
														if (Object.keys(data14).length < 1) {
															validate25.errors = [{
																instancePath: instancePath + "/arguments/patch",
																schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/minProperties",
																keyword: "minProperties",
																params: { limit: 1 },
																message: "must NOT have fewer than 1 properties"
															}];
															return false;
														} else {
															for (const key3 in data14) if (!(key3 === "title" || key3 === "status" || key3 === "dueDate")) {
																validate25.errors = [{
																	instancePath: instancePath + "/arguments/patch",
																	schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/additionalProperties",
																	keyword: "additionalProperties",
																	params: { additionalProperty: key3 },
																	message: "must NOT have additional properties"
																}];
																return false;
															}
															if (data14.title !== void 0) {
																let data15 = data14.title;
																if (typeof data15 === "string") {
																	if (func1(data15) > 240) {
																		validate25.errors = [{
																			instancePath: instancePath + "/arguments/patch/title",
																			schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/maxLength",
																			keyword: "maxLength",
																			params: { limit: 240 },
																			message: "must NOT have more than 240 characters"
																		}];
																		return false;
																	} else if (func1(data15) < 1) {
																		validate25.errors = [{
																			instancePath: instancePath + "/arguments/patch/title",
																			schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/minLength",
																			keyword: "minLength",
																			params: { limit: 1 },
																			message: "must NOT have fewer than 1 characters"
																		}];
																		return false;
																	}
																} else {
																	validate25.errors = [{
																		instancePath: instancePath + "/arguments/patch/title",
																		schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/type",
																		keyword: "type",
																		params: { type: "string" },
																		message: "must be string"
																	}];
																	return false;
																}
																var valid5 = true;
															} else var valid5 = true;
															if (valid5) {
																if (data14.status !== void 0) {
																	let data16 = data14.status;
																	if (!(data16 === "todo" || data16 === "in_progress" || data16 === "done" || data16 === "blocked" || data16 === "canceled")) {
																		validate25.errors = [{
																			instancePath: instancePath + "/arguments/patch/status",
																			schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/status/enum",
																			keyword: "enum",
																			params: { allowedValues: schema35.properties.patch.properties.status.enum },
																			message: "must be equal to one of the allowed values"
																		}];
																		return false;
																	}
																	var valid5 = true;
																} else var valid5 = true;
																if (valid5) {
																	if (data14.dueDate !== void 0) {
																		let data17 = data14.dueDate;
																		if (typeof data17 === "string") {
																			if (!pattern4.test(data17)) {
																				validate25.errors = [{
																					instancePath: instancePath + "/arguments/patch/dueDate",
																					schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/pattern",
																					keyword: "pattern",
																					params: { pattern: "Z$" },
																					message: "must match pattern \"Z$\""
																				}];
																				return false;
																			} else if (!formats2.validate(data17)) {
																				validate25.errors = [{
																					instancePath: instancePath + "/arguments/patch/dueDate",
																					schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/format",
																					keyword: "format",
																					params: { format: "date-time" },
																					message: "must match format \"date-time\""
																				}];
																				return false;
																			}
																		} else {
																			validate25.errors = [{
																				instancePath: instancePath + "/arguments/patch/dueDate",
																				schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/type",
																				keyword: "type",
																				params: { type: "string" },
																				message: "must be string"
																			}];
																			return false;
																		}
																		var valid5 = true;
																	} else var valid5 = true;
																}
															}
														}
													} else {
														validate25.errors = [{
															instancePath: instancePath + "/arguments/patch",
															schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/type",
															keyword: "type",
															params: { type: "object" },
															message: "must be object"
														}];
														return false;
													}
													var valid4 = true;
												} else var valid4 = true;
											}
										}
									}
								} else {
									validate25.errors = [{
										instancePath: instancePath + "/arguments",
										schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/type",
										keyword: "type",
										params: { type: "object" },
										message: "must be object"
									}];
									return false;
								}
								var valid0 = true;
							} else var valid0 = true;
							if (valid0) {
								if (data.attachments !== void 0) {
									let data18 = data.attachments;
									if (Array.isArray(data18)) {
										if (data18.length > 0) {
											validate25.errors = [{
												instancePath: instancePath + "/attachments",
												schemaPath: "#/properties/attachments/maxItems",
												keyword: "maxItems",
												params: { limit: 0 },
												message: "must NOT have more than 0 items"
											}];
											return false;
										}
									} else {
										validate25.errors = [{
											instancePath: instancePath + "/attachments",
											schemaPath: "#/properties/attachments/type",
											keyword: "type",
											params: { type: "array" },
											message: "must be array"
										}];
										return false;
									}
									var valid0 = true;
								} else var valid0 = true;
								if (valid0) {
									if (data.scopes !== void 0) {
										let data19 = data.scopes;
										if (Array.isArray(data19)) {
											if (data19.length < 1) {
												validate25.errors = [{
													instancePath: instancePath + "/scopes",
													schemaPath: "#/properties/scopes/minItems",
													keyword: "minItems",
													params: { limit: 1 },
													message: "must NOT have fewer than 1 items"
												}];
												return false;
											} else {
												var valid6 = true;
												const len0 = data19.length;
												for (let i0 = 0; i0 < len0; i0++) {
													let data20 = data19[i0];
													if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
														let missing3;
														if (data20.tenantId === void 0 && (missing3 = "tenantId") || data20.kind === void 0 && (missing3 = "kind") || data20.resourceId === void 0 && (missing3 = "resourceId") || data20.policyRevision === void 0 && (missing3 = "policyRevision")) {
															validate25.errors = [{
																instancePath: instancePath + "/scopes/" + i0,
																schemaPath: "#/$defs/Canonical_Scope_f882edb5/required",
																keyword: "required",
																params: { missingProperty: missing3 },
																message: "must have required property '" + missing3 + "'"
															}];
															return false;
														} else {
															for (const key4 in data20) if (!(key4 === "tenantId" || key4 === "kind" || key4 === "resourceId" || key4 === "policyRevision")) {
																validate25.errors = [{
																	instancePath: instancePath + "/scopes/" + i0,
																	schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties",
																	keyword: "additionalProperties",
																	params: { additionalProperty: key4 },
																	message: "must NOT have additional properties"
																}];
																return false;
															}
															if (data20.tenantId !== void 0) {
																let data21 = data20.tenantId;
																if (typeof data21 === "string") {
																	if (func1(data21) > 128) {
																		validate25.errors = [{
																			instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																			schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength",
																			keyword: "maxLength",
																			params: { limit: 128 },
																			message: "must NOT have more than 128 characters"
																		}];
																		return false;
																	} else if (func1(data21) < 1) {
																		validate25.errors = [{
																			instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																			schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength",
																			keyword: "minLength",
																			params: { limit: 1 },
																			message: "must NOT have fewer than 1 characters"
																		}];
																		return false;
																	}
																} else {
																	validate25.errors = [{
																		instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																		schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type",
																		keyword: "type",
																		params: { type: "string" },
																		message: "must be string"
																	}];
																	return false;
																}
																var valid8 = true;
															} else var valid8 = true;
															if (valid8) {
																if (data20.kind !== void 0) {
																	let data22 = data20.kind;
																	if (typeof data22 !== "string") {
																		validate25.errors = [{
																			instancePath: instancePath + "/scopes/" + i0 + "/kind",
																			schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type",
																			keyword: "type",
																			params: { type: "string" },
																			message: "must be string"
																		}];
																		return false;
																	}
																	if (!(data22 === "tenant" || data22 === "client" || data22 === "mailbox" || data22 === "memory" || data22 === "document" || data22 === "private-user" || data22 === "public")) {
																		validate25.errors = [{
																			instancePath: instancePath + "/scopes/" + i0 + "/kind",
																			schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum",
																			keyword: "enum",
																			params: { allowedValues: schema41.properties.kind.enum },
																			message: "must be equal to one of the allowed values"
																		}];
																		return false;
																	}
																	var valid8 = true;
																} else var valid8 = true;
																if (valid8) {
																	if (data20.resourceId !== void 0) {
																		let data23 = data20.resourceId;
																		if (typeof data23 === "string") {
																			if (func1(data23) > 256) {
																				validate25.errors = [{
																					instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																					schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength",
																					keyword: "maxLength",
																					params: { limit: 256 },
																					message: "must NOT have more than 256 characters"
																				}];
																				return false;
																			} else if (func1(data23) < 1) {
																				validate25.errors = [{
																					instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																					schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength",
																					keyword: "minLength",
																					params: { limit: 1 },
																					message: "must NOT have fewer than 1 characters"
																				}];
																				return false;
																			}
																		} else {
																			validate25.errors = [{
																				instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																				schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type",
																				keyword: "type",
																				params: { type: "string" },
																				message: "must be string"
																			}];
																			return false;
																		}
																		var valid8 = true;
																	} else var valid8 = true;
																	if (valid8) {
																		if (data20.policyRevision !== void 0) {
																			let data24 = data20.policyRevision;
																			if (typeof data24 === "string") {
																				if (func1(data24) > 128) {
																					validate25.errors = [{
																						instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																						schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength",
																						keyword: "maxLength",
																						params: { limit: 128 },
																						message: "must NOT have more than 128 characters"
																					}];
																					return false;
																				} else if (func1(data24) < 1) {
																					validate25.errors = [{
																						instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																						schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength",
																						keyword: "minLength",
																						params: { limit: 1 },
																						message: "must NOT have fewer than 1 characters"
																					}];
																					return false;
																				}
																			} else {
																				validate25.errors = [{
																					instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																					schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type",
																					keyword: "type",
																					params: { type: "string" },
																					message: "must be string"
																				}];
																				return false;
																			}
																			var valid8 = true;
																		} else var valid8 = true;
																	}
																}
															}
														}
													} else {
														validate25.errors = [{
															instancePath: instancePath + "/scopes/" + i0,
															schemaPath: "#/$defs/Canonical_Scope_f882edb5/type",
															keyword: "type",
															params: { type: "object" },
															message: "must be object"
														}];
														return false;
													}
													var valid6 = true;
													if (!valid6) break;
												}
												if (valid6) {
													let i1 = data19.length;
													let j0;
													if (i1 > 1) {
														outer0: for (; i1--;) for (j0 = i1; j0--;) if (func0(data19[i1], data19[j0])) {
															validate25.errors = [{
																instancePath: instancePath + "/scopes",
																schemaPath: "#/properties/scopes/uniqueItems",
																keyword: "uniqueItems",
																params: {
																	i: i1,
																	j: j0
																},
																message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)"
															}];
															return false;
														}
													}
												}
											}
										} else {
											validate25.errors = [{
												instancePath: instancePath + "/scopes",
												schemaPath: "#/properties/scopes/type",
												keyword: "type",
												params: { type: "array" },
												message: "must be array"
											}];
											return false;
										}
										var valid0 = true;
									} else var valid0 = true;
									if (valid0) {
										if (data.idempotencyKey !== void 0) {
											let data25 = data.idempotencyKey;
											if (typeof data25 === "string") {
												if (func1(data25) > 128) {
													validate25.errors = [{
														instancePath: instancePath + "/idempotencyKey",
														schemaPath: "#/properties/idempotencyKey/maxLength",
														keyword: "maxLength",
														params: { limit: 128 },
														message: "must NOT have more than 128 characters"
													}];
													return false;
												} else if (func1(data25) < 1) {
													validate25.errors = [{
														instancePath: instancePath + "/idempotencyKey",
														schemaPath: "#/properties/idempotencyKey/minLength",
														keyword: "minLength",
														params: { limit: 1 },
														message: "must NOT have fewer than 1 characters"
													}];
													return false;
												}
											} else {
												validate25.errors = [{
													instancePath: instancePath + "/idempotencyKey",
													schemaPath: "#/properties/idempotencyKey/type",
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
							}
						}
					}
				}
			}
		}
	} else {
		validate25.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate25.errors = vErrors;
	return true;
}
validate25.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const pattern6 = /* @__PURE__ */ new RegExp("^[a-f0-9]{64}$", "u");
function validate58(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate58.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.proposalId === void 0 && (missing0 = "proposalId") || data.command === void 0 && (missing0 = "command") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.createdAt === void 0 && (missing0 = "createdAt") || data.expiresAt === void 0 && (missing0 = "expiresAt") || data.requiredApprover === void 0 && (missing0 = "requiredApprover")) {
				validate58.errors = [{
					instancePath,
					schemaPath: "#/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				}];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) if (!(key0 === "proposalId" || key0 === "command" || key0 === "commandSha256" || key0 === "createdAt" || key0 === "expiresAt" || key0 === "requiredApprover")) {
					validate58.errors = [{
						instancePath,
						schemaPath: "#/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					}];
					return false;
				}
				if (_errs1 === errors) {
					if (data.proposalId !== void 0) {
						let data0 = data.proposalId;
						const _errs2 = errors;
						if (errors === _errs2) {
							if (errors === _errs2) {
								if (typeof data0 === "string") {
									if (!formats0.test(data0)) {
										validate58.errors = [{
											instancePath: instancePath + "/proposalId",
											schemaPath: "#/properties/proposalId/format",
											keyword: "format",
											params: { format: "uuid" },
											message: "must match format \"uuid\""
										}];
										return false;
									}
								} else {
									validate58.errors = [{
										instancePath: instancePath + "/proposalId",
										schemaPath: "#/properties/proposalId/type",
										keyword: "type",
										params: { type: "string" },
										message: "must be string"
									}];
									return false;
								}
							}
						}
						var valid0 = _errs2 === errors;
					} else var valid0 = true;
					if (valid0) {
						if (data.command !== void 0) {
							const _errs4 = errors;
							if (!validate25(data.command, {
								instancePath: instancePath + "/command",
								parentData: data,
								parentDataProperty: "command",
								rootData,
								dynamicAnchors
							})) {
								vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
								errors = vErrors.length;
							}
							var valid0 = _errs4 === errors;
						} else var valid0 = true;
						if (valid0) {
							if (data.commandSha256 !== void 0) {
								let data2 = data.commandSha256;
								const _errs5 = errors;
								if (errors === _errs5) {
									if (typeof data2 === "string") {
										if (!pattern6.test(data2)) {
											validate58.errors = [{
												instancePath: instancePath + "/commandSha256",
												schemaPath: "#/properties/commandSha256/pattern",
												keyword: "pattern",
												params: { pattern: "^[a-f0-9]{64}$" },
												message: "must match pattern \"^[a-f0-9]{64}$\""
											}];
											return false;
										}
									} else {
										validate58.errors = [{
											instancePath: instancePath + "/commandSha256",
											schemaPath: "#/properties/commandSha256/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
								}
								var valid0 = _errs5 === errors;
							} else var valid0 = true;
							if (valid0) {
								if (data.createdAt !== void 0) {
									let data3 = data.createdAt;
									const _errs7 = errors;
									if (errors === _errs7) {
										if (errors === _errs7) {
											if (typeof data3 === "string") {
												if (!pattern4.test(data3)) {
													validate58.errors = [{
														instancePath: instancePath + "/createdAt",
														schemaPath: "#/properties/createdAt/pattern",
														keyword: "pattern",
														params: { pattern: "Z$" },
														message: "must match pattern \"Z$\""
													}];
													return false;
												} else if (!formats2.validate(data3)) {
													validate58.errors = [{
														instancePath: instancePath + "/createdAt",
														schemaPath: "#/properties/createdAt/format",
														keyword: "format",
														params: { format: "date-time" },
														message: "must match format \"date-time\""
													}];
													return false;
												}
											} else {
												validate58.errors = [{
													instancePath: instancePath + "/createdAt",
													schemaPath: "#/properties/createdAt/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												}];
												return false;
											}
										}
									}
									var valid0 = _errs7 === errors;
								} else var valid0 = true;
								if (valid0) {
									if (data.expiresAt !== void 0) {
										let data4 = data.expiresAt;
										const _errs9 = errors;
										if (errors === _errs9) {
											if (errors === _errs9) {
												if (typeof data4 === "string") {
													if (!pattern4.test(data4)) {
														validate58.errors = [{
															instancePath: instancePath + "/expiresAt",
															schemaPath: "#/properties/expiresAt/pattern",
															keyword: "pattern",
															params: { pattern: "Z$" },
															message: "must match pattern \"Z$\""
														}];
														return false;
													} else if (!formats2.validate(data4)) {
														validate58.errors = [{
															instancePath: instancePath + "/expiresAt",
															schemaPath: "#/properties/expiresAt/format",
															keyword: "format",
															params: { format: "date-time" },
															message: "must match format \"date-time\""
														}];
														return false;
													}
												} else {
													validate58.errors = [{
														instancePath: instancePath + "/expiresAt",
														schemaPath: "#/properties/expiresAt/type",
														keyword: "type",
														params: { type: "string" },
														message: "must be string"
													}];
													return false;
												}
											}
										}
										var valid0 = _errs9 === errors;
									} else var valid0 = true;
									if (valid0) {
										if (data.requiredApprover !== void 0) {
											let data5 = data.requiredApprover;
											const _errs11 = errors;
											if (errors === errors) {
												if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
													let missing1;
													if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.actorId === void 0 && (missing1 = "actorId")) {
														validate58.errors = [{
															instancePath: instancePath + "/requiredApprover",
															schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/required",
															keyword: "required",
															params: { missingProperty: missing1 },
															message: "must have required property '" + missing1 + "'"
														}];
														return false;
													} else {
														const _errs14 = errors;
														for (const key1 in data5) if (!(key1 === "tenantId" || key1 === "actorId")) {
															validate58.errors = [{
																instancePath: instancePath + "/requiredApprover",
																schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/additionalProperties",
																keyword: "additionalProperties",
																params: { additionalProperty: key1 },
																message: "must NOT have additional properties"
															}];
															return false;
														}
														if (_errs14 === errors) {
															if (data5.tenantId !== void 0) {
																let data6 = data5.tenantId;
																const _errs15 = errors;
																if (errors === _errs15) {
																	if (typeof data6 === "string") {
																		if (func1(data6) > 128) {
																			validate58.errors = [{
																				instancePath: instancePath + "/requiredApprover/tenantId",
																				schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/maxLength",
																				keyword: "maxLength",
																				params: { limit: 128 },
																				message: "must NOT have more than 128 characters"
																			}];
																			return false;
																		} else if (func1(data6) < 1) {
																			validate58.errors = [{
																				instancePath: instancePath + "/requiredApprover/tenantId",
																				schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/minLength",
																				keyword: "minLength",
																				params: { limit: 1 },
																				message: "must NOT have fewer than 1 characters"
																			}];
																			return false;
																		}
																	} else {
																		validate58.errors = [{
																			instancePath: instancePath + "/requiredApprover/tenantId",
																			schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/type",
																			keyword: "type",
																			params: { type: "string" },
																			message: "must be string"
																		}];
																		return false;
																	}
																}
																var valid2 = _errs15 === errors;
															} else var valid2 = true;
															if (valid2) {
																if (data5.actorId !== void 0) {
																	let data7 = data5.actorId;
																	const _errs17 = errors;
																	if (errors === _errs17) {
																		if (typeof data7 === "string") {
																			if (func1(data7) > 128) {
																				validate58.errors = [{
																					instancePath: instancePath + "/requiredApprover/actorId",
																					schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/maxLength",
																					keyword: "maxLength",
																					params: { limit: 128 },
																					message: "must NOT have more than 128 characters"
																				}];
																				return false;
																			} else if (func1(data7) < 1) {
																				validate58.errors = [{
																					instancePath: instancePath + "/requiredApprover/actorId",
																					schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/minLength",
																					keyword: "minLength",
																					params: { limit: 1 },
																					message: "must NOT have fewer than 1 characters"
																				}];
																				return false;
																			}
																		} else {
																			validate58.errors = [{
																				instancePath: instancePath + "/requiredApprover/actorId",
																				schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/type",
																				keyword: "type",
																				params: { type: "string" },
																				message: "must be string"
																			}];
																			return false;
																		}
																	}
																	var valid2 = _errs17 === errors;
																} else var valid2 = true;
															}
														}
													}
												} else {
													validate58.errors = [{
														instancePath: instancePath + "/requiredApprover",
														schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/type",
														keyword: "type",
														params: { type: "object" },
														message: "must be object"
													}];
													return false;
												}
											}
											var valid0 = _errs11 === errors;
										} else var valid0 = true;
									}
								}
							}
						}
					}
				}
			}
		} else {
			validate58.errors = [{
				instancePath,
				schemaPath: "#/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			}];
			return false;
		}
	}
	validate58.errors = vErrors;
	return errors === 0;
}
validate58.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskUpdateResult = validate60;
const schema44 = {
	"type": "object",
	"properties": {
		"id": {
			"type": "string",
			"format": "uuid"
		},
		"title": { "type": "string" },
		"status": { "enum": [
			"todo",
			"in_progress",
			"done",
			"blocked",
			"canceled"
		] },
		"dueDate": { "anyOf": [{
			"type": "string",
			"format": "date-time",
			"pattern": "Z$"
		}, { "type": "null" }] },
		"clientId": { "anyOf": [{
			"type": "string",
			"format": "uuid"
		}, { "type": "null" }] },
		"updatedAt": {
			"type": "string",
			"format": "date-time",
			"pattern": "Z$"
		}
	},
	"required": [
		"id",
		"title",
		"status",
		"dueDate",
		"clientId",
		"updatedAt"
	],
	"additionalProperties": false
};
function validate60(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate60.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.id === void 0 && (missing0 = "id") || data.title === void 0 && (missing0 = "title") || data.status === void 0 && (missing0 = "status") || data.dueDate === void 0 && (missing0 = "dueDate") || data.clientId === void 0 && (missing0 = "clientId") || data.updatedAt === void 0 && (missing0 = "updatedAt")) {
				validate60.errors = [{
					instancePath,
					schemaPath: "#/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				}];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) if (!(key0 === "id" || key0 === "title" || key0 === "status" || key0 === "dueDate" || key0 === "clientId" || key0 === "updatedAt")) {
					validate60.errors = [{
						instancePath,
						schemaPath: "#/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					}];
					return false;
				}
				if (_errs1 === errors) {
					if (data.id !== void 0) {
						let data0 = data.id;
						const _errs2 = errors;
						if (errors === _errs2) {
							if (errors === _errs2) {
								if (typeof data0 === "string") {
									if (!formats0.test(data0)) {
										validate60.errors = [{
											instancePath: instancePath + "/id",
											schemaPath: "#/properties/id/format",
											keyword: "format",
											params: { format: "uuid" },
											message: "must match format \"uuid\""
										}];
										return false;
									}
								} else {
									validate60.errors = [{
										instancePath: instancePath + "/id",
										schemaPath: "#/properties/id/type",
										keyword: "type",
										params: { type: "string" },
										message: "must be string"
									}];
									return false;
								}
							}
						}
						var valid0 = _errs2 === errors;
					} else var valid0 = true;
					if (valid0) {
						if (data.title !== void 0) {
							const _errs4 = errors;
							if (typeof data.title !== "string") {
								validate60.errors = [{
									instancePath: instancePath + "/title",
									schemaPath: "#/properties/title/type",
									keyword: "type",
									params: { type: "string" },
									message: "must be string"
								}];
								return false;
							}
							var valid0 = _errs4 === errors;
						} else var valid0 = true;
						if (valid0) {
							if (data.status !== void 0) {
								let data2 = data.status;
								const _errs6 = errors;
								if (!(data2 === "todo" || data2 === "in_progress" || data2 === "done" || data2 === "blocked" || data2 === "canceled")) {
									validate60.errors = [{
										instancePath: instancePath + "/status",
										schemaPath: "#/properties/status/enum",
										keyword: "enum",
										params: { allowedValues: schema44.properties.status.enum },
										message: "must be equal to one of the allowed values"
									}];
									return false;
								}
								var valid0 = _errs6 === errors;
							} else var valid0 = true;
							if (valid0) {
								if (data.dueDate !== void 0) {
									let data3 = data.dueDate;
									const _errs7 = errors;
									const _errs8 = errors;
									let valid1 = false;
									const _errs9 = errors;
									if (errors === _errs9) {
										if (errors === _errs9) {
											if (typeof data3 === "string") {
												if (!pattern4.test(data3)) {
													const err0 = {
														instancePath: instancePath + "/dueDate",
														schemaPath: "#/properties/dueDate/anyOf/0/pattern",
														keyword: "pattern",
														params: { pattern: "Z$" },
														message: "must match pattern \"Z$\""
													};
													if (vErrors === null) vErrors = [err0];
													else vErrors.push(err0);
													errors++;
												} else if (!formats2.validate(data3)) {
													const err1 = {
														instancePath: instancePath + "/dueDate",
														schemaPath: "#/properties/dueDate/anyOf/0/format",
														keyword: "format",
														params: { format: "date-time" },
														message: "must match format \"date-time\""
													};
													if (vErrors === null) vErrors = [err1];
													else vErrors.push(err1);
													errors++;
												}
											} else {
												const err2 = {
													instancePath: instancePath + "/dueDate",
													schemaPath: "#/properties/dueDate/anyOf/0/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												};
												if (vErrors === null) vErrors = [err2];
												else vErrors.push(err2);
												errors++;
											}
										}
									}
									var _valid0 = _errs9 === errors;
									valid1 = valid1 || _valid0;
									const _errs11 = errors;
									if (data3 !== null) {
										const err3 = {
											instancePath: instancePath + "/dueDate",
											schemaPath: "#/properties/dueDate/anyOf/1/type",
											keyword: "type",
											params: { type: "null" },
											message: "must be null"
										};
										if (vErrors === null) vErrors = [err3];
										else vErrors.push(err3);
										errors++;
									}
									var _valid0 = _errs11 === errors;
									valid1 = valid1 || _valid0;
									if (!valid1) {
										const err4 = {
											instancePath: instancePath + "/dueDate",
											schemaPath: "#/properties/dueDate/anyOf",
											keyword: "anyOf",
											params: {},
											message: "must match a schema in anyOf"
										};
										if (vErrors === null) vErrors = [err4];
										else vErrors.push(err4);
										errors++;
										validate60.errors = vErrors;
										return false;
									} else {
										errors = _errs8;
										if (vErrors !== null) {
											if (_errs8) vErrors.length = _errs8;
											else vErrors = null;
										}
									}
									var valid0 = _errs7 === errors;
								} else var valid0 = true;
								if (valid0) {
									if (data.clientId !== void 0) {
										let data4 = data.clientId;
										const _errs13 = errors;
										const _errs14 = errors;
										let valid2 = false;
										const _errs15 = errors;
										if (errors === _errs15) {
											if (errors === _errs15) {
												if (typeof data4 === "string") {
													if (!formats0.test(data4)) {
														const err5 = {
															instancePath: instancePath + "/clientId",
															schemaPath: "#/properties/clientId/anyOf/0/format",
															keyword: "format",
															params: { format: "uuid" },
															message: "must match format \"uuid\""
														};
														if (vErrors === null) vErrors = [err5];
														else vErrors.push(err5);
														errors++;
													}
												} else {
													const err6 = {
														instancePath: instancePath + "/clientId",
														schemaPath: "#/properties/clientId/anyOf/0/type",
														keyword: "type",
														params: { type: "string" },
														message: "must be string"
													};
													if (vErrors === null) vErrors = [err6];
													else vErrors.push(err6);
													errors++;
												}
											}
										}
										var _valid1 = _errs15 === errors;
										valid2 = valid2 || _valid1;
										const _errs17 = errors;
										if (data4 !== null) {
											const err7 = {
												instancePath: instancePath + "/clientId",
												schemaPath: "#/properties/clientId/anyOf/1/type",
												keyword: "type",
												params: { type: "null" },
												message: "must be null"
											};
											if (vErrors === null) vErrors = [err7];
											else vErrors.push(err7);
											errors++;
										}
										var _valid1 = _errs17 === errors;
										valid2 = valid2 || _valid1;
										if (!valid2) {
											const err8 = {
												instancePath: instancePath + "/clientId",
												schemaPath: "#/properties/clientId/anyOf",
												keyword: "anyOf",
												params: {},
												message: "must match a schema in anyOf"
											};
											if (vErrors === null) vErrors = [err8];
											else vErrors.push(err8);
											errors++;
											validate60.errors = vErrors;
											return false;
										} else {
											errors = _errs14;
											if (vErrors !== null) {
												if (_errs14) vErrors.length = _errs14;
												else vErrors = null;
											}
										}
										var valid0 = _errs13 === errors;
									} else var valid0 = true;
									if (valid0) {
										if (data.updatedAt !== void 0) {
											let data5 = data.updatedAt;
											const _errs19 = errors;
											if (errors === _errs19) {
												if (errors === _errs19) {
													if (typeof data5 === "string") {
														if (!pattern4.test(data5)) {
															validate60.errors = [{
																instancePath: instancePath + "/updatedAt",
																schemaPath: "#/properties/updatedAt/pattern",
																keyword: "pattern",
																params: { pattern: "Z$" },
																message: "must match pattern \"Z$\""
															}];
															return false;
														} else if (!formats2.validate(data5)) {
															validate60.errors = [{
																instancePath: instancePath + "/updatedAt",
																schemaPath: "#/properties/updatedAt/format",
																keyword: "format",
																params: { format: "date-time" },
																message: "must match format \"date-time\""
															}];
															return false;
														}
													} else {
														validate60.errors = [{
															instancePath: instancePath + "/updatedAt",
															schemaPath: "#/properties/updatedAt/type",
															keyword: "type",
															params: { type: "string" },
															message: "must be string"
														}];
														return false;
													}
												}
											}
											var valid0 = _errs19 === errors;
										} else var valid0 = true;
									}
								}
							}
						}
					}
				}
			}
		} else {
			validate60.errors = [{
				instancePath,
				schemaPath: "#/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			}];
			return false;
		}
	}
	validate60.errors = vErrors;
	return errors === 0;
}
validate60.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskCommandPrepareRequest = validate61;
function validate61(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate61.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.arguments === void 0 && (missing0 = "arguments")) {
			validate61.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "arguments")) {
				validate61.errors = [{
					instancePath,
					schemaPath: "#/additionalProperties",
					keyword: "additionalProperties",
					params: { additionalProperty: key0 },
					message: "must NOT have additional properties"
				}];
				return false;
			}
			if (data.arguments !== void 0) {
				let data0 = data.arguments;
				if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
					let missing1;
					if (data0.taskId === void 0 && (missing1 = "taskId")) {
						validate61.errors = [{
							instancePath: instancePath + "/arguments",
							schemaPath: "#/$defs/TaskUpdateRaw/required",
							keyword: "required",
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'"
						}];
						return false;
					} else {
						for (const key1 in data0) if (!(key1 === "taskId" || key1 === "title" || key1 === "status" || key1 === "dueDate")) {
							validate61.errors = [{
								instancePath: instancePath + "/arguments",
								schemaPath: "#/$defs/TaskUpdateRaw/additionalProperties",
								keyword: "additionalProperties",
								params: { additionalProperty: key1 },
								message: "must NOT have additional properties"
							}];
							return false;
						}
						if (data0.taskId !== void 0) {
							if (typeof data0.taskId !== "string") {
								validate61.errors = [{
									instancePath: instancePath + "/arguments/taskId",
									schemaPath: "#/$defs/TaskUpdateRaw/properties/taskId/type",
									keyword: "type",
									params: { type: "string" },
									message: "must be string"
								}];
								return false;
							}
							var valid2 = true;
						} else var valid2 = true;
						if (valid2) {
							if (data0.title !== void 0) {
								let data2 = data0.title;
								if (typeof data2 !== "string" && data2 !== null) {
									validate61.errors = [{
										instancePath: instancePath + "/arguments/title",
										schemaPath: "#/$defs/TaskUpdateRaw/properties/title/type",
										keyword: "type",
										params: { type: schema33.properties.title.type },
										message: "must be string,null"
									}];
									return false;
								}
								var valid2 = true;
							} else var valid2 = true;
							if (valid2) {
								if (data0.status !== void 0) {
									let data3 = data0.status;
									if (typeof data3 !== "string" && data3 !== null) {
										validate61.errors = [{
											instancePath: instancePath + "/arguments/status",
											schemaPath: "#/$defs/TaskUpdateRaw/properties/status/type",
											keyword: "type",
											params: { type: schema33.properties.status.type },
											message: "must be string,null"
										}];
										return false;
									}
									var valid2 = true;
								} else var valid2 = true;
								if (valid2) {
									if (data0.dueDate !== void 0) {
										let data4 = data0.dueDate;
										if (typeof data4 !== "string" && data4 !== null) {
											validate61.errors = [{
												instancePath: instancePath + "/arguments/dueDate",
												schemaPath: "#/$defs/TaskUpdateRaw/properties/dueDate/type",
												keyword: "type",
												params: { type: schema33.properties.dueDate.type },
												message: "must be string,null"
											}];
											return false;
										}
										var valid2 = true;
									} else var valid2 = true;
								}
							}
						}
					}
				} else {
					validate61.errors = [{
						instancePath: instancePath + "/arguments",
						schemaPath: "#/$defs/TaskUpdateRaw/type",
						keyword: "type",
						params: { type: "object" },
						message: "must be object"
					}];
					return false;
				}
			}
		}
	} else {
		validate61.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate61.errors = vErrors;
	return true;
}
validate61.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskCommandExecuteRequest = validate62;
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate34.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.proposalId === void 0 && (missing0 = "proposalId") || data.command === void 0 && (missing0 = "command") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.createdAt === void 0 && (missing0 = "createdAt") || data.expiresAt === void 0 && (missing0 = "expiresAt") || data.requiredApprover === void 0 && (missing0 = "requiredApprover")) {
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
				for (const key0 in data) if (!(key0 === "proposalId" || key0 === "command" || key0 === "commandSha256" || key0 === "createdAt" || key0 === "expiresAt" || key0 === "requiredApprover")) {
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
					if (data.proposalId !== void 0) {
						let data0 = data.proposalId;
						const _errs2 = errors;
						if (errors === _errs2) {
							if (errors === _errs2) {
								if (typeof data0 === "string") {
									if (!formats0.test(data0)) {
										validate34.errors = [{
											instancePath: instancePath + "/proposalId",
											schemaPath: "#/properties/proposalId/format",
											keyword: "format",
											params: { format: "uuid" },
											message: "must match format \"uuid\""
										}];
										return false;
									}
								} else {
									validate34.errors = [{
										instancePath: instancePath + "/proposalId",
										schemaPath: "#/properties/proposalId/type",
										keyword: "type",
										params: { type: "string" },
										message: "must be string"
									}];
									return false;
								}
							}
						}
						var valid0 = _errs2 === errors;
					} else var valid0 = true;
					if (valid0) {
						if (data.command !== void 0) {
							const _errs4 = errors;
							if (!validate25(data.command, {
								instancePath: instancePath + "/command",
								parentData: data,
								parentDataProperty: "command",
								rootData,
								dynamicAnchors
							})) {
								vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
								errors = vErrors.length;
							}
							var valid0 = _errs4 === errors;
						} else var valid0 = true;
						if (valid0) {
							if (data.commandSha256 !== void 0) {
								let data2 = data.commandSha256;
								const _errs5 = errors;
								if (errors === _errs5) {
									if (typeof data2 === "string") {
										if (!pattern6.test(data2)) {
											validate34.errors = [{
												instancePath: instancePath + "/commandSha256",
												schemaPath: "#/properties/commandSha256/pattern",
												keyword: "pattern",
												params: { pattern: "^[a-f0-9]{64}$" },
												message: "must match pattern \"^[a-f0-9]{64}$\""
											}];
											return false;
										}
									} else {
										validate34.errors = [{
											instancePath: instancePath + "/commandSha256",
											schemaPath: "#/properties/commandSha256/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
								}
								var valid0 = _errs5 === errors;
							} else var valid0 = true;
							if (valid0) {
								if (data.createdAt !== void 0) {
									let data3 = data.createdAt;
									const _errs7 = errors;
									if (errors === _errs7) {
										if (errors === _errs7) {
											if (typeof data3 === "string") {
												if (!pattern4.test(data3)) {
													validate34.errors = [{
														instancePath: instancePath + "/createdAt",
														schemaPath: "#/properties/createdAt/pattern",
														keyword: "pattern",
														params: { pattern: "Z$" },
														message: "must match pattern \"Z$\""
													}];
													return false;
												} else if (!formats2.validate(data3)) {
													validate34.errors = [{
														instancePath: instancePath + "/createdAt",
														schemaPath: "#/properties/createdAt/format",
														keyword: "format",
														params: { format: "date-time" },
														message: "must match format \"date-time\""
													}];
													return false;
												}
											} else {
												validate34.errors = [{
													instancePath: instancePath + "/createdAt",
													schemaPath: "#/properties/createdAt/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												}];
												return false;
											}
										}
									}
									var valid0 = _errs7 === errors;
								} else var valid0 = true;
								if (valid0) {
									if (data.expiresAt !== void 0) {
										let data4 = data.expiresAt;
										const _errs9 = errors;
										if (errors === _errs9) {
											if (errors === _errs9) {
												if (typeof data4 === "string") {
													if (!pattern4.test(data4)) {
														validate34.errors = [{
															instancePath: instancePath + "/expiresAt",
															schemaPath: "#/properties/expiresAt/pattern",
															keyword: "pattern",
															params: { pattern: "Z$" },
															message: "must match pattern \"Z$\""
														}];
														return false;
													} else if (!formats2.validate(data4)) {
														validate34.errors = [{
															instancePath: instancePath + "/expiresAt",
															schemaPath: "#/properties/expiresAt/format",
															keyword: "format",
															params: { format: "date-time" },
															message: "must match format \"date-time\""
														}];
														return false;
													}
												} else {
													validate34.errors = [{
														instancePath: instancePath + "/expiresAt",
														schemaPath: "#/properties/expiresAt/type",
														keyword: "type",
														params: { type: "string" },
														message: "must be string"
													}];
													return false;
												}
											}
										}
										var valid0 = _errs9 === errors;
									} else var valid0 = true;
									if (valid0) {
										if (data.requiredApprover !== void 0) {
											let data5 = data.requiredApprover;
											const _errs11 = errors;
											if (errors === errors) {
												if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
													let missing1;
													if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.actorId === void 0 && (missing1 = "actorId")) {
														validate34.errors = [{
															instancePath: instancePath + "/requiredApprover",
															schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/required",
															keyword: "required",
															params: { missingProperty: missing1 },
															message: "must have required property '" + missing1 + "'"
														}];
														return false;
													} else {
														const _errs14 = errors;
														for (const key1 in data5) if (!(key1 === "tenantId" || key1 === "actorId")) {
															validate34.errors = [{
																instancePath: instancePath + "/requiredApprover",
																schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/additionalProperties",
																keyword: "additionalProperties",
																params: { additionalProperty: key1 },
																message: "must NOT have additional properties"
															}];
															return false;
														}
														if (_errs14 === errors) {
															if (data5.tenantId !== void 0) {
																let data6 = data5.tenantId;
																const _errs15 = errors;
																if (errors === _errs15) {
																	if (typeof data6 === "string") {
																		if (func1(data6) > 128) {
																			validate34.errors = [{
																				instancePath: instancePath + "/requiredApprover/tenantId",
																				schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/maxLength",
																				keyword: "maxLength",
																				params: { limit: 128 },
																				message: "must NOT have more than 128 characters"
																			}];
																			return false;
																		} else if (func1(data6) < 1) {
																			validate34.errors = [{
																				instancePath: instancePath + "/requiredApprover/tenantId",
																				schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/minLength",
																				keyword: "minLength",
																				params: { limit: 1 },
																				message: "must NOT have fewer than 1 characters"
																			}];
																			return false;
																		}
																	} else {
																		validate34.errors = [{
																			instancePath: instancePath + "/requiredApprover/tenantId",
																			schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/type",
																			keyword: "type",
																			params: { type: "string" },
																			message: "must be string"
																		}];
																		return false;
																	}
																}
																var valid2 = _errs15 === errors;
															} else var valid2 = true;
															if (valid2) {
																if (data5.actorId !== void 0) {
																	let data7 = data5.actorId;
																	const _errs17 = errors;
																	if (errors === _errs17) {
																		if (typeof data7 === "string") {
																			if (func1(data7) > 128) {
																				validate34.errors = [{
																					instancePath: instancePath + "/requiredApprover/actorId",
																					schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/maxLength",
																					keyword: "maxLength",
																					params: { limit: 128 },
																					message: "must NOT have more than 128 characters"
																				}];
																				return false;
																			} else if (func1(data7) < 1) {
																				validate34.errors = [{
																					instancePath: instancePath + "/requiredApprover/actorId",
																					schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/minLength",
																					keyword: "minLength",
																					params: { limit: 1 },
																					message: "must NOT have fewer than 1 characters"
																				}];
																				return false;
																			}
																		} else {
																			validate34.errors = [{
																				instancePath: instancePath + "/requiredApprover/actorId",
																				schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/type",
																				keyword: "type",
																				params: { type: "string" },
																				message: "must be string"
																			}];
																			return false;
																		}
																	}
																	var valid2 = _errs17 === errors;
																} else var valid2 = true;
															}
														}
													}
												} else {
													validate34.errors = [{
														instancePath: instancePath + "/requiredApprover",
														schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/type",
														keyword: "type",
														params: { type: "object" },
														message: "must be object"
													}];
													return false;
												}
											}
											var valid0 = _errs11 === errors;
										} else var valid0 = true;
									}
								}
							}
						}
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
function validate62(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate62.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.proposal === void 0 && (missing0 = "proposal")) {
				validate62.errors = [{
					instancePath,
					schemaPath: "#/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				}];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) if (!(key0 === "proposal")) {
					validate62.errors = [{
						instancePath,
						schemaPath: "#/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					}];
					return false;
				}
				if (_errs1 === errors) {
					if (data.proposal !== void 0) {
						if (!validate34(data.proposal, {
							instancePath: instancePath + "/proposal",
							parentData: data,
							parentDataProperty: "proposal",
							rootData,
							dynamicAnchors
						})) {
							vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
							errors = vErrors.length;
						}
					}
				}
			}
		} else {
			validate62.errors = [{
				instancePath,
				schemaPath: "#/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			}];
			return false;
		}
	}
	validate62.errors = vErrors;
	return errors === 0;
}
validate62.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskCommandPrepareResponse = validate64;
function validate64(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate64.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.status === void 0 && (missing0 = "status") || data.proposal === void 0 && (missing0 = "proposal")) {
				validate64.errors = [{
					instancePath,
					schemaPath: "#/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				}];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) if (!(key0 === "status" || key0 === "proposal")) {
					validate64.errors = [{
						instancePath,
						schemaPath: "#/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					}];
					return false;
				}
				if (_errs1 === errors) {
					if (data.status !== void 0) {
						const _errs2 = errors;
						if ("approval_required" !== data.status) {
							validate64.errors = [{
								instancePath: instancePath + "/status",
								schemaPath: "#/properties/status/const",
								keyword: "const",
								params: { allowedValue: "approval_required" },
								message: "must be equal to constant"
							}];
							return false;
						}
						var valid0 = _errs2 === errors;
					} else var valid0 = true;
					if (valid0) {
						if (data.proposal !== void 0) {
							const _errs3 = errors;
							if (!validate34(data.proposal, {
								instancePath: instancePath + "/proposal",
								parentData: data,
								parentDataProperty: "proposal",
								rootData,
								dynamicAnchors
							})) {
								vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
								errors = vErrors.length;
							}
							var valid0 = _errs3 === errors;
						} else var valid0 = true;
					}
				}
			}
		} else {
			validate64.errors = [{
				instancePath,
				schemaPath: "#/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			}];
			return false;
		}
	}
	validate64.errors = vErrors;
	return errors === 0;
}
validate64.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskCommandExecuteResponse = validate66;
const schema56 = {
	"type": "object",
	"properties": {
		"receiptId": {
			"type": "string",
			"format": "uuid"
		},
		"commandId": {
			"type": "string",
			"format": "uuid"
		},
		"commandSha256": {
			"type": "string",
			"pattern": "^[a-f0-9]{64}$"
		},
		"idempotencyKey": {
			"type": "string",
			"minLength": 1
		},
		"binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" },
		"outcome": {
			"type": "string",
			"enum": [
				"succeeded",
				"denied",
				"failed",
				"indeterminate"
			]
		},
		"sourceTransactionId": { "anyOf": [{
			"type": "string",
			"minLength": 1
		}, { "type": "null" }] },
		"completedAt": {
			"type": "string",
			"format": "date-time",
			"pattern": "Z$"
		},
		"scopes": {
			"type": "array",
			"items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" },
			"minItems": 1,
			"uniqueItems": true
		},
		"authorizationDecisionId": {
			"type": "string",
			"format": "uuid"
		}
	},
	"required": [
		"receiptId",
		"commandId",
		"commandSha256",
		"idempotencyKey",
		"binding",
		"outcome",
		"sourceTransactionId",
		"completedAt",
		"scopes",
		"authorizationDecisionId"
	],
	"additionalProperties": false
};
const func26 = Object.prototype.hasOwnProperty;
function validate44(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate44.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (errors === 0) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.receiptId === void 0 && (missing0 = "receiptId") || data.commandId === void 0 && (missing0 = "commandId") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.idempotencyKey === void 0 && (missing0 = "idempotencyKey") || data.binding === void 0 && (missing0 = "binding") || data.outcome === void 0 && (missing0 = "outcome") || data.sourceTransactionId === void 0 && (missing0 = "sourceTransactionId") || data.completedAt === void 0 && (missing0 = "completedAt") || data.scopes === void 0 && (missing0 = "scopes") || data.authorizationDecisionId === void 0 && (missing0 = "authorizationDecisionId")) {
				validate44.errors = [{
					instancePath,
					schemaPath: "#/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				}];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) if (!func26.call(schema56.properties, key0)) {
					validate44.errors = [{
						instancePath,
						schemaPath: "#/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					}];
					return false;
				}
				if (_errs1 === errors) {
					if (data.receiptId !== void 0) {
						let data0 = data.receiptId;
						const _errs2 = errors;
						if (errors === _errs2) {
							if (errors === _errs2) {
								if (typeof data0 === "string") {
									if (!formats0.test(data0)) {
										validate44.errors = [{
											instancePath: instancePath + "/receiptId",
											schemaPath: "#/properties/receiptId/format",
											keyword: "format",
											params: { format: "uuid" },
											message: "must match format \"uuid\""
										}];
										return false;
									}
								} else {
									validate44.errors = [{
										instancePath: instancePath + "/receiptId",
										schemaPath: "#/properties/receiptId/type",
										keyword: "type",
										params: { type: "string" },
										message: "must be string"
									}];
									return false;
								}
							}
						}
						var valid0 = _errs2 === errors;
					} else var valid0 = true;
					if (valid0) {
						if (data.commandId !== void 0) {
							let data1 = data.commandId;
							const _errs4 = errors;
							if (errors === _errs4) {
								if (errors === _errs4) {
									if (typeof data1 === "string") {
										if (!formats0.test(data1)) {
											validate44.errors = [{
												instancePath: instancePath + "/commandId",
												schemaPath: "#/properties/commandId/format",
												keyword: "format",
												params: { format: "uuid" },
												message: "must match format \"uuid\""
											}];
											return false;
										}
									} else {
										validate44.errors = [{
											instancePath: instancePath + "/commandId",
											schemaPath: "#/properties/commandId/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
								}
							}
							var valid0 = _errs4 === errors;
						} else var valid0 = true;
						if (valid0) {
							if (data.commandSha256 !== void 0) {
								let data2 = data.commandSha256;
								const _errs6 = errors;
								if (errors === _errs6) {
									if (typeof data2 === "string") {
										if (!pattern6.test(data2)) {
											validate44.errors = [{
												instancePath: instancePath + "/commandSha256",
												schemaPath: "#/properties/commandSha256/pattern",
												keyword: "pattern",
												params: { pattern: "^[a-f0-9]{64}$" },
												message: "must match pattern \"^[a-f0-9]{64}$\""
											}];
											return false;
										}
									} else {
										validate44.errors = [{
											instancePath: instancePath + "/commandSha256",
											schemaPath: "#/properties/commandSha256/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
								}
								var valid0 = _errs6 === errors;
							} else var valid0 = true;
							if (valid0) {
								if (data.idempotencyKey !== void 0) {
									let data3 = data.idempotencyKey;
									const _errs8 = errors;
									if (errors === _errs8) {
										if (typeof data3 === "string") {
											if (func1(data3) < 1) {
												validate44.errors = [{
													instancePath: instancePath + "/idempotencyKey",
													schemaPath: "#/properties/idempotencyKey/minLength",
													keyword: "minLength",
													params: { limit: 1 },
													message: "must NOT have fewer than 1 characters"
												}];
												return false;
											}
										} else {
											validate44.errors = [{
												instancePath: instancePath + "/idempotencyKey",
												schemaPath: "#/properties/idempotencyKey/type",
												keyword: "type",
												params: { type: "string" },
												message: "must be string"
											}];
											return false;
										}
									}
									var valid0 = _errs8 === errors;
								} else var valid0 = true;
								if (valid0) {
									if (data.binding !== void 0) {
										let data4 = data.binding;
										const _errs10 = errors;
										if (errors === errors) {
											if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
												let missing1;
												if (data4.tenantId === void 0 && (missing1 = "tenantId") || data4.actorId === void 0 && (missing1 = "actorId") || data4.conversationId === void 0 && (missing1 = "conversationId") || data4.runId === void 0 && (missing1 = "runId") || data4.attemptId === void 0 && (missing1 = "attemptId") || data4.workerId === void 0 && (missing1 = "workerId") || data4.writerFence === void 0 && (missing1 = "writerFence")) {
													validate44.errors = [{
														instancePath: instancePath + "/binding",
														schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required",
														keyword: "required",
														params: { missingProperty: missing1 },
														message: "must have required property '" + missing1 + "'"
													}];
													return false;
												} else {
													const _errs13 = errors;
													for (const key1 in data4) if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
														validate44.errors = [{
															instancePath: instancePath + "/binding",
															schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties",
															keyword: "additionalProperties",
															params: { additionalProperty: key1 },
															message: "must NOT have additional properties"
														}];
														return false;
													}
													if (_errs13 === errors) {
														if (data4.tenantId !== void 0) {
															let data5 = data4.tenantId;
															const _errs14 = errors;
															if (errors === _errs14) {
																if (typeof data5 === "string") {
																	if (func1(data5) > 128) {
																		validate44.errors = [{
																			instancePath: instancePath + "/binding/tenantId",
																			schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength",
																			keyword: "maxLength",
																			params: { limit: 128 },
																			message: "must NOT have more than 128 characters"
																		}];
																		return false;
																	} else if (func1(data5) < 1) {
																		validate44.errors = [{
																			instancePath: instancePath + "/binding/tenantId",
																			schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength",
																			keyword: "minLength",
																			params: { limit: 1 },
																			message: "must NOT have fewer than 1 characters"
																		}];
																		return false;
																	}
																} else {
																	validate44.errors = [{
																		instancePath: instancePath + "/binding/tenantId",
																		schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type",
																		keyword: "type",
																		params: { type: "string" },
																		message: "must be string"
																	}];
																	return false;
																}
															}
															var valid2 = _errs14 === errors;
														} else var valid2 = true;
														if (valid2) {
															if (data4.actorId !== void 0) {
																let data6 = data4.actorId;
																const _errs16 = errors;
																if (errors === _errs16) {
																	if (typeof data6 === "string") {
																		if (func1(data6) > 128) {
																			validate44.errors = [{
																				instancePath: instancePath + "/binding/actorId",
																				schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength",
																				keyword: "maxLength",
																				params: { limit: 128 },
																				message: "must NOT have more than 128 characters"
																			}];
																			return false;
																		} else if (func1(data6) < 1) {
																			validate44.errors = [{
																				instancePath: instancePath + "/binding/actorId",
																				schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength",
																				keyword: "minLength",
																				params: { limit: 1 },
																				message: "must NOT have fewer than 1 characters"
																			}];
																			return false;
																		}
																	} else {
																		validate44.errors = [{
																			instancePath: instancePath + "/binding/actorId",
																			schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type",
																			keyword: "type",
																			params: { type: "string" },
																			message: "must be string"
																		}];
																		return false;
																	}
																}
																var valid2 = _errs16 === errors;
															} else var valid2 = true;
															if (valid2) {
																if (data4.conversationId !== void 0) {
																	let data7 = data4.conversationId;
																	const _errs18 = errors;
																	if (errors === _errs18) {
																		if (errors === _errs18) {
																			if (typeof data7 === "string") {
																				if (!formats0.test(data7)) {
																					validate44.errors = [{
																						instancePath: instancePath + "/binding/conversationId",
																						schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format",
																						keyword: "format",
																						params: { format: "uuid" },
																						message: "must match format \"uuid\""
																					}];
																					return false;
																				}
																			} else {
																				validate44.errors = [{
																					instancePath: instancePath + "/binding/conversationId",
																					schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type",
																					keyword: "type",
																					params: { type: "string" },
																					message: "must be string"
																				}];
																				return false;
																			}
																		}
																	}
																	var valid2 = _errs18 === errors;
																} else var valid2 = true;
																if (valid2) {
																	if (data4.runId !== void 0) {
																		let data8 = data4.runId;
																		const _errs20 = errors;
																		if (errors === _errs20) {
																			if (errors === _errs20) {
																				if (typeof data8 === "string") {
																					if (!formats0.test(data8)) {
																						validate44.errors = [{
																							instancePath: instancePath + "/binding/runId",
																							schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format",
																							keyword: "format",
																							params: { format: "uuid" },
																							message: "must match format \"uuid\""
																						}];
																						return false;
																					}
																				} else {
																					validate44.errors = [{
																						instancePath: instancePath + "/binding/runId",
																						schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type",
																						keyword: "type",
																						params: { type: "string" },
																						message: "must be string"
																					}];
																					return false;
																				}
																			}
																		}
																		var valid2 = _errs20 === errors;
																	} else var valid2 = true;
																	if (valid2) {
																		if (data4.attemptId !== void 0) {
																			let data9 = data4.attemptId;
																			const _errs22 = errors;
																			if (errors === _errs22) {
																				if (errors === _errs22) {
																					if (typeof data9 === "string") {
																						if (!formats0.test(data9)) {
																							validate44.errors = [{
																								instancePath: instancePath + "/binding/attemptId",
																								schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format",
																								keyword: "format",
																								params: { format: "uuid" },
																								message: "must match format \"uuid\""
																							}];
																							return false;
																						}
																					} else {
																						validate44.errors = [{
																							instancePath: instancePath + "/binding/attemptId",
																							schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type",
																							keyword: "type",
																							params: { type: "string" },
																							message: "must be string"
																						}];
																						return false;
																					}
																				}
																			}
																			var valid2 = _errs22 === errors;
																		} else var valid2 = true;
																		if (valid2) {
																			if (data4.workerId !== void 0) {
																				let data10 = data4.workerId;
																				const _errs24 = errors;
																				if (errors === _errs24) {
																					if (errors === _errs24) {
																						if (typeof data10 === "string") {
																							if (!formats0.test(data10)) {
																								validate44.errors = [{
																									instancePath: instancePath + "/binding/workerId",
																									schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format",
																									keyword: "format",
																									params: { format: "uuid" },
																									message: "must match format \"uuid\""
																								}];
																								return false;
																							}
																						} else {
																							validate44.errors = [{
																								instancePath: instancePath + "/binding/workerId",
																								schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type",
																								keyword: "type",
																								params: { type: "string" },
																								message: "must be string"
																							}];
																							return false;
																						}
																					}
																				}
																				var valid2 = _errs24 === errors;
																			} else var valid2 = true;
																			if (valid2) {
																				if (data4.writerFence !== void 0) {
																					let data11 = data4.writerFence;
																					const _errs26 = errors;
																					if (!(typeof data11 == "number" && !(data11 % 1) && !isNaN(data11) && isFinite(data11))) {
																						validate44.errors = [{
																							instancePath: instancePath + "/binding/writerFence",
																							schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type",
																							keyword: "type",
																							params: { type: "integer" },
																							message: "must be integer"
																						}];
																						return false;
																					}
																					if (errors === _errs26) {
																						if (typeof data11 == "number" && isFinite(data11)) {
																							if (data11 > 9007199254740991 || isNaN(data11)) {
																								validate44.errors = [{
																									instancePath: instancePath + "/binding/writerFence",
																									schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum",
																									keyword: "maximum",
																									params: {
																										comparison: "<=",
																										limit: 9007199254740991
																									},
																									message: "must be <= 9007199254740991"
																								}];
																								return false;
																							} else if (data11 < 1 || isNaN(data11)) {
																								validate44.errors = [{
																									instancePath: instancePath + "/binding/writerFence",
																									schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum",
																									keyword: "minimum",
																									params: {
																										comparison: ">=",
																										limit: 1
																									},
																									message: "must be >= 1"
																								}];
																								return false;
																							}
																						}
																					}
																					var valid2 = _errs26 === errors;
																				} else var valid2 = true;
																			}
																		}
																	}
																}
															}
														}
													}
												}
											} else {
												validate44.errors = [{
													instancePath: instancePath + "/binding",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type",
													keyword: "type",
													params: { type: "object" },
													message: "must be object"
												}];
												return false;
											}
										}
										var valid0 = _errs10 === errors;
									} else var valid0 = true;
									if (valid0) {
										if (data.outcome !== void 0) {
											let data12 = data.outcome;
											const _errs28 = errors;
											if (typeof data12 !== "string") {
												validate44.errors = [{
													instancePath: instancePath + "/outcome",
													schemaPath: "#/properties/outcome/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												}];
												return false;
											}
											if (!(data12 === "succeeded" || data12 === "denied" || data12 === "failed" || data12 === "indeterminate")) {
												validate44.errors = [{
													instancePath: instancePath + "/outcome",
													schemaPath: "#/properties/outcome/enum",
													keyword: "enum",
													params: { allowedValues: schema56.properties.outcome.enum },
													message: "must be equal to one of the allowed values"
												}];
												return false;
											}
											var valid0 = _errs28 === errors;
										} else var valid0 = true;
										if (valid0) {
											if (data.sourceTransactionId !== void 0) {
												let data13 = data.sourceTransactionId;
												const _errs30 = errors;
												const _errs31 = errors;
												let valid3 = false;
												const _errs32 = errors;
												if (errors === _errs32) {
													if (typeof data13 === "string") {
														if (func1(data13) < 1) {
															const err0 = {
																instancePath: instancePath + "/sourceTransactionId",
																schemaPath: "#/properties/sourceTransactionId/anyOf/0/minLength",
																keyword: "minLength",
																params: { limit: 1 },
																message: "must NOT have fewer than 1 characters"
															};
															if (vErrors === null) vErrors = [err0];
															else vErrors.push(err0);
															errors++;
														}
													} else {
														const err1 = {
															instancePath: instancePath + "/sourceTransactionId",
															schemaPath: "#/properties/sourceTransactionId/anyOf/0/type",
															keyword: "type",
															params: { type: "string" },
															message: "must be string"
														};
														if (vErrors === null) vErrors = [err1];
														else vErrors.push(err1);
														errors++;
													}
												}
												var _valid0 = _errs32 === errors;
												valid3 = valid3 || _valid0;
												const _errs34 = errors;
												if (data13 !== null) {
													const err2 = {
														instancePath: instancePath + "/sourceTransactionId",
														schemaPath: "#/properties/sourceTransactionId/anyOf/1/type",
														keyword: "type",
														params: { type: "null" },
														message: "must be null"
													};
													if (vErrors === null) vErrors = [err2];
													else vErrors.push(err2);
													errors++;
												}
												var _valid0 = _errs34 === errors;
												valid3 = valid3 || _valid0;
												if (!valid3) {
													const err3 = {
														instancePath: instancePath + "/sourceTransactionId",
														schemaPath: "#/properties/sourceTransactionId/anyOf",
														keyword: "anyOf",
														params: {},
														message: "must match a schema in anyOf"
													};
													if (vErrors === null) vErrors = [err3];
													else vErrors.push(err3);
													errors++;
													validate44.errors = vErrors;
													return false;
												} else {
													errors = _errs31;
													if (vErrors !== null) {
														if (_errs31) vErrors.length = _errs31;
														else vErrors = null;
													}
												}
												var valid0 = _errs30 === errors;
											} else var valid0 = true;
											if (valid0) {
												if (data.completedAt !== void 0) {
													let data14 = data.completedAt;
													const _errs36 = errors;
													if (errors === _errs36) {
														if (errors === _errs36) {
															if (typeof data14 === "string") {
																if (!pattern4.test(data14)) {
																	validate44.errors = [{
																		instancePath: instancePath + "/completedAt",
																		schemaPath: "#/properties/completedAt/pattern",
																		keyword: "pattern",
																		params: { pattern: "Z$" },
																		message: "must match pattern \"Z$\""
																	}];
																	return false;
																} else if (!formats2.validate(data14)) {
																	validate44.errors = [{
																		instancePath: instancePath + "/completedAt",
																		schemaPath: "#/properties/completedAt/format",
																		keyword: "format",
																		params: { format: "date-time" },
																		message: "must match format \"date-time\""
																	}];
																	return false;
																}
															} else {
																validate44.errors = [{
																	instancePath: instancePath + "/completedAt",
																	schemaPath: "#/properties/completedAt/type",
																	keyword: "type",
																	params: { type: "string" },
																	message: "must be string"
																}];
																return false;
															}
														}
													}
													var valid0 = _errs36 === errors;
												} else var valid0 = true;
												if (valid0) {
													if (data.scopes !== void 0) {
														let data15 = data.scopes;
														const _errs38 = errors;
														if (errors === _errs38) {
															if (Array.isArray(data15)) {
																if (data15.length < 1) {
																	validate44.errors = [{
																		instancePath: instancePath + "/scopes",
																		schemaPath: "#/properties/scopes/minItems",
																		keyword: "minItems",
																		params: { limit: 1 },
																		message: "must NOT have fewer than 1 items"
																	}];
																	return false;
																} else {
																	var valid4 = true;
																	const len0 = data15.length;
																	for (let i0 = 0; i0 < len0; i0++) {
																		let data16 = data15[i0];
																		const _errs40 = errors;
																		if (errors === errors) {
																			if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
																				let missing2;
																				if (data16.tenantId === void 0 && (missing2 = "tenantId") || data16.kind === void 0 && (missing2 = "kind") || data16.resourceId === void 0 && (missing2 = "resourceId") || data16.policyRevision === void 0 && (missing2 = "policyRevision")) {
																					validate44.errors = [{
																						instancePath: instancePath + "/scopes/" + i0,
																						schemaPath: "#/$defs/Canonical_Scope_f882edb5/required",
																						keyword: "required",
																						params: { missingProperty: missing2 },
																						message: "must have required property '" + missing2 + "'"
																					}];
																					return false;
																				} else {
																					const _errs43 = errors;
																					for (const key2 in data16) if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
																						validate44.errors = [{
																							instancePath: instancePath + "/scopes/" + i0,
																							schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties",
																							keyword: "additionalProperties",
																							params: { additionalProperty: key2 },
																							message: "must NOT have additional properties"
																						}];
																						return false;
																					}
																					if (_errs43 === errors) {
																						if (data16.tenantId !== void 0) {
																							let data17 = data16.tenantId;
																							const _errs44 = errors;
																							if (errors === _errs44) {
																								if (typeof data17 === "string") {
																									if (func1(data17) > 128) {
																										validate44.errors = [{
																											instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																											schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength",
																											keyword: "maxLength",
																											params: { limit: 128 },
																											message: "must NOT have more than 128 characters"
																										}];
																										return false;
																									} else if (func1(data17) < 1) {
																										validate44.errors = [{
																											instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																											schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength",
																											keyword: "minLength",
																											params: { limit: 1 },
																											message: "must NOT have fewer than 1 characters"
																										}];
																										return false;
																									}
																								} else {
																									validate44.errors = [{
																										instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																										schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type",
																										keyword: "type",
																										params: { type: "string" },
																										message: "must be string"
																									}];
																									return false;
																								}
																							}
																							var valid6 = _errs44 === errors;
																						} else var valid6 = true;
																						if (valid6) {
																							if (data16.kind !== void 0) {
																								let data18 = data16.kind;
																								const _errs46 = errors;
																								if (typeof data18 !== "string") {
																									validate44.errors = [{
																										instancePath: instancePath + "/scopes/" + i0 + "/kind",
																										schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type",
																										keyword: "type",
																										params: { type: "string" },
																										message: "must be string"
																									}];
																									return false;
																								}
																								if (!(data18 === "tenant" || data18 === "client" || data18 === "mailbox" || data18 === "memory" || data18 === "document" || data18 === "private-user" || data18 === "public")) {
																									validate44.errors = [{
																										instancePath: instancePath + "/scopes/" + i0 + "/kind",
																										schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum",
																										keyword: "enum",
																										params: { allowedValues: schema41.properties.kind.enum },
																										message: "must be equal to one of the allowed values"
																									}];
																									return false;
																								}
																								var valid6 = _errs46 === errors;
																							} else var valid6 = true;
																							if (valid6) {
																								if (data16.resourceId !== void 0) {
																									let data19 = data16.resourceId;
																									const _errs48 = errors;
																									if (errors === _errs48) {
																										if (typeof data19 === "string") {
																											if (func1(data19) > 256) {
																												validate44.errors = [{
																													instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																													schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength",
																													keyword: "maxLength",
																													params: { limit: 256 },
																													message: "must NOT have more than 256 characters"
																												}];
																												return false;
																											} else if (func1(data19) < 1) {
																												validate44.errors = [{
																													instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																													schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength",
																													keyword: "minLength",
																													params: { limit: 1 },
																													message: "must NOT have fewer than 1 characters"
																												}];
																												return false;
																											}
																										} else {
																											validate44.errors = [{
																												instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																												schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type",
																												keyword: "type",
																												params: { type: "string" },
																												message: "must be string"
																											}];
																											return false;
																										}
																									}
																									var valid6 = _errs48 === errors;
																								} else var valid6 = true;
																								if (valid6) {
																									if (data16.policyRevision !== void 0) {
																										let data20 = data16.policyRevision;
																										const _errs50 = errors;
																										if (errors === _errs50) {
																											if (typeof data20 === "string") {
																												if (func1(data20) > 128) {
																													validate44.errors = [{
																														instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																														schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength",
																														keyword: "maxLength",
																														params: { limit: 128 },
																														message: "must NOT have more than 128 characters"
																													}];
																													return false;
																												} else if (func1(data20) < 1) {
																													validate44.errors = [{
																														instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																														schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength",
																														keyword: "minLength",
																														params: { limit: 1 },
																														message: "must NOT have fewer than 1 characters"
																													}];
																													return false;
																												}
																											} else {
																												validate44.errors = [{
																													instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																													schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type",
																													keyword: "type",
																													params: { type: "string" },
																													message: "must be string"
																												}];
																												return false;
																											}
																										}
																										var valid6 = _errs50 === errors;
																									} else var valid6 = true;
																								}
																							}
																						}
																					}
																				}
																			} else {
																				validate44.errors = [{
																					instancePath: instancePath + "/scopes/" + i0,
																					schemaPath: "#/$defs/Canonical_Scope_f882edb5/type",
																					keyword: "type",
																					params: { type: "object" },
																					message: "must be object"
																				}];
																				return false;
																			}
																		}
																		var valid4 = _errs40 === errors;
																		if (!valid4) break;
																	}
																	if (valid4) {
																		let i1 = data15.length;
																		let j0;
																		if (i1 > 1) {
																			outer0: for (; i1--;) for (j0 = i1; j0--;) if (func0(data15[i1], data15[j0])) {
																				validate44.errors = [{
																					instancePath: instancePath + "/scopes",
																					schemaPath: "#/properties/scopes/uniqueItems",
																					keyword: "uniqueItems",
																					params: {
																						i: i1,
																						j: j0
																					},
																					message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)"
																				}];
																				return false;
																			}
																		}
																	}
																}
															} else {
																validate44.errors = [{
																	instancePath: instancePath + "/scopes",
																	schemaPath: "#/properties/scopes/type",
																	keyword: "type",
																	params: { type: "array" },
																	message: "must be array"
																}];
																return false;
															}
														}
														var valid0 = _errs38 === errors;
													} else var valid0 = true;
													if (valid0) {
														if (data.authorizationDecisionId !== void 0) {
															let data21 = data.authorizationDecisionId;
															const _errs52 = errors;
															if (errors === _errs52) {
																if (errors === _errs52) {
																	if (typeof data21 === "string") {
																		if (!formats0.test(data21)) {
																			validate44.errors = [{
																				instancePath: instancePath + "/authorizationDecisionId",
																				schemaPath: "#/properties/authorizationDecisionId/format",
																				keyword: "format",
																				params: { format: "uuid" },
																				message: "must match format \"uuid\""
																			}];
																			return false;
																		}
																	} else {
																		validate44.errors = [{
																			instancePath: instancePath + "/authorizationDecisionId",
																			schemaPath: "#/properties/authorizationDecisionId/type",
																			keyword: "type",
																			params: { type: "string" },
																			message: "must be string"
																		}];
																		return false;
																	}
																}
															}
															var valid0 = _errs52 === errors;
														} else var valid0 = true;
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		} else {
			validate44.errors = [{
				instancePath,
				schemaPath: "#/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			}];
			return false;
		}
	}
	validate44.errors = vErrors;
	return errors === 0;
}
validate44.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
function validate66(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	let errors = 0;
	const evaluated0 = validate66.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	const _errs0 = errors;
	let valid0 = false;
	let passing0 = null;
	const _errs1 = errors;
	if (errors === _errs1) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing0;
			if (data.status === void 0 && (missing0 = "status") || data.outcome === void 0 && (missing0 = "outcome")) {
				const err0 = {
					instancePath,
					schemaPath: "#/oneOf/0/required",
					keyword: "required",
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'"
				};
				if (vErrors === null) vErrors = [err0];
				else vErrors.push(err0);
				errors++;
			} else {
				const _errs3 = errors;
				for (const key0 in data) if (!(key0 === "status" || key0 === "outcome")) {
					const err1 = {
						instancePath,
						schemaPath: "#/oneOf/0/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key0 },
						message: "must NOT have additional properties"
					};
					if (vErrors === null) vErrors = [err1];
					else vErrors.push(err1);
					errors++;
					break;
				}
				if (_errs3 === errors) {
					if (data.status !== void 0) {
						const _errs4 = errors;
						if ("observed" !== data.status) {
							const err2 = {
								instancePath: instancePath + "/status",
								schemaPath: "#/oneOf/0/properties/status/const",
								keyword: "const",
								params: { allowedValue: "observed" },
								message: "must be equal to constant"
							};
							if (vErrors === null) vErrors = [err2];
							else vErrors.push(err2);
							errors++;
						}
						var valid1 = _errs4 === errors;
					} else var valid1 = true;
					if (valid1) {
						if (data.outcome !== void 0) {
							let data1 = data.outcome;
							const _errs5 = errors;
							if (errors === _errs5) {
								if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
									let missing1;
									if (data1.receipt === void 0 && (missing1 = "receipt") || data1.result === void 0 && (missing1 = "result")) {
										const err3 = {
											instancePath: instancePath + "/outcome",
											schemaPath: "#/oneOf/0/properties/outcome/required",
											keyword: "required",
											params: { missingProperty: missing1 },
											message: "must have required property '" + missing1 + "'"
										};
										if (vErrors === null) vErrors = [err3];
										else vErrors.push(err3);
										errors++;
									} else {
										const _errs7 = errors;
										for (const key1 in data1) if (!(key1 === "receipt" || key1 === "result")) {
											const err4 = {
												instancePath: instancePath + "/outcome",
												schemaPath: "#/oneOf/0/properties/outcome/additionalProperties",
												keyword: "additionalProperties",
												params: { additionalProperty: key1 },
												message: "must NOT have additional properties"
											};
											if (vErrors === null) vErrors = [err4];
											else vErrors.push(err4);
											errors++;
											break;
										}
										if (_errs7 === errors) {
											if (data1.receipt !== void 0) {
												const _errs8 = errors;
												if (!validate44(data1.receipt, {
													instancePath: instancePath + "/outcome/receipt",
													parentData: data1,
													parentDataProperty: "receipt",
													rootData,
													dynamicAnchors
												})) {
													vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
													errors = vErrors.length;
												}
												var valid2 = _errs8 === errors;
											} else var valid2 = true;
											if (valid2) {
												if (data1.result !== void 0) {
													let data3 = data1.result;
													const _errs9 = errors;
													if (errors === errors) {
														if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
															let missing2;
															if (data3.id === void 0 && (missing2 = "id") || data3.title === void 0 && (missing2 = "title") || data3.status === void 0 && (missing2 = "status") || data3.dueDate === void 0 && (missing2 = "dueDate") || data3.clientId === void 0 && (missing2 = "clientId") || data3.updatedAt === void 0 && (missing2 = "updatedAt")) {
																const err5 = {
																	instancePath: instancePath + "/outcome/result",
																	schemaPath: "#/$defs/TaskUpdateResult/required",
																	keyword: "required",
																	params: { missingProperty: missing2 },
																	message: "must have required property '" + missing2 + "'"
																};
																if (vErrors === null) vErrors = [err5];
																else vErrors.push(err5);
																errors++;
															} else {
																const _errs12 = errors;
																for (const key2 in data3) if (!(key2 === "id" || key2 === "title" || key2 === "status" || key2 === "dueDate" || key2 === "clientId" || key2 === "updatedAt")) {
																	const err6 = {
																		instancePath: instancePath + "/outcome/result",
																		schemaPath: "#/$defs/TaskUpdateResult/additionalProperties",
																		keyword: "additionalProperties",
																		params: { additionalProperty: key2 },
																		message: "must NOT have additional properties"
																	};
																	if (vErrors === null) vErrors = [err6];
																	else vErrors.push(err6);
																	errors++;
																	break;
																}
																if (_errs12 === errors) {
																	if (data3.id !== void 0) {
																		let data4 = data3.id;
																		const _errs13 = errors;
																		if (errors === _errs13) {
																			if (errors === _errs13) {
																				if (typeof data4 === "string") {
																					if (!formats0.test(data4)) {
																						const err7 = {
																							instancePath: instancePath + "/outcome/result/id",
																							schemaPath: "#/$defs/TaskUpdateResult/properties/id/format",
																							keyword: "format",
																							params: { format: "uuid" },
																							message: "must match format \"uuid\""
																						};
																						if (vErrors === null) vErrors = [err7];
																						else vErrors.push(err7);
																						errors++;
																					}
																				} else {
																					const err8 = {
																						instancePath: instancePath + "/outcome/result/id",
																						schemaPath: "#/$defs/TaskUpdateResult/properties/id/type",
																						keyword: "type",
																						params: { type: "string" },
																						message: "must be string"
																					};
																					if (vErrors === null) vErrors = [err8];
																					else vErrors.push(err8);
																					errors++;
																				}
																			}
																		}
																		var valid4 = _errs13 === errors;
																	} else var valid4 = true;
																	if (valid4) {
																		if (data3.title !== void 0) {
																			const _errs15 = errors;
																			if (typeof data3.title !== "string") {
																				const err9 = {
																					instancePath: instancePath + "/outcome/result/title",
																					schemaPath: "#/$defs/TaskUpdateResult/properties/title/type",
																					keyword: "type",
																					params: { type: "string" },
																					message: "must be string"
																				};
																				if (vErrors === null) vErrors = [err9];
																				else vErrors.push(err9);
																				errors++;
																			}
																			var valid4 = _errs15 === errors;
																		} else var valid4 = true;
																		if (valid4) {
																			if (data3.status !== void 0) {
																				let data6 = data3.status;
																				const _errs17 = errors;
																				if (!(data6 === "todo" || data6 === "in_progress" || data6 === "done" || data6 === "blocked" || data6 === "canceled")) {
																					const err10 = {
																						instancePath: instancePath + "/outcome/result/status",
																						schemaPath: "#/$defs/TaskUpdateResult/properties/status/enum",
																						keyword: "enum",
																						params: { allowedValues: schema44.properties.status.enum },
																						message: "must be equal to one of the allowed values"
																					};
																					if (vErrors === null) vErrors = [err10];
																					else vErrors.push(err10);
																					errors++;
																				}
																				var valid4 = _errs17 === errors;
																			} else var valid4 = true;
																			if (valid4) {
																				if (data3.dueDate !== void 0) {
																					let data7 = data3.dueDate;
																					const _errs18 = errors;
																					const _errs19 = errors;
																					let valid5 = false;
																					const _errs20 = errors;
																					if (errors === _errs20) {
																						if (errors === _errs20) {
																							if (typeof data7 === "string") {
																								if (!pattern4.test(data7)) {
																									const err11 = {
																										instancePath: instancePath + "/outcome/result/dueDate",
																										schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/pattern",
																										keyword: "pattern",
																										params: { pattern: "Z$" },
																										message: "must match pattern \"Z$\""
																									};
																									if (vErrors === null) vErrors = [err11];
																									else vErrors.push(err11);
																									errors++;
																								} else if (!formats2.validate(data7)) {
																									const err12 = {
																										instancePath: instancePath + "/outcome/result/dueDate",
																										schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/format",
																										keyword: "format",
																										params: { format: "date-time" },
																										message: "must match format \"date-time\""
																									};
																									if (vErrors === null) vErrors = [err12];
																									else vErrors.push(err12);
																									errors++;
																								}
																							} else {
																								const err13 = {
																									instancePath: instancePath + "/outcome/result/dueDate",
																									schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/type",
																									keyword: "type",
																									params: { type: "string" },
																									message: "must be string"
																								};
																								if (vErrors === null) vErrors = [err13];
																								else vErrors.push(err13);
																								errors++;
																							}
																						}
																					}
																					var _valid1 = _errs20 === errors;
																					valid5 = valid5 || _valid1;
																					const _errs22 = errors;
																					if (data7 !== null) {
																						const err14 = {
																							instancePath: instancePath + "/outcome/result/dueDate",
																							schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/1/type",
																							keyword: "type",
																							params: { type: "null" },
																							message: "must be null"
																						};
																						if (vErrors === null) vErrors = [err14];
																						else vErrors.push(err14);
																						errors++;
																					}
																					var _valid1 = _errs22 === errors;
																					valid5 = valid5 || _valid1;
																					if (!valid5) {
																						const err15 = {
																							instancePath: instancePath + "/outcome/result/dueDate",
																							schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf",
																							keyword: "anyOf",
																							params: {},
																							message: "must match a schema in anyOf"
																						};
																						if (vErrors === null) vErrors = [err15];
																						else vErrors.push(err15);
																						errors++;
																					} else {
																						errors = _errs19;
																						if (vErrors !== null) {
																							if (_errs19) vErrors.length = _errs19;
																							else vErrors = null;
																						}
																					}
																					var valid4 = _errs18 === errors;
																				} else var valid4 = true;
																				if (valid4) {
																					if (data3.clientId !== void 0) {
																						let data8 = data3.clientId;
																						const _errs24 = errors;
																						const _errs25 = errors;
																						let valid6 = false;
																						const _errs26 = errors;
																						if (errors === _errs26) {
																							if (errors === _errs26) {
																								if (typeof data8 === "string") {
																									if (!formats0.test(data8)) {
																										const err16 = {
																											instancePath: instancePath + "/outcome/result/clientId",
																											schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/0/format",
																											keyword: "format",
																											params: { format: "uuid" },
																											message: "must match format \"uuid\""
																										};
																										if (vErrors === null) vErrors = [err16];
																										else vErrors.push(err16);
																										errors++;
																									}
																								} else {
																									const err17 = {
																										instancePath: instancePath + "/outcome/result/clientId",
																										schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/0/type",
																										keyword: "type",
																										params: { type: "string" },
																										message: "must be string"
																									};
																									if (vErrors === null) vErrors = [err17];
																									else vErrors.push(err17);
																									errors++;
																								}
																							}
																						}
																						var _valid2 = _errs26 === errors;
																						valid6 = valid6 || _valid2;
																						const _errs28 = errors;
																						if (data8 !== null) {
																							const err18 = {
																								instancePath: instancePath + "/outcome/result/clientId",
																								schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/1/type",
																								keyword: "type",
																								params: { type: "null" },
																								message: "must be null"
																							};
																							if (vErrors === null) vErrors = [err18];
																							else vErrors.push(err18);
																							errors++;
																						}
																						var _valid2 = _errs28 === errors;
																						valid6 = valid6 || _valid2;
																						if (!valid6) {
																							const err19 = {
																								instancePath: instancePath + "/outcome/result/clientId",
																								schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf",
																								keyword: "anyOf",
																								params: {},
																								message: "must match a schema in anyOf"
																							};
																							if (vErrors === null) vErrors = [err19];
																							else vErrors.push(err19);
																							errors++;
																						} else {
																							errors = _errs25;
																							if (vErrors !== null) {
																								if (_errs25) vErrors.length = _errs25;
																								else vErrors = null;
																							}
																						}
																						var valid4 = _errs24 === errors;
																					} else var valid4 = true;
																					if (valid4) {
																						if (data3.updatedAt !== void 0) {
																							let data9 = data3.updatedAt;
																							const _errs30 = errors;
																							if (errors === _errs30) {
																								if (errors === _errs30) {
																									if (typeof data9 === "string") {
																										if (!pattern4.test(data9)) {
																											const err20 = {
																												instancePath: instancePath + "/outcome/result/updatedAt",
																												schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/pattern",
																												keyword: "pattern",
																												params: { pattern: "Z$" },
																												message: "must match pattern \"Z$\""
																											};
																											if (vErrors === null) vErrors = [err20];
																											else vErrors.push(err20);
																											errors++;
																										} else if (!formats2.validate(data9)) {
																											const err21 = {
																												instancePath: instancePath + "/outcome/result/updatedAt",
																												schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/format",
																												keyword: "format",
																												params: { format: "date-time" },
																												message: "must match format \"date-time\""
																											};
																											if (vErrors === null) vErrors = [err21];
																											else vErrors.push(err21);
																											errors++;
																										}
																									} else {
																										const err22 = {
																											instancePath: instancePath + "/outcome/result/updatedAt",
																											schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/type",
																											keyword: "type",
																											params: { type: "string" },
																											message: "must be string"
																										};
																										if (vErrors === null) vErrors = [err22];
																										else vErrors.push(err22);
																										errors++;
																									}
																								}
																							}
																							var valid4 = _errs30 === errors;
																						} else var valid4 = true;
																					}
																				}
																			}
																		}
																	}
																}
															}
														} else {
															const err23 = {
																instancePath: instancePath + "/outcome/result",
																schemaPath: "#/$defs/TaskUpdateResult/type",
																keyword: "type",
																params: { type: "object" },
																message: "must be object"
															};
															if (vErrors === null) vErrors = [err23];
															else vErrors.push(err23);
															errors++;
														}
													}
													var valid2 = _errs9 === errors;
												} else var valid2 = true;
											}
										}
									}
								} else {
									const err24 = {
										instancePath: instancePath + "/outcome",
										schemaPath: "#/oneOf/0/properties/outcome/type",
										keyword: "type",
										params: { type: "object" },
										message: "must be object"
									};
									if (vErrors === null) vErrors = [err24];
									else vErrors.push(err24);
									errors++;
								}
							}
							var valid1 = _errs5 === errors;
						} else var valid1 = true;
					}
				}
			}
		} else {
			const err25 = {
				instancePath,
				schemaPath: "#/oneOf/0/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			};
			if (vErrors === null) vErrors = [err25];
			else vErrors.push(err25);
			errors++;
		}
	}
	var _valid0 = _errs1 === errors;
	if (_valid0) {
		valid0 = true;
		passing0 = 0;
		var props0 = true;
	}
	const _errs32 = errors;
	if (errors === _errs32) {
		if (data && typeof data == "object" && !Array.isArray(data)) {
			let missing3;
			if (data.status === void 0 && (missing3 = "status") || data.outcome === void 0 && (missing3 = "outcome")) {
				const err26 = {
					instancePath,
					schemaPath: "#/oneOf/1/required",
					keyword: "required",
					params: { missingProperty: missing3 },
					message: "must have required property '" + missing3 + "'"
				};
				if (vErrors === null) vErrors = [err26];
				else vErrors.push(err26);
				errors++;
			} else {
				const _errs34 = errors;
				for (const key3 in data) if (!(key3 === "status" || key3 === "outcome")) {
					const err27 = {
						instancePath,
						schemaPath: "#/oneOf/1/additionalProperties",
						keyword: "additionalProperties",
						params: { additionalProperty: key3 },
						message: "must NOT have additional properties"
					};
					if (vErrors === null) vErrors = [err27];
					else vErrors.push(err27);
					errors++;
					break;
				}
				if (_errs34 === errors) {
					if (data.status !== void 0) {
						const _errs35 = errors;
						if ("indeterminate" !== data.status) {
							const err28 = {
								instancePath: instancePath + "/status",
								schemaPath: "#/oneOf/1/properties/status/const",
								keyword: "const",
								params: { allowedValue: "indeterminate" },
								message: "must be equal to constant"
							};
							if (vErrors === null) vErrors = [err28];
							else vErrors.push(err28);
							errors++;
						}
						var valid7 = _errs35 === errors;
					} else var valid7 = true;
					if (valid7) {
						if (data.outcome !== void 0) {
							const _errs36 = errors;
							if (data.outcome !== null) {
								const err29 = {
									instancePath: instancePath + "/outcome",
									schemaPath: "#/oneOf/1/properties/outcome/type",
									keyword: "type",
									params: { type: "null" },
									message: "must be null"
								};
								if (vErrors === null) vErrors = [err29];
								else vErrors.push(err29);
								errors++;
							}
							var valid7 = _errs36 === errors;
						} else var valid7 = true;
					}
				}
			}
		} else {
			const err30 = {
				instancePath,
				schemaPath: "#/oneOf/1/type",
				keyword: "type",
				params: { type: "object" },
				message: "must be object"
			};
			if (vErrors === null) vErrors = [err30];
			else vErrors.push(err30);
			errors++;
		}
	}
	var _valid0 = _errs32 === errors;
	if (_valid0 && valid0) {
		valid0 = false;
		passing0 = [passing0, 1];
	} else if (_valid0) {
		valid0 = true;
		passing0 = 1;
		if (props0 !== true) props0 = true;
	}
	if (!valid0) {
		const err31 = {
			instancePath,
			schemaPath: "#/oneOf",
			keyword: "oneOf",
			params: { passingSchemas: passing0 },
			message: "must match exactly one schema in oneOf"
		};
		if (vErrors === null) vErrors = [err31];
		else vErrors.push(err31);
		errors++;
		validate66.errors = vErrors;
		return false;
	} else {
		errors = _errs0;
		if (vErrors !== null) {
			if (_errs0) vErrors.length = _errs0;
			else vErrors = null;
		}
	}
	validate66.errors = vErrors;
	evaluated0.props = props0;
	return errors === 0;
}
validate66.evaluated = {
	"dynamicProps": true,
	"dynamicItems": false
};
const validateTaskCommandErrorResponse = validate68;
const schema61 = {
	"type": "object",
	"properties": { "error": {
		"type": "object",
		"properties": {
			"code": {
				"type": "string",
				"enum": [
					"ACCESS_DENIED",
					"APPLICATION_CLOCK",
					"APPLICATION_CONFIGURATION",
					"CANCELLED",
					"COMMAND_APPROVAL_REFUSED",
					"COMMAND_AUTHORITY_REFUSED",
					"COMMAND_COMMIT_UNCERTAIN",
					"COMMAND_OUTCOME_UNKNOWN",
					"COMMAND_PREPARATION_REFUSED",
					"COMMAND_REFUSED",
					"DEADLINE",
					"EXECUTION_AUTHORITY_REFUSED",
					"INVALID_BODY",
					"INVALID_CONTENT_LENGTH",
					"INVALID_JSON",
					"INVALID_REQUEST",
					"INVALID_UTF8",
					"LOOKUP_REPLAY",
					"LOOKUP_UNAVAILABLE",
					"METHOD_NOT_ALLOWED",
					"NOT_FOUND",
					"REQUEST_FAILED",
					"REQUEST_TOO_LARGE",
					"RESPONSE_TOO_LARGE",
					"SESSION_SCOPE_REFUSED",
					"TASK_COMMAND_UNAVAILABLE",
					"UNAUTHENTICATED",
					"UNAVAILABLE",
					"UNSUPPORTED_CONTENT_ENCODING",
					"UNSUPPORTED_MEDIA_TYPE"
				]
			},
			"outcome": {
				"type": "string",
				"enum": [
					"NOT_DISPATCHED",
					"UNKNOWN",
					"RESULT_NOT_RELEASED",
					"STORED_NOT_RELEASED",
					"NOT_STORED",
					"READ_UNAVAILABLE"
				]
			}
		},
		"required": ["code", "outcome"],
		"additionalProperties": false
	} },
	"required": ["error"],
	"additionalProperties": false
};
function validate68(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate68.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.error === void 0 && (missing0 = "error")) {
			validate68.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "error")) {
				validate68.errors = [{
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
					if (data0.code === void 0 && (missing1 = "code") || data0.outcome === void 0 && (missing1 = "outcome")) {
						validate68.errors = [{
							instancePath: instancePath + "/error",
							schemaPath: "#/properties/error/required",
							keyword: "required",
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'"
						}];
						return false;
					} else {
						for (const key1 in data0) if (!(key1 === "code" || key1 === "outcome")) {
							validate68.errors = [{
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
								validate68.errors = [{
									instancePath: instancePath + "/error/code",
									schemaPath: "#/properties/error/properties/code/type",
									keyword: "type",
									params: { type: "string" },
									message: "must be string"
								}];
								return false;
							}
							if (!(data1 === "ACCESS_DENIED" || data1 === "APPLICATION_CLOCK" || data1 === "APPLICATION_CONFIGURATION" || data1 === "CANCELLED" || data1 === "COMMAND_APPROVAL_REFUSED" || data1 === "COMMAND_AUTHORITY_REFUSED" || data1 === "COMMAND_COMMIT_UNCERTAIN" || data1 === "COMMAND_OUTCOME_UNKNOWN" || data1 === "COMMAND_PREPARATION_REFUSED" || data1 === "COMMAND_REFUSED" || data1 === "DEADLINE" || data1 === "EXECUTION_AUTHORITY_REFUSED" || data1 === "INVALID_BODY" || data1 === "INVALID_CONTENT_LENGTH" || data1 === "INVALID_JSON" || data1 === "INVALID_REQUEST" || data1 === "INVALID_UTF8" || data1 === "LOOKUP_REPLAY" || data1 === "LOOKUP_UNAVAILABLE" || data1 === "METHOD_NOT_ALLOWED" || data1 === "NOT_FOUND" || data1 === "REQUEST_FAILED" || data1 === "REQUEST_TOO_LARGE" || data1 === "RESPONSE_TOO_LARGE" || data1 === "SESSION_SCOPE_REFUSED" || data1 === "TASK_COMMAND_UNAVAILABLE" || data1 === "UNAUTHENTICATED" || data1 === "UNAVAILABLE" || data1 === "UNSUPPORTED_CONTENT_ENCODING" || data1 === "UNSUPPORTED_MEDIA_TYPE")) {
								validate68.errors = [{
									instancePath: instancePath + "/error/code",
									schemaPath: "#/properties/error/properties/code/enum",
									keyword: "enum",
									params: { allowedValues: schema61.properties.error.properties.code.enum },
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
									validate68.errors = [{
										instancePath: instancePath + "/error/outcome",
										schemaPath: "#/properties/error/properties/outcome/type",
										keyword: "type",
										params: { type: "string" },
										message: "must be string"
									}];
									return false;
								}
								if (!(data2 === "NOT_DISPATCHED" || data2 === "UNKNOWN" || data2 === "RESULT_NOT_RELEASED" || data2 === "STORED_NOT_RELEASED" || data2 === "NOT_STORED" || data2 === "READ_UNAVAILABLE")) {
									validate68.errors = [{
										instancePath: instancePath + "/error/outcome",
										schemaPath: "#/properties/error/properties/outcome/enum",
										keyword: "enum",
										params: { allowedValues: schema61.properties.error.properties.outcome.enum },
										message: "must be equal to one of the allowed values"
									}];
									return false;
								}
								var valid1 = true;
							} else var valid1 = true;
						}
					}
				} else {
					validate68.errors = [{
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
		validate68.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate68.errors = vErrors;
	return true;
}
validate68.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskCommandExpectedBinding = validate69;
function validate69(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate69.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.tenantId === void 0 && (missing0 = "tenantId") || data.actorId === void 0 && (missing0 = "actorId") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId")) {
			validate69.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "tenantId" || key0 === "actorId" || key0 === "conversationId" || key0 === "runId")) {
				validate69.errors = [{
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
						validate69.errors = [{
							instancePath: instancePath + "/tenantId",
							schemaPath: "#/properties/tenantId/maxLength",
							keyword: "maxLength",
							params: { limit: 128 },
							message: "must NOT have more than 128 characters"
						}];
						return false;
					} else if (func1(data0) < 1) {
						validate69.errors = [{
							instancePath: instancePath + "/tenantId",
							schemaPath: "#/properties/tenantId/minLength",
							keyword: "minLength",
							params: { limit: 1 },
							message: "must NOT have fewer than 1 characters"
						}];
						return false;
					}
				} else {
					validate69.errors = [{
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
							validate69.errors = [{
								instancePath: instancePath + "/actorId",
								schemaPath: "#/properties/actorId/maxLength",
								keyword: "maxLength",
								params: { limit: 128 },
								message: "must NOT have more than 128 characters"
							}];
							return false;
						} else if (func1(data1) < 1) {
							validate69.errors = [{
								instancePath: instancePath + "/actorId",
								schemaPath: "#/properties/actorId/minLength",
								keyword: "minLength",
								params: { limit: 1 },
								message: "must NOT have fewer than 1 characters"
							}];
							return false;
						}
					} else {
						validate69.errors = [{
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
				if (valid0) {
					if (data.conversationId !== void 0) {
						let data2 = data.conversationId;
						if (typeof data2 === "string") {
							if (!formats0.test(data2)) {
								validate69.errors = [{
									instancePath: instancePath + "/conversationId",
									schemaPath: "#/properties/conversationId/format",
									keyword: "format",
									params: { format: "uuid" },
									message: "must match format \"uuid\""
								}];
								return false;
							}
						} else {
							validate69.errors = [{
								instancePath: instancePath + "/conversationId",
								schemaPath: "#/properties/conversationId/type",
								keyword: "type",
								params: { type: "string" },
								message: "must be string"
							}];
							return false;
						}
						var valid0 = true;
					} else var valid0 = true;
					if (valid0) {
						if (data.runId !== void 0) {
							let data3 = data.runId;
							if (typeof data3 === "string") {
								if (!formats0.test(data3)) {
									validate69.errors = [{
										instancePath: instancePath + "/runId",
										schemaPath: "#/properties/runId/format",
										keyword: "format",
										params: { format: "uuid" },
										message: "must match format \"uuid\""
									}];
									return false;
								}
							} else {
								validate69.errors = [{
									instancePath: instancePath + "/runId",
									schemaPath: "#/properties/runId/type",
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
			}
		}
	} else {
		validate69.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate69.errors = vErrors;
	return true;
}
validate69.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskUpdateContext = validate70;
function validate70(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate70.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.binding === void 0 && (missing0 = "binding")) {
			validate70.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "binding")) {
				validate70.errors = [{
					instancePath,
					schemaPath: "#/additionalProperties",
					keyword: "additionalProperties",
					params: { additionalProperty: key0 },
					message: "must NOT have additional properties"
				}];
				return false;
			}
			if (data.binding !== void 0) {
				let data0 = data.binding;
				if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
					let missing1;
					if (data0.tenantId === void 0 && (missing1 = "tenantId") || data0.actorId === void 0 && (missing1 = "actorId") || data0.conversationId === void 0 && (missing1 = "conversationId") || data0.runId === void 0 && (missing1 = "runId") || data0.attemptId === void 0 && (missing1 = "attemptId") || data0.workerId === void 0 && (missing1 = "workerId") || data0.writerFence === void 0 && (missing1 = "writerFence")) {
						validate70.errors = [{
							instancePath: instancePath + "/binding",
							schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required",
							keyword: "required",
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'"
						}];
						return false;
					} else {
						for (const key1 in data0) if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
							validate70.errors = [{
								instancePath: instancePath + "/binding",
								schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties",
								keyword: "additionalProperties",
								params: { additionalProperty: key1 },
								message: "must NOT have additional properties"
							}];
							return false;
						}
						if (data0.tenantId !== void 0) {
							let data1 = data0.tenantId;
							if (typeof data1 === "string") {
								if (func1(data1) > 128) {
									validate70.errors = [{
										instancePath: instancePath + "/binding/tenantId",
										schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength",
										keyword: "maxLength",
										params: { limit: 128 },
										message: "must NOT have more than 128 characters"
									}];
									return false;
								} else if (func1(data1) < 1) {
									validate70.errors = [{
										instancePath: instancePath + "/binding/tenantId",
										schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength",
										keyword: "minLength",
										params: { limit: 1 },
										message: "must NOT have fewer than 1 characters"
									}];
									return false;
								}
							} else {
								validate70.errors = [{
									instancePath: instancePath + "/binding/tenantId",
									schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type",
									keyword: "type",
									params: { type: "string" },
									message: "must be string"
								}];
								return false;
							}
							var valid2 = true;
						} else var valid2 = true;
						if (valid2) {
							if (data0.actorId !== void 0) {
								let data2 = data0.actorId;
								if (typeof data2 === "string") {
									if (func1(data2) > 128) {
										validate70.errors = [{
											instancePath: instancePath + "/binding/actorId",
											schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength",
											keyword: "maxLength",
											params: { limit: 128 },
											message: "must NOT have more than 128 characters"
										}];
										return false;
									} else if (func1(data2) < 1) {
										validate70.errors = [{
											instancePath: instancePath + "/binding/actorId",
											schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength",
											keyword: "minLength",
											params: { limit: 1 },
											message: "must NOT have fewer than 1 characters"
										}];
										return false;
									}
								} else {
									validate70.errors = [{
										instancePath: instancePath + "/binding/actorId",
										schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type",
										keyword: "type",
										params: { type: "string" },
										message: "must be string"
									}];
									return false;
								}
								var valid2 = true;
							} else var valid2 = true;
							if (valid2) {
								if (data0.conversationId !== void 0) {
									let data3 = data0.conversationId;
									if (typeof data3 === "string") {
										if (!formats0.test(data3)) {
											validate70.errors = [{
												instancePath: instancePath + "/binding/conversationId",
												schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format",
												keyword: "format",
												params: { format: "uuid" },
												message: "must match format \"uuid\""
											}];
											return false;
										}
									} else {
										validate70.errors = [{
											instancePath: instancePath + "/binding/conversationId",
											schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
									var valid2 = true;
								} else var valid2 = true;
								if (valid2) {
									if (data0.runId !== void 0) {
										let data4 = data0.runId;
										if (typeof data4 === "string") {
											if (!formats0.test(data4)) {
												validate70.errors = [{
													instancePath: instancePath + "/binding/runId",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format",
													keyword: "format",
													params: { format: "uuid" },
													message: "must match format \"uuid\""
												}];
												return false;
											}
										} else {
											validate70.errors = [{
												instancePath: instancePath + "/binding/runId",
												schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type",
												keyword: "type",
												params: { type: "string" },
												message: "must be string"
											}];
											return false;
										}
										var valid2 = true;
									} else var valid2 = true;
									if (valid2) {
										if (data0.attemptId !== void 0) {
											let data5 = data0.attemptId;
											if (typeof data5 === "string") {
												if (!formats0.test(data5)) {
													validate70.errors = [{
														instancePath: instancePath + "/binding/attemptId",
														schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format",
														keyword: "format",
														params: { format: "uuid" },
														message: "must match format \"uuid\""
													}];
													return false;
												}
											} else {
												validate70.errors = [{
													instancePath: instancePath + "/binding/attemptId",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												}];
												return false;
											}
											var valid2 = true;
										} else var valid2 = true;
										if (valid2) {
											if (data0.workerId !== void 0) {
												let data6 = data0.workerId;
												if (typeof data6 === "string") {
													if (!formats0.test(data6)) {
														validate70.errors = [{
															instancePath: instancePath + "/binding/workerId",
															schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format",
															keyword: "format",
															params: { format: "uuid" },
															message: "must match format \"uuid\""
														}];
														return false;
													}
												} else {
													validate70.errors = [{
														instancePath: instancePath + "/binding/workerId",
														schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type",
														keyword: "type",
														params: { type: "string" },
														message: "must be string"
													}];
													return false;
												}
												var valid2 = true;
											} else var valid2 = true;
											if (valid2) {
												if (data0.writerFence !== void 0) {
													let data7 = data0.writerFence;
													if (!(typeof data7 == "number" && !(data7 % 1) && !isNaN(data7) && isFinite(data7))) {
														validate70.errors = [{
															instancePath: instancePath + "/binding/writerFence",
															schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type",
															keyword: "type",
															params: { type: "integer" },
															message: "must be integer"
														}];
														return false;
													}
													if (typeof data7 == "number" && isFinite(data7)) {
														if (data7 > 9007199254740991 || isNaN(data7)) {
															validate70.errors = [{
																instancePath: instancePath + "/binding/writerFence",
																schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum",
																keyword: "maximum",
																params: {
																	comparison: "<=",
																	limit: 9007199254740991
																},
																message: "must be <= 9007199254740991"
															}];
															return false;
														} else if (data7 < 1 || isNaN(data7)) {
															validate70.errors = [{
																instancePath: instancePath + "/binding/writerFence",
																schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum",
																keyword: "minimum",
																params: {
																	comparison: ">=",
																	limit: 1
																},
																message: "must be >= 1"
															}];
															return false;
														}
													}
													var valid2 = true;
												} else var valid2 = true;
											}
										}
									}
								}
							}
						}
					}
				} else {
					validate70.errors = [{
						instancePath: instancePath + "/binding",
						schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type",
						keyword: "type",
						params: { type: "object" },
						message: "must be object"
					}];
					return false;
				}
			}
		}
	} else {
		validate70.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate70.errors = vErrors;
	return true;
}
validate70.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateTaskUpdateCommand = validate71;
function validate71(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate71.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.commandId === void 0 && (missing0 = "commandId") || data.binding === void 0 && (missing0 = "binding") || data.action === void 0 && (missing0 = "action") || data.arguments === void 0 && (missing0 = "arguments") || data.attachments === void 0 && (missing0 = "attachments") || data.scopes === void 0 && (missing0 = "scopes") || data.idempotencyKey === void 0 && (missing0 = "idempotencyKey")) {
			validate71.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "contractVersion" || key0 === "commandId" || key0 === "binding" || key0 === "action" || key0 === "arguments" || key0 === "attachments" || key0 === "scopes" || key0 === "idempotencyKey")) {
				validate71.errors = [{
					instancePath,
					schemaPath: "#/additionalProperties",
					keyword: "additionalProperties",
					params: { additionalProperty: key0 },
					message: "must NOT have additional properties"
				}];
				return false;
			}
			if (data.contractVersion !== void 0) {
				if ("0.2.0" !== data.contractVersion) {
					validate71.errors = [{
						instancePath: instancePath + "/contractVersion",
						schemaPath: "#/properties/contractVersion/const",
						keyword: "const",
						params: { allowedValue: "0.2.0" },
						message: "must be equal to constant"
					}];
					return false;
				}
				var valid0 = true;
			} else var valid0 = true;
			if (valid0) {
				if (data.commandId !== void 0) {
					let data1 = data.commandId;
					if (typeof data1 === "string") {
						if (!formats0.test(data1)) {
							validate71.errors = [{
								instancePath: instancePath + "/commandId",
								schemaPath: "#/properties/commandId/format",
								keyword: "format",
								params: { format: "uuid" },
								message: "must match format \"uuid\""
							}];
							return false;
						}
					} else {
						validate71.errors = [{
							instancePath: instancePath + "/commandId",
							schemaPath: "#/properties/commandId/type",
							keyword: "type",
							params: { type: "string" },
							message: "must be string"
						}];
						return false;
					}
					var valid0 = true;
				} else var valid0 = true;
				if (valid0) {
					if (data.binding !== void 0) {
						let data2 = data.binding;
						if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
							let missing1;
							if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.attemptId === void 0 && (missing1 = "attemptId") || data2.workerId === void 0 && (missing1 = "workerId") || data2.writerFence === void 0 && (missing1 = "writerFence")) {
								validate71.errors = [{
									instancePath: instancePath + "/binding",
									schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required",
									keyword: "required",
									params: { missingProperty: missing1 },
									message: "must have required property '" + missing1 + "'"
								}];
								return false;
							} else {
								for (const key1 in data2) if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
									validate71.errors = [{
										instancePath: instancePath + "/binding",
										schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties",
										keyword: "additionalProperties",
										params: { additionalProperty: key1 },
										message: "must NOT have additional properties"
									}];
									return false;
								}
								if (data2.tenantId !== void 0) {
									let data3 = data2.tenantId;
									if (typeof data3 === "string") {
										if (func1(data3) > 128) {
											validate71.errors = [{
												instancePath: instancePath + "/binding/tenantId",
												schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength",
												keyword: "maxLength",
												params: { limit: 128 },
												message: "must NOT have more than 128 characters"
											}];
											return false;
										} else if (func1(data3) < 1) {
											validate71.errors = [{
												instancePath: instancePath + "/binding/tenantId",
												schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength",
												keyword: "minLength",
												params: { limit: 1 },
												message: "must NOT have fewer than 1 characters"
											}];
											return false;
										}
									} else {
										validate71.errors = [{
											instancePath: instancePath + "/binding/tenantId",
											schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
									var valid2 = true;
								} else var valid2 = true;
								if (valid2) {
									if (data2.actorId !== void 0) {
										let data4 = data2.actorId;
										if (typeof data4 === "string") {
											if (func1(data4) > 128) {
												validate71.errors = [{
													instancePath: instancePath + "/binding/actorId",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength",
													keyword: "maxLength",
													params: { limit: 128 },
													message: "must NOT have more than 128 characters"
												}];
												return false;
											} else if (func1(data4) < 1) {
												validate71.errors = [{
													instancePath: instancePath + "/binding/actorId",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength",
													keyword: "minLength",
													params: { limit: 1 },
													message: "must NOT have fewer than 1 characters"
												}];
												return false;
											}
										} else {
											validate71.errors = [{
												instancePath: instancePath + "/binding/actorId",
												schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type",
												keyword: "type",
												params: { type: "string" },
												message: "must be string"
											}];
											return false;
										}
										var valid2 = true;
									} else var valid2 = true;
									if (valid2) {
										if (data2.conversationId !== void 0) {
											let data5 = data2.conversationId;
											if (typeof data5 === "string") {
												if (!formats0.test(data5)) {
													validate71.errors = [{
														instancePath: instancePath + "/binding/conversationId",
														schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format",
														keyword: "format",
														params: { format: "uuid" },
														message: "must match format \"uuid\""
													}];
													return false;
												}
											} else {
												validate71.errors = [{
													instancePath: instancePath + "/binding/conversationId",
													schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												}];
												return false;
											}
											var valid2 = true;
										} else var valid2 = true;
										if (valid2) {
											if (data2.runId !== void 0) {
												let data6 = data2.runId;
												if (typeof data6 === "string") {
													if (!formats0.test(data6)) {
														validate71.errors = [{
															instancePath: instancePath + "/binding/runId",
															schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format",
															keyword: "format",
															params: { format: "uuid" },
															message: "must match format \"uuid\""
														}];
														return false;
													}
												} else {
													validate71.errors = [{
														instancePath: instancePath + "/binding/runId",
														schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type",
														keyword: "type",
														params: { type: "string" },
														message: "must be string"
													}];
													return false;
												}
												var valid2 = true;
											} else var valid2 = true;
											if (valid2) {
												if (data2.attemptId !== void 0) {
													let data7 = data2.attemptId;
													if (typeof data7 === "string") {
														if (!formats0.test(data7)) {
															validate71.errors = [{
																instancePath: instancePath + "/binding/attemptId",
																schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format",
																keyword: "format",
																params: { format: "uuid" },
																message: "must match format \"uuid\""
															}];
															return false;
														}
													} else {
														validate71.errors = [{
															instancePath: instancePath + "/binding/attemptId",
															schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type",
															keyword: "type",
															params: { type: "string" },
															message: "must be string"
														}];
														return false;
													}
													var valid2 = true;
												} else var valid2 = true;
												if (valid2) {
													if (data2.workerId !== void 0) {
														let data8 = data2.workerId;
														if (typeof data8 === "string") {
															if (!formats0.test(data8)) {
																validate71.errors = [{
																	instancePath: instancePath + "/binding/workerId",
																	schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format",
																	keyword: "format",
																	params: { format: "uuid" },
																	message: "must match format \"uuid\""
																}];
																return false;
															}
														} else {
															validate71.errors = [{
																instancePath: instancePath + "/binding/workerId",
																schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type",
																keyword: "type",
																params: { type: "string" },
																message: "must be string"
															}];
															return false;
														}
														var valid2 = true;
													} else var valid2 = true;
													if (valid2) {
														if (data2.writerFence !== void 0) {
															let data9 = data2.writerFence;
															if (!(typeof data9 == "number" && !(data9 % 1) && !isNaN(data9) && isFinite(data9))) {
																validate71.errors = [{
																	instancePath: instancePath + "/binding/writerFence",
																	schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type",
																	keyword: "type",
																	params: { type: "integer" },
																	message: "must be integer"
																}];
																return false;
															}
															if (typeof data9 == "number" && isFinite(data9)) {
																if (data9 > 9007199254740991 || isNaN(data9)) {
																	validate71.errors = [{
																		instancePath: instancePath + "/binding/writerFence",
																		schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum",
																		keyword: "maximum",
																		params: {
																			comparison: "<=",
																			limit: 9007199254740991
																		},
																		message: "must be <= 9007199254740991"
																	}];
																	return false;
																} else if (data9 < 1 || isNaN(data9)) {
																	validate71.errors = [{
																		instancePath: instancePath + "/binding/writerFence",
																		schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum",
																		keyword: "minimum",
																		params: {
																			comparison: ">=",
																			limit: 1
																		},
																		message: "must be >= 1"
																	}];
																	return false;
																}
															}
															var valid2 = true;
														} else var valid2 = true;
													}
												}
											}
										}
									}
								}
							}
						} else {
							validate71.errors = [{
								instancePath: instancePath + "/binding",
								schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type",
								keyword: "type",
								params: { type: "object" },
								message: "must be object"
							}];
							return false;
						}
						var valid0 = true;
					} else var valid0 = true;
					if (valid0) {
						if (data.action !== void 0) {
							if ("task.update" !== data.action) {
								validate71.errors = [{
									instancePath: instancePath + "/action",
									schemaPath: "#/properties/action/const",
									keyword: "const",
									params: { allowedValue: "task.update" },
									message: "must be equal to constant"
								}];
								return false;
							}
							var valid0 = true;
						} else var valid0 = true;
						if (valid0) {
							if (data.arguments !== void 0) {
								let data11 = data.arguments;
								if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
									let missing2;
									if (data11.taskId === void 0 && (missing2 = "taskId") || data11.mode === void 0 && (missing2 = "mode") || data11.patch === void 0 && (missing2 = "patch")) {
										validate71.errors = [{
											instancePath: instancePath + "/arguments",
											schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/required",
											keyword: "required",
											params: { missingProperty: missing2 },
											message: "must have required property '" + missing2 + "'"
										}];
										return false;
									} else {
										for (const key2 in data11) if (!(key2 === "taskId" || key2 === "mode" || key2 === "patch")) {
											validate71.errors = [{
												instancePath: instancePath + "/arguments",
												schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/additionalProperties",
												keyword: "additionalProperties",
												params: { additionalProperty: key2 },
												message: "must NOT have additional properties"
											}];
											return false;
										}
										if (data11.taskId !== void 0) {
											let data12 = data11.taskId;
											if (typeof data12 === "string") {
												if (!formats0.test(data12)) {
													validate71.errors = [{
														instancePath: instancePath + "/arguments/taskId",
														schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/taskId/format",
														keyword: "format",
														params: { format: "uuid" },
														message: "must match format \"uuid\""
													}];
													return false;
												}
											} else {
												validate71.errors = [{
													instancePath: instancePath + "/arguments/taskId",
													schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/taskId/type",
													keyword: "type",
													params: { type: "string" },
													message: "must be string"
												}];
												return false;
											}
											var valid4 = true;
										} else var valid4 = true;
										if (valid4) {
											if (data11.mode !== void 0) {
												if ("unconditional_patch" !== data11.mode) {
													validate71.errors = [{
														instancePath: instancePath + "/arguments/mode",
														schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/mode/const",
														keyword: "const",
														params: { allowedValue: "unconditional_patch" },
														message: "must be equal to constant"
													}];
													return false;
												}
												var valid4 = true;
											} else var valid4 = true;
											if (valid4) {
												if (data11.patch !== void 0) {
													let data14 = data11.patch;
													if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
														if (Object.keys(data14).length < 1) {
															validate71.errors = [{
																instancePath: instancePath + "/arguments/patch",
																schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/minProperties",
																keyword: "minProperties",
																params: { limit: 1 },
																message: "must NOT have fewer than 1 properties"
															}];
															return false;
														} else {
															for (const key3 in data14) if (!(key3 === "title" || key3 === "status" || key3 === "dueDate")) {
																validate71.errors = [{
																	instancePath: instancePath + "/arguments/patch",
																	schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/additionalProperties",
																	keyword: "additionalProperties",
																	params: { additionalProperty: key3 },
																	message: "must NOT have additional properties"
																}];
																return false;
															}
															if (data14.title !== void 0) {
																let data15 = data14.title;
																if (typeof data15 === "string") {
																	if (func1(data15) > 240) {
																		validate71.errors = [{
																			instancePath: instancePath + "/arguments/patch/title",
																			schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/maxLength",
																			keyword: "maxLength",
																			params: { limit: 240 },
																			message: "must NOT have more than 240 characters"
																		}];
																		return false;
																	} else if (func1(data15) < 1) {
																		validate71.errors = [{
																			instancePath: instancePath + "/arguments/patch/title",
																			schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/minLength",
																			keyword: "minLength",
																			params: { limit: 1 },
																			message: "must NOT have fewer than 1 characters"
																		}];
																		return false;
																	}
																} else {
																	validate71.errors = [{
																		instancePath: instancePath + "/arguments/patch/title",
																		schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/type",
																		keyword: "type",
																		params: { type: "string" },
																		message: "must be string"
																	}];
																	return false;
																}
																var valid5 = true;
															} else var valid5 = true;
															if (valid5) {
																if (data14.status !== void 0) {
																	let data16 = data14.status;
																	if (!(data16 === "todo" || data16 === "in_progress" || data16 === "done" || data16 === "blocked" || data16 === "canceled")) {
																		validate71.errors = [{
																			instancePath: instancePath + "/arguments/patch/status",
																			schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/status/enum",
																			keyword: "enum",
																			params: { allowedValues: schema35.properties.patch.properties.status.enum },
																			message: "must be equal to one of the allowed values"
																		}];
																		return false;
																	}
																	var valid5 = true;
																} else var valid5 = true;
																if (valid5) {
																	if (data14.dueDate !== void 0) {
																		let data17 = data14.dueDate;
																		if (typeof data17 === "string") {
																			if (!pattern4.test(data17)) {
																				validate71.errors = [{
																					instancePath: instancePath + "/arguments/patch/dueDate",
																					schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/pattern",
																					keyword: "pattern",
																					params: { pattern: "Z$" },
																					message: "must match pattern \"Z$\""
																				}];
																				return false;
																			} else if (!formats2.validate(data17)) {
																				validate71.errors = [{
																					instancePath: instancePath + "/arguments/patch/dueDate",
																					schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/format",
																					keyword: "format",
																					params: { format: "date-time" },
																					message: "must match format \"date-time\""
																				}];
																				return false;
																			}
																		} else {
																			validate71.errors = [{
																				instancePath: instancePath + "/arguments/patch/dueDate",
																				schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/type",
																				keyword: "type",
																				params: { type: "string" },
																				message: "must be string"
																			}];
																			return false;
																		}
																		var valid5 = true;
																	} else var valid5 = true;
																}
															}
														}
													} else {
														validate71.errors = [{
															instancePath: instancePath + "/arguments/patch",
															schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/type",
															keyword: "type",
															params: { type: "object" },
															message: "must be object"
														}];
														return false;
													}
													var valid4 = true;
												} else var valid4 = true;
											}
										}
									}
								} else {
									validate71.errors = [{
										instancePath: instancePath + "/arguments",
										schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/type",
										keyword: "type",
										params: { type: "object" },
										message: "must be object"
									}];
									return false;
								}
								var valid0 = true;
							} else var valid0 = true;
							if (valid0) {
								if (data.attachments !== void 0) {
									let data18 = data.attachments;
									if (Array.isArray(data18)) {
										if (data18.length > 0) {
											validate71.errors = [{
												instancePath: instancePath + "/attachments",
												schemaPath: "#/properties/attachments/maxItems",
												keyword: "maxItems",
												params: { limit: 0 },
												message: "must NOT have more than 0 items"
											}];
											return false;
										}
									} else {
										validate71.errors = [{
											instancePath: instancePath + "/attachments",
											schemaPath: "#/properties/attachments/type",
											keyword: "type",
											params: { type: "array" },
											message: "must be array"
										}];
										return false;
									}
									var valid0 = true;
								} else var valid0 = true;
								if (valid0) {
									if (data.scopes !== void 0) {
										let data19 = data.scopes;
										if (Array.isArray(data19)) {
											if (data19.length < 1) {
												validate71.errors = [{
													instancePath: instancePath + "/scopes",
													schemaPath: "#/properties/scopes/minItems",
													keyword: "minItems",
													params: { limit: 1 },
													message: "must NOT have fewer than 1 items"
												}];
												return false;
											} else {
												var valid6 = true;
												const len0 = data19.length;
												for (let i0 = 0; i0 < len0; i0++) {
													let data20 = data19[i0];
													if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
														let missing3;
														if (data20.tenantId === void 0 && (missing3 = "tenantId") || data20.kind === void 0 && (missing3 = "kind") || data20.resourceId === void 0 && (missing3 = "resourceId") || data20.policyRevision === void 0 && (missing3 = "policyRevision")) {
															validate71.errors = [{
																instancePath: instancePath + "/scopes/" + i0,
																schemaPath: "#/$defs/Canonical_Scope_f882edb5/required",
																keyword: "required",
																params: { missingProperty: missing3 },
																message: "must have required property '" + missing3 + "'"
															}];
															return false;
														} else {
															for (const key4 in data20) if (!(key4 === "tenantId" || key4 === "kind" || key4 === "resourceId" || key4 === "policyRevision")) {
																validate71.errors = [{
																	instancePath: instancePath + "/scopes/" + i0,
																	schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties",
																	keyword: "additionalProperties",
																	params: { additionalProperty: key4 },
																	message: "must NOT have additional properties"
																}];
																return false;
															}
															if (data20.tenantId !== void 0) {
																let data21 = data20.tenantId;
																if (typeof data21 === "string") {
																	if (func1(data21) > 128) {
																		validate71.errors = [{
																			instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																			schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength",
																			keyword: "maxLength",
																			params: { limit: 128 },
																			message: "must NOT have more than 128 characters"
																		}];
																		return false;
																	} else if (func1(data21) < 1) {
																		validate71.errors = [{
																			instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																			schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength",
																			keyword: "minLength",
																			params: { limit: 1 },
																			message: "must NOT have fewer than 1 characters"
																		}];
																		return false;
																	}
																} else {
																	validate71.errors = [{
																		instancePath: instancePath + "/scopes/" + i0 + "/tenantId",
																		schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type",
																		keyword: "type",
																		params: { type: "string" },
																		message: "must be string"
																	}];
																	return false;
																}
																var valid8 = true;
															} else var valid8 = true;
															if (valid8) {
																if (data20.kind !== void 0) {
																	let data22 = data20.kind;
																	if (typeof data22 !== "string") {
																		validate71.errors = [{
																			instancePath: instancePath + "/scopes/" + i0 + "/kind",
																			schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type",
																			keyword: "type",
																			params: { type: "string" },
																			message: "must be string"
																		}];
																		return false;
																	}
																	if (!(data22 === "tenant" || data22 === "client" || data22 === "mailbox" || data22 === "memory" || data22 === "document" || data22 === "private-user" || data22 === "public")) {
																		validate71.errors = [{
																			instancePath: instancePath + "/scopes/" + i0 + "/kind",
																			schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum",
																			keyword: "enum",
																			params: { allowedValues: schema41.properties.kind.enum },
																			message: "must be equal to one of the allowed values"
																		}];
																		return false;
																	}
																	var valid8 = true;
																} else var valid8 = true;
																if (valid8) {
																	if (data20.resourceId !== void 0) {
																		let data23 = data20.resourceId;
																		if (typeof data23 === "string") {
																			if (func1(data23) > 256) {
																				validate71.errors = [{
																					instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																					schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength",
																					keyword: "maxLength",
																					params: { limit: 256 },
																					message: "must NOT have more than 256 characters"
																				}];
																				return false;
																			} else if (func1(data23) < 1) {
																				validate71.errors = [{
																					instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																					schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength",
																					keyword: "minLength",
																					params: { limit: 1 },
																					message: "must NOT have fewer than 1 characters"
																				}];
																				return false;
																			}
																		} else {
																			validate71.errors = [{
																				instancePath: instancePath + "/scopes/" + i0 + "/resourceId",
																				schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type",
																				keyword: "type",
																				params: { type: "string" },
																				message: "must be string"
																			}];
																			return false;
																		}
																		var valid8 = true;
																	} else var valid8 = true;
																	if (valid8) {
																		if (data20.policyRevision !== void 0) {
																			let data24 = data20.policyRevision;
																			if (typeof data24 === "string") {
																				if (func1(data24) > 128) {
																					validate71.errors = [{
																						instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																						schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength",
																						keyword: "maxLength",
																						params: { limit: 128 },
																						message: "must NOT have more than 128 characters"
																					}];
																					return false;
																				} else if (func1(data24) < 1) {
																					validate71.errors = [{
																						instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																						schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength",
																						keyword: "minLength",
																						params: { limit: 1 },
																						message: "must NOT have fewer than 1 characters"
																					}];
																					return false;
																				}
																			} else {
																				validate71.errors = [{
																					instancePath: instancePath + "/scopes/" + i0 + "/policyRevision",
																					schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type",
																					keyword: "type",
																					params: { type: "string" },
																					message: "must be string"
																				}];
																				return false;
																			}
																			var valid8 = true;
																		} else var valid8 = true;
																	}
																}
															}
														}
													} else {
														validate71.errors = [{
															instancePath: instancePath + "/scopes/" + i0,
															schemaPath: "#/$defs/Canonical_Scope_f882edb5/type",
															keyword: "type",
															params: { type: "object" },
															message: "must be object"
														}];
														return false;
													}
													var valid6 = true;
													if (!valid6) break;
												}
												if (valid6) {
													let i1 = data19.length;
													let j0;
													if (i1 > 1) {
														outer0: for (; i1--;) for (j0 = i1; j0--;) if (func0(data19[i1], data19[j0])) {
															validate71.errors = [{
																instancePath: instancePath + "/scopes",
																schemaPath: "#/properties/scopes/uniqueItems",
																keyword: "uniqueItems",
																params: {
																	i: i1,
																	j: j0
																},
																message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)"
															}];
															return false;
														}
													}
												}
											}
										} else {
											validate71.errors = [{
												instancePath: instancePath + "/scopes",
												schemaPath: "#/properties/scopes/type",
												keyword: "type",
												params: { type: "array" },
												message: "must be array"
											}];
											return false;
										}
										var valid0 = true;
									} else var valid0 = true;
									if (valid0) {
										if (data.idempotencyKey !== void 0) {
											let data25 = data.idempotencyKey;
											if (typeof data25 === "string") {
												if (func1(data25) > 128) {
													validate71.errors = [{
														instancePath: instancePath + "/idempotencyKey",
														schemaPath: "#/properties/idempotencyKey/maxLength",
														keyword: "maxLength",
														params: { limit: 128 },
														message: "must NOT have more than 128 characters"
													}];
													return false;
												} else if (func1(data25) < 1) {
													validate71.errors = [{
														instancePath: instancePath + "/idempotencyKey",
														schemaPath: "#/properties/idempotencyKey/minLength",
														keyword: "minLength",
														params: { limit: 1 },
														message: "must NOT have fewer than 1 characters"
													}];
													return false;
												}
											} else {
												validate71.errors = [{
													instancePath: instancePath + "/idempotencyKey",
													schemaPath: "#/properties/idempotencyKey/type",
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
							}
						}
					}
				}
			}
		}
	} else {
		validate71.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate71.errors = vErrors;
	return true;
}
validate71.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validateRunBinding = validate72;
function validate72(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
	let vErrors = null;
	const evaluated0 = validate72.evaluated;
	if (evaluated0.dynamicProps) evaluated0.props = void 0;
	if (evaluated0.dynamicItems) evaluated0.items = void 0;
	if (data && typeof data == "object" && !Array.isArray(data)) {
		let missing0;
		if (data.tenantId === void 0 && (missing0 = "tenantId") || data.actorId === void 0 && (missing0 = "actorId") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId") || data.attemptId === void 0 && (missing0 = "attemptId") || data.workerId === void 0 && (missing0 = "workerId") || data.writerFence === void 0 && (missing0 = "writerFence")) {
			validate72.errors = [{
				instancePath,
				schemaPath: "#/required",
				keyword: "required",
				params: { missingProperty: missing0 },
				message: "must have required property '" + missing0 + "'"
			}];
			return false;
		} else {
			for (const key0 in data) if (!(key0 === "tenantId" || key0 === "actorId" || key0 === "conversationId" || key0 === "runId" || key0 === "attemptId" || key0 === "workerId" || key0 === "writerFence")) {
				validate72.errors = [{
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
						validate72.errors = [{
							instancePath: instancePath + "/tenantId",
							schemaPath: "#/properties/tenantId/maxLength",
							keyword: "maxLength",
							params: { limit: 128 },
							message: "must NOT have more than 128 characters"
						}];
						return false;
					} else if (func1(data0) < 1) {
						validate72.errors = [{
							instancePath: instancePath + "/tenantId",
							schemaPath: "#/properties/tenantId/minLength",
							keyword: "minLength",
							params: { limit: 1 },
							message: "must NOT have fewer than 1 characters"
						}];
						return false;
					}
				} else {
					validate72.errors = [{
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
							validate72.errors = [{
								instancePath: instancePath + "/actorId",
								schemaPath: "#/properties/actorId/maxLength",
								keyword: "maxLength",
								params: { limit: 128 },
								message: "must NOT have more than 128 characters"
							}];
							return false;
						} else if (func1(data1) < 1) {
							validate72.errors = [{
								instancePath: instancePath + "/actorId",
								schemaPath: "#/properties/actorId/minLength",
								keyword: "minLength",
								params: { limit: 1 },
								message: "must NOT have fewer than 1 characters"
							}];
							return false;
						}
					} else {
						validate72.errors = [{
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
				if (valid0) {
					if (data.conversationId !== void 0) {
						let data2 = data.conversationId;
						if (typeof data2 === "string") {
							if (!formats0.test(data2)) {
								validate72.errors = [{
									instancePath: instancePath + "/conversationId",
									schemaPath: "#/properties/conversationId/format",
									keyword: "format",
									params: { format: "uuid" },
									message: "must match format \"uuid\""
								}];
								return false;
							}
						} else {
							validate72.errors = [{
								instancePath: instancePath + "/conversationId",
								schemaPath: "#/properties/conversationId/type",
								keyword: "type",
								params: { type: "string" },
								message: "must be string"
							}];
							return false;
						}
						var valid0 = true;
					} else var valid0 = true;
					if (valid0) {
						if (data.runId !== void 0) {
							let data3 = data.runId;
							if (typeof data3 === "string") {
								if (!formats0.test(data3)) {
									validate72.errors = [{
										instancePath: instancePath + "/runId",
										schemaPath: "#/properties/runId/format",
										keyword: "format",
										params: { format: "uuid" },
										message: "must match format \"uuid\""
									}];
									return false;
								}
							} else {
								validate72.errors = [{
									instancePath: instancePath + "/runId",
									schemaPath: "#/properties/runId/type",
									keyword: "type",
									params: { type: "string" },
									message: "must be string"
								}];
								return false;
							}
							var valid0 = true;
						} else var valid0 = true;
						if (valid0) {
							if (data.attemptId !== void 0) {
								let data4 = data.attemptId;
								if (typeof data4 === "string") {
									if (!formats0.test(data4)) {
										validate72.errors = [{
											instancePath: instancePath + "/attemptId",
											schemaPath: "#/properties/attemptId/format",
											keyword: "format",
											params: { format: "uuid" },
											message: "must match format \"uuid\""
										}];
										return false;
									}
								} else {
									validate72.errors = [{
										instancePath: instancePath + "/attemptId",
										schemaPath: "#/properties/attemptId/type",
										keyword: "type",
										params: { type: "string" },
										message: "must be string"
									}];
									return false;
								}
								var valid0 = true;
							} else var valid0 = true;
							if (valid0) {
								if (data.workerId !== void 0) {
									let data5 = data.workerId;
									if (typeof data5 === "string") {
										if (!formats0.test(data5)) {
											validate72.errors = [{
												instancePath: instancePath + "/workerId",
												schemaPath: "#/properties/workerId/format",
												keyword: "format",
												params: { format: "uuid" },
												message: "must match format \"uuid\""
											}];
											return false;
										}
									} else {
										validate72.errors = [{
											instancePath: instancePath + "/workerId",
											schemaPath: "#/properties/workerId/type",
											keyword: "type",
											params: { type: "string" },
											message: "must be string"
										}];
										return false;
									}
									var valid0 = true;
								} else var valid0 = true;
								if (valid0) {
									if (data.writerFence !== void 0) {
										let data6 = data.writerFence;
										if (!(typeof data6 == "number" && !(data6 % 1) && !isNaN(data6) && isFinite(data6))) {
											validate72.errors = [{
												instancePath: instancePath + "/writerFence",
												schemaPath: "#/properties/writerFence/type",
												keyword: "type",
												params: { type: "integer" },
												message: "must be integer"
											}];
											return false;
										}
										if (typeof data6 == "number" && isFinite(data6)) {
											if (data6 > 9007199254740991 || isNaN(data6)) {
												validate72.errors = [{
													instancePath: instancePath + "/writerFence",
													schemaPath: "#/properties/writerFence/maximum",
													keyword: "maximum",
													params: {
														comparison: "<=",
														limit: 9007199254740991
													},
													message: "must be <= 9007199254740991"
												}];
												return false;
											} else if (data6 < 1 || isNaN(data6)) {
												validate72.errors = [{
													instancePath: instancePath + "/writerFence",
													schemaPath: "#/properties/writerFence/minimum",
													keyword: "minimum",
													params: {
														comparison: ">=",
														limit: 1
													},
													message: "must be >= 1"
												}];
												return false;
											}
										}
										var valid0 = true;
									} else var valid0 = true;
								}
							}
						}
					}
				}
			}
		}
	} else {
		validate72.errors = [{
			instancePath,
			schemaPath: "#/type",
			keyword: "type",
			params: { type: "object" },
			message: "must be object"
		}];
		return false;
	}
	validate72.errors = vErrors;
	return true;
}
validate72.evaluated = {
	"props": true,
	"dynamicProps": false,
	"dynamicItems": false
};
const validators = {
	TaskUpdateRaw: validateTaskUpdateRaw,
	TaskUpdateArguments: validateTaskUpdateArguments,
	TaskUpdateApprovalProposal: validateTaskUpdateApprovalProposal,
	TaskUpdateResult: validateTaskUpdateResult,
	TaskCommandPrepareRequest: validateTaskCommandPrepareRequest,
	TaskCommandExecuteRequest: validateTaskCommandExecuteRequest,
	TaskCommandPrepareResponse: validateTaskCommandPrepareResponse,
	TaskCommandExecuteResponse: validateTaskCommandExecuteResponse,
	TaskCommandErrorResponse: validateTaskCommandErrorResponse,
	TaskCommandExpectedBinding: validateTaskCommandExpectedBinding,
	TaskUpdateContext: validateTaskUpdateContext,
	TaskUpdateCommand: validateTaskUpdateCommand,
	RunBinding: validateRunBinding
};
const errorStatuses = {
	"ACCESS_DENIED": 403,
	"APPLICATION_CLOCK": 500,
	"APPLICATION_CONFIGURATION": 500,
	"CANCELLED": 499,
	"COMMAND_APPROVAL_REFUSED": 409,
	"COMMAND_AUTHORITY_REFUSED": 502,
	"COMMAND_COMMIT_UNCERTAIN": 502,
	"COMMAND_OUTCOME_UNKNOWN": 502,
	"COMMAND_PREPARATION_REFUSED": 502,
	"COMMAND_REFUSED": 502,
	"DEADLINE": 408,
	"EXECUTION_AUTHORITY_REFUSED": 403,
	"INVALID_BODY": 400,
	"INVALID_CONTENT_LENGTH": 400,
	"INVALID_JSON": 400,
	"INVALID_REQUEST": 400,
	"INVALID_UTF8": 400,
	"LOOKUP_REPLAY": 409,
	"LOOKUP_UNAVAILABLE": 502,
	"METHOD_NOT_ALLOWED": 405,
	"NOT_FOUND": 404,
	"REQUEST_FAILED": 502,
	"REQUEST_TOO_LARGE": 413,
	"RESPONSE_TOO_LARGE": 413,
	"SESSION_SCOPE_REFUSED": 403,
	"TASK_COMMAND_UNAVAILABLE": 503,
	"UNAUTHENTICATED": 401,
	"UNAVAILABLE": 502,
	"UNSUPPORTED_CONTENT_ENCODING": 415,
	"UNSUPPORTED_MEDIA_TYPE": 415
};
const errorOutcomes = [
	"NOT_DISPATCHED",
	"UNKNOWN",
	"RESULT_NOT_RELEASED",
	"STORED_NOT_RELEASED",
	"NOT_STORED",
	"READ_UNAVAILABLE"
];
/** Receiving metadata describes transport and integrity only; it grants no authority. */
const taskCommandVersion = "0.1.0";
const taskCommandSchemaId = "urn:meri:task-command-application:0.1.0";
const taskCommandPaths = Object.freeze({
	prepare: "/api/task-commands/prepare",
	execute: "/api/task-commands/execute"
});
const taskCommandLimits = Object.freeze({
	requestBytes: 16777216,
	responseBytes: 16777216,
	jsonNodes: 1e5,
	jsonDepth: 64
});
const freeze = (value) => {
	if (value && typeof value === "object") {
		Object.values(value).forEach(freeze);
		Object.freeze(value);
	}
	return value;
};
const createTaskCommandMetadata = (errorStatuses, errorOutcomes) => freeze({
	contractVersion: taskCommandVersion,
	schemaId: taskCommandSchemaId,
	routes: {
		prepare: {
			method: "POST",
			path: taskCommandPaths.prepare,
			response: "json"
		},
		execute: {
			method: "POST",
			path: taskCommandPaths.execute,
			response: "json"
		}
	},
	authentication: {
		scheme: "Bearer",
		authority: "trusted session resolution and current server approval/command owners",
		expectedContext: "independently authenticated tenantId, actorId, conversationId and runId"
	},
	limits: taskCommandLimits,
	errorStatuses,
	errorOutcomes,
	semantics: {
		preparation: "approval_required is an immutable proposal, never approval",
		execution: "observed requires a succeeded receipt and matching task result; indeterminate is not success",
		expiry: "caller checks createdAt/expiresAt against a fresh clock before display and execution; server rechecks current authority",
		resume: "attemptId, workerId and writerFence may change within the same stable tenant/actor/conversation/run binding"
	}
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
const fail$2 = (code) => {
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
		if (tag.call(value) !== "Uint8Array") fail$2("INVALID_BYTES");
		const n = length.call(value), b = buffer.call(value), o = offset.call(value);
		ordinaryBuffer.call(b);
		if (n > cap) fail$2("BYTE_LIMIT");
		const copy = new Uint8Array(n);
		Uint8Array.prototype.set.call(copy, new Uint8Array(b, o, n));
		return copy;
	} catch (error) {
		if (isFailure(error)) throw error;
		fail$2("INVALID_BYTES");
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
		fail$2("INVALID_JSON_UTF8");
	}
	const stack = [[data, 0]], objects = [];
	let nodes = 0;
	while (stack.length) {
		const [v, depth] = stack.pop();
		if (++nodes > 1e5 || depth > 64) fail$2("JSON_LIMIT");
		if (typeof v === "number" && !Number.isFinite(v)) fail$2("INVALID_NUMBER");
		if (typeof v === "string" && !v.isWellFormed()) fail$2("INVALID_UNICODE");
		if (v && typeof v === "object") {
			objects.push(v);
			for (const [k, x] of Object.entries(v)) {
				if ([
					"__proto__",
					"prototype",
					"constructor"
				].includes(k)) fail$2("DANGEROUS_KEY");
				stack.push([x, depth + 1]);
			}
		}
	}
	for (const v of objects) Object.freeze(v);
	return data;
}
/** Text is converted through the existing bounded, inert browser JSON boundary. */
var TaskCommandResponseError = class extends Error {
	constructor(code) {
		super(code);
		this.name = "TaskCommandResponseError";
		this.code = code;
	}
};
const fail$1 = (code) => {
	throw new TaskCommandResponseError(code);
};
function parseText(value, cap) {
	if (typeof value !== "string") fail$1("TASK_COMMAND_JSON");
	if (value.length > cap) fail$1("TASK_COMMAND_LIMIT");
	if (!value.isWellFormed()) fail$1("TASK_COMMAND_JSON");
	try {
		return parseBytes(new TextEncoder().encode(value), cap);
	} catch (error) {
		fail$1(["BYTE_LIMIT", "JSON_LIMIT"].includes(error.code) ? "TASK_COMMAND_LIMIT" : "TASK_COMMAND_JSON");
	}
}
/** Trusted caller context is still copied as own enumerable data; accessors are never read. */
function snapshotExpected(value) {
	const visit = (v, depth) => {
		if (depth > 64) fail$1("TASK_COMMAND_EXPECTATION");
		if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return v;
		if (!v || typeof v !== "object" || ![
			Object.prototype,
			null,
			Array.prototype
		].includes(Object.getPrototypeOf(v))) fail$1("TASK_COMMAND_EXPECTATION");
		const d = Object.getOwnPropertyDescriptors(v), array = Array.isArray(v), out = array ? [] : {};
		for (const key of Reflect.ownKeys(d)) {
			if (array && key === "length") continue;
			if (typeof key !== "string" || [
				"__proto__",
				"prototype",
				"constructor"
			].includes(key) || !d[key].enumerable || !Object.hasOwn(d[key], "value")) fail$1("TASK_COMMAND_EXPECTATION");
			out[key] = visit(d[key].value, depth + 1);
		}
		return out;
	};
	try {
		return parseText(JSON.stringify(visit(value, 0)), 16777216);
	} catch (error) {
		if (error instanceof TaskCommandResponseError) throw error;
		fail$1("TASK_COMMAND_EXPECTATION");
	}
}
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
/** The canonical normalizer is called only with bounded inert JSON from receive.mjs,
* and with a context built from its schema-validated proposal. No object ingress or
* authority is supplied by this build-time browser adapter. */
const snapshotOperationData = (value) => value;
const fail = () => {
	throw new Error("Invalid task update intent");
};
const instant$1 = (value) => {
	const n = Date.parse(value);
	if (!Number.isSafeInteger(n) || new Date(n).toISOString() !== value) fail();
	return n;
};
const day = (value) => {
	if (instant$1(value) % 864e5 !== 0) fail();
	return value;
};
function createTaskUpdateValidators({ validateShape, validatePublicShape, canonicalSha256 }) {
	const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
	function context(value) {
		const c = snapshotOperationData(value);
		validateShape("TaskUpdateContext", c);
		return c;
	}
	function normalizeTaskUpdateInput(value, options) {
		context(options);
		const raw = snapshotOperationData(value);
		validateShape("TaskUpdateRaw", raw);
		const taskId = raw.taskId.trim().toLowerCase(), patch = {};
		if (raw.title?.trim()) {
			const title = raw.title.trim();
			if (title.length > 240) fail();
			patch.title = title;
		}
		if (raw.status?.trim()) {
			const status = raw.status.trim().toLowerCase();
			patch.status = status === "open" ? "todo" : status;
		}
		if (raw.dueDate?.trim()) {
			const date = raw.dueDate.trim();
			patch.dueDate = day(date.length === 10 ? `${date}T00:00:00.000Z` : date);
		}
		const input = {
			taskId,
			mode: "unconditional_patch",
			patch
		};
		validateShape("TaskUpdateArguments", input);
		return input;
	}
	function assertTaskUpdateCommand(value, options) {
		const cmd = snapshotOperationData(value), c = context(options);
		validateShape("TaskUpdateCommand", cmd);
		if (!same(cmd.binding, c.binding) || cmd.scopes.some((s) => s.tenantId !== cmd.binding.tenantId)) fail();
		if (cmd.arguments.taskId !== cmd.arguments.taskId.toLowerCase()) fail();
		const { title, dueDate } = cmd.arguments.patch;
		if (title !== void 0 && (title.trim() !== title || title.length > 240)) fail();
		if (dueDate !== void 0) day(dueDate);
		return cmd;
	}
	function assertTaskUpdateProposal(value, options) {
		const p = snapshotOperationData(value);
		validateShape("TaskUpdateApprovalProposal", p);
		assertTaskUpdateCommand(p.command, options);
		if (canonicalSha256(p.command) !== p.commandSha256 || instant$1(p.expiresAt) <= instant$1(p.createdAt) || p.requiredApprover.tenantId !== p.command.binding.tenantId) fail();
		return p;
	}
	function assertTaskUpdateExecution(proposalValue, value, options) {
		const p = assertTaskUpdateProposal(proposalValue, options), e = snapshotOperationData(value);
		validatePublicShape("CommandExecutionRequest", e);
		if (e.proposalId !== p.proposalId || e.commandSha256 !== p.commandSha256 || e.idempotencyKey !== p.command.idempotencyKey) fail();
		for (const key of [
			"tenantId",
			"actorId",
			"conversationId",
			"runId"
		]) if (e.executorBinding[key] !== p.command.binding[key]) fail();
		return e;
	}
	function assertTaskUpdateResult(value, commandValue, options) {
		const c = assertTaskUpdateCommand(commandValue, options), r = snapshotOperationData(value);
		validateShape("TaskUpdateResult", r);
		instant$1(r.updatedAt);
		if (r.dueDate !== null) day(r.dueDate);
		if (r.id.toLowerCase() !== c.arguments.taskId) fail();
		for (const [key, v] of Object.entries(c.arguments.patch)) if (r[key] !== v) fail();
		return r;
	}
	return Object.freeze({
		normalizeTaskUpdateInput,
		assertTaskUpdateCommand,
		assertTaskUpdateProposal,
		assertTaskUpdateExecution,
		assertTaskUpdateResult
	});
}
const same = (a, b) => canonicalize(a) === canonicalize(b);
const sha = async (value) => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalize(value)))), (byte) => byte.toString(16).padStart(2, "0")).join("");
const check = (name, value) => {
	if (!validators[name]?.(value)) fail$1("TASK_COMMAND_SHAPE");
	return value;
};
const normalizer = createTaskUpdateValidators({
	validateShape: check,
	validatePublicShape: check,
	canonicalSha256: () => fail$1("TASK_COMMAND_INTERNAL")
}).normalizeTaskUpdateInput;
const stableKeys = [
	"tenantId",
	"actorId",
	"conversationId",
	"runId"
];
const instant = (value) => {
	const at = Date.parse(value);
	if (!Number.isSafeInteger(at) || new Date(at).toISOString() !== value) fail$1("TASK_COMMAND_CORRELATION");
	return at;
};
const stable = (binding, expected) => {
	if (stableKeys.some((key) => binding[key] !== expected[key])) fail$1("TASK_COMMAND_CORRELATION");
};
const scopes = (binding, values) => {
	if (values.some((scope) => scope.tenantId !== binding.tenantId)) fail$1("TASK_COMMAND_CORRELATION");
};
function normalizeArguments(raw, binding) {
	try {
		return normalizer(raw, { binding });
	} catch {
		fail$1("TASK_COMMAND_ARGUMENTS");
	}
}
async function proposal(value) {
	check("TaskUpdateApprovalProposal", value);
	const c = value.command;
	if (await sha(c) !== value.commandSha256 || value.requiredApprover.tenantId !== c.binding.tenantId || instant(value.expiresAt) <= instant(value.createdAt)) fail$1("TASK_COMMAND_CORRELATION");
	scopes(c.binding, c.scopes);
	if (c.arguments.taskId !== c.arguments.taskId.toLowerCase() || !same(c.arguments, normalizeArguments({
		taskId: c.arguments.taskId,
		...c.arguments.patch
	}, c.binding))) fail$1("TASK_COMMAND_CORRELATION");
	return value;
}
async function correlatePrepare(value, expectation) {
	const p = await proposal(value.proposal);
	stable(p.command.binding, expectation.binding);
	check("TaskCommandPrepareRequest", expectation.request);
	if (!same(p.command.arguments, normalizeArguments(expectation.request.arguments, p.command.binding))) fail$1("TASK_COMMAND_CORRELATION");
}
async function correlateExecute(value, expectation) {
	const selected = await proposal(expectation.proposal);
	stable(selected.command.binding, expectation.binding);
	if (value.status === "indeterminate") return;
	const { receipt, result } = value.outcome, c = selected.command;
	stable(receipt.binding, expectation.binding);
	scopes(receipt.binding, receipt.scopes);
	if (receipt.outcome !== "succeeded" || receipt.commandId !== c.commandId || receipt.commandSha256 !== selected.commandSha256 || receipt.idempotencyKey !== c.idempotencyKey || !same(receipt.scopes, c.scopes) || result.id.toLowerCase() !== c.arguments.taskId) fail$1("TASK_COMMAND_CORRELATION");
	instant(receipt.completedAt);
	instant(result.updatedAt);
	if (result.dueDate !== null && instant(result.dueDate) % 864e5 !== 0) fail$1("TASK_COMMAND_CORRELATION");
	for (const [key, value] of Object.entries(c.arguments.patch)) if (result[key] !== value) fail$1("TASK_COMMAND_CORRELATION");
}
const taskCommandMetadata = createTaskCommandMetadata(errorStatuses, errorOutcomes);
const routes = Object.freeze({
	prepare: {
		request: "TaskCommandPrepareRequest",
		response: "TaskCommandPrepareResponse"
	},
	execute: {
		request: "TaskCommandExecuteRequest",
		response: "TaskCommandExecuteResponse"
	}
});
const routeInfo = (route) => {
	if (typeof route !== "string" || !Object.hasOwn(routes, route)) fail$1("TASK_COMMAND_ROUTE");
	return routes[route];
};
/** JSON integrity is not permission. The server resolves all session and command authority freshly. */
async function receiveTaskCommandRequest(route, jsonText) {
	const selected = routeInfo(route), value = parseText(jsonText, taskCommandLimits.requestBytes);
	check(selected.request, value);
	if (route === "execute") await proposal(value.proposal);
	return value;
}
/** Read Response.text(), never Response.json(). Independent binding comes from trusted app context. */
async function receiveTaskCommandResponse(route, httpStatus, jsonText, expected) {
	const selected = routeInfo(route);
	if (!Number.isInteger(httpStatus)) fail$1("TASK_COMMAND_STATUS");
	const expectation = snapshotExpected(expected);
	check("TaskCommandExpectedBinding", expectation?.binding);
	const keys = Object.keys(expectation);
	if (keys.length !== 2 || !keys.includes(route === "prepare" ? "request" : "proposal")) fail$1("TASK_COMMAND_EXPECTATION");
	if (route === "prepare") check("TaskCommandPrepareRequest", expectation.request);
	else await proposal(expectation.proposal);
	const value = parseText(jsonText, taskCommandLimits.responseBytes);
	if (httpStatus !== 200) {
		if (!validators.TaskCommandErrorResponse(value) || errorStatuses[value.error.code] !== httpStatus) fail$1("TASK_COMMAND_STATUS");
		return value;
	}
	check(selected.response, value);
	if (route === "prepare") await correlatePrepare(value, expectation);
	else await correlateExecute(value, expectation);
	return value;
}
export { TaskCommandResponseError, receiveTaskCommandRequest, receiveTaskCommandResponse, taskCommandMetadata, taskCommandPaths, taskCommandVersion };
