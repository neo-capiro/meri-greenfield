// Generated browser recorded usage boundary.
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "node_modules/ajv-formats/dist/formats.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
    function fmtDef(validate, compare) {
      return { validate, compare };
    }
    exports.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(true), compareTime),
      "date-time": fmtDef(getDateTime(true), compareDateTime),
      "iso-time": fmtDef(getTime(), compareIsoTime),
      "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
      // duration: https://tools.ietf.org/html/rfc3339#appendix-A
      duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
      uri,
      "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // uri-template: https://tools.ietf.org/html/rfc6570
      "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // For the source: https://gist.github.com/dperini/729294
      // For test cases: https://mathiasbynens.be/demo/url-regex
      url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
      email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
      hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
      regex,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
      "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
      // the following formats are used by the openapi specification: https://spec.openapis.org/oas/v3.0.0#data-types
      // byte: https://github.com/miguelmota/is-base64
      byte,
      // signed 32 bit integer
      int32: { type: "number", validate: validateInt32 },
      // signed 64 bit integer
      int64: { type: "number", validate: validateInt64 },
      // C-type float
      float: { type: "number", validate: validateNumber },
      // C-type double
      double: { type: "number", validate: validateNumber },
      // hint to the UI to hide input strings
      password: true,
      // unchecked string payload
      binary: true
    };
    exports.fastFormats = {
      ...exports.fullFormats,
      date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
      time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
      "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
      "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
      "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
      // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
      uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
      "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
      // email (sources from jsen validator):
      // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'wilful violation')
      email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
    };
    exports.formatNames = Object.keys(exports.fullFormats);
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      const matches = DATE.exec(str);
      if (!matches)
        return false;
      const year = +matches[1];
      const month = +matches[2];
      const day = +matches[3];
      return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function compareDate(d1, d2) {
      if (!(d1 && d2))
        return void 0;
      if (d1 > d2)
        return 1;
      if (d1 < d2)
        return -1;
      return 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function time(str) {
        const matches = TIME.exec(str);
        if (!matches)
          return false;
        const hr = +matches[1];
        const min = +matches[2];
        const sec = +matches[3];
        const tz = matches[4];
        const tzSign = matches[5] === "-" ? -1 : 1;
        const tzH = +(matches[6] || 0);
        const tzM = +(matches[7] || 0);
        if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
          return false;
        if (hr <= 23 && min <= 59 && sec < 60)
          return true;
        const utcMin = min - tzM * tzSign;
        const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2))
        return void 0;
      const t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf();
      const t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
      if (!(t1 && t2))
        return void 0;
      return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2))
        return void 0;
      const a1 = TIME.exec(t1);
      const a2 = TIME.exec(t2);
      if (!(a1 && a2))
        return void 0;
      t1 = a1[1] + a1[2] + a1[3];
      t2 = a2[1] + a2[2] + a2[3];
      if (t1 > t2)
        return 1;
      if (t1 < t2)
        return -1;
      return 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      const time = getTime(strictTimeZone);
      return function date_time(str) {
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const d1 = new Date(dt1).valueOf();
      const d2 = new Date(dt2).valueOf();
      if (!(d1 && d2))
        return void 0;
      return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
      const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
      const res = compareDate(d1, d2);
      if (res === void 0)
        return void 0;
      return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      BYTE.lastIndex = 0;
      return BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31);
    var MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return true;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str))
        return false;
      try {
        new RegExp(str);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length2 = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length2++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length2;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// artifacts-0.2/artifact-formats.mjs
var ARTIFACT_MIME_TYPES = Object.freeze({ docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", zip: "application/zip" });

// document-application/boundary.mjs
var errors = /* @__PURE__ */ new WeakSet();
var DocumentResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "DocumentResponseError";
    this.code = code;
    errors.add(this);
  }
};
var isFailure = (error) => errors.has(error);
var fail = (code) => {
  throw new DocumentResponseError(code);
};
var typed = Object.getPrototypeOf(Uint8Array.prototype);
var get = (name) => Object.getOwnPropertyDescriptor(typed, name).get;
var tag = Object.getOwnPropertyDescriptor(typed, Symbol.toStringTag).get;
var length = get("byteLength");
var offset = get("byteOffset");
var buffer = get("buffer");
var ordinaryBuffer = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
function copyBytes(value, cap) {
  try {
    if (tag.call(value) !== "Uint8Array") fail("INVALID_BYTES");
    const n = length.call(value), b = buffer.call(value), o = offset.call(value);
    ordinaryBuffer.call(b);
    if (n > cap) fail("BYTE_LIMIT");
    const copy = new Uint8Array(n);
    Uint8Array.prototype.set.call(copy, new Uint8Array(b, o, n));
    return copy;
  } catch (error) {
    if (isFailure(error)) throw error;
    fail("INVALID_BYTES");
  }
}
function parseBytes(value, cap) {
  const bytes = copyBytes(value, cap);
  let text, data;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    data = JSON.parse(text);
  } catch {
    fail("INVALID_JSON_UTF8");
  }
  const stack = [[data, 0]], objects = [];
  let nodes = 0;
  while (stack.length) {
    const [v, depth] = stack.pop();
    if (++nodes > 1e5 || depth > 64) fail("JSON_LIMIT");
    if (typeof v === "number" && !Number.isFinite(v)) fail("INVALID_NUMBER");
    if (typeof v === "string" && !v.isWellFormed()) fail("INVALID_UNICODE");
    if (v && typeof v === "object") {
      objects.push(v);
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(k)) fail("DANGEROUS_KEY");
        stack.push([x, depth + 1]);
      }
    }
  }
  for (const v of objects) Object.freeze(v);
  return data;
}

