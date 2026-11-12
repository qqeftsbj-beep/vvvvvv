import { describe, expect, it } from "vitest";
import {
  defaultWelcomeConfig,
  fromYemenInput,
  selectWelcomeTemplate,
  toYemenInput,
  welcomeConfigFrom,
  welcomeConfigSchema,
} from "../shared/welcomeSchedule";

const cloneConfig = () => structuredClone(defaultWelcomeConfig);
const template = (id: string, schedule: any, enabled = true) => ({
  ...cloneConfig().templates[0], id, name: id, enabled, schedule,
});
const utc = (day: number, hour: number, minute = 0, second = 0) =>
  Date.UTC(2026, 10, day, hour, minute, second);

describe("welcomeSchedule", () => {
  it("يحوّل يوم الجمعة في اليمن: يبدأ الخميس 21:00 UTC وينتهي الجمعة", () => {
    const config = { enabled: true, templates: [template("fri", { kind: "weekdays", days: [5], startTime: "00:00", endTime: "23:59" })] };
    expect(selectWelcomeTemplate(config, utc(12, 20, 59))).toBeNull();
    expect(selectWelcomeTemplate(config, utc(12, 21))).toBe(config.templates[0]);
    expect(selectWelcomeTemplate(config, utc(13, 20, 59, 59))).toBe(config.templates[0]);
    expect(selectWelcomeTemplate(config, utc(13, 21))).toBeNull();
  });

  it("يشمل نافذة الوقت اليومية الدقيقة النهائية ونطاق UTC حدّيه", () => {
    const daily = { enabled: true, templates: [template("daily", { kind: "weekdays", days: [5], startTime: "00:15", endTime: "00:30" })] };
    expect(selectWelcomeTemplate(daily, utc(12, 21, 15))).toBe(daily.templates[0]);
    expect(selectWelcomeTemplate(daily, utc(12, 21, 30))).toBe(daily.templates[0]);
    const start = utc(13, 10), end = utc(13, 11);
    const range = { enabled: true, templates: [template("range", { kind: "range", startAt: start, endAt: end })] };
    expect(selectWelcomeTemplate(range, start - 1)).toBeNull();
    expect(selectWelcomeTemplate(range, start)).toBe(range.templates[0]);
    expect(selectWelcomeTemplate(range, end)).toBe(range.templates[0]);
    expect(selectWelcomeTemplate(range, end + 1)).toBeNull();
  });

  it("يقدّم المجدول على always، ثم يختار أول مجدول حسب ترتيب المالك", () => {
    const config = {
      enabled: true,
      templates: [
        template("always", { kind: "always" }),
        template("first", { kind: "range", startAt: 0, endAt: Number.MAX_SAFE_INTEGER }),
        template("second", { kind: "range", startAt: 0, endAt: Number.MAX_SAFE_INTEGER }),
      ],
    };
    expect(selectWelcomeTemplate(config, utc(13, 10))?.id).toBe("first");
  });

  it("لا يعرض المعطل، ولا يعيد fallback عند عدم التطابق", () => {
    const config = { enabled: true, templates: [template("off", { kind: "always" }, false), template("none", { kind: "weekdays", days: [0], startTime: "00:00", endTime: "00:01" })] };
    expect(selectWelcomeTemplate({ ...config, enabled: false }, utc(13, 10))).toBeNull();
    expect(selectWelcomeTemplate(config, utc(13, 10))).toBeNull();
  });

  it("يرفض URL javascript، والنهاية قبل البداية، وغياب weekday", () => {
    const base = cloneConfig().templates[0];
    expect(welcomeConfigSchema.safeParse({ enabled: true, templates: [{ ...base, buttonUrl: "javascript:alert(1)" }] }).success).toBe(false);
    expect(welcomeConfigSchema.safeParse({ enabled: true, templates: [{ ...base, schedule: { kind: "range", startAt: 2, endAt: 1 } }] }).success).toBe(false);
    expect(welcomeConfigSchema.safeParse({ enabled: true, templates: [{ ...base, schedule: { kind: "weekdays", days: [], startTime: "00:00", endTime: "00:01" } }] }).success).toBe(false);
  });

  it("يحافظ على roundtrip لحقول datetime-local اليمنية، ويسقط الإعداد غير الصالح إلى نسخة افتراضية", () => {
    const value = Date.UTC(2026, 10, 13, 12, 34);
    expect(fromYemenInput(toYemenInput(value))).toBe(value);
    const result = welcomeConfigFrom(null);
    expect(result).toEqual(defaultWelcomeConfig);
  });
});
