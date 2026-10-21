// Generated self-contained browser receiving boundary. No authority or deployment acceptance.
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

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length2, i, keys;
        if (Array.isArray(a)) {
          length2 = a.length;
          if (length2 != b.length) return false;
          for (i = length2; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length2 = keys.length;
        if (length2 !== Object.keys(b).length) return false;
        for (i = length2; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length2; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// intents-generated:./generated-validator.mjs
var validateIntentsConversationId = validate127;
var pattern4 = new RegExp("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", "u");
function validate127(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate127.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (typeof data === "string") {
      if (!pattern4.test(data)) {
        validate127.errors = [{ instancePath, schemaPath: "#/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' }];
        return false;
      }
    } else {
      validate127.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
      return false;
    }
  }
  validate127.errors = vErrors;
  return errors2 === 0;
}
validate127.evaluated = { "dynamicProps": false, "dynamicItems": false };
var validateIntentsDeliveryId = validate128;
var pattern5 = new RegExp("^sdk:[a-f0-9]{64}$", "u");
function validate128(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate128.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (typeof data === "string") {
      if (!pattern5.test(data)) {
        validate128.errors = [{ instancePath, schemaPath: "#/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
        return false;
      }
    } else {
      validate128.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
      return false;
    }
  }
  validate128.errors = vErrors;
  return errors2 === 0;
}
validate128.evaluated = { "dynamicProps": false, "dynamicItems": false };
var validateIntentsOperation = validate129;
var pattern6 = new RegExp("^[a-z][a-z_]{0,62}$", "u");
function validate129(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate129.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.id === void 0 && (missing0 = "id") || data.version === void 0 && (missing0 = "version")) {
        validate129.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "id" || key0 === "version")) {
            validate129.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.id !== void 0) {
            let data0 = data.id;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern6.test(data0)) {
                  validate129.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                  return false;
                }
              } else {
                validate129.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.version !== void 0) {
              const _errs4 = errors2;
              if ("0.2.0" !== data.version) {
                validate129.errors = [{ instancePath: instancePath + "/version", schemaPath: "#/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                return false;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate129.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate129.errors = vErrors;
  return errors2 === 0;
}
validate129.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsListRequest = validate130;
function validate130(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate130.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.conversationId === void 0 && (missing0 = "conversationId")) {
        validate130.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "conversationId" || key0 === "after" || key0 === "limit")) {
            validate130.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.conversationId !== void 0) {
            let data0 = data.conversationId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate130.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/$defs/IntentsConversationId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' }];
                  return false;
                }
              } else {
                validate130.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/$defs/IntentsConversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.after !== void 0) {
              let data1 = data.after;
              const _errs5 = errors2;
              const _errs6 = errors2;
              let valid2 = false;
              const _errs7 = errors2;
              const _errs8 = errors2;
              if (errors2 === _errs8) {
                if (typeof data1 === "string") {
                  if (!pattern5.test(data1)) {
                    const err0 = { instancePath: instancePath + "/after", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors2++;
                  }
                } else {
                  const err1 = { instancePath: instancePath + "/after", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err1];
                  } else {
                    vErrors.push(err1);
                  }
                  errors2++;
                }
              }
              var _valid0 = _errs7 === errors2;
              valid2 = valid2 || _valid0;
              const _errs10 = errors2;
              if (data1 !== null) {
                const err2 = { instancePath: instancePath + "/after", schemaPath: "#/properties/after/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors2++;
              }
              var _valid0 = _errs10 === errors2;
              valid2 = valid2 || _valid0;
              if (!valid2) {
                const err3 = { instancePath: instancePath + "/after", schemaPath: "#/properties/after/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors2++;
                validate130.errors = vErrors;
                return false;
              } else {
                errors2 = _errs6;
                if (vErrors !== null) {
                  if (_errs6) {
                    vErrors.length = _errs6;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.limit !== void 0) {
                let data2 = data.limit;
                const _errs12 = errors2;
                if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
                  validate130.errors = [{ instancePath: instancePath + "/limit", schemaPath: "#/properties/limit/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                  return false;
                }
                if (errors2 === _errs12) {
                  if (typeof data2 == "number" && isFinite(data2)) {
                    if (data2 > 50 || isNaN(data2)) {
                      validate130.errors = [{ instancePath: instancePath + "/limit", schemaPath: "#/properties/limit/maximum", keyword: "maximum", params: { comparison: "<=", limit: 50 }, message: "must be <= 50" }];
                      return false;
                    } else {
                      if (data2 < 1 || isNaN(data2)) {
                        validate130.errors = [{ instancePath: instancePath + "/limit", schemaPath: "#/properties/limit/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                        return false;
                      }
                    }
                  }
                }
                var valid0 = _errs12 === errors2;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate130.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate130.errors = vErrors;
  return errors2 === 0;
}
validate130.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsDecideRequest = validate131;
var schema43 = { "type": "object", "properties": { "conversationId": { "$ref": "#/$defs/IntentsConversationId" }, "deliveryId": { "$ref": "#/$defs/IntentsDeliveryId" }, "proposalId": { "type": "string", "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, "commandSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "decision": { "enum": ["approved", "rejected"] } }, "required": ["conversationId", "deliveryId", "proposalId", "commandSha256", "decision"], "additionalProperties": false };
var pattern12 = new RegExp("^[a-f0-9]{64}$", "u");
function validate131(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate131.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.conversationId === void 0 && (missing0 = "conversationId") || data.deliveryId === void 0 && (missing0 = "deliveryId") || data.proposalId === void 0 && (missing0 = "proposalId") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.decision === void 0 && (missing0 = "decision")) {
        validate131.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "conversationId" || key0 === "deliveryId" || key0 === "proposalId" || key0 === "commandSha256" || key0 === "decision")) {
            validate131.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.conversationId !== void 0) {
            let data0 = data.conversationId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate131.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/$defs/IntentsConversationId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' }];
                  return false;
                }
              } else {
                validate131.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/$defs/IntentsConversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.deliveryId !== void 0) {
              let data1 = data.deliveryId;
              const _errs5 = errors2;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (typeof data1 === "string") {
                  if (!pattern5.test(data1)) {
                    validate131.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                    return false;
                  }
                } else {
                  validate131.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.proposalId !== void 0) {
                let data2 = data.proposalId;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (typeof data2 === "string") {
                    if (!pattern4.test(data2)) {
                      validate131.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' }];
                      return false;
                    }
                  } else {
                    validate131.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs8 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.commandSha256 !== void 0) {
                  let data3 = data.commandSha256;
                  const _errs10 = errors2;
                  if (errors2 === _errs10) {
                    if (typeof data3 === "string") {
                      if (!pattern12.test(data3)) {
                        validate131.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                        return false;
                      }
                    } else {
                      validate131.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs10 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.decision !== void 0) {
                    let data4 = data.decision;
                    const _errs12 = errors2;
                    if (!(data4 === "approved" || data4 === "rejected")) {
                      validate131.errors = [{ instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/enum", keyword: "enum", params: { allowedValues: schema43.properties.decision.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs12 === errors2;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate131.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate131.errors = vErrors;
  return errors2 === 0;
}
validate131.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsProposal = validate132;
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var formats14 = require_formats().fullFormats["date-time"];
var schema48 = { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "commandId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, "action": { "type": "string", "enum": ["memory.propose", "task.create", "artifact.file"] }, "arguments": { "type": "object" }, "attachments": { "type": "array", "items": { "$ref": "#/$defs/Canonical_ObjectReference_a099bd1c" } }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "idempotencyKey": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["contractVersion", "commandId", "binding", "action", "arguments", "attachments", "scopes", "idempotencyKey"], "additionalProperties": false };
var schema51 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var func1 = require_ucs2length().default;
var func0 = require_equal().default;
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
      if (data.objectId === void 0 && (missing0 = "objectId") || data.versionId === void 0 && (missing0 = "versionId") || data.sha256 === void 0 && (missing0 = "sha256") || data.bytes === void 0 && (missing0 = "bytes") || data.scopes === void 0 && (missing0 = "scopes")) {
        validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "objectId" || key0 === "versionId" || key0 === "sha256" || key0 === "bytes" || key0 === "scopes")) {
            validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.objectId !== void 0) {
            let data0 = data.objectId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate33.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate33.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.versionId !== void 0) {
              let data1 = data.versionId;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) < 1) {
                    validate33.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate33.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.sha256 !== void 0) {
                let data2 = data.sha256;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (typeof data2 === "string") {
                    if (!pattern12.test(data2)) {
                      validate33.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate33.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.bytes !== void 0) {
                  let data3 = data.bytes;
                  const _errs8 = errors2;
                  if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                    validate33.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors2 === _errs8) {
                    if (typeof data3 == "number" && isFinite(data3)) {
                      if (data3 > 9007199254740991 || isNaN(data3)) {
                        validate33.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data3 < 0 || isNaN(data3)) {
                          validate33.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.scopes !== void 0) {
                    let data4 = data.scopes;
                    const _errs10 = errors2;
                    if (errors2 === _errs10) {
                      if (Array.isArray(data4)) {
                        if (data4.length < 1) {
                          validate33.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                          return false;
                        } else {
                          var valid1 = true;
                          const len0 = data4.length;
                          for (let i0 = 0; i0 < len0; i0++) {
                            let data5 = data4[i0];
                            const _errs12 = errors2;
                            const _errs13 = errors2;
                            if (errors2 === _errs13) {
                              if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                                let missing1;
                                if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.kind === void 0 && (missing1 = "kind") || data5.resourceId === void 0 && (missing1 = "resourceId") || data5.policyRevision === void 0 && (missing1 = "policyRevision")) {
                                  validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs15 = errors2;
                                  for (const key1 in data5) {
                                    if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                      validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs15 === errors2) {
                                    if (data5.tenantId !== void 0) {
                                      let data6 = data5.tenantId;
                                      const _errs16 = errors2;
                                      if (errors2 === _errs16) {
                                        if (typeof data6 === "string") {
                                          if (func1(data6) > 128) {
                                            validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                            return false;
                                          } else {
                                            if (func1(data6) < 1) {
                                              validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid3 = _errs16 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data5.kind !== void 0) {
                                        let data7 = data5.kind;
                                        const _errs18 = errors2;
                                        if (typeof data7 !== "string") {
                                          validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                        if (!(data7 === "tenant" || data7 === "client" || data7 === "mailbox" || data7 === "memory" || data7 === "document" || data7 === "private-user" || data7 === "public")) {
                                          validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema51.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                          return false;
                                        }
                                        var valid3 = _errs18 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data5.resourceId !== void 0) {
                                          let data8 = data5.resourceId;
                                          const _errs20 = errors2;
                                          if (errors2 === _errs20) {
                                            if (typeof data8 === "string") {
                                              if (func1(data8) > 256) {
                                                validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                return false;
                                              } else {
                                                if (func1(data8) < 1) {
                                                  validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid3 = _errs20 === errors2;
                                        } else {
                                          var valid3 = true;
                                        }
                                        if (valid3) {
                                          if (data5.policyRevision !== void 0) {
                                            let data9 = data5.policyRevision;
                                            const _errs22 = errors2;
                                            if (errors2 === _errs22) {
                                              if (typeof data9 === "string") {
                                                if (func1(data9) > 128) {
                                                  validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                  return false;
                                                } else {
                                                  if (func1(data9) < 1) {
                                                    validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid3 = _errs22 === errors2;
                                          } else {
                                            var valid3 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid1 = _errs12 === errors2;
                            if (!valid1) {
                              break;
                            }
                          }
                          if (valid1) {
                            let i1 = data4.length;
                            let j0;
                            if (i1 > 1) {
                              outer0: for (; i1--; ) {
                                for (j0 = i1; j0--; ) {
                                  if (func0(data4[i1], data4[j0])) {
                                    validate33.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                    return false;
                                    break outer0;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate33.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid0 = _errs10 === errors2;
                  } else {
                    var valid0 = true;
                  }
                }
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
function validate32(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.commandId === void 0 && (missing0 = "commandId") || data.binding === void 0 && (missing0 = "binding") || data.action === void 0 && (missing0 = "action") || data.arguments === void 0 && (missing0 = "arguments") || data.attachments === void 0 && (missing0 = "attachments") || data.scopes === void 0 && (missing0 = "scopes") || data.idempotencyKey === void 0 && (missing0 = "idempotencyKey")) {
        validate32.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "contractVersion" || key0 === "commandId" || key0 === "binding" || key0 === "action" || key0 === "arguments" || key0 === "attachments" || key0 === "scopes" || key0 === "idempotencyKey")) {
            validate32.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.1.0" !== data.contractVersion) {
              validate32.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.commandId !== void 0) {
              let data1 = data.commandId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate32.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate32.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.binding !== void 0) {
                let data2 = data.binding;
                const _errs5 = errors2;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.attemptId === void 0 && (missing1 = "attemptId") || data2.workerId === void 0 && (missing1 = "workerId") || data2.writerFence === void 0 && (missing1 = "writerFence")) {
                      validate32.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs8 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                          validate32.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs8 === errors2) {
                        if (data2.tenantId !== void 0) {
                          let data3 = data2.tenantId;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 128) {
                                validate32.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate32.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate32.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs9 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data2.actorId !== void 0) {
                            let data4 = data2.actorId;
                            const _errs11 = errors2;
                            if (errors2 === _errs11) {
                              if (typeof data4 === "string") {
                                if (func1(data4) > 128) {
                                  validate32.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                  return false;
                                } else {
                                  if (func1(data4) < 1) {
                                    validate32.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate32.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                            var valid2 = _errs11 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data2.conversationId !== void 0) {
                              let data5 = data2.conversationId;
                              const _errs13 = errors2;
                              if (errors2 === _errs13) {
                                if (errors2 === _errs13) {
                                  if (typeof data5 === "string") {
                                    if (!formats0.test(data5)) {
                                      validate32.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate32.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid2 = _errs13 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data2.runId !== void 0) {
                                let data6 = data2.runId;
                                const _errs15 = errors2;
                                if (errors2 === _errs15) {
                                  if (errors2 === _errs15) {
                                    if (typeof data6 === "string") {
                                      if (!formats0.test(data6)) {
                                        validate32.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate32.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid2 = _errs15 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data2.attemptId !== void 0) {
                                  let data7 = data2.attemptId;
                                  const _errs17 = errors2;
                                  if (errors2 === _errs17) {
                                    if (errors2 === _errs17) {
                                      if (typeof data7 === "string") {
                                        if (!formats0.test(data7)) {
                                          validate32.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate32.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid2 = _errs17 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data2.workerId !== void 0) {
                                    let data8 = data2.workerId;
                                    const _errs19 = errors2;
                                    if (errors2 === _errs19) {
                                      if (errors2 === _errs19) {
                                        if (typeof data8 === "string") {
                                          if (!formats0.test(data8)) {
                                            validate32.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate32.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid2 = _errs19 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data2.writerFence !== void 0) {
                                      let data9 = data2.writerFence;
                                      const _errs21 = errors2;
                                      if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                                        validate32.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs21) {
                                        if (typeof data9 == "number" && isFinite(data9)) {
                                          if (data9 > 9007199254740991 || isNaN(data9)) {
                                            validate32.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data9 < 1 || isNaN(data9)) {
                                              validate32.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid2 = _errs21 === errors2;
                                    } else {
                                      var valid2 = true;
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
                    validate32.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.action !== void 0) {
                  let data10 = data.action;
                  const _errs23 = errors2;
                  if (typeof data10 !== "string") {
                    validate32.errors = [{ instancePath: instancePath + "/action", schemaPath: "#/properties/action/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                  if (!(data10 === "memory.propose" || data10 === "task.create" || data10 === "artifact.file")) {
                    validate32.errors = [{ instancePath: instancePath + "/action", schemaPath: "#/properties/action/enum", keyword: "enum", params: { allowedValues: schema48.properties.action.enum }, message: "must be equal to one of the allowed values" }];
                    return false;
                  }
                  var valid0 = _errs23 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.arguments !== void 0) {
                    let data11 = data.arguments;
                    const _errs25 = errors2;
                    if (!(data11 && typeof data11 == "object" && !Array.isArray(data11))) {
                      validate32.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/properties/arguments/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                      return false;
                    }
                    var valid0 = _errs25 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.attachments !== void 0) {
                      let data12 = data.attachments;
                      const _errs27 = errors2;
                      if (errors2 === _errs27) {
                        if (Array.isArray(data12)) {
                          var valid3 = true;
                          const len0 = data12.length;
                          for (let i0 = 0; i0 < len0; i0++) {
                            const _errs29 = errors2;
                            if (!validate33(data12[i0], { instancePath: instancePath + "/attachments/" + i0, parentData: data12, parentDataProperty: i0, rootData, dynamicAnchors })) {
                              vErrors = vErrors === null ? validate33.errors : vErrors.concat(validate33.errors);
                              errors2 = vErrors.length;
                            }
                            var valid3 = _errs29 === errors2;
                            if (!valid3) {
                              break;
                            }
                          }
                        } else {
                          validate32.errors = [{ instancePath: instancePath + "/attachments", schemaPath: "#/properties/attachments/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                          return false;
                        }
                      }
                      var valid0 = _errs27 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.scopes !== void 0) {
                        let data14 = data.scopes;
                        const _errs30 = errors2;
                        if (errors2 === _errs30) {
                          if (Array.isArray(data14)) {
                            if (data14.length < 1) {
                              validate32.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                              return false;
                            } else {
                              var valid4 = true;
                              const len1 = data14.length;
                              for (let i1 = 0; i1 < len1; i1++) {
                                let data15 = data14[i1];
                                const _errs32 = errors2;
                                const _errs33 = errors2;
                                if (errors2 === _errs33) {
                                  if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
                                    let missing2;
                                    if (data15.tenantId === void 0 && (missing2 = "tenantId") || data15.kind === void 0 && (missing2 = "kind") || data15.resourceId === void 0 && (missing2 = "resourceId") || data15.policyRevision === void 0 && (missing2 = "policyRevision")) {
                                      validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                      return false;
                                    } else {
                                      const _errs35 = errors2;
                                      for (const key2 in data15) {
                                        if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                          validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs35 === errors2) {
                                        if (data15.tenantId !== void 0) {
                                          let data16 = data15.tenantId;
                                          const _errs36 = errors2;
                                          if (errors2 === _errs36) {
                                            if (typeof data16 === "string") {
                                              if (func1(data16) > 128) {
                                                validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                return false;
                                              } else {
                                                if (func1(data16) < 1) {
                                                  validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid6 = _errs36 === errors2;
                                        } else {
                                          var valid6 = true;
                                        }
                                        if (valid6) {
                                          if (data15.kind !== void 0) {
                                            let data17 = data15.kind;
                                            const _errs38 = errors2;
                                            if (typeof data17 !== "string") {
                                              validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                            if (!(data17 === "tenant" || data17 === "client" || data17 === "mailbox" || data17 === "memory" || data17 === "document" || data17 === "private-user" || data17 === "public")) {
                                              validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema51.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                              return false;
                                            }
                                            var valid6 = _errs38 === errors2;
                                          } else {
                                            var valid6 = true;
                                          }
                                          if (valid6) {
                                            if (data15.resourceId !== void 0) {
                                              let data18 = data15.resourceId;
                                              const _errs40 = errors2;
                                              if (errors2 === _errs40) {
                                                if (typeof data18 === "string") {
                                                  if (func1(data18) > 256) {
                                                    validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data18) < 1) {
                                                      validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid6 = _errs40 === errors2;
                                            } else {
                                              var valid6 = true;
                                            }
                                            if (valid6) {
                                              if (data15.policyRevision !== void 0) {
                                                let data19 = data15.policyRevision;
                                                const _errs42 = errors2;
                                                if (errors2 === _errs42) {
                                                  if (typeof data19 === "string") {
                                                    if (func1(data19) > 128) {
                                                      validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                      return false;
                                                    } else {
                                                      if (func1(data19) < 1) {
                                                        validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid6 = _errs42 === errors2;
                                              } else {
                                                var valid6 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate32.errors = [{ instancePath: instancePath + "/scopes/" + i1, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                    return false;
                                  }
                                }
                                var valid4 = _errs32 === errors2;
                                if (!valid4) {
                                  break;
                                }
                              }
                              if (valid4) {
                                let i2 = data14.length;
                                let j0;
                                if (i2 > 1) {
                                  outer0: for (; i2--; ) {
                                    for (j0 = i2; j0--; ) {
                                      if (func0(data14[i2], data14[j0])) {
                                        validate32.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i2, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)" }];
                                        return false;
                                        break outer0;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate32.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                            return false;
                          }
                        }
                        var valid0 = _errs30 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.idempotencyKey !== void 0) {
                          let data20 = data.idempotencyKey;
                          const _errs44 = errors2;
                          if (errors2 === _errs44) {
                            if (typeof data20 === "string") {
                              if (func1(data20) > 128) {
                                validate32.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data20) < 1) {
                                  validate32.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate32.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid0 = _errs44 === errors2;
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
      validate32.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate32.errors = vErrors;
  return errors2 === 0;
}
validate32.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern15 = new RegExp("Z$", "u");
function validate132(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate132.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.proposalId === void 0 && (missing0 = "proposalId") || data.command === void 0 && (missing0 = "command") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.createdAt === void 0 && (missing0 = "createdAt") || data.expiresAt === void 0 && (missing0 = "expiresAt") || data.requiredApprover === void 0 && (missing0 = "requiredApprover")) {
        validate132.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "proposalId" || key0 === "command" || key0 === "commandSha256" || key0 === "createdAt" || key0 === "expiresAt" || key0 === "requiredApprover")) {
            validate132.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.proposalId !== void 0) {
            let data0 = data.proposalId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate132.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate132.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.command !== void 0) {
              const _errs4 = errors2;
              if (!validate32(data.command, { instancePath: instancePath + "/command", parentData: data, parentDataProperty: "command", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.commandSha256 !== void 0) {
                let data2 = data.commandSha256;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (typeof data2 === "string") {
                    if (!pattern12.test(data2)) {
                      validate132.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate132.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.createdAt !== void 0) {
                  let data3 = data.createdAt;
                  const _errs7 = errors2;
                  if (errors2 === _errs7) {
                    if (errors2 === _errs7) {
                      if (typeof data3 === "string") {
                        if (!pattern15.test(data3)) {
                          validate132.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats14.validate(data3)) {
                            validate132.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate132.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.expiresAt !== void 0) {
                    let data4 = data.expiresAt;
                    const _errs9 = errors2;
                    if (errors2 === _errs9) {
                      if (errors2 === _errs9) {
                        if (typeof data4 === "string") {
                          if (!pattern15.test(data4)) {
                            validate132.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                            return false;
                          } else {
                            if (!formats14.validate(data4)) {
                              validate132.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                              return false;
                            }
                          }
                        } else {
                          validate132.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs9 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.requiredApprover !== void 0) {
                      let data5 = data.requiredApprover;
                      const _errs11 = errors2;
                      const _errs12 = errors2;
                      if (errors2 === _errs12) {
                        if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                          let missing1;
                          if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.actorId === void 0 && (missing1 = "actorId")) {
                            validate132.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                            return false;
                          } else {
                            const _errs14 = errors2;
                            for (const key1 in data5) {
                              if (!(key1 === "tenantId" || key1 === "actorId")) {
                                validate132.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs14 === errors2) {
                              if (data5.tenantId !== void 0) {
                                let data6 = data5.tenantId;
                                const _errs15 = errors2;
                                if (errors2 === _errs15) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate132.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate132.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate132.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs15 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data5.actorId !== void 0) {
                                  let data7 = data5.actorId;
                                  const _errs17 = errors2;
                                  if (errors2 === _errs17) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 128) {
                                        validate132.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func1(data7) < 1) {
                                          validate132.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate132.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid2 = _errs17 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        } else {
                          validate132.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs11 === errors2;
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
      validate132.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate132.errors = vErrors;
  return errors2 === 0;
}
validate132.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsDecision = validate134;
var schema55 = { "type": "object", "properties": { "proposalId": { "type": "string", "format": "uuid" }, "commandSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "decision": { "type": "string", "enum": ["approved", "rejected"] }, "decidedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "expiresAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "approver": { "$ref": "#/$defs/Canonical_Identity_aba0a4e9" }, "policyRevision": { "type": "string", "minLength": 1 } }, "required": ["proposalId", "commandSha256", "decision", "decidedAt", "expiresAt", "approver", "policyRevision"], "additionalProperties": false };
function validate134(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate134.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.proposalId === void 0 && (missing0 = "proposalId") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.decision === void 0 && (missing0 = "decision") || data.decidedAt === void 0 && (missing0 = "decidedAt") || data.expiresAt === void 0 && (missing0 = "expiresAt") || data.approver === void 0 && (missing0 = "approver") || data.policyRevision === void 0 && (missing0 = "policyRevision")) {
        validate134.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "proposalId" || key0 === "commandSha256" || key0 === "decision" || key0 === "decidedAt" || key0 === "expiresAt" || key0 === "approver" || key0 === "policyRevision")) {
            validate134.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.proposalId !== void 0) {
            let data0 = data.proposalId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate134.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate134.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.commandSha256 !== void 0) {
              let data1 = data.commandSha256;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (!pattern12.test(data1)) {
                    validate134.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                    return false;
                  }
                } else {
                  validate134.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.decision !== void 0) {
                let data2 = data.decision;
                const _errs6 = errors2;
                if (typeof data2 !== "string") {
                  validate134.errors = [{ instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
                if (!(data2 === "approved" || data2 === "rejected")) {
                  validate134.errors = [{ instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/enum", keyword: "enum", params: { allowedValues: schema55.properties.decision.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.decidedAt !== void 0) {
                  let data3 = data.decidedAt;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (errors2 === _errs8) {
                      if (typeof data3 === "string") {
                        if (!pattern15.test(data3)) {
                          validate134.errors = [{ instancePath: instancePath + "/decidedAt", schemaPath: "#/properties/decidedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats14.validate(data3)) {
                            validate134.errors = [{ instancePath: instancePath + "/decidedAt", schemaPath: "#/properties/decidedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate134.errors = [{ instancePath: instancePath + "/decidedAt", schemaPath: "#/properties/decidedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.expiresAt !== void 0) {
                    let data4 = data.expiresAt;
                    const _errs10 = errors2;
                    if (errors2 === _errs10) {
                      if (errors2 === _errs10) {
                        if (typeof data4 === "string") {
                          if (!pattern15.test(data4)) {
                            validate134.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                            return false;
                          } else {
                            if (!formats14.validate(data4)) {
                              validate134.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                              return false;
                            }
                          }
                        } else {
                          validate134.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs10 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.approver !== void 0) {
                      let data5 = data.approver;
                      const _errs12 = errors2;
                      const _errs13 = errors2;
                      if (errors2 === _errs13) {
                        if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                          let missing1;
                          if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.actorId === void 0 && (missing1 = "actorId")) {
                            validate134.errors = [{ instancePath: instancePath + "/approver", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                            return false;
                          } else {
                            const _errs15 = errors2;
                            for (const key1 in data5) {
                              if (!(key1 === "tenantId" || key1 === "actorId")) {
                                validate134.errors = [{ instancePath: instancePath + "/approver", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs15 === errors2) {
                              if (data5.tenantId !== void 0) {
                                let data6 = data5.tenantId;
                                const _errs16 = errors2;
                                if (errors2 === _errs16) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate134.errors = [{ instancePath: instancePath + "/approver/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate134.errors = [{ instancePath: instancePath + "/approver/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate134.errors = [{ instancePath: instancePath + "/approver/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs16 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data5.actorId !== void 0) {
                                  let data7 = data5.actorId;
                                  const _errs18 = errors2;
                                  if (errors2 === _errs18) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 128) {
                                        validate134.errors = [{ instancePath: instancePath + "/approver/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func1(data7) < 1) {
                                          validate134.errors = [{ instancePath: instancePath + "/approver/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate134.errors = [{ instancePath: instancePath + "/approver/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid2 = _errs18 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        } else {
                          validate134.errors = [{ instancePath: instancePath + "/approver", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs12 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.policyRevision !== void 0) {
                        let data8 = data.policyRevision;
                        const _errs20 = errors2;
                        if (errors2 === _errs20) {
                          if (typeof data8 === "string") {
                            if (func1(data8) < 1) {
                              validate134.errors = [{ instancePath: instancePath + "/policyRevision", schemaPath: "#/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                              return false;
                            }
                          } else {
                            validate134.errors = [{ instancePath: instancePath + "/policyRevision", schemaPath: "#/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid0 = _errs20 === errors2;
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
    } else {
      validate134.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate134.errors = vErrors;
  return errors2 === 0;
}
validate134.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsTaskCreateArguments = validate135;
var pattern20 = new RegExp("^\\d{4}-\\d{2}-\\d{2}T00:00:00\\.000Z$", "u");
function validate135(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate135.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.title === void 0 && (missing0 = "title") || data.clientId === void 0 && (missing0 = "clientId") || data.dueDate === void 0 && (missing0 = "dueDate")) {
        validate135.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "title" || key0 === "clientId" || key0 === "dueDate")) {
            validate135.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.title !== void 0) {
            let data0 = data.title;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (func1(data0) > 240) {
                  validate135.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/maxLength", keyword: "maxLength", params: { limit: 240 }, message: "must NOT have more than 240 characters" }];
                  return false;
                } else {
                  if (func1(data0) < 1) {
                    validate135.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                }
              } else {
                validate135.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.clientId !== void 0) {
              let data1 = data.clientId;
              const _errs4 = errors2;
              const _errs5 = errors2;
              let valid1 = false;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (errors2 === _errs6) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      const err0 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors2++;
                    }
                  } else {
                    const err1 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err1];
                    } else {
                      vErrors.push(err1);
                    }
                    errors2++;
                  }
                }
              }
              var _valid0 = _errs6 === errors2;
              valid1 = valid1 || _valid0;
              const _errs8 = errors2;
              if (data1 !== null) {
                const err2 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors2++;
              }
              var _valid0 = _errs8 === errors2;
              valid1 = valid1 || _valid0;
              if (!valid1) {
                const err3 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors2++;
                validate135.errors = vErrors;
                return false;
              } else {
                errors2 = _errs5;
                if (vErrors !== null) {
                  if (_errs5) {
                    vErrors.length = _errs5;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.dueDate !== void 0) {
                let data2 = data.dueDate;
                const _errs10 = errors2;
                const _errs11 = errors2;
                let valid2 = false;
                const _errs12 = errors2;
                if (errors2 === _errs12) {
                  if (errors2 === _errs12) {
                    if (typeof data2 === "string") {
                      if (!pattern20.test(data2)) {
                        const err4 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T00:00:00\\.000Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T00:00:00\\.000Z$"' };
                        if (vErrors === null) {
                          vErrors = [err4];
                        } else {
                          vErrors.push(err4);
                        }
                        errors2++;
                      } else {
                        if (!formats14.validate(data2)) {
                          const err5 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                          if (vErrors === null) {
                            vErrors = [err5];
                          } else {
                            vErrors.push(err5);
                          }
                          errors2++;
                        }
                      }
                    } else {
                      const err6 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors2++;
                    }
                  }
                }
                var _valid1 = _errs12 === errors2;
                valid2 = valid2 || _valid1;
                const _errs14 = errors2;
                if (data2 !== null) {
                  const err7 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err7];
                  } else {
                    vErrors.push(err7);
                  }
                  errors2++;
                }
                var _valid1 = _errs14 === errors2;
                valid2 = valid2 || _valid1;
                if (!valid2) {
                  const err8 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err8];
                  } else {
                    vErrors.push(err8);
                  }
                  errors2++;
                  validate135.errors = vErrors;
                  return false;
                } else {
                  errors2 = _errs11;
                  if (vErrors !== null) {
                    if (_errs11) {
                      vErrors.length = _errs11;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid0 = _errs10 === errors2;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate135.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate135.errors = vErrors;
  return errors2 === 0;
}
validate135.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsExecutionOutcome = validate136;
var schema61 = { "type": "object", "properties": { "receiptId": { "type": "string", "format": "uuid" }, "commandId": { "type": "string", "format": "uuid" }, "commandSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "idempotencyKey": { "type": "string", "minLength": 1 }, "binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, "outcome": { "type": "string", "enum": ["succeeded", "denied", "failed", "indeterminate"] }, "sourceTransactionId": { "anyOf": [{ "type": "string", "minLength": 1 }, { "type": "null" }] }, "completedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "authorizationDecisionId": { "type": "string", "format": "uuid" } }, "required": ["receiptId", "commandId", "commandSha256", "idempotencyKey", "binding", "outcome", "sourceTransactionId", "completedAt", "scopes", "authorizationDecisionId"], "additionalProperties": false };
var func33 = Object.prototype.hasOwnProperty;
function validate43(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate43.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.receiptId === void 0 && (missing0 = "receiptId") || data.commandId === void 0 && (missing0 = "commandId") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.idempotencyKey === void 0 && (missing0 = "idempotencyKey") || data.binding === void 0 && (missing0 = "binding") || data.outcome === void 0 && (missing0 = "outcome") || data.sourceTransactionId === void 0 && (missing0 = "sourceTransactionId") || data.completedAt === void 0 && (missing0 = "completedAt") || data.scopes === void 0 && (missing0 = "scopes") || data.authorizationDecisionId === void 0 && (missing0 = "authorizationDecisionId")) {
        validate43.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func33.call(schema61.properties, key0)) {
            validate43.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.receiptId !== void 0) {
            let data0 = data.receiptId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate43.errors = [{ instancePath: instancePath + "/receiptId", schemaPath: "#/properties/receiptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate43.errors = [{ instancePath: instancePath + "/receiptId", schemaPath: "#/properties/receiptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.commandId !== void 0) {
              let data1 = data.commandId;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (errors2 === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate43.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate43.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.commandSha256 !== void 0) {
                let data2 = data.commandSha256;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (typeof data2 === "string") {
                    if (!pattern12.test(data2)) {
                      validate43.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate43.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.idempotencyKey !== void 0) {
                  let data3 = data.idempotencyKey;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (typeof data3 === "string") {
                      if (func1(data3) < 1) {
                        validate43.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                        return false;
                      }
                    } else {
                      validate43.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.binding !== void 0) {
                    let data4 = data.binding;
                    const _errs10 = errors2;
                    const _errs11 = errors2;
                    if (errors2 === _errs11) {
                      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                        let missing1;
                        if (data4.tenantId === void 0 && (missing1 = "tenantId") || data4.actorId === void 0 && (missing1 = "actorId") || data4.conversationId === void 0 && (missing1 = "conversationId") || data4.runId === void 0 && (missing1 = "runId") || data4.attemptId === void 0 && (missing1 = "attemptId") || data4.workerId === void 0 && (missing1 = "workerId") || data4.writerFence === void 0 && (missing1 = "writerFence")) {
                          validate43.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                          return false;
                        } else {
                          const _errs13 = errors2;
                          for (const key1 in data4) {
                            if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                              validate43.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                              return false;
                              break;
                            }
                          }
                          if (_errs13 === errors2) {
                            if (data4.tenantId !== void 0) {
                              let data5 = data4.tenantId;
                              const _errs14 = errors2;
                              if (errors2 === _errs14) {
                                if (typeof data5 === "string") {
                                  if (func1(data5) > 128) {
                                    validate43.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                    return false;
                                  } else {
                                    if (func1(data5) < 1) {
                                      validate43.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate43.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid2 = _errs14 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data4.actorId !== void 0) {
                                let data6 = data4.actorId;
                                const _errs16 = errors2;
                                if (errors2 === _errs16) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate43.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate43.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate43.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs16 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data4.conversationId !== void 0) {
                                  let data7 = data4.conversationId;
                                  const _errs18 = errors2;
                                  if (errors2 === _errs18) {
                                    if (errors2 === _errs18) {
                                      if (typeof data7 === "string") {
                                        if (!formats0.test(data7)) {
                                          validate43.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate43.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid2 = _errs18 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data4.runId !== void 0) {
                                    let data8 = data4.runId;
                                    const _errs20 = errors2;
                                    if (errors2 === _errs20) {
                                      if (errors2 === _errs20) {
                                        if (typeof data8 === "string") {
                                          if (!formats0.test(data8)) {
                                            validate43.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate43.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid2 = _errs20 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data4.attemptId !== void 0) {
                                      let data9 = data4.attemptId;
                                      const _errs22 = errors2;
                                      if (errors2 === _errs22) {
                                        if (errors2 === _errs22) {
                                          if (typeof data9 === "string") {
                                            if (!formats0.test(data9)) {
                                              validate43.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                              return false;
                                            }
                                          } else {
                                            validate43.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                      }
                                      var valid2 = _errs22 === errors2;
                                    } else {
                                      var valid2 = true;
                                    }
                                    if (valid2) {
                                      if (data4.workerId !== void 0) {
                                        let data10 = data4.workerId;
                                        const _errs24 = errors2;
                                        if (errors2 === _errs24) {
                                          if (errors2 === _errs24) {
                                            if (typeof data10 === "string") {
                                              if (!formats0.test(data10)) {
                                                validate43.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                return false;
                                              }
                                            } else {
                                              validate43.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                        }
                                        var valid2 = _errs24 === errors2;
                                      } else {
                                        var valid2 = true;
                                      }
                                      if (valid2) {
                                        if (data4.writerFence !== void 0) {
                                          let data11 = data4.writerFence;
                                          const _errs26 = errors2;
                                          if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                            validate43.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs26) {
                                            if (typeof data11 == "number" && isFinite(data11)) {
                                              if (data11 > 9007199254740991 || isNaN(data11)) {
                                                validate43.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data11 < 1 || isNaN(data11)) {
                                                  validate43.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid2 = _errs26 === errors2;
                                        } else {
                                          var valid2 = true;
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
                        validate43.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid0 = _errs10 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.outcome !== void 0) {
                      let data12 = data.outcome;
                      const _errs28 = errors2;
                      if (typeof data12 !== "string") {
                        validate43.errors = [{ instancePath: instancePath + "/outcome", schemaPath: "#/properties/outcome/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data12 === "succeeded" || data12 === "denied" || data12 === "failed" || data12 === "indeterminate")) {
                        validate43.errors = [{ instancePath: instancePath + "/outcome", schemaPath: "#/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema61.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid0 = _errs28 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.sourceTransactionId !== void 0) {
                        let data13 = data.sourceTransactionId;
                        const _errs30 = errors2;
                        const _errs31 = errors2;
                        let valid3 = false;
                        const _errs32 = errors2;
                        if (errors2 === _errs32) {
                          if (typeof data13 === "string") {
                            if (func1(data13) < 1) {
                              const err0 = { instancePath: instancePath + "/sourceTransactionId", schemaPath: "#/properties/sourceTransactionId/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err0];
                              } else {
                                vErrors.push(err0);
                              }
                              errors2++;
                            }
                          } else {
                            const err1 = { instancePath: instancePath + "/sourceTransactionId", schemaPath: "#/properties/sourceTransactionId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err1];
                            } else {
                              vErrors.push(err1);
                            }
                            errors2++;
                          }
                        }
                        var _valid0 = _errs32 === errors2;
                        valid3 = valid3 || _valid0;
                        const _errs34 = errors2;
                        if (data13 !== null) {
                          const err2 = { instancePath: instancePath + "/sourceTransactionId", schemaPath: "#/properties/sourceTransactionId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors2++;
                        }
                        var _valid0 = _errs34 === errors2;
                        valid3 = valid3 || _valid0;
                        if (!valid3) {
                          const err3 = { instancePath: instancePath + "/sourceTransactionId", schemaPath: "#/properties/sourceTransactionId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                          if (vErrors === null) {
                            vErrors = [err3];
                          } else {
                            vErrors.push(err3);
                          }
                          errors2++;
                          validate43.errors = vErrors;
                          return false;
                        } else {
                          errors2 = _errs31;
                          if (vErrors !== null) {
                            if (_errs31) {
                              vErrors.length = _errs31;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs30 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.completedAt !== void 0) {
                          let data14 = data.completedAt;
                          const _errs36 = errors2;
                          if (errors2 === _errs36) {
                            if (errors2 === _errs36) {
                              if (typeof data14 === "string") {
                                if (!pattern15.test(data14)) {
                                  validate43.errors = [{ instancePath: instancePath + "/completedAt", schemaPath: "#/properties/completedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                  return false;
                                } else {
                                  if (!formats14.validate(data14)) {
                                    validate43.errors = [{ instancePath: instancePath + "/completedAt", schemaPath: "#/properties/completedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                    return false;
                                  }
                                }
                              } else {
                                validate43.errors = [{ instancePath: instancePath + "/completedAt", schemaPath: "#/properties/completedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                          }
                          var valid0 = _errs36 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.scopes !== void 0) {
                            let data15 = data.scopes;
                            const _errs38 = errors2;
                            if (errors2 === _errs38) {
                              if (Array.isArray(data15)) {
                                if (data15.length < 1) {
                                  validate43.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                  return false;
                                } else {
                                  var valid4 = true;
                                  const len0 = data15.length;
                                  for (let i0 = 0; i0 < len0; i0++) {
                                    let data16 = data15[i0];
                                    const _errs40 = errors2;
                                    const _errs41 = errors2;
                                    if (errors2 === _errs41) {
                                      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
                                        let missing2;
                                        if (data16.tenantId === void 0 && (missing2 = "tenantId") || data16.kind === void 0 && (missing2 = "kind") || data16.resourceId === void 0 && (missing2 = "resourceId") || data16.policyRevision === void 0 && (missing2 = "policyRevision")) {
                                          validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                          return false;
                                        } else {
                                          const _errs43 = errors2;
                                          for (const key2 in data16) {
                                            if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                              validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                              return false;
                                              break;
                                            }
                                          }
                                          if (_errs43 === errors2) {
                                            if (data16.tenantId !== void 0) {
                                              let data17 = data16.tenantId;
                                              const _errs44 = errors2;
                                              if (errors2 === _errs44) {
                                                if (typeof data17 === "string") {
                                                  if (func1(data17) > 128) {
                                                    validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data17) < 1) {
                                                      validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid6 = _errs44 === errors2;
                                            } else {
                                              var valid6 = true;
                                            }
                                            if (valid6) {
                                              if (data16.kind !== void 0) {
                                                let data18 = data16.kind;
                                                const _errs46 = errors2;
                                                if (typeof data18 !== "string") {
                                                  validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                                if (!(data18 === "tenant" || data18 === "client" || data18 === "mailbox" || data18 === "memory" || data18 === "document" || data18 === "private-user" || data18 === "public")) {
                                                  validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema51.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                                  return false;
                                                }
                                                var valid6 = _errs46 === errors2;
                                              } else {
                                                var valid6 = true;
                                              }
                                              if (valid6) {
                                                if (data16.resourceId !== void 0) {
                                                  let data19 = data16.resourceId;
                                                  const _errs48 = errors2;
                                                  if (errors2 === _errs48) {
                                                    if (typeof data19 === "string") {
                                                      if (func1(data19) > 256) {
                                                        validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func1(data19) < 1) {
                                                          validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid6 = _errs48 === errors2;
                                                } else {
                                                  var valid6 = true;
                                                }
                                                if (valid6) {
                                                  if (data16.policyRevision !== void 0) {
                                                    let data20 = data16.policyRevision;
                                                    const _errs50 = errors2;
                                                    if (errors2 === _errs50) {
                                                      if (typeof data20 === "string") {
                                                        if (func1(data20) > 128) {
                                                          validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                          return false;
                                                        } else {
                                                          if (func1(data20) < 1) {
                                                            validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          }
                                                        }
                                                      } else {
                                                        validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid6 = _errs50 === errors2;
                                                  } else {
                                                    var valid6 = true;
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      } else {
                                        validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                      }
                                    }
                                    var valid4 = _errs40 === errors2;
                                    if (!valid4) {
                                      break;
                                    }
                                  }
                                  if (valid4) {
                                    let i1 = data15.length;
                                    let j0;
                                    if (i1 > 1) {
                                      outer0: for (; i1--; ) {
                                        for (j0 = i1; j0--; ) {
                                          if (func0(data15[i1], data15[j0])) {
                                            validate43.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                            return false;
                                            break outer0;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate43.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                return false;
                              }
                            }
                            var valid0 = _errs38 === errors2;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.authorizationDecisionId !== void 0) {
                              let data21 = data.authorizationDecisionId;
                              const _errs52 = errors2;
                              if (errors2 === _errs52) {
                                if (errors2 === _errs52) {
                                  if (typeof data21 === "string") {
                                    if (!formats0.test(data21)) {
                                      validate43.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate43.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid0 = _errs52 === errors2;
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
        }
      }
    } else {
      validate43.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate43.errors = vErrors;
  return errors2 === 0;
}
validate43.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern24 = new RegExp("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$", "u");
function validate136(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate136.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.receipt === void 0 && (missing0 = "receipt") || data.result === void 0 && (missing0 = "result")) {
        validate136.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "receipt" || key0 === "result")) {
            validate136.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.receipt !== void 0) {
            const _errs2 = errors2;
            if (!validate43(data.receipt, { instancePath: instancePath + "/receipt", parentData: data, parentDataProperty: "receipt", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
              errors2 = vErrors.length;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.result !== void 0) {
              let data1 = data.result;
              const _errs3 = errors2;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.id === void 0 && (missing1 = "id") || data1.title === void 0 && (missing1 = "title") || data1.status === void 0 && (missing1 = "status") || data1.dueDate === void 0 && (missing1 = "dueDate") || data1.clientId === void 0 && (missing1 = "clientId") || data1.createdAt === void 0 && (missing1 = "createdAt")) {
                    validate136.errors = [{ instancePath: instancePath + "/result", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs6 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "id" || key1 === "title" || key1 === "status" || key1 === "dueDate" || key1 === "clientId" || key1 === "createdAt")) {
                        validate136.errors = [{ instancePath: instancePath + "/result", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors2) {
                      if (data1.id !== void 0) {
                        let data2 = data1.id;
                        const _errs7 = errors2;
                        if (errors2 === _errs7) {
                          if (errors2 === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats0.test(data2)) {
                                validate136.errors = [{ instancePath: instancePath + "/result/id", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/id/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                return false;
                              }
                            } else {
                              validate136.errors = [{ instancePath: instancePath + "/result/id", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.title !== void 0) {
                          let data3 = data1.title;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 240) {
                                validate136.errors = [{ instancePath: instancePath + "/result/title", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/title/maxLength", keyword: "maxLength", params: { limit: 240 }, message: "must NOT have more than 240 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate136.errors = [{ instancePath: instancePath + "/result/title", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate136.errors = [{ instancePath: instancePath + "/result/title", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs9 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.status !== void 0) {
                            const _errs11 = errors2;
                            if ("todo" !== data1.status) {
                              validate136.errors = [{ instancePath: instancePath + "/result/status", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/status/const", keyword: "const", params: { allowedValue: "todo" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid2 = _errs11 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.dueDate !== void 0) {
                              let data5 = data1.dueDate;
                              const _errs12 = errors2;
                              const _errs13 = errors2;
                              let valid3 = false;
                              const _errs14 = errors2;
                              if (errors2 === _errs14) {
                                if (errors2 === _errs14) {
                                  if (typeof data5 === "string") {
                                    if (!pattern20.test(data5)) {
                                      const err0 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T00:00:00\\.000Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T00:00:00\\.000Z$"' };
                                      if (vErrors === null) {
                                        vErrors = [err0];
                                      } else {
                                        vErrors.push(err0);
                                      }
                                      errors2++;
                                    } else {
                                      if (!formats14.validate(data5)) {
                                        const err1 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                        if (vErrors === null) {
                                          vErrors = [err1];
                                        } else {
                                          vErrors.push(err1);
                                        }
                                        errors2++;
                                      }
                                    }
                                  } else {
                                    const err2 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err2];
                                    } else {
                                      vErrors.push(err2);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                              var _valid0 = _errs14 === errors2;
                              valid3 = valid3 || _valid0;
                              const _errs16 = errors2;
                              if (data5 !== null) {
                                const err3 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                if (vErrors === null) {
                                  vErrors = [err3];
                                } else {
                                  vErrors.push(err3);
                                }
                                errors2++;
                              }
                              var _valid0 = _errs16 === errors2;
                              valid3 = valid3 || _valid0;
                              if (!valid3) {
                                const err4 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                if (vErrors === null) {
                                  vErrors = [err4];
                                } else {
                                  vErrors.push(err4);
                                }
                                errors2++;
                                validate136.errors = vErrors;
                                return false;
                              } else {
                                errors2 = _errs13;
                                if (vErrors !== null) {
                                  if (_errs13) {
                                    vErrors.length = _errs13;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var valid2 = _errs12 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.clientId !== void 0) {
                                let data6 = data1.clientId;
                                const _errs18 = errors2;
                                const _errs19 = errors2;
                                let valid4 = false;
                                const _errs20 = errors2;
                                if (errors2 === _errs20) {
                                  if (errors2 === _errs20) {
                                    if (typeof data6 === "string") {
                                      if (!formats0.test(data6)) {
                                        const err5 = { instancePath: instancePath + "/result/clientId", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/clientId/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                        if (vErrors === null) {
                                          vErrors = [err5];
                                        } else {
                                          vErrors.push(err5);
                                        }
                                        errors2++;
                                      }
                                    } else {
                                      const err6 = { instancePath: instancePath + "/result/clientId", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/clientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err6];
                                      } else {
                                        vErrors.push(err6);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                                var _valid1 = _errs20 === errors2;
                                valid4 = valid4 || _valid1;
                                const _errs22 = errors2;
                                if (data6 !== null) {
                                  const err7 = { instancePath: instancePath + "/result/clientId", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/clientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                  if (vErrors === null) {
                                    vErrors = [err7];
                                  } else {
                                    vErrors.push(err7);
                                  }
                                  errors2++;
                                }
                                var _valid1 = _errs22 === errors2;
                                valid4 = valid4 || _valid1;
                                if (!valid4) {
                                  const err8 = { instancePath: instancePath + "/result/clientId", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/clientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                  if (vErrors === null) {
                                    vErrors = [err8];
                                  } else {
                                    vErrors.push(err8);
                                  }
                                  errors2++;
                                  validate136.errors = vErrors;
                                  return false;
                                } else {
                                  errors2 = _errs19;
                                  if (vErrors !== null) {
                                    if (_errs19) {
                                      vErrors.length = _errs19;
                                    } else {
                                      vErrors = null;
                                    }
                                  }
                                }
                                var valid2 = _errs18 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data1.createdAt !== void 0) {
                                  let data7 = data1.createdAt;
                                  const _errs24 = errors2;
                                  if (errors2 === _errs24) {
                                    if (errors2 === _errs24) {
                                      if (typeof data7 === "string") {
                                        if (!pattern24.test(data7)) {
                                          validate136.errors = [{ instancePath: instancePath + "/result/createdAt", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                                          return false;
                                        } else {
                                          if (!formats14.validate(data7)) {
                                            validate136.errors = [{ instancePath: instancePath + "/result/createdAt", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                            return false;
                                          }
                                        }
                                      } else {
                                        validate136.errors = [{ instancePath: instancePath + "/result/createdAt", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid2 = _errs24 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate136.errors = [{ instancePath: instancePath + "/result", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate136.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate136.errors = vErrors;
  return errors2 === 0;
}
validate136.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsExecution = validate138;
function validate48(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate48.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.receipt === void 0 && (missing0 = "receipt") || data.result === void 0 && (missing0 = "result")) {
        validate48.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "receipt" || key0 === "result")) {
            validate48.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.receipt !== void 0) {
            const _errs2 = errors2;
            if (!validate43(data.receipt, { instancePath: instancePath + "/receipt", parentData: data, parentDataProperty: "receipt", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
              errors2 = vErrors.length;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.result !== void 0) {
              let data1 = data.result;
              const _errs3 = errors2;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.id === void 0 && (missing1 = "id") || data1.title === void 0 && (missing1 = "title") || data1.status === void 0 && (missing1 = "status") || data1.dueDate === void 0 && (missing1 = "dueDate") || data1.clientId === void 0 && (missing1 = "clientId") || data1.createdAt === void 0 && (missing1 = "createdAt")) {
                    validate48.errors = [{ instancePath: instancePath + "/result", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs6 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "id" || key1 === "title" || key1 === "status" || key1 === "dueDate" || key1 === "clientId" || key1 === "createdAt")) {
                        validate48.errors = [{ instancePath: instancePath + "/result", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors2) {
                      if (data1.id !== void 0) {
                        let data2 = data1.id;
                        const _errs7 = errors2;
                        if (errors2 === _errs7) {
                          if (errors2 === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats0.test(data2)) {
                                validate48.errors = [{ instancePath: instancePath + "/result/id", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/id/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                return false;
                              }
                            } else {
                              validate48.errors = [{ instancePath: instancePath + "/result/id", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.title !== void 0) {
                          let data3 = data1.title;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 240) {
                                validate48.errors = [{ instancePath: instancePath + "/result/title", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/title/maxLength", keyword: "maxLength", params: { limit: 240 }, message: "must NOT have more than 240 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate48.errors = [{ instancePath: instancePath + "/result/title", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate48.errors = [{ instancePath: instancePath + "/result/title", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs9 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.status !== void 0) {
                            const _errs11 = errors2;
                            if ("todo" !== data1.status) {
                              validate48.errors = [{ instancePath: instancePath + "/result/status", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/status/const", keyword: "const", params: { allowedValue: "todo" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid2 = _errs11 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.dueDate !== void 0) {
                              let data5 = data1.dueDate;
                              const _errs12 = errors2;
                              const _errs13 = errors2;
                              let valid3 = false;
                              const _errs14 = errors2;
                              if (errors2 === _errs14) {
                                if (errors2 === _errs14) {
                                  if (typeof data5 === "string") {
                                    if (!pattern20.test(data5)) {
                                      const err0 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T00:00:00\\.000Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T00:00:00\\.000Z$"' };
                                      if (vErrors === null) {
                                        vErrors = [err0];
                                      } else {
                                        vErrors.push(err0);
                                      }
                                      errors2++;
                                    } else {
                                      if (!formats14.validate(data5)) {
                                        const err1 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                        if (vErrors === null) {
                                          vErrors = [err1];
                                        } else {
                                          vErrors.push(err1);
                                        }
                                        errors2++;
                                      }
                                    }
                                  } else {
                                    const err2 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err2];
                                    } else {
                                      vErrors.push(err2);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                              var _valid0 = _errs14 === errors2;
                              valid3 = valid3 || _valid0;
                              const _errs16 = errors2;
                              if (data5 !== null) {
                                const err3 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                if (vErrors === null) {
                                  vErrors = [err3];
                                } else {
                                  vErrors.push(err3);
                                }
                                errors2++;
                              }
                              var _valid0 = _errs16 === errors2;
                              valid3 = valid3 || _valid0;
                              if (!valid3) {
                                const err4 = { instancePath: instancePath + "/result/dueDate", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/dueDate/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                if (vErrors === null) {
                                  vErrors = [err4];
                                } else {
                                  vErrors.push(err4);
                                }
                                errors2++;
                                validate48.errors = vErrors;
                                return false;
                              } else {
                                errors2 = _errs13;
                                if (vErrors !== null) {
                                  if (_errs13) {
                                    vErrors.length = _errs13;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var valid2 = _errs12 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.clientId !== void 0) {
                                let data6 = data1.clientId;
                                const _errs18 = errors2;
                                const _errs19 = errors2;
                                let valid4 = false;
                                const _errs20 = errors2;
                                if (errors2 === _errs20) {
                                  if (errors2 === _errs20) {
                                    if (typeof data6 === "string") {
                                      if (!formats0.test(data6)) {
                                        const err5 = { instancePath: instancePath + "/result/clientId", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/clientId/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                        if (vErrors === null) {
                                          vErrors = [err5];
                                        } else {
                                          vErrors.push(err5);
                                        }
                                        errors2++;
                                      }
                                    } else {
                                      const err6 = { instancePath: instancePath + "/result/clientId", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/clientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err6];
                                      } else {
                                        vErrors.push(err6);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                                var _valid1 = _errs20 === errors2;
                                valid4 = valid4 || _valid1;
                                const _errs22 = errors2;
                                if (data6 !== null) {
                                  const err7 = { instancePath: instancePath + "/result/clientId", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/clientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                  if (vErrors === null) {
                                    vErrors = [err7];
                                  } else {
                                    vErrors.push(err7);
                                  }
                                  errors2++;
                                }
                                var _valid1 = _errs22 === errors2;
                                valid4 = valid4 || _valid1;
                                if (!valid4) {
                                  const err8 = { instancePath: instancePath + "/result/clientId", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/clientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                  if (vErrors === null) {
                                    vErrors = [err8];
                                  } else {
                                    vErrors.push(err8);
                                  }
                                  errors2++;
                                  validate48.errors = vErrors;
                                  return false;
                                } else {
                                  errors2 = _errs19;
                                  if (vErrors !== null) {
                                    if (_errs19) {
                                      vErrors.length = _errs19;
                                    } else {
                                      vErrors = null;
                                    }
                                  }
                                }
                                var valid2 = _errs18 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data1.createdAt !== void 0) {
                                  let data7 = data1.createdAt;
                                  const _errs24 = errors2;
                                  if (errors2 === _errs24) {
                                    if (errors2 === _errs24) {
                                      if (typeof data7 === "string") {
                                        if (!pattern24.test(data7)) {
                                          validate48.errors = [{ instancePath: instancePath + "/result/createdAt", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                                          return false;
                                        } else {
                                          if (!formats14.validate(data7)) {
                                            validate48.errors = [{ instancePath: instancePath + "/result/createdAt", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                            return false;
                                          }
                                        }
                                      } else {
                                        validate48.errors = [{ instancePath: instancePath + "/result/createdAt", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid2 = _errs24 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate48.errors = [{ instancePath: instancePath + "/result", schemaPath: "#/$defs/Canonical_TaskCreateResult_0501c509/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate48.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate48.errors = vErrors;
  return errors2 === 0;
}
validate48.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate138(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate138.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (errors2 === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.state === void 0 && (missing0 = "state")) {
        const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors2++;
      } else {
        const _errs3 = errors2;
        for (const key0 in data) {
          if (!(key0 === "state")) {
            const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors2++;
            break;
          }
        }
        if (_errs3 === errors2) {
          if (data.state !== void 0) {
            if ("executing" !== data.state) {
              const err2 = { instancePath: instancePath + "/state", schemaPath: "#/oneOf/0/properties/state/const", keyword: "const", params: { allowedValue: "executing" }, message: "must be equal to constant" };
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
    } else {
      const err3 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors2++;
    }
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs5 = errors2;
  if (errors2 === _errs5) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.state === void 0 && (missing1 = "state")) {
        const err4 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors2++;
      } else {
        const _errs7 = errors2;
        for (const key1 in data) {
          if (!(key1 === "state")) {
            const err5 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors2++;
            break;
          }
        }
        if (_errs7 === errors2) {
          if (data.state !== void 0) {
            if ("unknown" !== data.state) {
              const err6 = { instancePath: instancePath + "/state", schemaPath: "#/oneOf/1/properties/state/const", keyword: "const", params: { allowedValue: "unknown" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err6];
              } else {
                vErrors.push(err6);
              }
              errors2++;
            }
          }
        }
      }
    } else {
      const err7 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors2++;
    }
  }
  var _valid0 = _errs5 === errors2;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs9 = errors2;
    if (errors2 === _errs9) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (data.state === void 0 && (missing2 = "state") || data.outcome === void 0 && (missing2 = "outcome")) {
          const err8 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors2++;
        } else {
          const _errs11 = errors2;
          for (const key2 in data) {
            if (!(key2 === "state" || key2 === "outcome")) {
              const err9 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors2++;
              break;
            }
          }
          if (_errs11 === errors2) {
            if (data.state !== void 0) {
              const _errs12 = errors2;
              if ("completed" !== data.state) {
                const err10 = { instancePath: instancePath + "/state", schemaPath: "#/oneOf/2/properties/state/const", keyword: "const", params: { allowedValue: "completed" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors2++;
              }
              var valid3 = _errs12 === errors2;
            } else {
              var valid3 = true;
            }
            if (valid3) {
              if (data.outcome !== void 0) {
                const _errs13 = errors2;
                if (!validate48(data.outcome, { instancePath: instancePath + "/outcome", parentData: data, parentDataProperty: "outcome", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate48.errors : vErrors.concat(validate48.errors);
                  errors2 = vErrors.length;
                }
                var valid3 = _errs13 === errors2;
              } else {
                var valid3 = true;
              }
            }
          }
        }
      } else {
        const err11 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors2++;
      }
    }
    var _valid0 = _errs9 === errors2;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err12 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors2++;
    validate138.errors = vErrors;
    return false;
  } else {
    errors2 = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate138.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate138.evaluated = { "dynamicProps": true, "dynamicItems": false };
var validateIntentsPendingItem = validate140;
function validate140(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate140.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state")) {
        validate140.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state")) {
            validate140.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate140.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate140.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate140.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate140.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate140.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate140.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate140.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate140.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate140.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate140.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("pending" !== data.state) {
                    validate140.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "pending" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate140.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate140.errors = vErrors;
  return errors2 === 0;
}
validate140.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsUnknownItem = validate141;
function validate141(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate141.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state")) {
        validate141.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state")) {
            validate141.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate141.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate141.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate141.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate141.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate141.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate141.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate141.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate141.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate141.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate141.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("unknown" !== data.state) {
                    validate141.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "unknown" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate141.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate141.errors = vErrors;
  return errors2 === 0;
}
validate141.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsFailedItem = validate142;
var schema78 = { "type": "object", "properties": { "deliveryId": { "$ref": "#/$defs/IntentsDeliveryId" }, "createdAt": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, "operation": { "$ref": "#/$defs/IntentsOperation" }, "state": { "const": "failed" }, "code": { "enum": ["UNAVAILABLE", "ACCESS_DENIED", "REFUSED", "INVALID_ARGUMENTS", "DEADLINE", "CANCELLED", "CONFLICT", "UNKNOWN"] } }, "required": ["deliveryId", "createdAt", "operation", "state", "code"], "additionalProperties": false };
function validate142(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate142.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.code === void 0 && (missing0 = "code")) {
        validate142.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "code")) {
            validate142.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate142.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate142.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate142.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate142.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate142.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate142.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate142.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate142.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate142.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate142.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("failed" !== data.state) {
                    validate142.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "failed" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.code !== void 0) {
                    let data6 = data.code;
                    const _errs15 = errors2;
                    if (!(data6 === "UNAVAILABLE" || data6 === "ACCESS_DENIED" || data6 === "REFUSED" || data6 === "INVALID_ARGUMENTS" || data6 === "DEADLINE" || data6 === "CANCELLED" || data6 === "CONFLICT" || data6 === "UNKNOWN")) {
                      validate142.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/properties/code/enum", keyword: "enum", params: { allowedValues: schema78.properties.code.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate142.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate142.errors = vErrors;
  return errors2 === 0;
}
validate142.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsDraftItem = validate143;
function validate143(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate143.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.versionId === void 0 && (missing0 = "versionId")) {
        validate143.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "kind" || key0 === "versionId")) {
            validate143.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate143.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate143.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate143.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate143.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate143.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate143.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate143.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate143.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate143.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate143.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate143.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("draft" !== data.kind) {
                      validate143.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "draft" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.versionId !== void 0) {
                      let data7 = data.versionId;
                      const _errs16 = errors2;
                      if (errors2 === _errs16) {
                        if (errors2 === _errs16) {
                          if (typeof data7 === "string") {
                            if (!formats0.test(data7)) {
                              validate143.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate143.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
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
          }
        }
      }
    } else {
      validate143.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate143.errors = vErrors;
  return errors2 === 0;
}
validate143.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsWithheldDraftItem = validate144;
function validate144(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate144.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.withheld === void 0 && (missing0 = "withheld")) {
        validate144.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "kind" || key0 === "withheld")) {
            validate144.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate144.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate144.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate144.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate144.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate144.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate144.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate144.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate144.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate144.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate144.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate144.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("draft" !== data.kind) {
                      validate144.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "draft" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.withheld !== void 0) {
                      const _errs16 = errors2;
                      if (true !== data.withheld) {
                        validate144.errors = [{ instancePath: instancePath + "/withheld", schemaPath: "#/properties/withheld/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" }];
                        return false;
                      }
                      var valid0 = _errs16 === errors2;
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
      validate144.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate144.errors = vErrors;
  return errors2 === 0;
}
validate144.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsScheduleProposalItem = validate145;
function validate145(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate145.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.proposalId === void 0 && (missing0 = "proposalId")) {
        validate145.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "kind" || key0 === "proposalId")) {
            validate145.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate145.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate145.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate145.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate145.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate145.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate145.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate145.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate145.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate145.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate145.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate145.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("schedule_proposal" !== data.kind) {
                      validate145.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "schedule_proposal" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.proposalId !== void 0) {
                      let data7 = data.proposalId;
                      const _errs16 = errors2;
                      const _errs17 = errors2;
                      let valid4 = false;
                      const _errs18 = errors2;
                      if (errors2 === _errs18) {
                        if (typeof data7 === "string") {
                          if (func1(data7) > 128) {
                            const err0 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          } else {
                            if (func1(data7) < 1) {
                              const err1 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err1];
                              } else {
                                vErrors.push(err1);
                              }
                              errors2++;
                            }
                          }
                        } else {
                          const err2 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs18 === errors2;
                      valid4 = valid4 || _valid0;
                      const _errs20 = errors2;
                      if (data7 !== null) {
                        const err3 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
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
                        const err4 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err4];
                        } else {
                          vErrors.push(err4);
                        }
                        errors2++;
                        validate145.errors = vErrors;
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
                      var valid0 = _errs16 === errors2;
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
      validate145.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate145.errors = vErrors;
  return errors2 === 0;
}
validate145.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsWithheldProposalItem = validate146;
function validate146(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate146.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.withheld === void 0 && (missing0 = "withheld")) {
        validate146.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "kind" || key0 === "withheld")) {
            validate146.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate146.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate146.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate146.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate146.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate146.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate146.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate146.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate146.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate146.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate146.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate146.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("proposal" !== data.kind) {
                      validate146.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "proposal" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.withheld !== void 0) {
                      const _errs16 = errors2;
                      if (true !== data.withheld) {
                        validate146.errors = [{ instancePath: instancePath + "/withheld", schemaPath: "#/properties/withheld/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" }];
                        return false;
                      }
                      var valid0 = _errs16 === errors2;
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
      validate146.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate146.errors = vErrors;
  return errors2 === 0;
}
validate146.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsProposalItem = validate147;
var schema98 = { "type": "object", "properties": { "deliveryId": { "$ref": "#/$defs/IntentsDeliveryId" }, "createdAt": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, "operation": { "$ref": "#/$defs/IntentsOperation" }, "state": { "const": "prepared" }, "kind": { "const": "proposal" }, "proposal": { "$ref": "#/$defs/IntentsProposal" }, "decision": { "anyOf": [{ "$ref": "#/$defs/IntentsDecision" }, { "type": "null" }, { "const": "unavailable" }] }, "execution": { "anyOf": [{ "$ref": "#/$defs/IntentsExecution" }, { "type": "null" }, { "const": "unavailable" }] }, "phase": { "enum": ["awaiting_approval", "approved", "rejected", "expired", "executing", "completed", "unknown", "unknown_decision"] } }, "required": ["deliveryId", "createdAt", "operation", "state", "kind", "proposal", "decision", "execution", "phase"], "additionalProperties": false };
function validate75(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate75.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.proposalId === void 0 && (missing0 = "proposalId") || data.command === void 0 && (missing0 = "command") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.createdAt === void 0 && (missing0 = "createdAt") || data.expiresAt === void 0 && (missing0 = "expiresAt") || data.requiredApprover === void 0 && (missing0 = "requiredApprover")) {
        validate75.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "proposalId" || key0 === "command" || key0 === "commandSha256" || key0 === "createdAt" || key0 === "expiresAt" || key0 === "requiredApprover")) {
            validate75.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.proposalId !== void 0) {
            let data0 = data.proposalId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate75.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate75.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.command !== void 0) {
              const _errs4 = errors2;
              if (!validate32(data.command, { instancePath: instancePath + "/command", parentData: data, parentDataProperty: "command", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.commandSha256 !== void 0) {
                let data2 = data.commandSha256;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (typeof data2 === "string") {
                    if (!pattern12.test(data2)) {
                      validate75.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate75.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.createdAt !== void 0) {
                  let data3 = data.createdAt;
                  const _errs7 = errors2;
                  if (errors2 === _errs7) {
                    if (errors2 === _errs7) {
                      if (typeof data3 === "string") {
                        if (!pattern15.test(data3)) {
                          validate75.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats14.validate(data3)) {
                            validate75.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate75.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.expiresAt !== void 0) {
                    let data4 = data.expiresAt;
                    const _errs9 = errors2;
                    if (errors2 === _errs9) {
                      if (errors2 === _errs9) {
                        if (typeof data4 === "string") {
                          if (!pattern15.test(data4)) {
                            validate75.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                            return false;
                          } else {
                            if (!formats14.validate(data4)) {
                              validate75.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                              return false;
                            }
                          }
                        } else {
                          validate75.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs9 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.requiredApprover !== void 0) {
                      let data5 = data.requiredApprover;
                      const _errs11 = errors2;
                      const _errs12 = errors2;
                      if (errors2 === _errs12) {
                        if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                          let missing1;
                          if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.actorId === void 0 && (missing1 = "actorId")) {
                            validate75.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                            return false;
                          } else {
                            const _errs14 = errors2;
                            for (const key1 in data5) {
                              if (!(key1 === "tenantId" || key1 === "actorId")) {
                                validate75.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs14 === errors2) {
                              if (data5.tenantId !== void 0) {
                                let data6 = data5.tenantId;
                                const _errs15 = errors2;
                                if (errors2 === _errs15) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate75.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate75.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate75.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs15 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data5.actorId !== void 0) {
                                  let data7 = data5.actorId;
                                  const _errs17 = errors2;
                                  if (errors2 === _errs17) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 128) {
                                        validate75.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func1(data7) < 1) {
                                          validate75.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate75.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid2 = _errs17 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        } else {
                          validate75.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs11 === errors2;
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
      validate75.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate75.errors = vErrors;
  return errors2 === 0;
}
validate75.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate78(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate78.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.proposalId === void 0 && (missing0 = "proposalId") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.decision === void 0 && (missing0 = "decision") || data.decidedAt === void 0 && (missing0 = "decidedAt") || data.expiresAt === void 0 && (missing0 = "expiresAt") || data.approver === void 0 && (missing0 = "approver") || data.policyRevision === void 0 && (missing0 = "policyRevision")) {
        validate78.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "proposalId" || key0 === "commandSha256" || key0 === "decision" || key0 === "decidedAt" || key0 === "expiresAt" || key0 === "approver" || key0 === "policyRevision")) {
            validate78.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.proposalId !== void 0) {
            let data0 = data.proposalId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate78.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate78.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.commandSha256 !== void 0) {
              let data1 = data.commandSha256;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (!pattern12.test(data1)) {
                    validate78.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                    return false;
                  }
                } else {
                  validate78.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.decision !== void 0) {
                let data2 = data.decision;
                const _errs6 = errors2;
                if (typeof data2 !== "string") {
                  validate78.errors = [{ instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
                if (!(data2 === "approved" || data2 === "rejected")) {
                  validate78.errors = [{ instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/enum", keyword: "enum", params: { allowedValues: schema55.properties.decision.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.decidedAt !== void 0) {
                  let data3 = data.decidedAt;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (errors2 === _errs8) {
                      if (typeof data3 === "string") {
                        if (!pattern15.test(data3)) {
                          validate78.errors = [{ instancePath: instancePath + "/decidedAt", schemaPath: "#/properties/decidedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats14.validate(data3)) {
                            validate78.errors = [{ instancePath: instancePath + "/decidedAt", schemaPath: "#/properties/decidedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate78.errors = [{ instancePath: instancePath + "/decidedAt", schemaPath: "#/properties/decidedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.expiresAt !== void 0) {
                    let data4 = data.expiresAt;
                    const _errs10 = errors2;
                    if (errors2 === _errs10) {
                      if (errors2 === _errs10) {
                        if (typeof data4 === "string") {
                          if (!pattern15.test(data4)) {
                            validate78.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                            return false;
                          } else {
                            if (!formats14.validate(data4)) {
                              validate78.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                              return false;
                            }
                          }
                        } else {
                          validate78.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs10 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.approver !== void 0) {
                      let data5 = data.approver;
                      const _errs12 = errors2;
                      const _errs13 = errors2;
                      if (errors2 === _errs13) {
                        if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                          let missing1;
                          if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.actorId === void 0 && (missing1 = "actorId")) {
                            validate78.errors = [{ instancePath: instancePath + "/approver", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                            return false;
                          } else {
                            const _errs15 = errors2;
                            for (const key1 in data5) {
                              if (!(key1 === "tenantId" || key1 === "actorId")) {
                                validate78.errors = [{ instancePath: instancePath + "/approver", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs15 === errors2) {
                              if (data5.tenantId !== void 0) {
                                let data6 = data5.tenantId;
                                const _errs16 = errors2;
                                if (errors2 === _errs16) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate78.errors = [{ instancePath: instancePath + "/approver/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate78.errors = [{ instancePath: instancePath + "/approver/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate78.errors = [{ instancePath: instancePath + "/approver/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs16 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data5.actorId !== void 0) {
                                  let data7 = data5.actorId;
                                  const _errs18 = errors2;
                                  if (errors2 === _errs18) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 128) {
                                        validate78.errors = [{ instancePath: instancePath + "/approver/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func1(data7) < 1) {
                                          validate78.errors = [{ instancePath: instancePath + "/approver/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate78.errors = [{ instancePath: instancePath + "/approver/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid2 = _errs18 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        } else {
                          validate78.errors = [{ instancePath: instancePath + "/approver", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs12 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.policyRevision !== void 0) {
                        let data8 = data.policyRevision;
                        const _errs20 = errors2;
                        if (errors2 === _errs20) {
                          if (typeof data8 === "string") {
                            if (func1(data8) < 1) {
                              validate78.errors = [{ instancePath: instancePath + "/policyRevision", schemaPath: "#/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                              return false;
                            }
                          } else {
                            validate78.errors = [{ instancePath: instancePath + "/policyRevision", schemaPath: "#/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid0 = _errs20 === errors2;
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
    } else {
      validate78.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate78.errors = vErrors;
  return errors2 === 0;
}
validate78.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate80(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate80.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (errors2 === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.state === void 0 && (missing0 = "state")) {
        const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors2++;
      } else {
        const _errs3 = errors2;
        for (const key0 in data) {
          if (!(key0 === "state")) {
            const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors2++;
            break;
          }
        }
        if (_errs3 === errors2) {
          if (data.state !== void 0) {
            if ("executing" !== data.state) {
              const err2 = { instancePath: instancePath + "/state", schemaPath: "#/oneOf/0/properties/state/const", keyword: "const", params: { allowedValue: "executing" }, message: "must be equal to constant" };
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
    } else {
      const err3 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors2++;
    }
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs5 = errors2;
  if (errors2 === _errs5) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.state === void 0 && (missing1 = "state")) {
        const err4 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors2++;
      } else {
        const _errs7 = errors2;
        for (const key1 in data) {
          if (!(key1 === "state")) {
            const err5 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors2++;
            break;
          }
        }
        if (_errs7 === errors2) {
          if (data.state !== void 0) {
            if ("unknown" !== data.state) {
              const err6 = { instancePath: instancePath + "/state", schemaPath: "#/oneOf/1/properties/state/const", keyword: "const", params: { allowedValue: "unknown" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err6];
              } else {
                vErrors.push(err6);
              }
              errors2++;
            }
          }
        }
      }
    } else {
      const err7 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors2++;
    }
  }
  var _valid0 = _errs5 === errors2;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs9 = errors2;
    if (errors2 === _errs9) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (data.state === void 0 && (missing2 = "state") || data.outcome === void 0 && (missing2 = "outcome")) {
          const err8 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors2++;
        } else {
          const _errs11 = errors2;
          for (const key2 in data) {
            if (!(key2 === "state" || key2 === "outcome")) {
              const err9 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors2++;
              break;
            }
          }
          if (_errs11 === errors2) {
            if (data.state !== void 0) {
              const _errs12 = errors2;
              if ("completed" !== data.state) {
                const err10 = { instancePath: instancePath + "/state", schemaPath: "#/oneOf/2/properties/state/const", keyword: "const", params: { allowedValue: "completed" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors2++;
              }
              var valid3 = _errs12 === errors2;
            } else {
              var valid3 = true;
            }
            if (valid3) {
              if (data.outcome !== void 0) {
                const _errs13 = errors2;
                if (!validate48(data.outcome, { instancePath: instancePath + "/outcome", parentData: data, parentDataProperty: "outcome", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate48.errors : vErrors.concat(validate48.errors);
                  errors2 = vErrors.length;
                }
                var valid3 = _errs13 === errors2;
              } else {
                var valid3 = true;
              }
            }
          }
        }
      } else {
        const err11 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors2++;
      }
    }
    var _valid0 = _errs9 === errors2;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err12 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors2++;
    validate80.errors = vErrors;
    return false;
  } else {
    errors2 = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate80.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate80.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate147(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate147.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.proposal === void 0 && (missing0 = "proposal") || data.decision === void 0 && (missing0 = "decision") || data.execution === void 0 && (missing0 = "execution") || data.phase === void 0 && (missing0 = "phase")) {
        validate147.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func33.call(schema98.properties, key0)) {
            validate147.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate147.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate147.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate147.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate147.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate147.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate147.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate147.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate147.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate147.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate147.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate147.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("proposal" !== data.kind) {
                      validate147.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "proposal" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.proposal !== void 0) {
                      const _errs16 = errors2;
                      if (!validate75(data.proposal, { instancePath: instancePath + "/proposal", parentData: data, parentDataProperty: "proposal", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate75.errors : vErrors.concat(validate75.errors);
                        errors2 = vErrors.length;
                      }
                      var valid0 = _errs16 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.decision !== void 0) {
                        let data8 = data.decision;
                        const _errs17 = errors2;
                        const _errs18 = errors2;
                        let valid4 = false;
                        const _errs19 = errors2;
                        if (!validate78(data8, { instancePath: instancePath + "/decision", parentData: data, parentDataProperty: "decision", rootData, dynamicAnchors })) {
                          vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
                          errors2 = vErrors.length;
                        }
                        var _valid0 = _errs19 === errors2;
                        valid4 = valid4 || _valid0;
                        const _errs20 = errors2;
                        if (data8 !== null) {
                          const err0 = { instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors2++;
                        }
                        var _valid0 = _errs20 === errors2;
                        valid4 = valid4 || _valid0;
                        const _errs22 = errors2;
                        if ("unavailable" !== data8) {
                          const err1 = { instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/anyOf/2/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors2++;
                        }
                        var _valid0 = _errs22 === errors2;
                        valid4 = valid4 || _valid0;
                        if (!valid4) {
                          const err2 = { instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors2++;
                          validate147.errors = vErrors;
                          return false;
                        } else {
                          errors2 = _errs18;
                          if (vErrors !== null) {
                            if (_errs18) {
                              vErrors.length = _errs18;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs17 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.execution !== void 0) {
                          let data9 = data.execution;
                          const _errs23 = errors2;
                          const _errs24 = errors2;
                          let valid5 = false;
                          const _errs25 = errors2;
                          if (!validate80(data9, { instancePath: instancePath + "/execution", parentData: data, parentDataProperty: "execution", rootData, dynamicAnchors })) {
                            vErrors = vErrors === null ? validate80.errors : vErrors.concat(validate80.errors);
                            errors2 = vErrors.length;
                          }
                          var _valid1 = _errs25 === errors2;
                          valid5 = valid5 || _valid1;
                          const _errs26 = errors2;
                          if (data9 !== null) {
                            const err3 = { instancePath: instancePath + "/execution", schemaPath: "#/properties/execution/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors2++;
                          }
                          var _valid1 = _errs26 === errors2;
                          valid5 = valid5 || _valid1;
                          const _errs28 = errors2;
                          if ("unavailable" !== data9) {
                            const err4 = { instancePath: instancePath + "/execution", schemaPath: "#/properties/execution/anyOf/2/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors2++;
                          }
                          var _valid1 = _errs28 === errors2;
                          valid5 = valid5 || _valid1;
                          if (!valid5) {
                            const err5 = { instancePath: instancePath + "/execution", schemaPath: "#/properties/execution/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err5];
                            } else {
                              vErrors.push(err5);
                            }
                            errors2++;
                            validate147.errors = vErrors;
                            return false;
                          } else {
                            errors2 = _errs24;
                            if (vErrors !== null) {
                              if (_errs24) {
                                vErrors.length = _errs24;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs23 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.phase !== void 0) {
                            let data10 = data.phase;
                            const _errs29 = errors2;
                            if (!(data10 === "awaiting_approval" || data10 === "approved" || data10 === "rejected" || data10 === "expired" || data10 === "executing" || data10 === "completed" || data10 === "unknown" || data10 === "unknown_decision")) {
                              validate147.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/properties/phase/enum", keyword: "enum", params: { allowedValues: schema98.properties.phase.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid0 = _errs29 === errors2;
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
      }
    } else {
      validate147.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate147.errors = vErrors;
  return errors2 === 0;
}
validate147.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsItem = validate151;
function validate86(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate86.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state")) {
        validate86.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state")) {
            validate86.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate86.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate86.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate86.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate86.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate86.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate86.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate86.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate86.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate86.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate86.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("pending" !== data.state) {
                    validate86.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "pending" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate86.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate86.errors = vErrors;
  return errors2 === 0;
}
validate86.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate88(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate88.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state")) {
        validate88.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state")) {
            validate88.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate88.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate88.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate88.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate88.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate88.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate88.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate88.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate88.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate88.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate88.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("unknown" !== data.state) {
                    validate88.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "unknown" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate88.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate88.errors = vErrors;
  return errors2 === 0;
}
validate88.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate90(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate90.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.code === void 0 && (missing0 = "code")) {
        validate90.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "code")) {
            validate90.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate90.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate90.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate90.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate90.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate90.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate90.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate90.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate90.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate90.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate90.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("failed" !== data.state) {
                    validate90.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "failed" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.code !== void 0) {
                    let data6 = data.code;
                    const _errs15 = errors2;
                    if (!(data6 === "UNAVAILABLE" || data6 === "ACCESS_DENIED" || data6 === "REFUSED" || data6 === "INVALID_ARGUMENTS" || data6 === "DEADLINE" || data6 === "CANCELLED" || data6 === "CONFLICT" || data6 === "UNKNOWN")) {
                      validate90.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/properties/code/enum", keyword: "enum", params: { allowedValues: schema78.properties.code.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate90.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate90.errors = vErrors;
  return errors2 === 0;
}
validate90.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate92(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate92.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.versionId === void 0 && (missing0 = "versionId")) {
        validate92.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "kind" || key0 === "versionId")) {
            validate92.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate92.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate92.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate92.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate92.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate92.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate92.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate92.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate92.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate92.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate92.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate92.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("draft" !== data.kind) {
                      validate92.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "draft" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.versionId !== void 0) {
                      let data7 = data.versionId;
                      const _errs16 = errors2;
                      if (errors2 === _errs16) {
                        if (errors2 === _errs16) {
                          if (typeof data7 === "string") {
                            if (!formats0.test(data7)) {
                              validate92.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate92.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
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
          }
        }
      }
    } else {
      validate92.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate92.errors = vErrors;
  return errors2 === 0;
}
validate92.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate94(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate94.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.withheld === void 0 && (missing0 = "withheld")) {
        validate94.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "kind" || key0 === "withheld")) {
            validate94.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate94.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate94.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate94.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate94.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate94.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate94.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate94.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate94.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate94.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate94.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate94.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("draft" !== data.kind) {
                      validate94.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "draft" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.withheld !== void 0) {
                      const _errs16 = errors2;
                      if (true !== data.withheld) {
                        validate94.errors = [{ instancePath: instancePath + "/withheld", schemaPath: "#/properties/withheld/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" }];
                        return false;
                      }
                      var valid0 = _errs16 === errors2;
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
      validate94.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate94.errors = vErrors;
  return errors2 === 0;
}
validate94.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate96(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate96.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.proposalId === void 0 && (missing0 = "proposalId")) {
        validate96.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "kind" || key0 === "proposalId")) {
            validate96.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate96.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate96.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate96.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate96.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate96.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate96.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate96.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate96.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate96.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate96.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate96.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("schedule_proposal" !== data.kind) {
                      validate96.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "schedule_proposal" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.proposalId !== void 0) {
                      let data7 = data.proposalId;
                      const _errs16 = errors2;
                      const _errs17 = errors2;
                      let valid4 = false;
                      const _errs18 = errors2;
                      if (errors2 === _errs18) {
                        if (typeof data7 === "string") {
                          if (func1(data7) > 128) {
                            const err0 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          } else {
                            if (func1(data7) < 1) {
                              const err1 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err1];
                              } else {
                                vErrors.push(err1);
                              }
                              errors2++;
                            }
                          }
                        } else {
                          const err2 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs18 === errors2;
                      valid4 = valid4 || _valid0;
                      const _errs20 = errors2;
                      if (data7 !== null) {
                        const err3 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
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
                        const err4 = { instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err4];
                        } else {
                          vErrors.push(err4);
                        }
                        errors2++;
                        validate96.errors = vErrors;
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
                      var valid0 = _errs16 === errors2;
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
      validate96.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate96.errors = vErrors;
  return errors2 === 0;
}
validate96.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate98(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate98.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.withheld === void 0 && (missing0 = "withheld")) {
        validate98.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "createdAt" || key0 === "operation" || key0 === "state" || key0 === "kind" || key0 === "withheld")) {
            validate98.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate98.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate98.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate98.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate98.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate98.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate98.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate98.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate98.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate98.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate98.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate98.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("proposal" !== data.kind) {
                      validate98.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "proposal" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.withheld !== void 0) {
                      const _errs16 = errors2;
                      if (true !== data.withheld) {
                        validate98.errors = [{ instancePath: instancePath + "/withheld", schemaPath: "#/properties/withheld/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" }];
                        return false;
                      }
                      var valid0 = _errs16 === errors2;
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
      validate98.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate98.errors = vErrors;
  return errors2 === 0;
}
validate98.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate100(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate100.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.createdAt === void 0 && (missing0 = "createdAt") || data.operation === void 0 && (missing0 = "operation") || data.state === void 0 && (missing0 = "state") || data.kind === void 0 && (missing0 = "kind") || data.proposal === void 0 && (missing0 = "proposal") || data.decision === void 0 && (missing0 = "decision") || data.execution === void 0 && (missing0 = "execution") || data.phase === void 0 && (missing0 = "phase")) {
        validate100.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func33.call(schema98.properties, key0)) {
            validate100.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern5.test(data0)) {
                  validate100.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate100.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.createdAt !== void 0) {
              let data1 = data.createdAt;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data1 === "string") {
                  if (!pattern24.test(data1)) {
                    validate100.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate100.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operation !== void 0) {
                let data2 = data.operation;
                const _errs7 = errors2;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.id === void 0 && (missing1 = "id") || data2.version === void 0 && (missing1 = "version")) {
                      validate100.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "id" || key1 === "version")) {
                          validate100.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.id !== void 0) {
                          let data3 = data2.id;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (!pattern6.test(data3)) {
                                validate100.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z_]{0,62}$" }, message: 'must match pattern "^[a-z][a-z_]{0,62}$"' }];
                                return false;
                              }
                            } else {
                              validate100.errors = [{ instancePath: instancePath + "/operation/id", schemaPath: "#/$defs/IntentsOperation/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.version !== void 0) {
                            const _errs13 = errors2;
                            if ("0.2.0" !== data2.version) {
                              validate100.errors = [{ instancePath: instancePath + "/operation/version", schemaPath: "#/$defs/IntentsOperation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                              return false;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate100.errors = [{ instancePath: instancePath + "/operation", schemaPath: "#/$defs/IntentsOperation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== void 0) {
                  const _errs14 = errors2;
                  if ("prepared" !== data.state) {
                    validate100.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/const", keyword: "const", params: { allowedValue: "prepared" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs14 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.kind !== void 0) {
                    const _errs15 = errors2;
                    if ("proposal" !== data.kind) {
                      validate100.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "proposal" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs15 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.proposal !== void 0) {
                      const _errs16 = errors2;
                      if (!validate75(data.proposal, { instancePath: instancePath + "/proposal", parentData: data, parentDataProperty: "proposal", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate75.errors : vErrors.concat(validate75.errors);
                        errors2 = vErrors.length;
                      }
                      var valid0 = _errs16 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.decision !== void 0) {
                        let data8 = data.decision;
                        const _errs17 = errors2;
                        const _errs18 = errors2;
                        let valid4 = false;
                        const _errs19 = errors2;
                        if (!validate78(data8, { instancePath: instancePath + "/decision", parentData: data, parentDataProperty: "decision", rootData, dynamicAnchors })) {
                          vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
                          errors2 = vErrors.length;
                        }
                        var _valid0 = _errs19 === errors2;
                        valid4 = valid4 || _valid0;
                        const _errs20 = errors2;
                        if (data8 !== null) {
                          const err0 = { instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors2++;
                        }
                        var _valid0 = _errs20 === errors2;
                        valid4 = valid4 || _valid0;
                        const _errs22 = errors2;
                        if ("unavailable" !== data8) {
                          const err1 = { instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/anyOf/2/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors2++;
                        }
                        var _valid0 = _errs22 === errors2;
                        valid4 = valid4 || _valid0;
                        if (!valid4) {
                          const err2 = { instancePath: instancePath + "/decision", schemaPath: "#/properties/decision/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors2++;
                          validate100.errors = vErrors;
                          return false;
                        } else {
                          errors2 = _errs18;
                          if (vErrors !== null) {
                            if (_errs18) {
                              vErrors.length = _errs18;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs17 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.execution !== void 0) {
                          let data9 = data.execution;
                          const _errs23 = errors2;
                          const _errs24 = errors2;
                          let valid5 = false;
                          const _errs25 = errors2;
                          if (!validate80(data9, { instancePath: instancePath + "/execution", parentData: data, parentDataProperty: "execution", rootData, dynamicAnchors })) {
                            vErrors = vErrors === null ? validate80.errors : vErrors.concat(validate80.errors);
                            errors2 = vErrors.length;
                          }
                          var _valid1 = _errs25 === errors2;
                          valid5 = valid5 || _valid1;
                          const _errs26 = errors2;
                          if (data9 !== null) {
                            const err3 = { instancePath: instancePath + "/execution", schemaPath: "#/properties/execution/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors2++;
                          }
                          var _valid1 = _errs26 === errors2;
                          valid5 = valid5 || _valid1;
                          const _errs28 = errors2;
                          if ("unavailable" !== data9) {
                            const err4 = { instancePath: instancePath + "/execution", schemaPath: "#/properties/execution/anyOf/2/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors2++;
                          }
                          var _valid1 = _errs28 === errors2;
                          valid5 = valid5 || _valid1;
                          if (!valid5) {
                            const err5 = { instancePath: instancePath + "/execution", schemaPath: "#/properties/execution/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err5];
                            } else {
                              vErrors.push(err5);
                            }
                            errors2++;
                            validate100.errors = vErrors;
                            return false;
                          } else {
                            errors2 = _errs24;
                            if (vErrors !== null) {
                              if (_errs24) {
                                vErrors.length = _errs24;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs23 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.phase !== void 0) {
                            let data10 = data.phase;
                            const _errs29 = errors2;
                            if (!(data10 === "awaiting_approval" || data10 === "approved" || data10 === "rejected" || data10 === "expired" || data10 === "executing" || data10 === "completed" || data10 === "unknown" || data10 === "unknown_decision")) {
                              validate100.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/properties/phase/enum", keyword: "enum", params: { allowedValues: schema98.properties.phase.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid0 = _errs29 === errors2;
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
      }
    } else {
      validate100.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate100.errors = vErrors;
  return errors2 === 0;
}
validate100.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate151(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate151.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (!validate86(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate86.errors : vErrors.concat(validate86.errors);
    errors2 = vErrors.length;
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs2 = errors2;
  if (!validate88(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate88.errors : vErrors.concat(validate88.errors);
    errors2 = vErrors.length;
  }
  var _valid0 = _errs2 === errors2;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs3 = errors2;
    if (!validate90(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
      vErrors = vErrors === null ? validate90.errors : vErrors.concat(validate90.errors);
      errors2 = vErrors.length;
    }
    var _valid0 = _errs3 === errors2;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs4 = errors2;
      if (!validate92(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate92.errors : vErrors.concat(validate92.errors);
        errors2 = vErrors.length;
      }
      var _valid0 = _errs4 === errors2;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs5 = errors2;
        if (!validate94(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate94.errors : vErrors.concat(validate94.errors);
          errors2 = vErrors.length;
        }
        var _valid0 = _errs5 === errors2;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
          const _errs6 = errors2;
          if (!validate96(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate96.errors : vErrors.concat(validate96.errors);
            errors2 = vErrors.length;
          }
          var _valid0 = _errs6 === errors2;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
            const _errs7 = errors2;
            if (!validate98(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate98.errors : vErrors.concat(validate98.errors);
              errors2 = vErrors.length;
            }
            var _valid0 = _errs7 === errors2;
            if (_valid0 && valid0) {
              valid0 = false;
              passing0 = [passing0, 6];
            } else {
              if (_valid0) {
                valid0 = true;
                passing0 = 6;
                if (props0 !== true) {
                  props0 = true;
                }
              }
              const _errs8 = errors2;
              if (!validate100(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate100.errors : vErrors.concat(validate100.errors);
                errors2 = vErrors.length;
              }
              var _valid0 = _errs8 === errors2;
              if (_valid0 && valid0) {
                valid0 = false;
                passing0 = [passing0, 7];
              } else {
                if (_valid0) {
                  valid0 = true;
                  passing0 = 7;
                  if (props0 !== true) {
                    props0 = true;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors2++;
    validate151.errors = vErrors;
    return false;
  } else {
    errors2 = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate151.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate151.evaluated = { "dynamicProps": true, "dynamicItems": false };
var validateIntentsListResponse = validate160;
function validate108(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate108.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (!validate86(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate86.errors : vErrors.concat(validate86.errors);
    errors2 = vErrors.length;
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs2 = errors2;
  if (!validate88(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate88.errors : vErrors.concat(validate88.errors);
    errors2 = vErrors.length;
  }
  var _valid0 = _errs2 === errors2;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs3 = errors2;
    if (!validate90(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
      vErrors = vErrors === null ? validate90.errors : vErrors.concat(validate90.errors);
      errors2 = vErrors.length;
    }
    var _valid0 = _errs3 === errors2;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs4 = errors2;
      if (!validate92(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate92.errors : vErrors.concat(validate92.errors);
        errors2 = vErrors.length;
      }
      var _valid0 = _errs4 === errors2;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs5 = errors2;
        if (!validate94(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate94.errors : vErrors.concat(validate94.errors);
          errors2 = vErrors.length;
        }
        var _valid0 = _errs5 === errors2;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
          const _errs6 = errors2;
          if (!validate96(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate96.errors : vErrors.concat(validate96.errors);
            errors2 = vErrors.length;
          }
          var _valid0 = _errs6 === errors2;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
            const _errs7 = errors2;
            if (!validate98(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate98.errors : vErrors.concat(validate98.errors);
              errors2 = vErrors.length;
            }
            var _valid0 = _errs7 === errors2;
            if (_valid0 && valid0) {
              valid0 = false;
              passing0 = [passing0, 6];
            } else {
              if (_valid0) {
                valid0 = true;
                passing0 = 6;
                if (props0 !== true) {
                  props0 = true;
                }
              }
              const _errs8 = errors2;
              if (!validate100(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate100.errors : vErrors.concat(validate100.errors);
                errors2 = vErrors.length;
              }
              var _valid0 = _errs8 === errors2;
              if (_valid0 && valid0) {
                valid0 = false;
                passing0 = [passing0, 7];
              } else {
                if (_valid0) {
                  valid0 = true;
                  passing0 = 7;
                  if (props0 !== true) {
                    props0 = true;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors2++;
    validate108.errors = vErrors;
    return false;
  } else {
    errors2 = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate108.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate108.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate160(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate160.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.conversationId === void 0 && (missing0 = "conversationId") || data.intents === void 0 && (missing0 = "intents") || data.next === void 0 && (missing0 = "next")) {
        validate160.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "conversationId" || key0 === "intents" || key0 === "next")) {
            validate160.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.conversationId !== void 0) {
            let data0 = data.conversationId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate160.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/$defs/IntentsConversationId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' }];
                  return false;
                }
              } else {
                validate160.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/$defs/IntentsConversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.intents !== void 0) {
              let data1 = data.intents;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (Array.isArray(data1)) {
                  if (data1.length > 50) {
                    validate160.errors = [{ instancePath: instancePath + "/intents", schemaPath: "#/properties/intents/maxItems", keyword: "maxItems", params: { limit: 50 }, message: "must NOT have more than 50 items" }];
                    return false;
                  } else {
                    var valid2 = true;
                    const len0 = data1.length;
                    for (let i0 = 0; i0 < len0; i0++) {
                      const _errs7 = errors2;
                      if (!validate108(data1[i0], { instancePath: instancePath + "/intents/" + i0, parentData: data1, parentDataProperty: i0, rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate108.errors : vErrors.concat(validate108.errors);
                        errors2 = vErrors.length;
                      }
                      var valid2 = _errs7 === errors2;
                      if (!valid2) {
                        break;
                      }
                    }
                  }
                } else {
                  validate160.errors = [{ instancePath: instancePath + "/intents", schemaPath: "#/properties/intents/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.next !== void 0) {
                let data3 = data.next;
                const _errs8 = errors2;
                const _errs9 = errors2;
                let valid3 = false;
                const _errs10 = errors2;
                const _errs11 = errors2;
                if (errors2 === _errs11) {
                  if (typeof data3 === "string") {
                    if (!pattern5.test(data3)) {
                      const err0 = { instancePath: instancePath + "/next", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors2++;
                    }
                  } else {
                    const err1 = { instancePath: instancePath + "/next", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err1];
                    } else {
                      vErrors.push(err1);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs10 === errors2;
                valid3 = valid3 || _valid0;
                const _errs13 = errors2;
                if (data3 !== null) {
                  const err2 = { instancePath: instancePath + "/next", schemaPath: "#/properties/next/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
                var _valid0 = _errs13 === errors2;
                valid3 = valid3 || _valid0;
                if (!valid3) {
                  const err3 = { instancePath: instancePath + "/next", schemaPath: "#/properties/next/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err3];
                  } else {
                    vErrors.push(err3);
                  }
                  errors2++;
                  validate160.errors = vErrors;
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
            }
          }
        }
      }
    } else {
      validate160.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate160.errors = vErrors;
  return errors2 === 0;
}
validate160.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateIntentsDecideResponse = validate162;
function validate162(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate162.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (errors2 === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.status === void 0 && (missing0 = "status") || data.deliveryId === void 0 && (missing0 = "deliveryId") || data.proposalId === void 0 && (missing0 = "proposalId") || data.decision === void 0 && (missing0 = "decision")) {
        const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors2++;
      } else {
        const _errs3 = errors2;
        for (const key0 in data) {
          if (!(key0 === "status" || key0 === "deliveryId" || key0 === "proposalId" || key0 === "decision")) {
            const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors2++;
            break;
          }
        }
        if (_errs3 === errors2) {
          if (data.status !== void 0) {
            const _errs4 = errors2;
            if ("rejected" !== data.status) {
              const err2 = { instancePath: instancePath + "/status", schemaPath: "#/oneOf/0/properties/status/const", keyword: "const", params: { allowedValue: "rejected" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors2++;
            }
            var valid1 = _errs4 === errors2;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.deliveryId !== void 0) {
              let data1 = data.deliveryId;
              const _errs5 = errors2;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (typeof data1 === "string") {
                  if (!pattern5.test(data1)) {
                    const err3 = { instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                } else {
                  const err4 = { instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err4];
                  } else {
                    vErrors.push(err4);
                  }
                  errors2++;
                }
              }
              var valid1 = _errs5 === errors2;
            } else {
              var valid1 = true;
            }
            if (valid1) {
              if (data.proposalId !== void 0) {
                let data2 = data.proposalId;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (typeof data2 === "string") {
                    if (!pattern4.test(data2)) {
                      const err5 = { instancePath: instancePath + "/proposalId", schemaPath: "#/oneOf/0/properties/proposalId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors2++;
                    }
                  } else {
                    const err6 = { instancePath: instancePath + "/proposalId", schemaPath: "#/oneOf/0/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err6];
                    } else {
                      vErrors.push(err6);
                    }
                    errors2++;
                  }
                }
                var valid1 = _errs8 === errors2;
              } else {
                var valid1 = true;
              }
              if (valid1) {
                if (data.decision !== void 0) {
                  const _errs10 = errors2;
                  if (!validate78(data.decision, { instancePath: instancePath + "/decision", parentData: data, parentDataProperty: "decision", rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
                    errors2 = vErrors.length;
                  }
                  var valid1 = _errs10 === errors2;
                } else {
                  var valid1 = true;
                }
              }
            }
          }
        }
      }
    } else {
      const err7 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors2++;
    }
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs11 = errors2;
  if (errors2 === _errs11) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.status === void 0 && (missing1 = "status") || data.deliveryId === void 0 && (missing1 = "deliveryId") || data.proposalId === void 0 && (missing1 = "proposalId") || data.decision === void 0 && (missing1 = "decision") || data.outcome === void 0 && (missing1 = "outcome")) {
        const err8 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors2++;
      } else {
        const _errs13 = errors2;
        for (const key1 in data) {
          if (!(key1 === "status" || key1 === "deliveryId" || key1 === "proposalId" || key1 === "decision" || key1 === "outcome")) {
            const err9 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors2++;
            break;
          }
        }
        if (_errs13 === errors2) {
          if (data.status !== void 0) {
            const _errs14 = errors2;
            if ("executed" !== data.status) {
              const err10 = { instancePath: instancePath + "/status", schemaPath: "#/oneOf/1/properties/status/const", keyword: "const", params: { allowedValue: "executed" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors2++;
            }
            var valid3 = _errs14 === errors2;
          } else {
            var valid3 = true;
          }
          if (valid3) {
            if (data.deliveryId !== void 0) {
              let data5 = data.deliveryId;
              const _errs15 = errors2;
              const _errs16 = errors2;
              if (errors2 === _errs16) {
                if (typeof data5 === "string") {
                  if (!pattern5.test(data5)) {
                    const err11 = { instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' };
                    if (vErrors === null) {
                      vErrors = [err11];
                    } else {
                      vErrors.push(err11);
                    }
                    errors2++;
                  }
                } else {
                  const err12 = { instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err12];
                  } else {
                    vErrors.push(err12);
                  }
                  errors2++;
                }
              }
              var valid3 = _errs15 === errors2;
            } else {
              var valid3 = true;
            }
            if (valid3) {
              if (data.proposalId !== void 0) {
                let data6 = data.proposalId;
                const _errs18 = errors2;
                if (errors2 === _errs18) {
                  if (typeof data6 === "string") {
                    if (!pattern4.test(data6)) {
                      const err13 = { instancePath: instancePath + "/proposalId", schemaPath: "#/oneOf/1/properties/proposalId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' };
                      if (vErrors === null) {
                        vErrors = [err13];
                      } else {
                        vErrors.push(err13);
                      }
                      errors2++;
                    }
                  } else {
                    const err14 = { instancePath: instancePath + "/proposalId", schemaPath: "#/oneOf/1/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err14];
                    } else {
                      vErrors.push(err14);
                    }
                    errors2++;
                  }
                }
                var valid3 = _errs18 === errors2;
              } else {
                var valid3 = true;
              }
              if (valid3) {
                if (data.decision !== void 0) {
                  const _errs20 = errors2;
                  if (!validate78(data.decision, { instancePath: instancePath + "/decision", parentData: data, parentDataProperty: "decision", rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
                    errors2 = vErrors.length;
                  }
                  var valid3 = _errs20 === errors2;
                } else {
                  var valid3 = true;
                }
                if (valid3) {
                  if (data.outcome !== void 0) {
                    const _errs21 = errors2;
                    if (!validate48(data.outcome, { instancePath: instancePath + "/outcome", parentData: data, parentDataProperty: "outcome", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate48.errors : vErrors.concat(validate48.errors);
                      errors2 = vErrors.length;
                    }
                    var valid3 = _errs21 === errors2;
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
      const err15 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors2++;
    }
  }
  var _valid0 = _errs11 === errors2;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs22 = errors2;
    if (errors2 === _errs22) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (data.status === void 0 && (missing2 = "status") || data.deliveryId === void 0 && (missing2 = "deliveryId") || data.proposalId === void 0 && (missing2 = "proposalId") || data.decision === void 0 && (missing2 = "decision")) {
          const err16 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors2++;
        } else {
          const _errs24 = errors2;
          for (const key2 in data) {
            if (!(key2 === "status" || key2 === "deliveryId" || key2 === "proposalId" || key2 === "decision")) {
              const err17 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors2++;
              break;
            }
          }
          if (_errs24 === errors2) {
            if (data.status !== void 0) {
              const _errs25 = errors2;
              if ("indeterminate" !== data.status) {
                const err18 = { instancePath: instancePath + "/status", schemaPath: "#/oneOf/2/properties/status/const", keyword: "const", params: { allowedValue: "indeterminate" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err18];
                } else {
                  vErrors.push(err18);
                }
                errors2++;
              }
              var valid5 = _errs25 === errors2;
            } else {
              var valid5 = true;
            }
            if (valid5) {
              if (data.deliveryId !== void 0) {
                let data10 = data.deliveryId;
                const _errs26 = errors2;
                const _errs27 = errors2;
                if (errors2 === _errs27) {
                  if (typeof data10 === "string") {
                    if (!pattern5.test(data10)) {
                      const err19 = { instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' };
                      if (vErrors === null) {
                        vErrors = [err19];
                      } else {
                        vErrors.push(err19);
                      }
                      errors2++;
                    }
                  } else {
                    const err20 = { instancePath: instancePath + "/deliveryId", schemaPath: "#/$defs/IntentsDeliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err20];
                    } else {
                      vErrors.push(err20);
                    }
                    errors2++;
                  }
                }
                var valid5 = _errs26 === errors2;
              } else {
                var valid5 = true;
              }
              if (valid5) {
                if (data.proposalId !== void 0) {
                  let data11 = data.proposalId;
                  const _errs29 = errors2;
                  if (errors2 === _errs29) {
                    if (typeof data11 === "string") {
                      if (!pattern4.test(data11)) {
                        const err21 = { instancePath: instancePath + "/proposalId", schemaPath: "#/oneOf/2/properties/proposalId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' };
                        if (vErrors === null) {
                          vErrors = [err21];
                        } else {
                          vErrors.push(err21);
                        }
                        errors2++;
                      }
                    } else {
                      const err22 = { instancePath: instancePath + "/proposalId", schemaPath: "#/oneOf/2/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err22];
                      } else {
                        vErrors.push(err22);
                      }
                      errors2++;
                    }
                  }
                  var valid5 = _errs29 === errors2;
                } else {
                  var valid5 = true;
                }
                if (valid5) {
                  if (data.decision !== void 0) {
                    const _errs31 = errors2;
                    if (!validate78(data.decision, { instancePath: instancePath + "/decision", parentData: data, parentDataProperty: "decision", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
                      errors2 = vErrors.length;
                    }
                    var valid5 = _errs31 === errors2;
                  } else {
                    var valid5 = true;
                  }
                }
              }
            }
          }
        }
      } else {
        const err23 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors2++;
      }
    }
    var _valid0 = _errs22 === errors2;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err24 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err24];
    } else {
      vErrors.push(err24);
    }
    errors2++;
    validate162.errors = vErrors;
    return false;
  } else {
    errors2 = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate162.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate162.evaluated = { "dynamicProps": true, "dynamicItems": false };
var validateIntentsErrorResponse = validate167;
var schema143 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "type": "string", "enum": ["INVALID_REQUEST", "UNAUTHENTICATED", "ACCESS_DENIED", "MEMBERSHIP_REVOKED", "NOT_FOUND", "METHOD_NOT_ALLOWED", "DEADLINE", "MEMBERSHIP_CHANGED", "REQUEST_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "CANCELLED", "PRODUCT_UNAVAILABLE", "INTENT_APPROVALS_DISABLED", "INTENT_NOT_FOUND", "INTENT_NOT_PREPARED", "INTENT_NOT_APPROVABLE", "INTENT_MISMATCH", "INTENT_EXPIRED", "INTENT_SCOPE_WITHHELD", "APPROVER_REFUSED", "APPROVAL_OWNER_UNAVAILABLE", "APPROVAL_DECISION_REFUSED", "APPROVAL_DECISION_UNKNOWN", "EXECUTION_OWNER_UNAVAILABLE", "EXECUTION_AUTHORITY_REFUSED", "INTENT_CROSS_RUN", "COMMAND_APPROVAL_REFUSED", "COMMAND_AUTHORITY_REFUSED", "COMMAND_PREPARATION_REFUSED", "COMMAND_REFUSED", "COMMAND_OUTCOME_UNKNOWN", "INTENT_RESULT_NOT_RELEASED", "INTENT_EXECUTION_UNKNOWN", "INTENT_JOURNAL_UNAVAILABLE", "INTENT_REQUEST_INVALID"] }, "outcome": { "type": "string", "enum": ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED"] }, "field": { "type": "string", "pattern": "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" } }, "required": ["code"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
var pattern89 = new RegExp("^[A-Za-z][A-Za-z0-9_.-]{0,127}$", "u");
function validate167(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate167.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.error === void 0 && (missing0 = "error")) {
        validate167.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate167.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.error !== void 0) {
            let data0 = data.error;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.code === void 0 && (missing1 = "code")) {
                  validate167.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome" || key1 === "field")) {
                      validate167.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (typeof data1 !== "string") {
                        validate167.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data1 === "INVALID_REQUEST" || data1 === "UNAUTHENTICATED" || data1 === "ACCESS_DENIED" || data1 === "MEMBERSHIP_REVOKED" || data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "DEADLINE" || data1 === "MEMBERSHIP_CHANGED" || data1 === "REQUEST_TOO_LARGE" || data1 === "UNSUPPORTED_MEDIA_TYPE" || data1 === "CANCELLED" || data1 === "PRODUCT_UNAVAILABLE" || data1 === "INTENT_APPROVALS_DISABLED" || data1 === "INTENT_NOT_FOUND" || data1 === "INTENT_NOT_PREPARED" || data1 === "INTENT_NOT_APPROVABLE" || data1 === "INTENT_MISMATCH" || data1 === "INTENT_EXPIRED" || data1 === "INTENT_SCOPE_WITHHELD" || data1 === "APPROVER_REFUSED" || data1 === "APPROVAL_OWNER_UNAVAILABLE" || data1 === "APPROVAL_DECISION_REFUSED" || data1 === "APPROVAL_DECISION_UNKNOWN" || data1 === "EXECUTION_OWNER_UNAVAILABLE" || data1 === "EXECUTION_AUTHORITY_REFUSED" || data1 === "INTENT_CROSS_RUN" || data1 === "COMMAND_APPROVAL_REFUSED" || data1 === "COMMAND_AUTHORITY_REFUSED" || data1 === "COMMAND_PREPARATION_REFUSED" || data1 === "COMMAND_REFUSED" || data1 === "COMMAND_OUTCOME_UNKNOWN" || data1 === "INTENT_RESULT_NOT_RELEASED" || data1 === "INTENT_EXECUTION_UNKNOWN" || data1 === "INTENT_JOURNAL_UNAVAILABLE" || data1 === "INTENT_REQUEST_INVALID")) {
                        validate167.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema143.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid1 = _errs5 === errors2;
                    } else {
                      var valid1 = true;
                    }
                    if (valid1) {
                      if (data0.outcome !== void 0) {
                        let data2 = data0.outcome;
                        const _errs7 = errors2;
                        if (typeof data2 !== "string") {
                          validate167.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        if (!(data2 === "NOT_DISPATCHED" || data2 === "UNKNOWN" || data2 === "RESULT_NOT_RELEASED")) {
                          validate167.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema143.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid1 = _errs7 === errors2;
                      } else {
                        var valid1 = true;
                      }
                      if (valid1) {
                        if (data0.field !== void 0) {
                          let data3 = data0.field;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (typeof data3 === "string") {
                              if (!pattern89.test(data3)) {
                                validate167.errors = [{ instancePath: instancePath + "/error/field", schemaPath: "#/properties/error/properties/field/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_.-]{0,127}$"' }];
                                return false;
                              }
                            } else {
                              validate167.errors = [{ instancePath: instancePath + "/error/field", schemaPath: "#/properties/error/properties/field/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid1 = _errs9 === errors2;
                        } else {
                          var valid1 = true;
                        }
                      }
                    }
                  }
                }
              } else {
                validate167.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate167.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate167.errors = vErrors;
  return errors2 === 0;
}
validate167.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validators = { IntentsConversationId: validateIntentsConversationId, IntentsDeliveryId: validateIntentsDeliveryId, IntentsOperation: validateIntentsOperation, IntentsListRequest: validateIntentsListRequest, IntentsDecideRequest: validateIntentsDecideRequest, IntentsProposal: validateIntentsProposal, IntentsDecision: validateIntentsDecision, IntentsTaskCreateArguments: validateIntentsTaskCreateArguments, IntentsExecutionOutcome: validateIntentsExecutionOutcome, IntentsExecution: validateIntentsExecution, IntentsPendingItem: validateIntentsPendingItem, IntentsUnknownItem: validateIntentsUnknownItem, IntentsFailedItem: validateIntentsFailedItem, IntentsDraftItem: validateIntentsDraftItem, IntentsWithheldDraftItem: validateIntentsWithheldDraftItem, IntentsScheduleProposalItem: validateIntentsScheduleProposalItem, IntentsWithheldProposalItem: validateIntentsWithheldProposalItem, IntentsProposalItem: validateIntentsProposalItem, IntentsItem: validateIntentsItem, IntentsListResponse: validateIntentsListResponse, IntentsDecideResponse: validateIntentsDecideResponse, IntentsErrorResponse: validateIntentsErrorResponse };

// intents-application/schema.mjs
var INTENTS_SCHEMA_ID = "urn:meri:intents-application:0.1.0";
var INTENT_PHASES = Object.freeze(["awaiting_approval", "approved", "rejected", "expired", "executing", "completed", "unknown", "unknown_decision"]);

// intents-application/protocol.mjs
var intentsVersion = "0.1.0";
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var createIntentsMetadata = ({ paths, limits, errorStatuses, errorOutcomes, failureCodes, approvableActions }) => freeze({
  contractVersion: intentsVersion,
  schemaId: INTENTS_SCHEMA_ID,
  routes: Object.fromEntries(Object.entries(paths).map(([route, path]) => [route, { method: "POST", path, response: "json" }])),
  authentication: { scheme: "Bearer", authority: "native session admitted by Core membership on every request; tenant, actor and clients come only from that admission, never from a body or a response" },
  limits: { requestBytes: limits.maxRequestBytes, responseBytes: limits.maxResponseBytes, requestMs: limits.maxRequestMs, listLimitDefault: 20, listLimitMax: 50, jsonDepth: 64, jsonNodes: 1e5 },
  errorStatuses,
  errorOutcomes,
  failureCodes,
  approvableActions,
  semantics: {
    list: "read-only durable history of this conversation's prepared intents; next is the last returned deliveryId when more remain, otherwise null",
    decision: "approved or rejected is recorded by the canonical decision owner for exactly the named proposal, command hash and approver; display, stream or model text never approves",
    execution: "only actions in approvableActions execute; any other prepared proposal answers INTENT_NOT_APPROVABLE and stays prepared",
    executed: "status executed returns the observed receipt and task result; the receiver admits it only as the executor's own outcome for the retained task.create command (its hash, id, idempotency key, scopes and stable binding, a succeeded receipt with no source transaction, and a result equal to the immutable arguments)",
    correlation: "a list answer is admitted against its captured list request; a decide answer is admitted against the captured decide request and the proposal admitted from an earlier list answer; rejected and indeterminate replies carry no conversation or command of their own, so only that retained proposal binds them to the request's conversation and approver",
    uncertainty: "UNKNOWN and RESULT_NOT_RELEASED mean a decision or effect may exist: repeat the identical decide request or read list; never prepare a second proposal",
    withheld: "withheld items carry no content because the caller no longer sees a client scope of the retained command",
    expiry: "the caller compares proposal.expiresAt with a fresh clock before presenting a decision; the server rechecks current authority",
    phase: "phase is a reading of the durable decision and execution owners, never a decision",
    integration: "isolated source contract; route mounting, Core decision-owner wiring and runtime qualification remain handoff work"
  }
});

// intents-generated:./generated-protocol.mjs
var intentsPaths = Object.freeze({ "list": "/api/conversations/intents/list", "decide": "/api/conversations/intents/decide" });
var intentsMetadata = createIntentsMetadata({ "paths": { "list": "/api/conversations/intents/list", "decide": "/api/conversations/intents/decide" }, "limits": { "maxRequestMs": 3e4, "maxRequestBytes": 4096, "maxResponseBytes": 16777216 }, "errorStatuses": { "INVALID_REQUEST": 400, "UNAUTHENTICATED": 401, "ACCESS_DENIED": 403, "MEMBERSHIP_REVOKED": 403, "NOT_FOUND": 404, "METHOD_NOT_ALLOWED": 405, "DEADLINE": 408, "MEMBERSHIP_CHANGED": 409, "REQUEST_TOO_LARGE": 413, "UNSUPPORTED_MEDIA_TYPE": 415, "CANCELLED": 499, "PRODUCT_UNAVAILABLE": 502, "INTENT_APPROVALS_DISABLED": 503, "INTENT_NOT_FOUND": 404, "INTENT_NOT_PREPARED": 409, "INTENT_NOT_APPROVABLE": 409, "INTENT_MISMATCH": 409, "INTENT_EXPIRED": 409, "INTENT_SCOPE_WITHHELD": 403, "APPROVER_REFUSED": 403, "APPROVAL_OWNER_UNAVAILABLE": 503, "APPROVAL_DECISION_REFUSED": 409, "APPROVAL_DECISION_UNKNOWN": 502, "EXECUTION_OWNER_UNAVAILABLE": 503, "EXECUTION_AUTHORITY_REFUSED": 403, "INTENT_CROSS_RUN": 409, "COMMAND_APPROVAL_REFUSED": 409, "COMMAND_AUTHORITY_REFUSED": 403, "COMMAND_PREPARATION_REFUSED": 409, "COMMAND_REFUSED": 409, "COMMAND_OUTCOME_UNKNOWN": 502, "INTENT_RESULT_NOT_RELEASED": 502, "INTENT_EXECUTION_UNKNOWN": 502, "INTENT_JOURNAL_UNAVAILABLE": 503, "INTENT_REQUEST_INVALID": 400 }, "errorOutcomes": ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED"], "failureCodes": ["UNAVAILABLE", "ACCESS_DENIED", "REFUSED", "INVALID_ARGUMENTS", "DEADLINE", "CANCELLED", "CONFLICT", "UNKNOWN"], "approvableActions": ["task.create"], "fieldPattern": "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" });

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

// intents-application/boundary.mjs
var IntentsResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "IntentsResponseError";
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new IntentsResponseError(code);
};
function parseText(value, cap) {
  if (typeof value !== "string") fail2("INTENTS_JSON");
  if (value.length > cap) fail2("INTENTS_LIMIT");
  if (!value.isWellFormed()) fail2("INTENTS_JSON");
  try {
    return parseBytes(new TextEncoder().encode(value), cap);
  } catch (error) {
    fail2(["BYTE_LIMIT", "JSON_LIMIT"].includes(error.code) ? "INTENTS_LIMIT" : "INTENTS_JSON");
  }
}
function expectedData(value, cap) {
  let nodes = 0;
  const visit = (v, depth) => {
    if (++nodes > 1e5 || depth > 64) fail2("INTENTS_EXPECTATION");
    if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return v;
    if (!v || typeof v !== "object" || ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(v))) fail2("INTENTS_EXPECTATION");
    const descriptors = Object.getOwnPropertyDescriptors(v), array = Array.isArray(v), out = array ? [] : {};
    for (const key of Reflect.ownKeys(descriptors)) {
      if (array && key === "length") continue;
      const d = descriptors[key];
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key) || !d.enumerable || !Object.hasOwn(d, "value")) fail2("INTENTS_EXPECTATION");
      out[key] = visit(d.value, depth + 1);
    }
    return out;
  };
  try {
    return parseText(JSON.stringify(visit(value, 0)), cap);
  } catch (error) {
    if (error instanceof IntentsResponseError) throw error;
    fail2("INTENTS_EXPECTATION");
  }
}

// node_modules/canonicalize/lib/canonicalize.js
function serializeString(value) {
  if (!value.isWellFormed()) {
    throw new Error("Lone surrogate is not allowed");
  }
  return JSON.stringify(value);
}
function serializePrimitive(value) {
  switch (typeof value) {
    case "number":
      if (isNaN(value)) {
        throw new Error("NaN is not allowed");
      }
      if (!isFinite(value)) {
        throw new Error("Infinity is not allowed");
      }
      return JSON.stringify(value);
    case "string":
      return serializeString(value);
    case "boolean":
      return value ? "true" : "false";
    default:
      return JSON.stringify(value);
  }
}
function enterValue(value, seen) {
  let wrappers = null;
  while (value !== null && typeof value === "object" && typeof value.toJSON === "function") {
    if (seen.has(value)) {
      throw new Error("Circular reference detected");
    }
    seen.add(value);
    (wrappers ??= []).push(value);
    value = value.toJSON();
  }
  if (value instanceof Number || value instanceof String || value instanceof Boolean) {
    value = value.valueOf();
  }
  if (value === null || typeof value !== "object") {
    if (wrappers !== null) {
      for (const wrapper of wrappers) seen.delete(wrapper);
    }
    return serializePrimitive(value);
  }
  if (seen.has(value)) {
    throw new Error("Circular reference detected");
  }
  seen.add(value);
  return {
    container: value,
    // null marks an array frame; object frames carry their sorted keys.
    // `sort()`'s default comparator orders by UTF-16 code unit, which is the
    // order JCS requires.
    keys: Array.isArray(value) ? null : Object.keys(value).sort(),
    // Next child to serialize; the frame resumes here after a nested
    // container's subtree completes.
    index: 0,
    // Whether no member has been emitted yet (controls comma placement).
    first: true,
    // toJSON wrappers to release from `seen` when this frame completes.
    wrappers
  };
}
function canonicalize(object) {
  if (object === null || typeof object !== "object") {
    return serializePrimitive(object);
  }
  const seen = /* @__PURE__ */ new Set();
  const root = enterValue(object, seen);
  if (typeof root !== "object") {
    return root;
  }
  let result = root.keys === null ? "[" : "{";
  const stack = [root];
  outer:
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const container = frame.container;
      if (frame.keys === null) {
        while (frame.index < container.length) {
          const i = frame.index++;
          if (i > 0) {
            result += ",";
          }
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
          if (value === void 0 || typeof value === "symbol" || typeof value === "function") {
            continue;
          }
          if (value === null || typeof value !== "object") {
            if (frame.first) {
              frame.first = false;
            } else {
              result += ",";
            }
            result += serializeString(key) + ":" + serializePrimitive(value);
            continue;
          }
          const child = enterValue(value, seen);
          if (child === void 0) {
            continue;
          }
          if (frame.first) {
            frame.first = false;
          } else {
            result += ",";
          }
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
      if (frame.wrappers !== null) {
        for (const wrapper of frame.wrappers) seen.delete(wrapper);
      }
      stack.pop();
    }
  return result;
}

// intents-application/semantics.mjs
var same = (a, b) => canonicalize(a) === canonicalize(b);
var sha = async (value) => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalize(value)))), (byte) => byte.toString(16).padStart(2, "0")).join("");
var conflict = () => fail2("INTENTS_CORRELATION");
var parsed = (value) => {
  const at = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isSafeInteger(at)) conflict();
  return at;
};
var exact = (value) => {
  const at = Date.parse(value);
  if (!Number.isSafeInteger(at) || new Date(at).toISOString() !== value) conflict();
  return at;
};
var STABLE = ["tenantId", "actorId", "conversationId", "runId"];
async function proposal(value, conversationId) {
  const command = value.command;
  if (await sha(command) !== value.commandSha256 || value.requiredApprover.tenantId !== command.binding.tenantId || command.binding.conversationId !== conversationId || command.scopes.some((scope) => scope.tenantId !== command.binding.tenantId) || parsed(value.expiresAt) <= parsed(value.createdAt)) conflict();
  if (command.action === "task.create" && (!validators.IntentsTaskCreateArguments(command.arguments) || command.attachments.length !== 0 || command.arguments.title.trim() !== command.arguments.title)) conflict();
}
function decision(value, retained) {
  parsed(value.decidedAt);
  parsed(value.expiresAt);
  if (value.proposalId !== retained.proposalId || value.commandSha256 !== retained.commandSha256) conflict();
}
function outcome(value, retained) {
  const command = retained.command, receipt = value.receipt, result = value.result;
  if (command.action !== "task.create") conflict();
  exact(receipt.completedAt);
  exact(result.createdAt);
  if (receipt.commandId !== command.commandId || receipt.commandSha256 !== retained.commandSha256 || receipt.idempotencyKey !== command.idempotencyKey || !same(receipt.scopes, command.scopes)) conflict();
  if (STABLE.some((key) => receipt.binding[key] !== command.binding[key])) conflict();
  if (["title", "clientId", "dueDate"].some((key) => result[key] !== command.arguments[key])) conflict();
  if (receipt.outcome !== "succeeded" || receipt.sourceTransactionId !== null) conflict();
}
function phase(item2) {
  const { decision: d, execution, phase: p } = item2;
  if (execution !== null && typeof execution === "object") {
    if (p !== execution.state) conflict();
    return;
  }
  if (d !== null && typeof d === "object") {
    if (p !== d.decision) conflict();
    return;
  }
  if (!(d === null ? ["awaiting_approval", "expired"] : ["expired", "unknown_decision"]).includes(p)) conflict();
}
async function item(value, conversationId) {
  exact(value.createdAt);
  if (!Object.hasOwn(value, "proposal")) return;
  await proposal(value.proposal, conversationId);
  if (value.decision !== null && typeof value.decision === "object") decision(value.decision, value.proposal);
  if (value.execution !== null && typeof value.execution === "object" && value.execution.state === "completed") outcome(value.execution.outcome, value.proposal);
  phase(value);
}
async function list(value, request) {
  const limit = request.limit ?? 20;
  if (value.conversationId !== request.conversationId || value.intents.length > limit) conflict();
  const ids = value.intents.map((entry) => entry.deliveryId);
  if (new Set(ids).size !== ids.length) conflict();
  if (value.next !== null && (value.intents.length !== limit || value.next !== ids.at(-1))) conflict();
  for (const entry of value.intents) await item(entry, request.conversationId);
  return value;
}
async function decide(value, request, retained) {
  await proposal(retained, request.conversationId);
  if (retained.proposalId !== request.proposalId || retained.commandSha256 !== request.commandSha256 || !intentsMetadata.approvableActions.includes(retained.command.action)) conflict();
  if (value.deliveryId !== request.deliveryId || value.proposalId !== request.proposalId) conflict();
  const d = value.decision;
  decision(d, retained);
  if (d.decision !== request.decision || !same(d.approver, retained.requiredApprover) || parsed(d.decidedAt) < parsed(retained.createdAt)) conflict();
  if (value.status === "rejected" !== (request.decision === "rejected")) conflict();
  if (value.status === "executed") outcome(value.outcome, retained);
  return value;
}

// intents-application/intents-application-receiver.mjs
var requests = Object.freeze({ list: "IntentsListRequest", decide: "IntentsDecideRequest" });
var responses = Object.freeze({ list: "IntentsListResponse", decide: "IntentsDecideResponse" });
var expectationKeys = Object.freeze({ list: ["request"], decide: ["proposal", "request"] });
var selected = (table, route) => {
  if (typeof route !== "string" || !Object.hasOwn(table, route)) fail2("INTENTS_ROUTE");
  return table[route];
};
var check = (name, value) => {
  if (!validators[name](value)) fail2("INTENTS_SHAPE");
  return value;
};
var freeze2 = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze2);
    Object.freeze(value);
  }
  return value;
};
async function receiveIntentsRequest(route, jsonText) {
  const name = selected(requests, route), value = parseText(jsonText, intentsMetadata.limits.requestBytes);
  check(name, value);
  return freeze2(value);
}
async function receiveIntentsResponse(route, httpStatus, jsonText, expected) {
  const request = selected(requests, route), response = selected(responses, route);
  if (!Number.isInteger(httpStatus)) fail2("INTENTS_STATUS");
  const expectation = expectedData(expected, intentsMetadata.limits.responseBytes), keys = Object.keys(expectation ?? {}).sort();
  if (keys.length !== expectationKeys[route].length || keys.some((key, index) => key !== expectationKeys[route][index])) fail2("INTENTS_EXPECTATION");
  check(request, expectation.request);
  if (route === "decide") check("IntentsProposal", expectation.proposal);
  const value = parseText(jsonText, intentsMetadata.limits.responseBytes);
  if (httpStatus !== 200) {
    check("IntentsErrorResponse", value);
    if (intentsMetadata.errorStatuses[value.error.code] !== httpStatus || httpStatus === 502 && Object.hasOwn(value.error, "field")) fail2("INTENTS_STATUS");
    return freeze2(value);
  }
  check(response, value);
  return freeze2(route === "list" ? await list(value, expectation.request) : await decide(value, expectation.request, expectation.proposal));
}
export {
  IntentsResponseError,
  intentsMetadata,
  intentsPaths,
  intentsVersion,
  receiveIntentsRequest,
  receiveIntentsResponse
};