// overview-generated:./generated-overview-validator.mjs
var validateOverviewRequest = validate23;
function validate23(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion")) {
        validate23.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion")) {
            validate23.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            if ("meri.usage-overview/1" !== data.schemaVersion) {
              validate23.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.usage-overview/1" }, message: "must be equal to constant" }];
              return false;
            }
          }
        }
      }
    } else {
      validate23.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate23.errors = vErrors;
  return errors2 === 0;
}
validate23.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateOverviewResponse = validate24;
var schema35 = { "type": "object", "properties": { "schemaVersion": { "const": "meri.usage-overview/1" }, "observedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "const": "UTC" }, "policy": { "oneOf": [{ "type": "object", "properties": { "status": { "const": "configured" }, "revision": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "monthlyCapMicroUsd": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "maxTurns": { "type": "integer", "minimum": 1, "maximum": 100 }, "maxBudgetMicroUsd": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } }, "required": ["status", "revision", "monthlyCapMicroUsd", "maxTurns", "maxBudgetMicroUsd"], "additionalProperties": false }, { "type": "object", "properties": { "status": { "const": "unavailable" }, "revision": { "type": "null" }, "monthlyCapMicroUsd": { "type": "null" }, "maxTurns": { "type": "null" }, "maxBudgetMicroUsd": { "type": "null" } }, "required": ["status", "revision", "monthlyCapMicroUsd", "maxTurns", "maxBudgetMicroUsd"], "additionalProperties": false }] }, "periods": { "type": "array", "items": { "type": "object", "properties": { "kind": { "enum": ["day", "week", "month"] }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "states": { "type": "object", "properties": { "queued": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "starting": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "running": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "waiting-for-approval": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "paused": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "failed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cancelled": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"], "additionalProperties": false }, "recording": { "type": "object", "properties": { "recorded": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "unavailable": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "notRecorded": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["recorded", "unavailable", "notRecorded"], "additionalProperties": false }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completedAttemptsWithRecordedUsage": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completedAttemptKnownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["kind", "startInclusive", "endExclusive", "attempts", "states", "recording", "knownChargeMicroUsd", "completedAttemptsWithRecordedUsage", "completedAttemptKnownChargeMicroUsd"], "additionalProperties": false }, "minItems": 3, "maxItems": 3 }, "monthlyAdmission": { "type": "object", "properties": { "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "unavailableRecordedAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "remainingKnownMicroUsd": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, { "type": "null" }] }, "reached": { "anyOf": [{ "type": "boolean" }, { "type": "null" }] } }, "required": ["startInclusive", "knownChargeMicroUsd", "unavailableRecordedAttempts", "remainingKnownMicroUsd", "reached"], "additionalProperties": false }, "queue": { "type": "object", "properties": { "basis": { "const": "recorded-run-state" }, "states": { "type": "object", "properties": { "queued": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "starting": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "running": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "waiting-for-approval": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "paused": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "failed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cancelled": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"], "additionalProperties": false }, "physicalConcurrency": { "type": "null" }, "availableCapacity": { "type": "null" }, "capacityStatus": { "const": "unavailable" } }, "required": ["basis", "states", "physicalConcurrency", "availableCapacity", "capacityStatus"], "additionalProperties": false }, "coverage": { "type": "object", "properties": { "attemptPeriodBasis": { "const": "run-created-at" }, "admissionPeriodBasis": { "const": "sdk-usage-recorded-at" }, "chargeBasis": { "const": "recorded-sdk-estimate" }, "providerBilledMicroUsd": { "type": "null" }, "completeJobCost": { "const": "unavailable" } }, "required": ["attemptPeriodBasis", "admissionPeriodBasis", "chargeBasis", "providerBilledMicroUsd", "completeJobCost"], "additionalProperties": false } }, "required": ["schemaVersion", "observedAt", "timezone", "policy", "periods", "monthlyAdmission", "queue", "coverage"], "additionalProperties": false };
var formats0 = require_formats().fullFormats["date-time"];
var pattern4 = new RegExp("Z$", "u");
var func1 = Object.prototype.hasOwnProperty;
function validate24(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.observedAt === void 0 && (missing0 = "observedAt") || data.timezone === void 0 && (missing0 = "timezone") || data.policy === void 0 && (missing0 = "policy") || data.periods === void 0 && (missing0 = "periods") || data.monthlyAdmission === void 0 && (missing0 = "monthlyAdmission") || data.queue === void 0 && (missing0 = "queue") || data.coverage === void 0 && (missing0 = "coverage")) {
        validate24.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "observedAt" || key0 === "timezone" || key0 === "policy" || key0 === "periods" || key0 === "monthlyAdmission" || key0 === "queue" || key0 === "coverage")) {
            validate24.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.usage-overview/1" !== data.schemaVersion) {
              validate24.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.usage-overview/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.observedAt !== void 0) {
              let data1 = data.observedAt;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!pattern4.test(data1)) {
                      validate24.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                      return false;
                    } else {
                      if (!formats0.validate(data1)) {
                        validate24.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                        return false;
                      }
                    }
                  } else {
                    validate24.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.timezone !== void 0) {
                const _errs5 = errors2;
                if ("UTC" !== data.timezone) {
                  validate24.errors = [{ instancePath: instancePath + "/timezone", schemaPath: "#/properties/timezone/const", keyword: "const", params: { allowedValue: "UTC" }, message: "must be equal to constant" }];
                  return false;
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.policy !== void 0) {
                  let data3 = data.policy;
                  const _errs6 = errors2;
                  const _errs7 = errors2;
                  let valid1 = false;
                  let passing0 = null;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      let missing1;
                      if (data3.status === void 0 && (missing1 = "status") || data3.revision === void 0 && (missing1 = "revision") || data3.monthlyCapMicroUsd === void 0 && (missing1 = "monthlyCapMicroUsd") || data3.maxTurns === void 0 && (missing1 = "maxTurns") || data3.maxBudgetMicroUsd === void 0 && (missing1 = "maxBudgetMicroUsd")) {
                        const err0 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                        if (vErrors === null) {
                          vErrors = [err0];
                        } else {
                          vErrors.push(err0);
                        }
                        errors2++;
                      } else {
                        const _errs10 = errors2;
                        for (const key1 in data3) {
                          if (!(key1 === "status" || key1 === "revision" || key1 === "monthlyCapMicroUsd" || key1 === "maxTurns" || key1 === "maxBudgetMicroUsd")) {
                            const err1 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err1];
                            } else {
                              vErrors.push(err1);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs10 === errors2) {
                          if (data3.status !== void 0) {
                            const _errs11 = errors2;
                            if ("configured" !== data3.status) {
                              const err2 = { instancePath: instancePath + "/policy/status", schemaPath: "#/properties/policy/oneOf/0/properties/status/const", keyword: "const", params: { allowedValue: "configured" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors2++;
                            }
                            var valid2 = _errs11 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data3.revision !== void 0) {
                              let data5 = data3.revision;
                              const _errs12 = errors2;
                              if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
                                const err3 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err3];
                                } else {
                                  vErrors.push(err3);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs12) {
                                if (typeof data5 == "number" && isFinite(data5)) {
                                  if (data5 > 9007199254740991 || isNaN(data5)) {
                                    const err4 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                    if (vErrors === null) {
                                      vErrors = [err4];
                                    } else {
                                      vErrors.push(err4);
                                    }
                                    errors2++;
                                  } else {
                                    if (data5 < 1 || isNaN(data5)) {
                                      const err5 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                      if (vErrors === null) {
                                        vErrors = [err5];
                                      } else {
                                        vErrors.push(err5);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                              var valid2 = _errs12 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data3.monthlyCapMicroUsd !== void 0) {
                                let data6 = data3.monthlyCapMicroUsd;
                                const _errs14 = errors2;
                                if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6))) {
                                  const err6 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err6];
                                  } else {
                                    vErrors.push(err6);
                                  }
                                  errors2++;
                                }
                                if (errors2 === _errs14) {
                                  if (typeof data6 == "number" && isFinite(data6)) {
                                    if (data6 > 9007199254740991 || isNaN(data6)) {
                                      const err7 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                      if (vErrors === null) {
                                        vErrors = [err7];
                                      } else {
                                        vErrors.push(err7);
                                      }
                                      errors2++;
                                    } else {
                                      if (data6 < 1 || isNaN(data6)) {
                                        const err8 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                        if (vErrors === null) {
                                          vErrors = [err8];
                                        } else {
                                          vErrors.push(err8);
                                        }
                                        errors2++;
                                      }
                                    }
                                  }
                                }
                                var valid2 = _errs14 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data3.maxTurns !== void 0) {
                                  let data7 = data3.maxTurns;
                                  const _errs16 = errors2;
                                  if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                    const err9 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err9];
                                    } else {
                                      vErrors.push(err9);
                                    }
                                    errors2++;
                                  }
                                  if (errors2 === _errs16) {
                                    if (typeof data7 == "number" && isFinite(data7)) {
                                      if (data7 > 100 || isNaN(data7)) {
                                        const err10 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 100 }, message: "must be <= 100" };
                                        if (vErrors === null) {
                                          vErrors = [err10];
                                        } else {
                                          vErrors.push(err10);
                                        }
                                        errors2++;
                                      } else {
                                        if (data7 < 1 || isNaN(data7)) {
                                          const err11 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                          if (vErrors === null) {
                                            vErrors = [err11];
                                          } else {
                                            vErrors.push(err11);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                  var valid2 = _errs16 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data3.maxBudgetMicroUsd !== void 0) {
                                    let data8 = data3.maxBudgetMicroUsd;
                                    const _errs18 = errors2;
                                    if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                                      const err12 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err12];
                                      } else {
                                        vErrors.push(err12);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs18) {
                                      if (typeof data8 == "number" && isFinite(data8)) {
                                        if (data8 > 9007199254740991 || isNaN(data8)) {
                                          const err13 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                          if (vErrors === null) {
                                            vErrors = [err13];
                                          } else {
                                            vErrors.push(err13);
                                          }
                                          errors2++;
                                        } else {
                                          if (data8 < 1 || isNaN(data8)) {
                                            const err14 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                            if (vErrors === null) {
                                              vErrors = [err14];
                                            } else {
                                              vErrors.push(err14);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                    }
                                    var valid2 = _errs18 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err15 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err15];
                      } else {
                        vErrors.push(err15);
                      }
                      errors2++;
                    }
                  }
                  var _valid0 = _errs8 === errors2;
                  if (_valid0) {
                    valid1 = true;
                    passing0 = 0;
                    var props0 = true;
                  }
                  const _errs20 = errors2;
                  if (errors2 === _errs20) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      let missing2;
                      if (data3.status === void 0 && (missing2 = "status") || data3.revision === void 0 && (missing2 = "revision") || data3.monthlyCapMicroUsd === void 0 && (missing2 = "monthlyCapMicroUsd") || data3.maxTurns === void 0 && (missing2 = "maxTurns") || data3.maxBudgetMicroUsd === void 0 && (missing2 = "maxBudgetMicroUsd")) {
                        const err16 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                        if (vErrors === null) {
                          vErrors = [err16];
                        } else {
                          vErrors.push(err16);
                        }
                        errors2++;
                      } else {
                        const _errs22 = errors2;
                        for (const key2 in data3) {
                          if (!(key2 === "status" || key2 === "revision" || key2 === "monthlyCapMicroUsd" || key2 === "maxTurns" || key2 === "maxBudgetMicroUsd")) {
                            const err17 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err17];
                            } else {
                              vErrors.push(err17);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs22 === errors2) {
                          if (data3.status !== void 0) {
                            const _errs23 = errors2;
                            if ("unavailable" !== data3.status) {
                              const err18 = { instancePath: instancePath + "/policy/status", schemaPath: "#/properties/policy/oneOf/1/properties/status/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err18];
                              } else {
                                vErrors.push(err18);
                              }
                              errors2++;
                            }
                            var valid3 = _errs23 === errors2;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data3.revision !== void 0) {
                              const _errs24 = errors2;
                              if (data3.revision !== null) {
                                const err19 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/1/properties/revision/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                if (vErrors === null) {
                                  vErrors = [err19];
                                } else {
                                  vErrors.push(err19);
                                }
                                errors2++;
                              }
                              var valid3 = _errs24 === errors2;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data3.monthlyCapMicroUsd !== void 0) {
                                const _errs26 = errors2;
                                if (data3.monthlyCapMicroUsd !== null) {
                                  const err20 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/1/properties/monthlyCapMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                  if (vErrors === null) {
                                    vErrors = [err20];
                                  } else {
                                    vErrors.push(err20);
                                  }
                                  errors2++;
                                }
                                var valid3 = _errs26 === errors2;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data3.maxTurns !== void 0) {
                                  const _errs28 = errors2;
                                  if (data3.maxTurns !== null) {
                                    const err21 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/1/properties/maxTurns/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err21];
                                    } else {
                                      vErrors.push(err21);
                                    }
                                    errors2++;
                                  }
                                  var valid3 = _errs28 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data3.maxBudgetMicroUsd !== void 0) {
                                    const _errs30 = errors2;
                                    if (data3.maxBudgetMicroUsd !== null) {
                                      const err22 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/1/properties/maxBudgetMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err22];
                                      } else {
                                        vErrors.push(err22);
                                      }
                                      errors2++;
                                    }
                                    var valid3 = _errs30 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err23 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err23];
                      } else {
                        vErrors.push(err23);
                      }
                      errors2++;
                    }
                  }
                  var _valid0 = _errs20 === errors2;
                  if (_valid0 && valid1) {
                    valid1 = false;
                    passing0 = [passing0, 1];
                  } else {
                    if (_valid0) {
                      valid1 = true;
                      passing0 = 1;
                      if (props0 !== true) {
                        props0 = true;
                      }
                    }
                  }
                  if (!valid1) {
                    const err24 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                    if (vErrors === null) {
                      vErrors = [err24];
                    } else {
                      vErrors.push(err24);
                    }
                    errors2++;
                    validate24.errors = vErrors;
                    return false;
                  } else {
                    errors2 = _errs7;
                    if (vErrors !== null) {
                      if (_errs7) {
                        vErrors.length = _errs7;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs6 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.periods !== void 0) {
                    let data14 = data.periods;
                    const _errs32 = errors2;
                    if (errors2 === _errs32) {
                      if (Array.isArray(data14)) {
                        if (data14.length > 3) {
                          validate24.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/maxItems", keyword: "maxItems", params: { limit: 3 }, message: "must NOT have more than 3 items" }];
                          return false;
                        } else {
                          if (data14.length < 3) {
                            validate24.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/minItems", keyword: "minItems", params: { limit: 3 }, message: "must NOT have fewer than 3 items" }];
                            return false;
                          } else {
                            var valid4 = true;
                            const len0 = data14.length;
                            for (let i0 = 0; i0 < len0; i0++) {
                              let data15 = data14[i0];
                              const _errs34 = errors2;
                              if (errors2 === _errs34) {
                                if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
                                  let missing3;
                                  if (data15.kind === void 0 && (missing3 = "kind") || data15.startInclusive === void 0 && (missing3 = "startInclusive") || data15.endExclusive === void 0 && (missing3 = "endExclusive") || data15.attempts === void 0 && (missing3 = "attempts") || data15.states === void 0 && (missing3 = "states") || data15.recording === void 0 && (missing3 = "recording") || data15.knownChargeMicroUsd === void 0 && (missing3 = "knownChargeMicroUsd") || data15.completedAttemptsWithRecordedUsage === void 0 && (missing3 = "completedAttemptsWithRecordedUsage") || data15.completedAttemptKnownChargeMicroUsd === void 0 && (missing3 = "completedAttemptKnownChargeMicroUsd")) {
                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                    return false;
                                  } else {
                                    const _errs36 = errors2;
                                    for (const key3 in data15) {
                                      if (!func1.call(schema35.properties.periods.items.properties, key3)) {
                                        validate24.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs36 === errors2) {
                                      if (data15.kind !== void 0) {
                                        let data16 = data15.kind;
                                        const _errs37 = errors2;
                                        if (!(data16 === "day" || data16 === "week" || data16 === "month")) {
                                          validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/kind", schemaPath: "#/properties/periods/items/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.periods.items.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                          return false;
                                        }
                                        var valid5 = _errs37 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data15.startInclusive !== void 0) {
                                          let data17 = data15.startInclusive;
                                          const _errs38 = errors2;
                                          if (errors2 === _errs38) {
                                            if (errors2 === _errs38) {
                                              if (typeof data17 === "string") {
                                                if (!pattern4.test(data17)) {
                                                  validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                                  return false;
                                                } else {
                                                  if (!formats0.validate(data17)) {
                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                          }
                                          var valid5 = _errs38 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data15.endExclusive !== void 0) {
                                            let data18 = data15.endExclusive;
                                            const _errs40 = errors2;
                                            if (errors2 === _errs40) {
                                              if (errors2 === _errs40) {
                                                if (typeof data18 === "string") {
                                                  if (!pattern4.test(data18)) {
                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                                    return false;
                                                  } else {
                                                    if (!formats0.validate(data18)) {
                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                            }
                                            var valid5 = _errs40 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data15.attempts !== void 0) {
                                              let data19 = data15.attempts;
                                              const _errs42 = errors2;
                                              if (!(typeof data19 == "number" && (!(data19 % 1) && !isNaN(data19)) && isFinite(data19))) {
                                                validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                return false;
                                              }
                                              if (errors2 === _errs42) {
                                                if (typeof data19 == "number" && isFinite(data19)) {
                                                  if (data19 > 9007199254740991 || isNaN(data19)) {
                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                    return false;
                                                  } else {
                                                    if (data19 < 0 || isNaN(data19)) {
                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid5 = _errs42 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data15.states !== void 0) {
                                                let data20 = data15.states;
                                                const _errs44 = errors2;
                                                if (errors2 === _errs44) {
                                                  if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                                                    let missing4;
                                                    if (data20.queued === void 0 && (missing4 = "queued") || data20.starting === void 0 && (missing4 = "starting") || data20.running === void 0 && (missing4 = "running") || data20["waiting-for-approval"] === void 0 && (missing4 = "waiting-for-approval") || data20.paused === void 0 && (missing4 = "paused") || data20.completed === void 0 && (missing4 = "completed") || data20.failed === void 0 && (missing4 = "failed") || data20.cancelled === void 0 && (missing4 = "cancelled")) {
                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                                      return false;
                                                    } else {
                                                      const _errs46 = errors2;
                                                      for (const key4 in data20) {
                                                        if (!(key4 === "queued" || key4 === "starting" || key4 === "running" || key4 === "waiting-for-approval" || key4 === "paused" || key4 === "completed" || key4 === "failed" || key4 === "cancelled")) {
                                                          validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                                          return false;
                                                          break;
                                                        }
                                                      }
                                                      if (_errs46 === errors2) {
                                                        if (data20.queued !== void 0) {
                                                          let data21 = data20.queued;
                                                          const _errs47 = errors2;
                                                          if (!(typeof data21 == "number" && (!(data21 % 1) && !isNaN(data21)) && isFinite(data21))) {
                                                            validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                            return false;
                                                          }
                                                          if (errors2 === _errs47) {
                                                            if (typeof data21 == "number" && isFinite(data21)) {
                                                              if (data21 > 9007199254740991 || isNaN(data21)) {
                                                                validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                return false;
                                                              } else {
                                                                if (data21 < 0 || isNaN(data21)) {
                                                                  validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          }
                                                          var valid6 = _errs47 === errors2;
                                                        } else {
                                                          var valid6 = true;
                                                        }
                                                        if (valid6) {
                                                          if (data20.starting !== void 0) {
                                                            let data22 = data20.starting;
                                                            const _errs49 = errors2;
                                                            if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
                                                              validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors2 === _errs49) {
                                                              if (typeof data22 == "number" && isFinite(data22)) {
                                                                if (data22 > 9007199254740991 || isNaN(data22)) {
                                                                  validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data22 < 0 || isNaN(data22)) {
                                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid6 = _errs49 === errors2;
                                                          } else {
                                                            var valid6 = true;
                                                          }
                                                          if (valid6) {
                                                            if (data20.running !== void 0) {
                                                              let data23 = data20.running;
                                                              const _errs51 = errors2;
                                                              if (!(typeof data23 == "number" && (!(data23 % 1) && !isNaN(data23)) && isFinite(data23))) {
                                                                validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                return false;
                                                              }
                                                              if (errors2 === _errs51) {
                                                                if (typeof data23 == "number" && isFinite(data23)) {
                                                                  if (data23 > 9007199254740991 || isNaN(data23)) {
                                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                    return false;
                                                                  } else {
                                                                    if (data23 < 0 || isNaN(data23)) {
                                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              var valid6 = _errs51 === errors2;
                                                            } else {
                                                              var valid6 = true;
                                                            }
                                                            if (valid6) {
                                                              if (data20["waiting-for-approval"] !== void 0) {
                                                                let data24 = data20["waiting-for-approval"];
                                                                const _errs53 = errors2;
                                                                if (!(typeof data24 == "number" && (!(data24 % 1) && !isNaN(data24)) && isFinite(data24))) {
                                                                  validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs53) {
                                                                  if (typeof data24 == "number" && isFinite(data24)) {
                                                                    if (data24 > 9007199254740991 || isNaN(data24)) {
                                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data24 < 0 || isNaN(data24)) {
                                                                        validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid6 = _errs53 === errors2;
                                                              } else {
                                                                var valid6 = true;
                                                              }
                                                              if (valid6) {
                                                                if (data20.paused !== void 0) {
                                                                  let data25 = data20.paused;
                                                                  const _errs55 = errors2;
                                                                  if (!(typeof data25 == "number" && (!(data25 % 1) && !isNaN(data25)) && isFinite(data25))) {
                                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors2 === _errs55) {
                                                                    if (typeof data25 == "number" && isFinite(data25)) {
                                                                      if (data25 > 9007199254740991 || isNaN(data25)) {
                                                                        validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                        return false;
                                                                      } else {
                                                                        if (data25 < 0 || isNaN(data25)) {
                                                                          validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid6 = _errs55 === errors2;
                                                                } else {
                                                                  var valid6 = true;
                                                                }
                                                                if (valid6) {
                                                                  if (data20.completed !== void 0) {
                                                                    let data26 = data20.completed;
                                                                    const _errs57 = errors2;
                                                                    if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs57) {
                                                                      if (typeof data26 == "number" && isFinite(data26)) {
                                                                        if (data26 > 9007199254740991 || isNaN(data26)) {
                                                                          validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data26 < 0 || isNaN(data26)) {
                                                                            validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid6 = _errs57 === errors2;
                                                                  } else {
                                                                    var valid6 = true;
                                                                  }
                                                                  if (valid6) {
                                                                    if (data20.failed !== void 0) {
                                                                      let data27 = data20.failed;
                                                                      const _errs59 = errors2;
                                                                      if (!(typeof data27 == "number" && (!(data27 % 1) && !isNaN(data27)) && isFinite(data27))) {
                                                                        validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                        return false;
                                                                      }
                                                                      if (errors2 === _errs59) {
                                                                        if (typeof data27 == "number" && isFinite(data27)) {
                                                                          if (data27 > 9007199254740991 || isNaN(data27)) {
                                                                            validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                            return false;
                                                                          } else {
                                                                            if (data27 < 0 || isNaN(data27)) {
                                                                              validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                      var valid6 = _errs59 === errors2;
                                                                    } else {
                                                                      var valid6 = true;
                                                                    }
                                                                    if (valid6) {
                                                                      if (data20.cancelled !== void 0) {
                                                                        let data28 = data20.cancelled;
                                                                        const _errs61 = errors2;
                                                                        if (!(typeof data28 == "number" && (!(data28 % 1) && !isNaN(data28)) && isFinite(data28))) {
                                                                          validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                          return false;
                                                                        }
                                                                        if (errors2 === _errs61) {
                                                                          if (typeof data28 == "number" && isFinite(data28)) {
                                                                            if (data28 > 9007199254740991 || isNaN(data28)) {
                                                                              validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                              return false;
                                                                            } else {
                                                                              if (data28 < 0 || isNaN(data28)) {
                                                                                validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                        var valid6 = _errs61 === errors2;
                                                                      } else {
                                                                        var valid6 = true;
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
                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                    return false;
                                                  }
                                                }
                                                var valid5 = _errs44 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data15.recording !== void 0) {
                                                  let data29 = data15.recording;
                                                  const _errs63 = errors2;
                                                  if (errors2 === _errs63) {
                                                    if (data29 && typeof data29 == "object" && !Array.isArray(data29)) {
                                                      let missing5;
                                                      if (data29.recorded === void 0 && (missing5 = "recorded") || data29.unavailable === void 0 && (missing5 = "unavailable") || data29.notRecorded === void 0 && (missing5 = "notRecorded")) {
                                                        validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                                                        return false;
                                                      } else {
                                                        const _errs65 = errors2;
                                                        for (const key5 in data29) {
                                                          if (!(key5 === "recorded" || key5 === "unavailable" || key5 === "notRecorded")) {
                                                            validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                                                            return false;
                                                            break;
                                                          }
                                                        }
                                                        if (_errs65 === errors2) {
                                                          if (data29.recorded !== void 0) {
                                                            let data30 = data29.recorded;
                                                            const _errs66 = errors2;
                                                            if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                                                              validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors2 === _errs66) {
                                                              if (typeof data30 == "number" && isFinite(data30)) {
                                                                if (data30 > 9007199254740991 || isNaN(data30)) {
                                                                  validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data30 < 0 || isNaN(data30)) {
                                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid7 = _errs66 === errors2;
                                                          } else {
                                                            var valid7 = true;
                                                          }
                                                          if (valid7) {
                                                            if (data29.unavailable !== void 0) {
                                                              let data31 = data29.unavailable;
                                                              const _errs68 = errors2;
                                                              if (!(typeof data31 == "number" && (!(data31 % 1) && !isNaN(data31)) && isFinite(data31))) {
                                                                validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                return false;
                                                              }
                                                              if (errors2 === _errs68) {
                                                                if (typeof data31 == "number" && isFinite(data31)) {
                                                                  if (data31 > 9007199254740991 || isNaN(data31)) {
                                                                    validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                    return false;
                                                                  } else {
                                                                    if (data31 < 0 || isNaN(data31)) {
                                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              var valid7 = _errs68 === errors2;
                                                            } else {
                                                              var valid7 = true;
                                                            }
                                                            if (valid7) {
                                                              if (data29.notRecorded !== void 0) {
                                                                let data32 = data29.notRecorded;
                                                                const _errs70 = errors2;
                                                                if (!(typeof data32 == "number" && (!(data32 % 1) && !isNaN(data32)) && isFinite(data32))) {
                                                                  validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs70) {
                                                                  if (typeof data32 == "number" && isFinite(data32)) {
                                                                    if (data32 > 9007199254740991 || isNaN(data32)) {
                                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data32 < 0 || isNaN(data32)) {
                                                                        validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid7 = _errs70 === errors2;
                                                              } else {
                                                                var valid7 = true;
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    } else {
                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid5 = _errs63 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data15.knownChargeMicroUsd !== void 0) {
                                                    let data33 = data15.knownChargeMicroUsd;
                                                    const _errs72 = errors2;
                                                    if (!(typeof data33 == "number" && (!(data33 % 1) && !isNaN(data33)) && isFinite(data33))) {
                                                      validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                      return false;
                                                    }
                                                    if (errors2 === _errs72) {
                                                      if (typeof data33 == "number" && isFinite(data33)) {
                                                        if (data33 > 9007199254740991 || isNaN(data33)) {
                                                          validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                          return false;
                                                        } else {
                                                          if (data33 < 0 || isNaN(data33)) {
                                                            validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                            return false;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid5 = _errs72 === errors2;
                                                  } else {
                                                    var valid5 = true;
                                                  }
                                                  if (valid5) {
                                                    if (data15.completedAttemptsWithRecordedUsage !== void 0) {
                                                      let data34 = data15.completedAttemptsWithRecordedUsage;
                                                      const _errs74 = errors2;
                                                      if (!(typeof data34 == "number" && (!(data34 % 1) && !isNaN(data34)) && isFinite(data34))) {
                                                        validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptsWithRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttemptsWithRecordedUsage/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                        return false;
                                                      }
                                                      if (errors2 === _errs74) {
                                                        if (typeof data34 == "number" && isFinite(data34)) {
                                                          if (data34 > 9007199254740991 || isNaN(data34)) {
                                                            validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptsWithRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttemptsWithRecordedUsage/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                            return false;
                                                          } else {
                                                            if (data34 < 0 || isNaN(data34)) {
                                                              validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptsWithRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttemptsWithRecordedUsage/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid5 = _errs74 === errors2;
                                                    } else {
                                                      var valid5 = true;
                                                    }
                                                    if (valid5) {
                                                      if (data15.completedAttemptKnownChargeMicroUsd !== void 0) {
                                                        let data35 = data15.completedAttemptKnownChargeMicroUsd;
                                                        const _errs76 = errors2;
                                                        if (!(typeof data35 == "number" && (!(data35 % 1) && !isNaN(data35)) && isFinite(data35))) {
                                                          validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptKnownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttemptKnownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors2 === _errs76) {
                                                          if (typeof data35 == "number" && isFinite(data35)) {
                                                            if (data35 > 9007199254740991 || isNaN(data35)) {
                                                              validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptKnownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttemptKnownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                              return false;
                                                            } else {
                                                              if (data35 < 0 || isNaN(data35)) {
                                                                validate24.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptKnownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttemptKnownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        }
                                                        var valid5 = _errs76 === errors2;
                                                      } else {
                                                        var valid5 = true;
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
                                  validate24.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid4 = _errs34 === errors2;
                              if (!valid4) {
                                break;
                              }
                            }
                          }
                        }
                      } else {
                        validate24.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid0 = _errs32 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.monthlyAdmission !== void 0) {
                      let data36 = data.monthlyAdmission;
                      const _errs78 = errors2;
                      if (errors2 === _errs78) {
                        if (data36 && typeof data36 == "object" && !Array.isArray(data36)) {
                          let missing6;
                          if (data36.startInclusive === void 0 && (missing6 = "startInclusive") || data36.knownChargeMicroUsd === void 0 && (missing6 = "knownChargeMicroUsd") || data36.unavailableRecordedAttempts === void 0 && (missing6 = "unavailableRecordedAttempts") || data36.remainingKnownMicroUsd === void 0 && (missing6 = "remainingKnownMicroUsd") || data36.reached === void 0 && (missing6 = "reached")) {
                            validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                            return false;
                          } else {
                            const _errs80 = errors2;
                            for (const key6 in data36) {
                              if (!(key6 === "startInclusive" || key6 === "knownChargeMicroUsd" || key6 === "unavailableRecordedAttempts" || key6 === "remainingKnownMicroUsd" || key6 === "reached")) {
                                validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs80 === errors2) {
                              if (data36.startInclusive !== void 0) {
                                let data37 = data36.startInclusive;
                                const _errs81 = errors2;
                                if (errors2 === _errs81) {
                                  if (errors2 === _errs81) {
                                    if (typeof data37 === "string") {
                                      if (!pattern4.test(data37)) {
                                        validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                        return false;
                                      } else {
                                        if (!formats0.validate(data37)) {
                                          validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid8 = _errs81 === errors2;
                              } else {
                                var valid8 = true;
                              }
                              if (valid8) {
                                if (data36.knownChargeMicroUsd !== void 0) {
                                  let data38 = data36.knownChargeMicroUsd;
                                  const _errs83 = errors2;
                                  if (!(typeof data38 == "number" && (!(data38 % 1) && !isNaN(data38)) && isFinite(data38))) {
                                    validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                    return false;
                                  }
                                  if (errors2 === _errs83) {
                                    if (typeof data38 == "number" && isFinite(data38)) {
                                      if (data38 > 9007199254740991 || isNaN(data38)) {
                                        validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                        return false;
                                      } else {
                                        if (data38 < 0 || isNaN(data38)) {
                                          validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                          return false;
                                        }
                                      }
                                    }
                                  }
                                  var valid8 = _errs83 === errors2;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data36.unavailableRecordedAttempts !== void 0) {
                                    let data39 = data36.unavailableRecordedAttempts;
                                    const _errs85 = errors2;
                                    if (!(typeof data39 == "number" && (!(data39 % 1) && !isNaN(data39)) && isFinite(data39))) {
                                      validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors2 === _errs85) {
                                      if (typeof data39 == "number" && isFinite(data39)) {
                                        if (data39 > 9007199254740991 || isNaN(data39)) {
                                          validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data39 < 0 || isNaN(data39)) {
                                            validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid8 = _errs85 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data36.remainingKnownMicroUsd !== void 0) {
                                      let data40 = data36.remainingKnownMicroUsd;
                                      const _errs87 = errors2;
                                      const _errs88 = errors2;
                                      let valid9 = false;
                                      const _errs89 = errors2;
                                      if (!(typeof data40 == "number" && (!(data40 % 1) && !isNaN(data40)) && isFinite(data40))) {
                                        const err25 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                        if (vErrors === null) {
                                          vErrors = [err25];
                                        } else {
                                          vErrors.push(err25);
                                        }
                                        errors2++;
                                      }
                                      if (errors2 === _errs89) {
                                        if (typeof data40 == "number" && isFinite(data40)) {
                                          if (data40 > 9007199254740991 || isNaN(data40)) {
                                            const err26 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                            if (vErrors === null) {
                                              vErrors = [err26];
                                            } else {
                                              vErrors.push(err26);
                                            }
                                            errors2++;
                                          } else {
                                            if (data40 < 0 || isNaN(data40)) {
                                              const err27 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                              if (vErrors === null) {
                                                vErrors = [err27];
                                              } else {
                                                vErrors.push(err27);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                      }
                                      var _valid1 = _errs89 === errors2;
                                      valid9 = valid9 || _valid1;
                                      const _errs91 = errors2;
                                      if (data40 !== null) {
                                        const err28 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                        if (vErrors === null) {
                                          vErrors = [err28];
                                        } else {
                                          vErrors.push(err28);
                                        }
                                        errors2++;
                                      }
                                      var _valid1 = _errs91 === errors2;
                                      valid9 = valid9 || _valid1;
                                      if (!valid9) {
                                        const err29 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                        if (vErrors === null) {
                                          vErrors = [err29];
                                        } else {
                                          vErrors.push(err29);
                                        }
                                        errors2++;
                                        validate24.errors = vErrors;
                                        return false;
                                      } else {
                                        errors2 = _errs88;
                                        if (vErrors !== null) {
                                          if (_errs88) {
                                            vErrors.length = _errs88;
                                          } else {
                                            vErrors = null;
                                          }
                                        }
                                      }
                                      var valid8 = _errs87 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data36.reached !== void 0) {
                                        let data41 = data36.reached;
                                        const _errs93 = errors2;
                                        const _errs94 = errors2;
                                        let valid10 = false;
                                        const _errs95 = errors2;
                                        if (typeof data41 !== "boolean") {
                                          const err30 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf/0/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                          if (vErrors === null) {
                                            vErrors = [err30];
                                          } else {
                                            vErrors.push(err30);
                                          }
                                          errors2++;
                                        }
                                        var _valid2 = _errs95 === errors2;
                                        valid10 = valid10 || _valid2;
                                        const _errs97 = errors2;
                                        if (data41 !== null) {
                                          const err31 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                          if (vErrors === null) {
                                            vErrors = [err31];
                                          } else {
                                            vErrors.push(err31);
                                          }
                                          errors2++;
                                        }
                                        var _valid2 = _errs97 === errors2;
                                        valid10 = valid10 || _valid2;
                                        if (!valid10) {
                                          const err32 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                          if (vErrors === null) {
                                            vErrors = [err32];
                                          } else {
                                            vErrors.push(err32);
                                          }
                                          errors2++;
                                          validate24.errors = vErrors;
                                          return false;
                                        } else {
                                          errors2 = _errs94;
                                          if (vErrors !== null) {
                                            if (_errs94) {
                                              vErrors.length = _errs94;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid8 = _errs93 === errors2;
                                      } else {
                                        var valid8 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate24.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs78 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.queue !== void 0) {
                        let data42 = data.queue;
                        const _errs99 = errors2;
                        if (errors2 === _errs99) {
                          if (data42 && typeof data42 == "object" && !Array.isArray(data42)) {
                            let missing7;
                            if (data42.basis === void 0 && (missing7 = "basis") || data42.states === void 0 && (missing7 = "states") || data42.physicalConcurrency === void 0 && (missing7 = "physicalConcurrency") || data42.availableCapacity === void 0 && (missing7 = "availableCapacity") || data42.capacityStatus === void 0 && (missing7 = "capacityStatus")) {
                              validate24.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" }];
                              return false;
                            } else {
                              const _errs101 = errors2;
                              for (const key7 in data42) {
                                if (!(key7 === "basis" || key7 === "states" || key7 === "physicalConcurrency" || key7 === "availableCapacity" || key7 === "capacityStatus")) {
                                  validate24.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs101 === errors2) {
                                if (data42.basis !== void 0) {
                                  const _errs102 = errors2;
                                  if ("recorded-run-state" !== data42.basis) {
                                    validate24.errors = [{ instancePath: instancePath + "/queue/basis", schemaPath: "#/properties/queue/properties/basis/const", keyword: "const", params: { allowedValue: "recorded-run-state" }, message: "must be equal to constant" }];
                                    return false;
                                  }
                                  var valid11 = _errs102 === errors2;
                                } else {
                                  var valid11 = true;
                                }
                                if (valid11) {
                                  if (data42.states !== void 0) {
                                    let data44 = data42.states;
                                    const _errs103 = errors2;
                                    if (errors2 === _errs103) {
                                      if (data44 && typeof data44 == "object" && !Array.isArray(data44)) {
                                        let missing8;
                                        if (data44.queued === void 0 && (missing8 = "queued") || data44.starting === void 0 && (missing8 = "starting") || data44.running === void 0 && (missing8 = "running") || data44["waiting-for-approval"] === void 0 && (missing8 = "waiting-for-approval") || data44.paused === void 0 && (missing8 = "paused") || data44.completed === void 0 && (missing8 = "completed") || data44.failed === void 0 && (missing8 = "failed") || data44.cancelled === void 0 && (missing8 = "cancelled")) {
                                          validate24.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" }];
                                          return false;
                                        } else {
                                          const _errs105 = errors2;
                                          for (const key8 in data44) {
                                            if (!(key8 === "queued" || key8 === "starting" || key8 === "running" || key8 === "waiting-for-approval" || key8 === "paused" || key8 === "completed" || key8 === "failed" || key8 === "cancelled")) {
                                              validate24.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" }];
                                              return false;
                                              break;
                                            }
                                          }
                                          if (_errs105 === errors2) {
                                            if (data44.queued !== void 0) {
                                              let data45 = data44.queued;
                                              const _errs106 = errors2;
                                              if (!(typeof data45 == "number" && (!(data45 % 1) && !isNaN(data45)) && isFinite(data45))) {
                                                validate24.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                return false;
                                              }
                                              if (errors2 === _errs106) {
                                                if (typeof data45 == "number" && isFinite(data45)) {
                                                  if (data45 > 9007199254740991 || isNaN(data45)) {
                                                    validate24.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                    return false;
                                                  } else {
                                                    if (data45 < 0 || isNaN(data45)) {
                                                      validate24.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid12 = _errs106 === errors2;
                                            } else {
                                              var valid12 = true;
                                            }
                                            if (valid12) {
                                              if (data44.starting !== void 0) {
                                                let data46 = data44.starting;
                                                const _errs108 = errors2;
                                                if (!(typeof data46 == "number" && (!(data46 % 1) && !isNaN(data46)) && isFinite(data46))) {
                                                  validate24.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                  return false;
                                                }
                                                if (errors2 === _errs108) {
                                                  if (typeof data46 == "number" && isFinite(data46)) {
                                                    if (data46 > 9007199254740991 || isNaN(data46)) {
                                                      validate24.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                      return false;
                                                    } else {
                                                      if (data46 < 0 || isNaN(data46)) {
                                                        validate24.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                        return false;
                                                      }
                                                    }
                                                  }
                                                }
                                                var valid12 = _errs108 === errors2;
                                              } else {
                                                var valid12 = true;
                                              }
                                              if (valid12) {
                                                if (data44.running !== void 0) {
                                                  let data47 = data44.running;
                                                  const _errs110 = errors2;
                                                  if (!(typeof data47 == "number" && (!(data47 % 1) && !isNaN(data47)) && isFinite(data47))) {
                                                    validate24.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                    return false;
                                                  }
                                                  if (errors2 === _errs110) {
                                                    if (typeof data47 == "number" && isFinite(data47)) {
                                                      if (data47 > 9007199254740991 || isNaN(data47)) {
                                                        validate24.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                        return false;
                                                      } else {
                                                        if (data47 < 0 || isNaN(data47)) {
                                                          validate24.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                          return false;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid12 = _errs110 === errors2;
                                                } else {
                                                  var valid12 = true;
                                                }
                                                if (valid12) {
                                                  if (data44["waiting-for-approval"] !== void 0) {
                                                    let data48 = data44["waiting-for-approval"];
                                                    const _errs112 = errors2;
                                                    if (!(typeof data48 == "number" && (!(data48 % 1) && !isNaN(data48)) && isFinite(data48))) {
                                                      validate24.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                      return false;
                                                    }
                                                    if (errors2 === _errs112) {
                                                      if (typeof data48 == "number" && isFinite(data48)) {
                                                        if (data48 > 9007199254740991 || isNaN(data48)) {
                                                          validate24.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                          return false;
                                                        } else {
                                                          if (data48 < 0 || isNaN(data48)) {
                                                            validate24.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                            return false;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid12 = _errs112 === errors2;
                                                  } else {
                                                    var valid12 = true;
                                                  }
                                                  if (valid12) {
                                                    if (data44.paused !== void 0) {
                                                      let data49 = data44.paused;
                                                      const _errs114 = errors2;
                                                      if (!(typeof data49 == "number" && (!(data49 % 1) && !isNaN(data49)) && isFinite(data49))) {
                                                        validate24.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                        return false;
                                                      }
                                                      if (errors2 === _errs114) {
                                                        if (typeof data49 == "number" && isFinite(data49)) {
                                                          if (data49 > 9007199254740991 || isNaN(data49)) {
                                                            validate24.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                            return false;
                                                          } else {
                                                            if (data49 < 0 || isNaN(data49)) {
                                                              validate24.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid12 = _errs114 === errors2;
                                                    } else {
                                                      var valid12 = true;
                                                    }
                                                    if (valid12) {
                                                      if (data44.completed !== void 0) {
                                                        let data50 = data44.completed;
                                                        const _errs116 = errors2;
                                                        if (!(typeof data50 == "number" && (!(data50 % 1) && !isNaN(data50)) && isFinite(data50))) {
                                                          validate24.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors2 === _errs116) {
                                                          if (typeof data50 == "number" && isFinite(data50)) {
                                                            if (data50 > 9007199254740991 || isNaN(data50)) {
                                                              validate24.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                              return false;
                                                            } else {
                                                              if (data50 < 0 || isNaN(data50)) {
                                                                validate24.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        }
                                                        var valid12 = _errs116 === errors2;
                                                      } else {
                                                        var valid12 = true;
                                                      }
                                                      if (valid12) {
                                                        if (data44.failed !== void 0) {
                                                          let data51 = data44.failed;
                                                          const _errs118 = errors2;
                                                          if (!(typeof data51 == "number" && (!(data51 % 1) && !isNaN(data51)) && isFinite(data51))) {
                                                            validate24.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                            return false;
                                                          }
                                                          if (errors2 === _errs118) {
                                                            if (typeof data51 == "number" && isFinite(data51)) {
                                                              if (data51 > 9007199254740991 || isNaN(data51)) {
                                                                validate24.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                return false;
                                                              } else {
                                                                if (data51 < 0 || isNaN(data51)) {
                                                                  validate24.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          }
                                                          var valid12 = _errs118 === errors2;
                                                        } else {
                                                          var valid12 = true;
                                                        }
                                                        if (valid12) {
                                                          if (data44.cancelled !== void 0) {
                                                            let data52 = data44.cancelled;
                                                            const _errs120 = errors2;
                                                            if (!(typeof data52 == "number" && (!(data52 % 1) && !isNaN(data52)) && isFinite(data52))) {
                                                              validate24.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors2 === _errs120) {
                                                              if (typeof data52 == "number" && isFinite(data52)) {
                                                                if (data52 > 9007199254740991 || isNaN(data52)) {
                                                                  validate24.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data52 < 0 || isNaN(data52)) {
                                                                    validate24.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid12 = _errs120 === errors2;
                                                          } else {
                                                            var valid12 = true;
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
                                        validate24.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                      }
                                    }
                                    var valid11 = _errs103 === errors2;
                                  } else {
                                    var valid11 = true;
                                  }
                                  if (valid11) {
                                    if (data42.physicalConcurrency !== void 0) {
                                      const _errs122 = errors2;
                                      if (data42.physicalConcurrency !== null) {
                                        validate24.errors = [{ instancePath: instancePath + "/queue/physicalConcurrency", schemaPath: "#/properties/queue/properties/physicalConcurrency/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                        return false;
                                      }
                                      var valid11 = _errs122 === errors2;
                                    } else {
                                      var valid11 = true;
                                    }
                                    if (valid11) {
                                      if (data42.availableCapacity !== void 0) {
                                        const _errs124 = errors2;
                                        if (data42.availableCapacity !== null) {
                                          validate24.errors = [{ instancePath: instancePath + "/queue/availableCapacity", schemaPath: "#/properties/queue/properties/availableCapacity/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                          return false;
                                        }
                                        var valid11 = _errs124 === errors2;
                                      } else {
                                        var valid11 = true;
                                      }
                                      if (valid11) {
                                        if (data42.capacityStatus !== void 0) {
                                          const _errs126 = errors2;
                                          if ("unavailable" !== data42.capacityStatus) {
                                            validate24.errors = [{ instancePath: instancePath + "/queue/capacityStatus", schemaPath: "#/properties/queue/properties/capacityStatus/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" }];
                                            return false;
                                          }
                                          var valid11 = _errs126 === errors2;
                                        } else {
                                          var valid11 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate24.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid0 = _errs99 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.coverage !== void 0) {
                          let data56 = data.coverage;
                          const _errs127 = errors2;
                          if (errors2 === _errs127) {
                            if (data56 && typeof data56 == "object" && !Array.isArray(data56)) {
                              let missing9;
                              if (data56.attemptPeriodBasis === void 0 && (missing9 = "attemptPeriodBasis") || data56.admissionPeriodBasis === void 0 && (missing9 = "admissionPeriodBasis") || data56.chargeBasis === void 0 && (missing9 = "chargeBasis") || data56.providerBilledMicroUsd === void 0 && (missing9 = "providerBilledMicroUsd") || data56.completeJobCost === void 0 && (missing9 = "completeJobCost")) {
                                validate24.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" }];
                                return false;
                              } else {
                                const _errs129 = errors2;
                                for (const key9 in data56) {
                                  if (!(key9 === "attemptPeriodBasis" || key9 === "admissionPeriodBasis" || key9 === "chargeBasis" || key9 === "providerBilledMicroUsd" || key9 === "completeJobCost")) {
                                    validate24.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs129 === errors2) {
                                  if (data56.attemptPeriodBasis !== void 0) {
                                    const _errs130 = errors2;
                                    if ("run-created-at" !== data56.attemptPeriodBasis) {
                                      validate24.errors = [{ instancePath: instancePath + "/coverage/attemptPeriodBasis", schemaPath: "#/properties/coverage/properties/attemptPeriodBasis/const", keyword: "const", params: { allowedValue: "run-created-at" }, message: "must be equal to constant" }];
                                      return false;
                                    }
                                    var valid13 = _errs130 === errors2;
                                  } else {
                                    var valid13 = true;
                                  }
                                  if (valid13) {
                                    if (data56.admissionPeriodBasis !== void 0) {
                                      const _errs131 = errors2;
                                      if ("sdk-usage-recorded-at" !== data56.admissionPeriodBasis) {
                                        validate24.errors = [{ instancePath: instancePath + "/coverage/admissionPeriodBasis", schemaPath: "#/properties/coverage/properties/admissionPeriodBasis/const", keyword: "const", params: { allowedValue: "sdk-usage-recorded-at" }, message: "must be equal to constant" }];
                                        return false;
                                      }
                                      var valid13 = _errs131 === errors2;
                                    } else {
                                      var valid13 = true;
                                    }
                                    if (valid13) {
                                      if (data56.chargeBasis !== void 0) {
                                        const _errs132 = errors2;
                                        if ("recorded-sdk-estimate" !== data56.chargeBasis) {
                                          validate24.errors = [{ instancePath: instancePath + "/coverage/chargeBasis", schemaPath: "#/properties/coverage/properties/chargeBasis/const", keyword: "const", params: { allowedValue: "recorded-sdk-estimate" }, message: "must be equal to constant" }];
                                          return false;
                                        }
                                        var valid13 = _errs132 === errors2;
                                      } else {
                                        var valid13 = true;
                                      }
                                      if (valid13) {
                                        if (data56.providerBilledMicroUsd !== void 0) {
                                          const _errs133 = errors2;
                                          if (data56.providerBilledMicroUsd !== null) {
                                            validate24.errors = [{ instancePath: instancePath + "/coverage/providerBilledMicroUsd", schemaPath: "#/properties/coverage/properties/providerBilledMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                            return false;
                                          }
                                          var valid13 = _errs133 === errors2;
                                        } else {
                                          var valid13 = true;
                                        }
                                        if (valid13) {
                                          if (data56.completeJobCost !== void 0) {
                                            const _errs135 = errors2;
                                            if ("unavailable" !== data56.completeJobCost) {
                                              validate24.errors = [{ instancePath: instancePath + "/coverage/completeJobCost", schemaPath: "#/properties/coverage/properties/completeJobCost/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" }];
                                              return false;
                                            }
                                            var valid13 = _errs135 === errors2;
                                          } else {
                                            var valid13 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate24.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid0 = _errs127 === errors2;
                        } else {
                          var valid0 = true;
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
      validate24.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate24.errors = vErrors;
  return errors2 === 0;
}
validate24.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// conversation-usage/overview-protocol.mjs
var USAGE_OVERVIEW_SCHEMA = "meri.usage-overview/1";
var USAGE_OVERVIEW_PATH = "/api/conversations/usage-overview";
var overviewStates = Object.freeze(["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"]);
var usageOverviewErrors = Object.freeze({ INVALID_REQUEST: [400], UNAUTHENTICATED: [401], ACCESS_DENIED: [403], MEMBERSHIP_REVOKED: [403], NOT_FOUND: [404], METHOD_NOT_ALLOWED: [405], DEADLINE: [408], MEMBERSHIP_CHANGED: [409], REQUEST_TOO_LARGE: [413], UNSUPPORTED_MEDIA_TYPE: [415], CANCELLED: [499], PRODUCT_UNAVAILABLE: [502], USAGE_OVERVIEW_REQUEST_INVALID: [400], USAGE_OVERVIEW_CORRUPT: [500], USAGE_OVERVIEW_UNAVAILABLE: [503] });
var usageOverviewMetadata = Object.freeze({
  schemaId: "urn:meri:usage-overview:1.0.0",
  version: "1.0.0",
  path: USAGE_OVERVIEW_PATH,
  method: "POST",
  requestBytes: 1024,
  responseBytes: 16384,
  authentication: "current native tenant membership, rechecked before release",
  scope: "tenant aggregate numbers only; no conversation, client or other member identifiers",
  currency: "USD",
  money: "integer micro-USD of known recorded SDK estimates; missing or unavailable accounting is not zero cost",
  periods: "UTC day, ISO Monday week and calendar month; attempt cohorts use run.createdAt, admission cap uses sdk_usage_recorded_at",
  limits: "current canonical SDK limits and tenant admission cap; no reservations or budget editing",
  capacity: "recorded durable states only; no physical worker concurrency or available capacity observation",
  economics: "attempts are not complete jobs; provider billing and complete-job economics unavailable"
});
function usageOverviewPeriods(at) {
  const date = new Date(at);
  if (!Number.isSafeInteger(at) || !Number.isFinite(date.getTime())) throw Error("USAGE_OVERVIEW_CLOCK");
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), week = day - (date.getUTCDay() + 6) % 7 * 864e5;
  const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1), nextMonth = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return [["day", day, day + 864e5], ["week", week, week + 7 * 864e5], ["month", month, nextMonth]].map(([kind, start, end]) => ({ kind, startInclusive: new Date(start).toISOString(), endExclusive: new Date(end).toISOString() }));
}

// conversation-usage/overview-semantics.mjs
var UsageOverviewResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "UsageOverviewResponseError";
    this.code = code;
  }
};
var overviewFail = (code) => {
  throw new UsageOverviewResponseError(code);
};
function assertUsageOverviewSemantics(value) {
  const periods = usageOverviewPeriods(Date.parse(value.observedAt));
  for (let i = 0; i < 3; i++) {
    const p = value.periods[i], expected = periods[i];
    if (p.kind !== expected.kind || p.startInclusive !== expected.startInclusive || p.endExclusive !== expected.endExclusive || overviewStates.reduce((total, state) => total + p.states[state], 0) !== p.attempts || Object.values(p.recording).reduce((a, b) => a + b, 0) !== p.attempts || p.completedAttemptsWithRecordedUsage > p.states.completed || p.completedAttemptsWithRecordedUsage > p.recording.recorded || p.completedAttemptKnownChargeMicroUsd > p.knownChargeMicroUsd || p.recording.recorded === 0 && p.knownChargeMicroUsd !== 0 || p.completedAttemptsWithRecordedUsage === 0 && p.completedAttemptKnownChargeMicroUsd !== 0) overviewFail("INVALID_USAGE_OVERVIEW");
  }
  const admission = value.monthlyAdmission, cap = value.policy.monthlyCapMicroUsd;
  if (admission.startInclusive !== periods[2].startInclusive || admission.remainingKnownMicroUsd !== (cap === null ? null : Math.max(0, cap - admission.knownChargeMicroUsd)) || admission.reached !== (cap === null ? null : admission.knownChargeMicroUsd >= cap) || overviewStates.slice(5).some((state) => value.queue.states[state] !== 0)) overviewFail("INVALID_USAGE_OVERVIEW");
  return value;
}

// conversation-usage/overview-receive.mjs
var requests = /* @__PURE__ */ new WeakSet();
function parse(bytes, limit) {
  try {
    return parseBytes(bytes, limit);
  } catch {
    overviewFail("INVALID_BYTES");
  }
}
function receiveUsageOverviewRequest(bytes) {
  const value = parse(bytes, usageOverviewMetadata.requestBytes);
  if (!validateOverviewRequest(value)) overviewFail("USAGE_OVERVIEW_REQUEST_INVALID");
  requests.add(value);
  return value;
}
function receiveUsageOverviewResponse(status, bytes, request) {
  if (!requests.has(request)) overviewFail("UNADMITTED_REQUEST");
  const value = parse(bytes, usageOverviewMetadata.responseBytes);
  if (status !== 200) {
    const error = value?.error;
    if (!Number.isInteger(status) || !value || Object.keys(value).length !== 1 || !error || !Object.hasOwn(usageOverviewErrors, error.code) || !usageOverviewErrors[error.code].includes(status) || Object.keys(error).some((key) => !["code", "outcome"].includes(key)) || Object.hasOwn(error, "outcome") && (error.code !== "USAGE_OVERVIEW_UNAVAILABLE" || error.outcome !== "UNKNOWN")) overviewFail("INVALID_ERROR_RESPONSE");
    return value;
  }
  if (!validateOverviewResponse(value)) overviewFail("INVALID_USAGE_OVERVIEW");
  return assertUsageOverviewSemantics(value);
}

// usage-generated:./generated-validator.mjs
var validateRequest = validate33;
var formats02 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function validate33(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate33.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId")) {
        validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "conversationId" || key0 === "runId")) {
            validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.conversation-usage/1" !== data.schemaVersion) {
              validate33.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.conversation-usage/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.conversationId !== void 0) {
              let data1 = data.conversationId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats02.test(data1)) {
                      validate33.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate33.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.runId !== void 0) {
                let data2 = data.runId;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (errors2 === _errs5) {
                    if (typeof data2 === "string") {
                      if (!formats02.test(data2)) {
                        validate33.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate33.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate33.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate33.errors = vErrors;
  return errors2 === 0;
}
validate33.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateResponse = validate34;
var schema352 = { "type": "object", "properties": { "schemaVersion": { "const": "meri.conversation-usage/1" }, "conversationId": { "type": "string", "format": "uuid" }, "runId": { "type": "string", "format": "uuid" }, "recording": { "enum": ["not-recorded", "recorded"] }, "usage": { "anyOf": [{ "$ref": "#/$defs/RecordedUsage" }, { "type": "null" }] }, "toolAudit": { "anyOf": [{ "$ref": "#/$defs/RecordedToolAudit" }, { "type": "null" }] } }, "required": ["schemaVersion", "conversationId", "runId", "recording", "usage", "toolAudit"], "additionalProperties": false };
var schema36 = { "type": "object", "properties": { "status": { "enum": ["recorded", "unavailable"] }, "reason": { "anyOf": [{ "enum": ["configuration_mismatch", "result_unavailable", "baseline_mismatch", "baseline_unavailable", "baseline_configuration_mismatch", "lineage_unavailable", "counters_reset", "estimate_mismatch", "rates_unavailable", "amount_out_of_range"] }, { "type": "null" }] }, "currency": { "const": "USD" }, "runDelta": { "anyOf": [{ "$ref": "#/$defs/UsageRunDelta" }, { "type": "null" }] }, "cumulative": { "anyOf": [{ "$ref": "#/$defs/UsageCumulative" }, { "type": "null" }] }, "providerBilledUsd": { "type": "null" } }, "required": ["status", "reason", "currency", "runDelta", "cumulative", "providerBilledUsd"], "additionalProperties": false };
var func12 = require_ucs2length().default;
var pattern42 = new RegExp("^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$", "u");
function validate25(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.sdkEstimateUsd === void 0 && (missing0 = "sdkEstimateUsd") || data.modelCounters === void 0 && (missing0 = "modelCounters")) {
        validate25.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sdkEstimateUsd" || key0 === "modelCounters")) {
            validate25.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sdkEstimateUsd !== void 0) {
            let data0 = data.sdkEstimateUsd;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 == "number" && isFinite(data0)) {
                if (data0 > 9007199254740992e-6 || isNaN(data0)) {
                  validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                  return false;
                } else {
                  if (data0 < 0 || isNaN(data0)) {
                    validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              } else {
                validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.modelCounters !== void 0) {
              let data1 = data.modelCounters;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (Array.isArray(data1)) {
                  if (data1.length > 32) {
                    validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                    return false;
                  } else {
                    if (data1.length < 1) {
                      validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                      return false;
                    } else {
                      var valid1 = true;
                      const len0 = data1.length;
                      for (let i0 = 0; i0 < len0; i0++) {
                        let data2 = data1[i0];
                        const _errs6 = errors2;
                        const _errs7 = errors2;
                        if (errors2 === _errs7) {
                          if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                            let missing1;
                            if (data2.model === void 0 && (missing1 = "model") || data2.inputTokens === void 0 && (missing1 = "inputTokens") || data2.outputTokens === void 0 && (missing1 = "outputTokens") || data2.cacheReadInputTokens === void 0 && (missing1 = "cacheReadInputTokens") || data2.cacheCreationInputTokens === void 0 && (missing1 = "cacheCreationInputTokens") || data2.webSearchRequests === void 0 && (missing1 = "webSearchRequests")) {
                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                              return false;
                            } else {
                              const _errs9 = errors2;
                              for (const key1 in data2) {
                                if (!(key1 === "model" || key1 === "inputTokens" || key1 === "outputTokens" || key1 === "cacheReadInputTokens" || key1 === "cacheCreationInputTokens" || key1 === "webSearchRequests")) {
                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs9 === errors2) {
                                if (data2.model !== void 0) {
                                  let data3 = data2.model;
                                  const _errs10 = errors2;
                                  if (errors2 === _errs10) {
                                    if (typeof data3 === "string") {
                                      if (func12(data3) > 200) {
                                        validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                        return false;
                                      } else {
                                        if (func12(data3) < 1) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        } else {
                                          if (!pattern42.test(data3)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                            return false;
                                          }
                                        }
                                      }
                                    } else {
                                      validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid3 = _errs10 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data2.inputTokens !== void 0) {
                                    let data4 = data2.inputTokens;
                                    const _errs12 = errors2;
                                    if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4))) {
                                      validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors2 === _errs12) {
                                      if (typeof data4 == "number" && isFinite(data4)) {
                                        if (data4 > 9007199254740991 || isNaN(data4)) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data4 < 0 || isNaN(data4)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid3 = _errs12 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data2.outputTokens !== void 0) {
                                      let data5 = data2.outputTokens;
                                      const _errs14 = errors2;
                                      if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
                                        validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs14) {
                                        if (typeof data5 == "number" && isFinite(data5)) {
                                          if (data5 > 9007199254740991 || isNaN(data5)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data5 < 0 || isNaN(data5)) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid3 = _errs14 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data2.cacheReadInputTokens !== void 0) {
                                        let data6 = data2.cacheReadInputTokens;
                                        const _errs16 = errors2;
                                        if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6))) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                          return false;
                                        }
                                        if (errors2 === _errs16) {
                                          if (typeof data6 == "number" && isFinite(data6)) {
                                            if (data6 > 9007199254740991 || isNaN(data6)) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                              return false;
                                            } else {
                                              if (data6 < 0 || isNaN(data6)) {
                                                validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                return false;
                                              }
                                            }
                                          }
                                        }
                                        var valid3 = _errs16 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data2.cacheCreationInputTokens !== void 0) {
                                          let data7 = data2.cacheCreationInputTokens;
                                          const _errs18 = errors2;
                                          if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs18) {
                                            if (typeof data7 == "number" && isFinite(data7)) {
                                              if (data7 > 9007199254740991 || isNaN(data7)) {
                                                validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data7 < 0 || isNaN(data7)) {
                                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid3 = _errs18 === errors2;
                                        } else {
                                          var valid3 = true;
                                        }
                                        if (valid3) {
                                          if (data2.webSearchRequests !== void 0) {
                                            let data8 = data2.webSearchRequests;
                                            const _errs20 = errors2;
                                            if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs20) {
                                              if (typeof data8 == "number" && isFinite(data8)) {
                                                if (data8 > 9007199254740991 || isNaN(data8)) {
                                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data8 < 0 || isNaN(data8)) {
                                                    validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid3 = _errs20 === errors2;
                                          } else {
                                            var valid3 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid1 = _errs6 === errors2;
                        if (!valid1) {
                          break;
                        }
                      }
                    }
                  }
                } else {
                  validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate25.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate25.errors = vErrors;
  return errors2 === 0;
}
validate25.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema40 = { "type": "object", "properties": { "sdk": { "type": "string", "maxLength": 64, "pattern": "^\\d+\\.\\d+\\.\\d+$" }, "cli": { "type": "string", "maxLength": 64, "pattern": "^\\d+\\.\\d+\\.\\d+$" }, "provider": { "enum": ["bedrock", "claude-api"] }, "cacheWriteTtl": { "enum": ["5m", "1h"] }, "priceRevision": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" } }, "required": ["sdk", "cli", "provider", "cacheWriteTtl", "priceRevision"], "additionalProperties": false };
var schema41 = { "type": "object", "properties": { "model": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, "inputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "outputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cacheReadInputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cacheCreationInputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "webSearchRequests": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "sdkEstimateUsd": { "type": "number", "minimum": 0, "maximum": 9007199254740992e-6 }, "provider": { "enum": ["bedrock", "firstParty", "unknown"] }, "costBasis": { "enum": ["list", "unknown"] } }, "required": ["model", "inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests", "sdkEstimateUsd", "provider", "costBasis"], "additionalProperties": false };
var func7 = Object.prototype.hasOwnProperty;
var pattern5 = new RegExp("^\\d+\\.\\d+\\.\\d+$", "u");
function validate27(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.sdkEstimateUsd === void 0 && (missing0 = "sdkEstimateUsd") || data.basis === void 0 && (missing0 = "basis") || data.models === void 0 && (missing0 = "models")) {
        validate27.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sdkEstimateUsd" || key0 === "basis" || key0 === "models")) {
            validate27.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sdkEstimateUsd !== void 0) {
            let data0 = data.sdkEstimateUsd;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 == "number" && isFinite(data0)) {
                if (data0 > 9007199254740992e-6 || isNaN(data0)) {
                  validate27.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                  return false;
                } else {
                  if (data0 < 0 || isNaN(data0)) {
                    validate27.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              } else {
                validate27.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.basis !== void 0) {
              let data1 = data.basis;
              const _errs4 = errors2;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.sdk === void 0 && (missing1 = "sdk") || data1.cli === void 0 && (missing1 = "cli") || data1.provider === void 0 && (missing1 = "provider") || data1.cacheWriteTtl === void 0 && (missing1 = "cacheWriteTtl") || data1.priceRevision === void 0 && (missing1 = "priceRevision")) {
                    validate27.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs7 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "sdk" || key1 === "cli" || key1 === "provider" || key1 === "cacheWriteTtl" || key1 === "priceRevision")) {
                        validate27.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs7 === errors2) {
                      if (data1.sdk !== void 0) {
                        let data2 = data1.sdk;
                        const _errs8 = errors2;
                        if (errors2 === _errs8) {
                          if (typeof data2 === "string") {
                            if (func12(data2) > 64) {
                              validate27.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                              return false;
                            } else {
                              if (!pattern5.test(data2)) {
                                validate27.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/pattern", keyword: "pattern", params: { pattern: "^\\d+\\.\\d+\\.\\d+$" }, message: 'must match pattern "^\\d+\\.\\d+\\.\\d+$"' }];
                                return false;
                              }
                            }
                          } else {
                            validate27.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.cli !== void 0) {
                          let data3 = data1.cli;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (typeof data3 === "string") {
                              if (func12(data3) > 64) {
                                validate27.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                                return false;
                              } else {
                                if (!pattern5.test(data3)) {
                                  validate27.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/pattern", keyword: "pattern", params: { pattern: "^\\d+\\.\\d+\\.\\d+$" }, message: 'must match pattern "^\\d+\\.\\d+\\.\\d+$"' }];
                                  return false;
                                }
                              }
                            } else {
                              validate27.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs10 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.provider !== void 0) {
                            let data4 = data1.provider;
                            const _errs12 = errors2;
                            if (!(data4 === "bedrock" || data4 === "claude-api")) {
                              validate27.errors = [{ instancePath: instancePath + "/basis/provider", schemaPath: "#/$defs/UsageBasis/properties/provider/enum", keyword: "enum", params: { allowedValues: schema40.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid2 = _errs12 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.cacheWriteTtl !== void 0) {
                              let data5 = data1.cacheWriteTtl;
                              const _errs13 = errors2;
                              if (!(data5 === "5m" || data5 === "1h")) {
                                validate27.errors = [{ instancePath: instancePath + "/basis/cacheWriteTtl", schemaPath: "#/$defs/UsageBasis/properties/cacheWriteTtl/enum", keyword: "enum", params: { allowedValues: schema40.properties.cacheWriteTtl.enum }, message: "must be equal to one of the allowed values" }];
                                return false;
                              }
                              var valid2 = _errs13 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.priceRevision !== void 0) {
                                let data6 = data1.priceRevision;
                                const _errs14 = errors2;
                                if (errors2 === _errs14) {
                                  if (typeof data6 === "string") {
                                    if (func12(data6) > 200) {
                                      validate27.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                      return false;
                                    } else {
                                      if (func12(data6) < 1) {
                                        validate27.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      } else {
                                        if (!pattern42.test(data6)) {
                                          validate27.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                          return false;
                                        }
                                      }
                                    }
                                  } else {
                                    validate27.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs14 === errors2;
                              } else {
                                var valid2 = true;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate27.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.models !== void 0) {
                let data7 = data.models;
                const _errs16 = errors2;
                if (errors2 === _errs16) {
                  if (Array.isArray(data7)) {
                    if (data7.length > 32) {
                      validate27.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                      return false;
                    } else {
                      if (data7.length < 1) {
                        validate27.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                        return false;
                      } else {
                        var valid3 = true;
                        const len0 = data7.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data8 = data7[i0];
                          const _errs18 = errors2;
                          const _errs19 = errors2;
                          if (errors2 === _errs19) {
                            if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
                              let missing2;
                              if (data8.model === void 0 && (missing2 = "model") || data8.inputTokens === void 0 && (missing2 = "inputTokens") || data8.outputTokens === void 0 && (missing2 = "outputTokens") || data8.cacheReadInputTokens === void 0 && (missing2 = "cacheReadInputTokens") || data8.cacheCreationInputTokens === void 0 && (missing2 = "cacheCreationInputTokens") || data8.webSearchRequests === void 0 && (missing2 = "webSearchRequests") || data8.sdkEstimateUsd === void 0 && (missing2 = "sdkEstimateUsd") || data8.provider === void 0 && (missing2 = "provider") || data8.costBasis === void 0 && (missing2 = "costBasis")) {
                                validate27.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                return false;
                              } else {
                                const _errs21 = errors2;
                                for (const key2 in data8) {
                                  if (!func7.call(schema41.properties, key2)) {
                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs21 === errors2) {
                                  if (data8.model !== void 0) {
                                    let data9 = data8.model;
                                    const _errs22 = errors2;
                                    if (errors2 === _errs22) {
                                      if (typeof data9 === "string") {
                                        if (func12(data9) > 200) {
                                          validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                          return false;
                                        } else {
                                          if (func12(data9) < 1) {
                                            validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                          } else {
                                            if (!pattern42.test(data9)) {
                                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                              return false;
                                            }
                                          }
                                        }
                                      } else {
                                        validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid5 = _errs22 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data8.inputTokens !== void 0) {
                                      let data10 = data8.inputTokens;
                                      const _errs24 = errors2;
                                      if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                                        validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs24) {
                                        if (typeof data10 == "number" && isFinite(data10)) {
                                          if (data10 > 9007199254740991 || isNaN(data10)) {
                                            validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data10 < 0 || isNaN(data10)) {
                                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid5 = _errs24 === errors2;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data8.outputTokens !== void 0) {
                                        let data11 = data8.outputTokens;
                                        const _errs26 = errors2;
                                        if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                          validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                          return false;
                                        }
                                        if (errors2 === _errs26) {
                                          if (typeof data11 == "number" && isFinite(data11)) {
                                            if (data11 > 9007199254740991 || isNaN(data11)) {
                                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                              return false;
                                            } else {
                                              if (data11 < 0 || isNaN(data11)) {
                                                validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                return false;
                                              }
                                            }
                                          }
                                        }
                                        var valid5 = _errs26 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data8.cacheReadInputTokens !== void 0) {
                                          let data12 = data8.cacheReadInputTokens;
                                          const _errs28 = errors2;
                                          if (!(typeof data12 == "number" && (!(data12 % 1) && !isNaN(data12)) && isFinite(data12))) {
                                            validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs28) {
                                            if (typeof data12 == "number" && isFinite(data12)) {
                                              if (data12 > 9007199254740991 || isNaN(data12)) {
                                                validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data12 < 0 || isNaN(data12)) {
                                                  validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid5 = _errs28 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data8.cacheCreationInputTokens !== void 0) {
                                            let data13 = data8.cacheCreationInputTokens;
                                            const _errs30 = errors2;
                                            if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs30) {
                                              if (typeof data13 == "number" && isFinite(data13)) {
                                                if (data13 > 9007199254740991 || isNaN(data13)) {
                                                  validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data13 < 0 || isNaN(data13)) {
                                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid5 = _errs30 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data8.webSearchRequests !== void 0) {
                                              let data14 = data8.webSearchRequests;
                                              const _errs32 = errors2;
                                              if (!(typeof data14 == "number" && (!(data14 % 1) && !isNaN(data14)) && isFinite(data14))) {
                                                validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                return false;
                                              }
                                              if (errors2 === _errs32) {
                                                if (typeof data14 == "number" && isFinite(data14)) {
                                                  if (data14 > 9007199254740991 || isNaN(data14)) {
                                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                    return false;
                                                  } else {
                                                    if (data14 < 0 || isNaN(data14)) {
                                                      validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid5 = _errs32 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data8.sdkEstimateUsd !== void 0) {
                                                let data15 = data8.sdkEstimateUsd;
                                                const _errs34 = errors2;
                                                if (errors2 === _errs34) {
                                                  if (typeof data15 == "number" && isFinite(data15)) {
                                                    if (data15 > 9007199254740992e-6 || isNaN(data15)) {
                                                      validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                                                      return false;
                                                    } else {
                                                      if (data15 < 0 || isNaN(data15)) {
                                                        validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                                                    return false;
                                                  }
                                                }
                                                var valid5 = _errs34 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data8.provider !== void 0) {
                                                  let data16 = data8.provider;
                                                  const _errs36 = errors2;
                                                  if (!(data16 === "bedrock" || data16 === "firstParty" || data16 === "unknown")) {
                                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/provider", schemaPath: "#/$defs/UsageModelEstimate/properties/provider/enum", keyword: "enum", params: { allowedValues: schema41.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                                                    return false;
                                                  }
                                                  var valid5 = _errs36 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data8.costBasis !== void 0) {
                                                    let data17 = data8.costBasis;
                                                    const _errs37 = errors2;
                                                    if (!(data17 === "list" || data17 === "unknown")) {
                                                      validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/costBasis", schemaPath: "#/$defs/UsageModelEstimate/properties/costBasis/enum", keyword: "enum", params: { allowedValues: schema41.properties.costBasis.enum }, message: "must be equal to one of the allowed values" }];
                                                      return false;
                                                    }
                                                    var valid5 = _errs37 === errors2;
                                                  } else {
                                                    var valid5 = true;
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
                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid3 = _errs18 === errors2;
                          if (!valid3) {
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    validate27.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                    return false;
                  }
                }
                var valid0 = _errs16 === errors2;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate27.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate27.errors = vErrors;
  return errors2 === 0;
}
validate27.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate242(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate242.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.status === void 0 && (missing0 = "status") || data.reason === void 0 && (missing0 = "reason") || data.currency === void 0 && (missing0 = "currency") || data.runDelta === void 0 && (missing0 = "runDelta") || data.cumulative === void 0 && (missing0 = "cumulative") || data.providerBilledUsd === void 0 && (missing0 = "providerBilledUsd")) {
        validate242.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "status" || key0 === "reason" || key0 === "currency" || key0 === "runDelta" || key0 === "cumulative" || key0 === "providerBilledUsd")) {
            validate242.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.status !== void 0) {
            let data0 = data.status;
            const _errs2 = errors2;
            if (!(data0 === "recorded" || data0 === "unavailable")) {
              validate242.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/enum", keyword: "enum", params: { allowedValues: schema36.properties.status.enum }, message: "must be equal to one of the allowed values" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.reason !== void 0) {
              let data1 = data.reason;
              const _errs3 = errors2;
              const _errs4 = errors2;
              let valid1 = false;
              const _errs5 = errors2;
              if (!(data1 === "configuration_mismatch" || data1 === "result_unavailable" || data1 === "baseline_mismatch" || data1 === "baseline_unavailable" || data1 === "baseline_configuration_mismatch" || data1 === "lineage_unavailable" || data1 === "counters_reset" || data1 === "estimate_mismatch" || data1 === "rates_unavailable" || data1 === "amount_out_of_range")) {
                const err0 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema36.properties.reason.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors2++;
              }
              var _valid0 = _errs5 === errors2;
              valid1 = valid1 || _valid0;
              const _errs6 = errors2;
              if (data1 !== null) {
                const err1 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors2++;
              }
              var _valid0 = _errs6 === errors2;
              valid1 = valid1 || _valid0;
              if (!valid1) {
                const err2 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors2++;
                validate242.errors = vErrors;
                return false;
              } else {
                errors2 = _errs4;
                if (vErrors !== null) {
                  if (_errs4) {
                    vErrors.length = _errs4;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.currency !== void 0) {
                const _errs8 = errors2;
                if ("USD" !== data.currency) {
                  validate242.errors = [{ instancePath: instancePath + "/currency", schemaPath: "#/properties/currency/const", keyword: "const", params: { allowedValue: "USD" }, message: "must be equal to constant" }];
                  return false;
                }
                var valid0 = _errs8 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.runDelta !== void 0) {
                  let data3 = data.runDelta;
                  const _errs9 = errors2;
                  const _errs10 = errors2;
                  let valid2 = false;
                  const _errs11 = errors2;
                  if (!validate25(data3, { instancePath: instancePath + "/runDelta", parentData: data, parentDataProperty: "runDelta", rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                    errors2 = vErrors.length;
                  }
                  var _valid1 = _errs11 === errors2;
                  valid2 = valid2 || _valid1;
                  const _errs12 = errors2;
                  if (data3 !== null) {
                    const err3 = { instancePath: instancePath + "/runDelta", schemaPath: "#/properties/runDelta/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                  var _valid1 = _errs12 === errors2;
                  valid2 = valid2 || _valid1;
                  if (!valid2) {
                    const err4 = { instancePath: instancePath + "/runDelta", schemaPath: "#/properties/runDelta/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors2++;
                    validate242.errors = vErrors;
                    return false;
                  } else {
                    errors2 = _errs10;
                    if (vErrors !== null) {
                      if (_errs10) {
                        vErrors.length = _errs10;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs9 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.cumulative !== void 0) {
                    let data4 = data.cumulative;
                    const _errs14 = errors2;
                    const _errs15 = errors2;
                    let valid3 = false;
                    const _errs16 = errors2;
                    if (!validate27(data4, { instancePath: instancePath + "/cumulative", parentData: data, parentDataProperty: "cumulative", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
                      errors2 = vErrors.length;
                    }
                    var _valid2 = _errs16 === errors2;
                    valid3 = valid3 || _valid2;
                    const _errs17 = errors2;
                    if (data4 !== null) {
                      const err5 = { instancePath: instancePath + "/cumulative", schemaPath: "#/properties/cumulative/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors2++;
                    }
                    var _valid2 = _errs17 === errors2;
                    valid3 = valid3 || _valid2;
                    if (!valid3) {
                      const err6 = { instancePath: instancePath + "/cumulative", schemaPath: "#/properties/cumulative/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors2++;
                      validate242.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs15;
                      if (vErrors !== null) {
                        if (_errs15) {
                          vErrors.length = _errs15;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid0 = _errs14 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.providerBilledUsd !== void 0) {
                      const _errs19 = errors2;
                      if (data.providerBilledUsd !== null) {
                        validate242.errors = [{ instancePath: instancePath + "/providerBilledUsd", schemaPath: "#/properties/providerBilledUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                        return false;
                      }
                      var valid0 = _errs19 === errors2;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate242.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate242.errors = vErrors;
  return errors2 === 0;
}
validate242.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema43 = { "type": "object", "properties": { "name": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, "executionOutcome": { "enum": ["completed", "failed"] }, "durationMs": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, { "type": "null" }] } }, "required": ["name", "executionOutcome", "durationMs"], "additionalProperties": false };
function validate30(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.coverage === void 0 && (missing0 = "coverage") || data.partial === void 0 && (missing0 = "partial") || data.omitted === void 0 && (missing0 = "omitted") || data.tools === void 0 && (missing0 = "tools")) {
        validate30.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "coverage" || key0 === "partial" || key0 === "omitted" || key0 === "tools")) {
            validate30.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.coverage !== void 0) {
            const _errs2 = errors2;
            if ("recorded-hooks-only" !== data.coverage) {
              validate30.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/const", keyword: "const", params: { allowedValue: "recorded-hooks-only" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.partial !== void 0) {
              const _errs3 = errors2;
              if (typeof data.partial !== "boolean") {
                validate30.errors = [{ instancePath: instancePath + "/partial", schemaPath: "#/properties/partial/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                return false;
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.omitted !== void 0) {
                let data2 = data.omitted;
                const _errs5 = errors2;
                if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
                  validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                  return false;
                }
                if (errors2 === _errs5) {
                  if (typeof data2 == "number" && isFinite(data2)) {
                    if (data2 > 9007199254740991 || isNaN(data2)) {
                      validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                      return false;
                    } else {
                      if (data2 < 0 || isNaN(data2)) {
                        validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                        return false;
                      }
                    }
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.tools !== void 0) {
                  let data3 = data.tools;
                  const _errs7 = errors2;
                  if (errors2 === _errs7) {
                    if (Array.isArray(data3)) {
                      if (data3.length > 128) {
                        validate30.errors = [{ instancePath: instancePath + "/tools", schemaPath: "#/properties/tools/maxItems", keyword: "maxItems", params: { limit: 128 }, message: "must NOT have more than 128 items" }];
                        return false;
                      } else {
                        var valid1 = true;
                        const len0 = data3.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data4 = data3[i0];
                          const _errs9 = errors2;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                              let missing1;
                              if (data4.name === void 0 && (missing1 = "name") || data4.executionOutcome === void 0 && (missing1 = "executionOutcome") || data4.durationMs === void 0 && (missing1 = "durationMs")) {
                                validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                return false;
                              } else {
                                const _errs12 = errors2;
                                for (const key1 in data4) {
                                  if (!(key1 === "name" || key1 === "executionOutcome" || key1 === "durationMs")) {
                                    validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs12 === errors2) {
                                  if (data4.name !== void 0) {
                                    let data5 = data4.name;
                                    const _errs13 = errors2;
                                    if (errors2 === _errs13) {
                                      if (typeof data5 === "string") {
                                        if (func12(data5) > 200) {
                                          validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                          return false;
                                        } else {
                                          if (func12(data5) < 1) {
                                            validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                          } else {
                                            if (!pattern42.test(data5)) {
                                              validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                              return false;
                                            }
                                          }
                                        }
                                      } else {
                                        validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid3 = _errs13 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data4.executionOutcome !== void 0) {
                                      let data6 = data4.executionOutcome;
                                      const _errs15 = errors2;
                                      if (!(data6 === "completed" || data6 === "failed")) {
                                        validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/executionOutcome", schemaPath: "#/$defs/RecordedToolOutcome/properties/executionOutcome/enum", keyword: "enum", params: { allowedValues: schema43.properties.executionOutcome.enum }, message: "must be equal to one of the allowed values" }];
                                        return false;
                                      }
                                      var valid3 = _errs15 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data4.durationMs !== void 0) {
                                        let data7 = data4.durationMs;
                                        const _errs16 = errors2;
                                        const _errs17 = errors2;
                                        let valid4 = false;
                                        const _errs18 = errors2;
                                        if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                          const err0 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err0];
                                          } else {
                                            vErrors.push(err0);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs18) {
                                          if (typeof data7 == "number" && isFinite(data7)) {
                                            if (data7 > 9007199254740991 || isNaN(data7)) {
                                              const err1 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                              if (vErrors === null) {
                                                vErrors = [err1];
                                              } else {
                                                vErrors.push(err1);
                                              }
                                              errors2++;
                                            } else {
                                              if (data7 < 0 || isNaN(data7)) {
                                                const err2 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                if (vErrors === null) {
                                                  vErrors = [err2];
                                                } else {
                                                  vErrors.push(err2);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var _valid0 = _errs18 === errors2;
                                        valid4 = valid4 || _valid0;
                                        const _errs20 = errors2;
                                        if (data7 !== null) {
                                          const err3 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                          if (vErrors === null) {
                                            vErrors = [err3];
                                          } else {
                                            vErrors.push(err3);
                                          }
                                          errors2++;
                                        }
                                        var _valid0 = _errs20 === errors2;
                                        valid4 = valid4 || _valid0;
                                        if (!valid4) {
                                          const err4 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                          if (vErrors === null) {
                                            vErrors = [err4];
                                          } else {
                                            vErrors.push(err4);
                                          }
                                          errors2++;
                                          validate30.errors = vErrors;
                                          return false;
                                        } else {
                                          errors2 = _errs17;
                                          if (vErrors !== null) {
                                            if (_errs17) {
                                              vErrors.length = _errs17;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid3 = _errs16 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid1 = _errs9 === errors2;
                          if (!valid1) {
                            break;
                          }
                        }
                      }
                    } else {
                      validate30.errors = [{ instancePath: instancePath + "/tools", schemaPath: "#/properties/tools/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                      return false;
                    }
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate30.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate30.errors = vErrors;
  return errors2 === 0;
}
validate30.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate34.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId") || data.recording === void 0 && (missing0 = "recording") || data.usage === void 0 && (missing0 = "usage") || data.toolAudit === void 0 && (missing0 = "toolAudit")) {
        validate34.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "conversationId" || key0 === "runId" || key0 === "recording" || key0 === "usage" || key0 === "toolAudit")) {
            validate34.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.conversation-usage/1" !== data.schemaVersion) {
              validate34.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.conversation-usage/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.conversationId !== void 0) {
              let data1 = data.conversationId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats02.test(data1)) {
                      validate34.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate34.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.runId !== void 0) {
                let data2 = data.runId;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (errors2 === _errs5) {
                    if (typeof data2 === "string") {
                      if (!formats02.test(data2)) {
                        validate34.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate34.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.recording !== void 0) {
                  let data3 = data.recording;
                  const _errs7 = errors2;
                  if (!(data3 === "not-recorded" || data3 === "recorded")) {
                    validate34.errors = [{ instancePath: instancePath + "/recording", schemaPath: "#/properties/recording/enum", keyword: "enum", params: { allowedValues: schema352.properties.recording.enum }, message: "must be equal to one of the allowed values" }];
                    return false;
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.usage !== void 0) {
                    let data4 = data.usage;
                    const _errs8 = errors2;
                    const _errs9 = errors2;
                    let valid1 = false;
                    const _errs10 = errors2;
                    if (!validate242(data4, { instancePath: instancePath + "/usage", parentData: data, parentDataProperty: "usage", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate242.errors : vErrors.concat(validate242.errors);
                      errors2 = vErrors.length;
                    }
                    var _valid0 = _errs10 === errors2;
                    valid1 = valid1 || _valid0;
                    const _errs11 = errors2;
                    if (data4 !== null) {
                      const err0 = { instancePath: instancePath + "/usage", schemaPath: "#/properties/usage/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors2++;
                    }
                    var _valid0 = _errs11 === errors2;
                    valid1 = valid1 || _valid0;
                    if (!valid1) {
                      const err1 = { instancePath: instancePath + "/usage", schemaPath: "#/properties/usage/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors2++;
                      validate34.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs9;
                      if (vErrors !== null) {
                        if (_errs9) {
                          vErrors.length = _errs9;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid0 = _errs8 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.toolAudit !== void 0) {
                      let data5 = data.toolAudit;
                      const _errs13 = errors2;
                      const _errs14 = errors2;
                      let valid2 = false;
                      const _errs15 = errors2;
                      if (!validate30(data5, { instancePath: instancePath + "/toolAudit", parentData: data, parentDataProperty: "toolAudit", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
                        errors2 = vErrors.length;
                      }
                      var _valid1 = _errs15 === errors2;
                      valid2 = valid2 || _valid1;
                      const _errs16 = errors2;
                      if (data5 !== null) {
                        const err2 = { instancePath: instancePath + "/toolAudit", schemaPath: "#/properties/toolAudit/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors2++;
                      }
                      var _valid1 = _errs16 === errors2;
                      valid2 = valid2 || _valid1;
                      if (!valid2) {
                        const err3 = { instancePath: instancePath + "/toolAudit", schemaPath: "#/properties/toolAudit/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err3];
                        } else {
                          vErrors.push(err3);
                        }
                        errors2++;
                        validate34.errors = vErrors;
                        return false;
                      } else {
                        errors2 = _errs14;
                        if (vErrors !== null) {
                          if (_errs14) {
                            vErrors.length = _errs14;
                          } else {
                            vErrors = null;
                          }
                        }
                      }
                      var valid0 = _errs13 === errors2;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate34.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate34.errors = vErrors;
  return errors2 === 0;
}
validate34.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// conversation-history/protocol.mjs
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var conversationHistoryVersion = "1.2.0";
var HISTORY_PATHS = freeze({ list: "/api/conversations/list", transcript: "/api/conversations/transcript", nextTurn: "/api/conversations/next-turn", summaries: "/api/conversations/summaries", manage: "/api/conversations/manage" });
var historyDomainErrorStatuses = freeze({ CONVERSATION_REQUEST_INVALID: 400, CONVERSATION_CURSOR_INVALID: 400, CONVERSATION_NOT_FOUND: 404, CONVERSATION_TURN_CONFLICT: 409, CONVERSATION_MANAGEMENT_CONFLICT: 409, CONVERSATION_RESTORE_EXPIRED: 410, CONVERSATION_STORE_CORRUPT: 500, CONVERSATION_TURN_UNAVAILABLE: 503, CONVERSATION_UNAVAILABLE: 503 });
var historyErrorStatuses = freeze({ INVALID_REQUEST: [400], UNAUTHENTICATED: [401], ACCESS_DENIED: [403], MEMBERSHIP_REVOKED: [403], NOT_FOUND: [404], METHOD_NOT_ALLOWED: [405], DEADLINE: [408], MEMBERSHIP_CHANGED: [409], REQUEST_TOO_LARGE: [413], UNSUPPORTED_MEDIA_TYPE: [415], CANCELLED: [499], PRODUCT_UNAVAILABLE: [502], ...Object.fromEntries(Object.entries(historyDomainErrorStatuses).map(([code, status]) => [code, [status]])) });
var conversationHistoryMetadata = freeze({
  packageVersion: "0.1.15",
  historyVersion: conversationHistoryVersion,
  schemaId: "urn:meri:conversation-history:1.2.0",
  routes: Object.fromEntries(Object.entries(HISTORY_PATHS).map(([route, path]) => [route, { method: "POST", path }])),
  authentication: { owner: "native identity and current Core membership", header: "authorization", scheme: "Bearer", serverSideCredentialOnly: true, validationGrantsAuthority: false },
  limits: { requestBytes: 131072, responseBytes: 2097152, pageItems: 100 },
  defaults: { limit: 50, after: 0, before: null },
  cursor: { transcript: "conversation sequence", runLocal: "UIEvent.sequence", translation: "conversation sequence = sequenceBase + UIEvent.sequence" },
  promptIdentity: "conversationId + promptLineage.logicalRequestId",
  turnRecovery: "same sourceRunId returns same targetBinding; retain exact submit requestId/prompt",
  errorOutcomes: ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED"],
  errorStatuses: historyErrorStatuses
});

// conversation-usage/protocol.mjs
var CONVERSATION_USAGE_SCHEMA = "meri.conversation-usage/1";
var CONVERSATION_USAGE_PATH = "/api/conversations/usage";
var usageUnavailableReasons = Object.freeze([
  "configuration_mismatch",
  "result_unavailable",
  "baseline_mismatch",
  "baseline_unavailable",
  "baseline_configuration_mismatch",
  "lineage_unavailable",
  "counters_reset",
  "estimate_mismatch",
  "rates_unavailable",
  "amount_out_of_range"
]);
var usageCounterNames = Object.freeze(["inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests"]);
var conversationUsageErrors = Object.freeze({
  ...historyErrorStatuses,
  USAGE_REQUEST_INVALID: Object.freeze([400]),
  USAGE_RECORD_CORRUPT: Object.freeze([500]),
  USAGE_UNAVAILABLE: Object.freeze([503])
});
var conversationUsageMetadata = Object.freeze({
  version: "1.0.0",
  packageVersion: "0.1.15",
  schemaId: "urn:meri:conversation-usage:1.0.0",
  path: CONVERSATION_USAGE_PATH,
  method: "POST",
  requestBytes: 4096,
  responseBytes: 131072,
  maxModels: 32,
  maxTools: 128,
  authentication: "current native product bearer and Core access",
  currency: "USD",
  money: "recorded SDK estimate; provider billing unavailable",
  counters: "original token/cache-token counts and web-search request counts",
  durationUnit: "milliseconds; null means unknown",
  cumulativeScope: "SDK query pipeline including subagents/compaction and prior resumed/forked usage",
  runScope: "existing accounting run delta",
  tools: "recorded post-tool execution outcomes only; not external-effect confirmation",
  coverage: "recorded hooks only; omitted count is explicit",
  correlation: "none with UI tool.call requestId, source references or other rows",
  identifiers: "bounded inert text; never links, commands or authority"
});

// conversation-usage/semantics.mjs
var ConversationUsageResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "ConversationUsageResponseError";
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new ConversationUsageResponseError(code);
};
function assertUsageResponseSemantics(value, request) {
  if (value.conversationId !== request.conversationId || value.runId !== request.runId) fail2("USAGE_REQUEST_MISMATCH");
  if (value.recording === "not-recorded") {
    if (value.usage !== null || value.toolAudit !== null) fail2("INVALID_USAGE_RECORDING");
    return value;
  }
  const usage = value.usage, audit = value.toolAudit;
  if (usage === null || audit === null || audit.partial !== audit.omitted > 0) fail2("INVALID_USAGE_RECORDING");
  if (usage.status === "recorded" ? usage.reason !== null || usage.runDelta === null || usage.cumulative === null : usage.reason === null) fail2("INVALID_USAGE_STATUS");
  const cumulative = usage.cumulative?.models ?? [], delta = usage.runDelta?.modelCounters ?? [];
  for (const entries of [cumulative, delta]) if (new Set(entries.map((m) => m.model)).size !== entries.length) fail2("DUPLICATE_USAGE_MODEL");
  if (usage.runDelta !== null) {
    if (usage.cumulative === null || delta.length !== cumulative.length || usage.runDelta.sdkEstimateUsd > usage.cumulative.sdkEstimateUsd + 1e-12) fail2("INVALID_USAGE_DELTA");
    for (const model of delta) {
      const original = cumulative.find((m) => m.model === model.model);
      if (!original || usageCounterNames.some((key) => model[key] > original[key])) fail2("INVALID_USAGE_DELTA");
    }
  }
  return value;
}

// conversation-usage/conversation-usage-receiver.mjs
var admitted = /* @__PURE__ */ new WeakMap();
var parse2 = (bytes, cap) => {
  try {
    return parseBytes(bytes, cap);
  } catch (error) {
    fail2(error.code ?? "INVALID_BYTES");
  }
};
function receiveConversationUsageRequest(bytes) {
  const value = parse2(bytes, conversationUsageMetadata.requestBytes);
  if (!validateRequest(value)) fail2("USAGE_REQUEST_INVALID");
  admitted.set(value, structuredClone(value));
  return value;
}
function receiveConversationUsageResponse(status, bytes, request) {
  const expected = admitted.get(request);
  if (!expected) fail2("UNADMITTED_REQUEST");
  const value = parse2(bytes, conversationUsageMetadata.responseBytes);
  if (status !== 200) {
    if (!Number.isInteger(status) || !value || Object.keys(value).length !== 1 || !value.error || Object.keys(value.error).length !== 1 || typeof value.error.code !== "string" || !Object.hasOwn(conversationUsageErrors, value.error.code) || !conversationUsageErrors[value.error.code].includes(status)) fail2("INVALID_ERROR_RESPONSE");
    return value;
  }
  if (!validateResponse(value)) fail2("INVALID_USAGE_RESPONSE");
  return assertUsageResponseSemantics(value, expected);
}
export {
  CONVERSATION_USAGE_PATH,
  CONVERSATION_USAGE_SCHEMA,
  ConversationUsageResponseError,
  USAGE_OVERVIEW_PATH,
  USAGE_OVERVIEW_SCHEMA,
  UsageOverviewResponseError,
  conversationUsageErrors,
  conversationUsageMetadata,
  receiveConversationUsageRequest,
  receiveConversationUsageResponse,
  receiveUsageOverviewRequest,
  receiveUsageOverviewResponse,
  usageCounterNames,
  usageOverviewMetadata,
  usageUnavailableReasons
};
